// data/basemap.pmtiles → public/tiles/<빌드날짜>/{z}/{x}/{y}.pbf
//
// 쓰는 법 (tools/basemap 폴더에서):
//   npm install
//   node split.mjs            # 9~15줌을 꺼내고 public/js/basemap.js 의 타일 설정을 고친다
//   node split.mjs --dry      # 파일은 쓰지 않고 크기만 본다
//
// 지도에 그리지 않는 것(가게·버스정류장·주소·주거지 색 같은 것)은 빼고,
// 이름은 한국어 이름 하나만 남겨 조각을 가볍게 만든다. 군사시설 구역은 넣지 않는다.
// 조각은 gzip으로 압축된 그대로 저장하고, 브라우저에서 풀어 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import vtpbf from 'vt-pbf';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dry = process.argv.includes('--dry');
const MIN_Z = 9, MAX_Z = 15;
const src = path.join(root, 'data', 'basemap.pmtiles');
const info = fs.readFileSync(path.join(root, 'data', 'basemap-info.txt'), 'utf8');
const build = (info.match(/^build: (\d{8})/m) || [])[1];
if (!build) throw new Error('data/basemap-info.txt 에서 빌드 날짜를 찾지 못했습니다');
const outDir = path.join(root, 'public', 'tiles', build);
const urlTemplate = `/tiles/${build}/{z}/{x}/{y}.pbf`;

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
const POIS = set(['park', 'peak', 'station', 'garden', 'nature_reserve', 'water', 'viewpoint']);
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

const p = new PMTiles(new FileSource(src));
const h = await p.getHeader();
const meta = await p.getMetadata();
if (!dry) {
  fs.rmSync(path.join(root, 'public', 'tiles'), { recursive: true, force: true });
}
const ranges = {};
let files = 0, bytes = 0;
const stats = [];
for (let z = MIN_Z; z <= MAX_Z; z++) {
  const x0 = lon2x(h.minLon, z), x1 = lon2x(h.maxLon, z);
  const y0 = lat2y(h.maxLat, z), y1 = lat2y(h.minLat, z);
  ranges[z] = [x0, y0, x1, y1];
  let n = 0, b = 0, max = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const r = await p.getZxy(z, x, y);
    if (!r || !r.data || !r.data.byteLength) continue;
    const out = slim(new Uint8Array(r.data), z);
    if (!out) continue;
    const gz = zlib.gzipSync(out, { level: 9 });
    n++; b += gz.length; max = Math.max(max, gz.length);
    if (!dry) {
      const dir = path.join(outDir, String(z), String(x));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${y}.pbf`), gz);
    }
  }
  files += n; bytes += b;
  stats.push({ z, tiles: n, kb: Math.round(b / 1024), avgKb: n ? +(b / n / 1024).toFixed(1) : 0, maxKb: +(max / 1024).toFixed(1) });
}
console.table(stats);
console.log(`${files} files, ${(bytes / 1048576).toFixed(1)} MB → ${dry ? '(dry run)' : path.relative(root, outDir)}`);

const tileset = {
  url: urlTemplate, minzoom: MIN_Z, maxzoom: MAX_Z, ranges,
  osm: (meta['planetiler:osm:osmosisreplicationtime'] || '').slice(0, 10), schema: meta.version,
};
if (!dry) {
  const js = path.join(root, 'public', 'js', 'basemap.js');
  const text = fs.readFileSync(js, 'utf8');
  const re = /\/\*TILESET\*\/[\s\S]*?\/\*\/TILESET\*\//;
  if (!re.test(text)) throw new Error('basemap.js 에 /*TILESET*/ 표시가 없습니다');
  fs.writeFileSync(js, text.replace(re, `/*TILESET*/${JSON.stringify(tileset)}/*/TILESET*/`));
  console.log('public/js/basemap.js 타일 설정을 고쳤습니다:', JSON.stringify(tileset));
}
