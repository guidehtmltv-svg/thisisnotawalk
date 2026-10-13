#!/usr/bin/env python3
"""
답사 GPX 정리: 멈춘 자리의 흔들림을 한 점으로 모으고, 튀는 점을 빼고,
가볍게 고른 다음 점 수를 줄인다. 사이트에는 결과의 좌표만 올린다
(심박·시간·기기 정보는 올리지 않는다).

쓰는 법:  python3 tools/gpx/clean.py 답사.gpx [결과.json]
결과 JSON: {"km", "minutes", "points": [[위도, 경도], ...], ...}
표준 라이브러리만 쓴다.
"""
import json
import math
import sys
import xml.etree.ElementTree as ET
from datetime import datetime

STOP_RADIUS_M = 6      # 이 반경 안에
STOP_MIN_S = 20        # 이만큼 머물면 '멈춤'으로 보고 한 점으로 모은다
SPIKE_MPS = 3.0        # 걷기에서 나올 수 없는 속도의 점은 뺀다
SMOOTH_HALF = 2        # 앞뒤 2점 평균으로 고른다
SIMPLIFY_M = 2.0       # 선 모양이 2m 넘게 변하지 않는 선에서 점을 줄인다


def read_gpx(path):
    root = ET.parse(path).getroot()
    pts = []
    for el in root.iter():
        if not el.tag.endswith('trkpt') and not el.tag.endswith('rtept'):
            continue
        t = None
        for c in el:
            if c.tag.endswith('time') and c.text:
                t = datetime.fromisoformat(c.text.strip().replace('Z', '+00:00')).timestamp()
        pts.append((float(el.get('lat')), float(el.get('lon')), t))
    if len(pts) < 2:
        raise SystemExit('GPX에서 경로 점을 찾지 못했습니다.')
    return pts


def douglas_peucker(xy, tol):
    keep = [False] * len(xy)
    keep[0] = keep[-1] = True
    stack = [(0, len(xy) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = xy[a], xy[b]
        dx, dy = bx - ax, by - ay
        seg = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = xy[i]
            if seg == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg))
                d = math.hypot(px - (ax + u * dx), py - (ay + u * dy))
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(xy, keep) if k]


def clean(pts):
    lat0 = sum(p[0] for p in pts) / len(pts)
    lon0 = sum(p[1] for p in pts) / len(pts)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    xy = [((p[1] - lon0) * kx, (p[0] - lat0) * ky) for p in pts]
    t = [p[2] for p in pts]
    has_time = all(v is not None for v in t)
    raw_m = sum(math.dist(xy[i], xy[i + 1]) for i in range(len(xy) - 1))

    # 1) 멈춘 자리 → 한 점
    out, stops, i = [], 0, 0
    while i < len(xy):
        j = i
        while j + 1 < len(xy) and math.dist(xy[i], xy[j + 1]) <= STOP_RADIUS_M:
            j += 1
        if has_time and t[j] - t[i] >= STOP_MIN_S:
            seg = xy[i:j + 1]
            out.append(((sum(p[0] for p in seg) / len(seg), sum(p[1] for p in seg) / len(seg)), t[i]))
            stops += 1
            i = j + 1
        else:
            out.append((xy[i], t[i]))
            i += 1
    # 2) 튀는 점 빼기
    kept = [out[0]]
    for p in out[1:]:
        q = kept[-1]
        if has_time and math.dist(p[0], q[0]) / max(1.0, p[1] - q[1]) > SPIKE_MPS:
            continue
        kept.append(p)
    xs = [p[0] for p in kept]
    # 3) 고르기
    sm = []
    for k in range(len(xs)):
        a, b = max(0, k - SMOOTH_HALF), min(len(xs), k + SMOOTH_HALF + 1)
        sm.append((sum(p[0] for p in xs[a:b]) / (b - a), sum(p[1] for p in xs[a:b]) / (b - a)))
    sm[0], sm[-1] = xs[0], xs[-1]
    # 4) 줄이기
    final = douglas_peucker(sm, SIMPLIFY_M)
    km = sum(math.dist(final[k], final[k + 1]) for k in range(len(final) - 1)) / 1000
    points = [[round(lat0 + y / ky, 6), round(lon0 + x / kx, 6)] for x, y in final]
    loop = math.dist(final[0], final[-1]) < 60
    return {
        'km': round(km, 2),
        'raw_km': round(raw_m / 1000, 2),
        'minutes': round((t[-1] - t[0]) / 60) if has_time else None,
        'stops': stops,
        'loop': loop,
        'raw_points': len(pts),
        'points': points,
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    res = clean(read_gpx(sys.argv[1]))
    print(f"{res['raw_points']}점 → {len(res['points'])}점, {res['raw_km']}km → {res['km']}km, "
          f"{res['minutes']}분, 멈춤 {res['stops']}번, {'한 바퀴' if res['loop'] else '편도'}")
    if len(sys.argv) > 2:
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False)
