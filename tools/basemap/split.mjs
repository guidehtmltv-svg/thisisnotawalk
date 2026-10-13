// 잘라 온 지도 데이터(data/<이름>.pmtiles)를 사이트용 지도 조각으로 나눈다.
//
// tools/basemap/areas/*.env 의 지역마다
//   data/<NAME>.pmtiles 의 MINZOOM~MAXZOOM 줌을 꺼내
//   public/tiles/<NAME>-<빌드날짜>/{z}/{x}/{y}.pbf 로 쓰고
// 마지막에 public/js/tilesets.js (지역별 조각 주소와 범위)를 만든다.
//
// 쓰는 법 (tools/basemap 폴더에서):  npm ci && node split.mjs        (--dry: 크기만 본다)
// 보통은 GitHub Actions의 basemap 작업이 대신 돌린다.
//
// 지도에 그리지 않는 것(가게·버스정류장·주소·주거지/공장 색, 군사시설 구역,
// 읍면동 경계, 국경선)은 빼고, 이름은 한국어 하나만 남겨 조각을 가볍게 만든다.
// 조각은 gzip으로 압축해 두고 브라우저에서 푼다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import vtpbf from 'vt-pbf';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dry = process.argv.includes('--dry');

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

class FileSource {
  constructor(file) { this.fd = fs.openSync(file, 'r'); this.key = file; }
  getKey() { return this.key; }
  async getBytes(offset, length) {
    const buf = Buffer.alloc(length);
    fs.readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

// ---- 남길 것 ----
const set = a => new Set(a);
const LANDUSE = set(['park', 'garden', 'playground', 'village_green', 'dog_park', 'recreation_ground',
  'wood', 'forest', 'nature_reserve', 'grass', 'grassland', 'meadow', 'scrub', 'wetland', 'farmland',
  'cemetery', 'golf_course', 'pitch', 'sand', 'beach', 'pedestrian', 'allotments', 'dam', 'pier']);
const PATHS = set(['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'track', 'bridleway']);
const RAIL = set(['rail', 'subway', 'light_rail', 'monorail', 'narrow_gauge']);
const PLACES = set(['city', 'town', 'village', 'quarter', 'neighbourhood', 'suburb', 'locality']);
const POIS = set(['park', 'peak', 'station', 'garden', 'nature_reserve', 'water', 'viewpoint', 'beach']);
const WATER_SKIP = set(['swimming_pool', 'fountain', 'ditch', 'drain', 'reef']);

const pick = (o, keys) => {
  const r = {};
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = o[k];
  return r;
};
const nameOf = pr => pr['name:ko'] || pr.name;

const RULES = {
  earth: f => ({ kind: f.properties.kind }),
  landuse: f => LANDUSE.has(f.properties.kind) ? { kind: f.properties.kind } : null,
  water: f => {
    const pr = f.properties;
    if (WATER_SKIP.has(pr.kind)) return null;
    const o = pick(pr, ['kind', 'kind_detail', 'min_zoom']);
    const n = nameOf(pr); if (n) o.name = n;
    return o;
  },
  roads: (f, z) => {
    const pr = f.properties, k = pr.kind, d = pr.kind_detail;
    let keep = false;
    if (k === 'highway' || k === 'major_road') keep = true;
    else if (k === 'minor_road') keep = d !== 'parking_aisle' && d !== 'raceway';
    else if (k === 'path') keep = PATHS.has(d);
    else if (k === 'other') keep = d === 'living_street';
    else if (k === 'rail') keep = RAIL.has(d);
    if (!keep) return null;
    const o = pick(pr, ['kind', 'kind_detail', 'is_link', 'is_bridge', 'is_tunnel']);
    const n = nameOf(pr);
    if (n && (k === 'highway' || k === 'major_road' || k === 'path' || k === 'rail' || z >= 14)) o.name = n;
    return o;
  },
  buildings: (f, z) => (z >= 14 && (f.properties.kind === 'building' || f.properties.kind === 'building_part')) ? {} : null,
  places: f => {
    const pr = f.properties;
    if (!PLACES.has(pr.kind_detail)) return null;
    const n = nameOf(pr); if (!n) return null;
    const o = pick(pr, ['kind', 'kind_detail', 'min_zoom', 'population_rank', 'sort_key']);
    o.name = n;
    return o;
  },
  pois: f => {
    const pr = f.properties;
    if (!POIS.has(pr.kind)) return null;
    const n = nameOf(pr); if (!n) return null;
    const o = pick(pr, ['kind', 'kind_detail', 'min_zoom', 'elevation']);
    o.name = n;
    return o;
  },
  // 4 도, 6 시·군·구, 7 일반구 (읍면동 경계와 국경선은 그리지 않는다)
  boundaries: f => [4, 6, 7].includes(f.properties.kind_detail) ? pick(f.properties, ['kind', 'kind_detail']) : null,
};

function slim(buf, z) {
  const vt = new VectorTile(new Pbf(buf));
  const layers = {};
  for (const [name, layer] of Object.entries(vt.layers)) {
    const rule = RULES[name];
    if (!rule) continue;
    const feats = [];
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const props = rule(f, z);
      if (!props) continue;
      feats.push({ id: f.id, type: f.type, properties: props, loadGeometry: () => f.loadGeometry() });
    }
    if (feats.length) layers[name] = { name, version: 2, extent: layer.extent, length: feats.length, feature: i => feats[i] };
  }
  return Object.keys(layers).length ? vtpbf.fromVectorTileJs({ layers }) : null;
}

const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };

const areaDir = path.join(here, 'areas');
const areas = fs.readdirSync(areaDir).filter(f => f.endsWith('.env')).sort().map(f => readEnv(path.join(areaDir, f)));
if (!dry) fs.rmSync(path.join(root, 'public', 'tiles'), { recursive: true, force: true });

const tilesets = {};
let allFiles = 0, allBytes = 0;
for (const a of areas) {
  const name = a.NAME, minZ = Number(a.MINZOOM), maxZ = Number(a.MAXZOOM);
  const src = path.join(root, 'data', `${name}.pmtiles`);
  const info = fs.readFileSync(path.join(root, 'data', `${name}-info.txt`), 'utf8');
  const build = (info.match(/^build: (\d{8})/m) || [])[1];
  if (!build) throw new Error(`data/${name}-info.txt 에서 빌드 날짜를 찾지 못했습니다`);
  const [w, s, e, n] = a.BBOX.split(',').map(Number);
  const dirName = `${name}-${build}`;
  const outDir = path.join(root, 'public', 'tiles', dirName);
  const p = new PMTiles(new FileSource(src));
  const meta = await p.getMetadata();
  const ranges = {};
  const stats = [];
  for (let z = minZ; z <= maxZ; z++) {
    const x0 = lon2x(w, z), x1 = lon2x(e, z), y0 = lat2y(n, z), y1 = lat2y(s, z);
    ranges[z] = [x0, y0, x1, y1];
    let cnt = 0, bytes = 0, max = 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const r = await p.getZxy(z, x, y);
      if (!r || !r.data || !r.data.byteLength) continue;
      const out = slim(new Uint8Array(r.data), z);
      if (!out) continue;
      const gz = zlib.gzipSync(out, { level: 9 });
      cnt++; bytes += gz.length; max = Math.max(max, gz.length);
      if (!dry) {
        const dir = path.join(outDir, String(z), String(x));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${y}.pbf`), gz);
      }
    }
    allFiles += cnt; allBytes += bytes;
    stats.push({ area: name, z, tiles: cnt, kb: Math.round(bytes / 1024), avgKb: cnt ? +(bytes / cnt / 1024).toFixed(1) : 0, maxKb: +(max / 1024).toFixed(1) });
  }
  console.table(stats);
  tilesets[name] = {
    url: `/tiles/${dirName}/{z}/{x}/{y}.pbf`, minzoom: minZ, maxzoom: maxZ, ranges,
    osm: (meta['planetiler:osm:osmosisreplicationtime'] || '').slice(0, 10), schema: meta.version,
  };
}
console.log(`모두 ${allFiles}개, ${(allBytes / 1048576).toFixed(1)} MB${dry ? ' (dry run)' : ''}`);
if (!dry) {
  const js = `/* tools/basemap/split.mjs 가 만든 파일. 손으로 고치지 않는다. */\nwindow.TILESETS=${JSON.stringify(tilesets)};\n`;
  fs.writeFileSync(path.join(root, 'public', 'js', 'tilesets.js'), js);
  console.log('public/js/tilesets.js 를 만들었습니다');
}
