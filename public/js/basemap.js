/*
 * 일,요사진이 걸어본 길 — 종이 지도 바탕
 * 지도 데이터 © OpenStreetMap contributors (ODbL), 타일 구성 Protomaps Basemap.
 * 지도 조각은 이 사이트의 /tiles/ 에서 직접 내려보낸다 (tools/basemap/split.mjs 가 만든다).
 *
 * 두 겹으로 그린다.
 *   전국(korea): 5~11줌 데이터. 넓게 볼 때, 그리고 자세한 지도가 없는 곳에서 확대할 때.
 *   자세히(gpg 등): 12~15줌 데이터. 코스가 있는 지역만. 있는 곳에서는 전국 지도를 덮는다.
 * 쓰는 법: const layer = makeBasemap({ pane: 'basePane' }).addTo(map);   (layerGroup을 돌려준다)
 */
(function () {
  'use strict';
  var P = window.protomapsL;
  var SETS = window.TILESETS;
  if (!P || !window.L || !SETS || !SETS.korea) return;

  /* ---------- 지도 조각 읽기: 범위 밖은 요청하지 않고, gzip은 브라우저에서 푼다 ---------- */
  function inRange(set, z, x, y) {
    var r = set.ranges[z];
    return !!r && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  }
  function gunzip(buf) {
    var b = new Uint8Array(buf);
    if (b.length < 2 || b[0] !== 0x1f || b[1] !== 0x8b) return Promise.resolve(buf); // 이미 풀려 있음
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('DecompressionStream 없음'));
    var stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  function load(set, z, x, y, signal) {
    var url = set.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    return fetch(url, { signal: signal }).then(function (res) {
      if (!res.ok) return undefined;
      return res.arrayBuffer().then(gunzip).then(function (data) { return { data: data }; });
    });
  }
  var nationalSource = {
    getZxy: function (z, x, y, signal) {
      return inRange(SETS.korea, z, x, y) ? load(SETS.korea, z, x, y, signal) : Promise.resolve(undefined);
    }
  };
  var detailSets = Object.keys(SETS).filter(function (k) { return k !== 'korea'; }).map(function (k) { return SETS[k]; });
  var detailSource = {
    getZxy: function (z, x, y, signal) {
      for (var i = 0; i < detailSets.length; i++) {
        if (inRange(detailSets[i], z, x, y)) return load(detailSets[i], z, x, y, signal);
      }
      return Promise.resolve(undefined);
    }
  };
  var DETAIL_MIN = Math.min.apply(null, detailSets.map(function (s) { return s.minzoom; }).concat([99]));

  /* ---------- 색 ---------- */
  var LIGHT = {
    paper: '#F5EFE7', farm: '#F1EBE0', grass: '#EAE8D9', park: '#E6E6D4', wood: '#DFE1CD', wet: '#E4E6DA',
    sand: '#EEE6D5', plaza: '#EEE7DD', building: '#E7DFD3', buildingLine: '#DDD3C5',
    water: '#D8DCDA', waterLine: '#C6CDCB',
    minor: '#DED5C8', major: '#CFC5B6', trunk: '#BFB3A2', highway: '#AFA290', rail: '#A79E92', path: '#9F9689',
    boundary: '#A39B8F', label: '#625C53', city: '#3F3A34', labelSoft: '#8F877B', green: '#6B6F57', waterLabel: '#6F7A78', halo: '#F5EFE7'
  };
  var DARK = {
    paper: '#1D1C1A', farm: '#201F1C', grass: '#21231F', park: '#222620', wood: '#232821', wet: '#212522',
    sand: '#252320', plaza: '#22211F', building: '#272522', buildingLine: '#2E2B27',
    water: '#2A2E30', waterLine: '#34393B',
    minor: '#35322D', major: '#45403A', trunk: '#565049', highway: '#676057', rail: '#625C53', path: '#746D62',
    boundary: '#5E584F', label: '#ADA59A', city: '#D6CFC4', labelSoft: '#8A8378', green: '#8E947A', waterLabel: '#87918F', halo: '#1D1C1A'
  };

  var SERIF = '"Noto Serif KR","Noto Serif CJK KR","Nanum Myeongjo","AppleMyungjo","Batang",serif';
  var font = function (size, weight) { return (weight || 400) + ' ' + size + 'px ' + SERIF; };
  var exp = P.exp;
  var kind = function (f) { return f.props.kind; };
  var detail = function (f) { return f.props.kind_detail; };
  var isIn = function (list) { var s = {}; list.forEach(function (k) { s[k] = 1; }); return function (v) { return !!s[v]; }; };

  var GREEN_PARK = isIn(['park', 'garden', 'playground', 'village_green', 'dog_park', 'recreation_ground', 'allotments']);
  var GREEN_WILD = isIn(['wood', 'forest', 'nature_reserve', 'scrub']);
  var GREEN_OPEN = isIn(['grass', 'grassland', 'meadow', 'pitch', 'golf_course', 'cemetery']);
  var PATHS = isIn(['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'track', 'bridleway']);
  var TRUNK = isIn(['trunk', 'primary']);

  function paintRules(c) {
    var poly = function (layer, fill, filter, extra) {
      var o = { dataLayer: layer, symbolizer: new P.PolygonSymbolizer(Object.assign({ fill: fill }, extra && extra.sym)), filter: filter };
      if (extra && extra.minzoom) o.minzoom = extra.minzoom;
      return o;
    };
    var line = function (layer, opts, filter, minzoom, maxzoom) {
      var o = { dataLayer: layer, symbolizer: new P.LineSymbolizer(Object.assign({ lineCap: 'round', lineJoin: 'round' }, opts)), filter: filter };
      if (minzoom) o.minzoom = minzoom;
      if (maxzoom) o.maxzoom = maxzoom;
      return o;
    };
    return [
      poly('earth', c.paper),
      poly('landuse', c.farm, function (z, f) { return kind(f) === 'farmland'; }, { minzoom: 12 }),
      poly('landuse', c.wet, function (z, f) { return kind(f) === 'wetland'; }),
      poly('landuse', c.sand, function (z, f) { return kind(f) === 'sand' || kind(f) === 'beach'; }),
      poly('landuse', c.grass, function (z, f) { return GREEN_OPEN(kind(f)); }),
      poly('landuse', c.wood, function (z, f) { return GREEN_WILD(kind(f)); }),
      poly('landuse', c.park, function (z, f) { return GREEN_PARK(kind(f)); }),
      poly('landuse', c.plaza, function (z, f) { return kind(f) === 'pedestrian' || kind(f) === 'pier' || kind(f) === 'dam'; }, { minzoom: 14 }),
      poly('water', c.water, function (z, f) { return f.geomType === 3; }),
      line('water', { color: c.waterLine, width: exp(1.5, [[11, 0.5], [14, 1.2], [16, 2.4]]) }, function (z, f) {
        return f.geomType === 2 && (kind(f) === 'river' || kind(f) === 'canal');
      }, 11),
      line('water', { color: c.waterLine, width: exp(1.5, [[13, 0.5], [16, 1.4]]) }, function (z, f) {
        return f.geomType === 2 && kind(f) === 'stream';
      }, 13),
      poly('buildings', c.building, null, { minzoom: 15, sym: { stroke: c.buildingLine, width: 0.5 } }),
      // 길: 가는 길 → 큰 길 순서로 쌓는다
      line('roads', { color: c.minor, width: exp(1.6, [[14, 0.5], [16, 1.6]]) }, function (z, f) {
        return kind(f) === 'other' || (kind(f) === 'minor_road' && detail(f) === 'service');
      }, 14),
      line('roads', { color: c.minor, width: exp(1.6, [[13, 0.5], [14, 0.9], [16, 2.6]]) }, function (z, f) {
        return kind(f) === 'minor_road' && detail(f) !== 'service';
      }, 13),
      line('roads', { color: c.path, width: exp(1.4, [[14, 0.7], [16, 1.1]]), dash: [2, 2.2], opacity: 0.9 }, function (z, f) {
        return kind(f) === 'path' && PATHS(detail(f)) && !f.props.is_tunnel;
      }, 14),
      line('roads', { color: c.major, width: exp(1.6, [[11, 0.4], [12, 0.7], [14, 1.6], [16, 3.6]]) }, function (z, f) {
        return kind(f) === 'major_road' && !TRUNK(detail(f));
      }, 11),
      line('roads', { color: c.trunk, width: exp(1.6, [[8, 0.3], [10, 0.5], [12, 1], [14, 2], [16, 4.2]]) }, function (z, f) {
        return kind(f) === 'major_road' && TRUNK(detail(f));
      }, 8),
      line('roads', { color: c.highway, width: exp(1.6, [[6, 0.4], [8, 0.6], [10, 0.8], [12, 1.3], [14, 2.6], [16, 5]]) }, function (z, f) {
        return kind(f) === 'highway';
      }, 6),
      line('roads', { color: c.rail, width: exp(1.4, [[11, 0.6], [16, 1.2]]), dash: [3, 2], opacity: 0.85 }, function (z, f) {
        return kind(f) === 'rail' && !f.props.is_tunnel;
      }, 11),
      // 경계: 멀리서는 도(4), 가까이서는 시·군·구(6), 일반구(7)
      line('boundaries', { color: c.boundary, width: 0.8, dash: [4, 3], opacity: 0.55 }, function (z, f) {
        var d = detail(f);
        if (d === 4) return z <= 10;
        if (d === 6) return z >= 9 && z <= 12;
        return d === 7 && z === 12;
      })
    ];
  }

  function labelRules(c) {
    var text = function (o) { return new P.CenteredTextSymbolizer(Object.assign({ labelProps: ['name'], stroke: c.halo, width: 2.2, lineHeight: 1.3 }, o)); };
    var rank = function (f) { return f.props.population_rank || 0; };
    return [
      { // 도시 이름 (멀리서는 큰 도시만)
        dataLayer: 'places',
        symbolizer: text({
          fill: c.city,
          font: function (z, f) { var big = f && rank(f) >= 12; return font(z <= 8 ? (big ? 13 : 12) : (big ? 15 : 13), 500); },
          letterSpacing: 2
        }),
        filter: function (z, f) {
          if (detail(f) !== 'city') return false;
          if (z <= 7) return rank(f) >= 12;
          if (z <= 9) return rank(f) >= 9;
          return z <= 12;
        },
        sort: function (a, b) { return (b.population_rank || 0) - (a.population_rank || 0); }
      },
      { // 읍·면 이름
        dataLayer: 'places', minzoom: 11, maxzoom: 12,
        symbolizer: text({ fill: c.label, font: font(12), letterSpacing: 1 }),
        filter: function (z, f) { return detail(f) === 'town'; }
      },
      { // 산 이름
        dataLayer: 'pois', minzoom: 12,
        symbolizer: text({ fill: c.label, font: function (z) { return font(z >= 14 ? 12 : 11, 500); }, letterSpacing: 0.5 }),
        filter: function (z, f) { return kind(f) === 'peak'; }
      },
      { // 호수·강 이름 (한강은 페이지에서 따로 쓴다)
        dataLayer: 'water', minzoom: 13,
        symbolizer: text({ fill: c.waterLabel, font: function (z) { return font(z >= 15 ? 13 : 12); }, letterSpacing: 2 }),
        filter: function (z, f) { return f.geomType === 1 && !!f.props.name && f.props.name !== '한강'; }
      },
      { // 공원·해변 이름
        dataLayer: 'pois', minzoom: 14,
        symbolizer: text({ fill: c.green, font: function (z) { return font(z >= 16 ? 12 : 11); } }),
        filter: function (z, f) { var k = kind(f); return k === 'park' || k === 'garden' || k === 'nature_reserve' || k === 'beach'; }
      },
      { // 동 이름
        dataLayer: 'places', minzoom: 13,
        symbolizer: text({ fill: c.labelSoft, font: function (z) { return font(z >= 15 ? 12 : 11); }, letterSpacing: 1 }),
        filter: function (z, f) { var d = detail(f); return d === 'quarter' || d === 'neighbourhood' || d === 'suburb' || d === 'town'; }
      },
      { // 리·마을 이름
        dataLayer: 'places', minzoom: 14,
        symbolizer: text({ fill: c.labelSoft, font: font(11) }),
        filter: function (z, f) { var d = detail(f); return d === 'village' || d === 'locality'; }
      },
      { // 역 이름
        dataLayer: 'pois', minzoom: 15,
        symbolizer: text({ fill: c.labelSoft, font: font(11) }),
        filter: function (z, f) { return kind(f) === 'station'; }
      },
      { // 큰 길 이름
        dataLayer: 'roads', minzoom: 15,
        symbolizer: new P.LineLabelSymbolizer({ labelProps: ['name'], fill: c.labelSoft, stroke: c.halo, width: 2, font: font(11) }),
        filter: function (z, f) { return kind(f) === 'major_road' || kind(f) === 'highway'; }
      },
      { // 산책로 이름
        dataLayer: 'roads', minzoom: 16,
        symbolizer: new P.LineLabelSymbolizer({ labelProps: ['name'], fill: c.labelSoft, stroke: c.halo, width: 2, font: font(10) }),
        filter: function (z, f) { return kind(f) === 'path'; }
      }
    ];
  }

  var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(darkMQ && darkMQ.matches);
  }

  window.makeBasemap = function (opts) {
    opts = opts || {};
    var c = isDark() ? DARK : LIGHT;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var common = {
      paintRules: paintRules(c),
      labelRules: labelRules(c),
      devicePixelRatio: dpr,
      pane: opts.pane || 'tilePane'
    };
    var national = P.leafletLayer(Object.assign({}, common, {
      url: nationalSource,
      maxDataZoom: SETS.korea.maxzoom,
      backgroundColor: c.paper,
      className: 'basemap',
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'
    }));
    var layers = [national];
    if (detailSets.length) {
      // 자세한 지도가 있는 곳만 그리고 나머지는 비워 둔다 (배경색 없음) → 아래 전국 지도가 보인다
      layers.push(P.leafletLayer(Object.assign({}, common, {
        paintRules: paintRules(c),
        labelRules: labelRules(c),
        url: detailSource,
        maxDataZoom: 15,
        minZoom: DETAIL_MIN + 1,
        className: 'basemap-detail',
        attribution: ''
      })));
    }
    return L.layerGroup(layers);
  };
  window.makeBasemap.isDark = isDark;
  window.makeBasemap.onThemeChange = function (fn) {
    if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', fn);
  };
  window.makeBasemap.tilesets = SETS;
})();
