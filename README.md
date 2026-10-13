# thisisnotawalk.com — 일,요사진이 걸어본 길

일로, 요이와 직접 걸어본 길만 올리는 반려견 산책 코스 지도.
지도에서 코스를 고르면 노면, 폭, 그늘, 붐비는 시간, 주차, 편의 정보와 사진을 담은 코스 페이지로 이어진다.

## 지금 상태

- 시안 버전이 올라가 있다. 코스 값은 기획서의 예시이고, 경로선도 예시로 그린 선이다.
- 바탕 지도는 OpenStreetMap 데이터로 그린 종이 지도다 (2026-10-13 데이터). 두 겹으로 그린다:
  전국(넓게 볼 때, 5~11줌 데이터) 위에 코스가 있는 지역만 자세한 지도(12~15줌 데이터)를 덮는다. 지금 자세한 지역은 고양·파주·김포.
- 내 위치 버튼이 있다. 위치는 브라우저 안에서만 쓰고 어디에도 보내거나 저장하지 않는다.
- 확인용 화면은 thisisnotawalk.com/new/ 에 따로 올린다 (Cloudflare 브랜치 미리보기가 꺼져 있어서). 첫 화면은 웅님 확인 뒤에 바꾼다.
- 공개 전까지 검색 노출을 막아 둔다 (`index.html`의 `<meta name="robots" content="noindex, nofollow">`). 공개할 때 지운다.

## 정해진 것

- 주소: thisisnotawalk.com (도메인은 호스팅케이알, 네임서버는 Cloudflare)
- 사이트: Cloudflare Workers(정적 파일) 무료 요금제. 원본은 이 저장소. 모두 웅님 계정.
- 광고 없음. 협찬은 직접 고른 곳만 받고 '광고'로 표시한다.
- 글은 일,요사진만 올린다. 제보는 인스타 DM(@sun.dayphoto)으로 받는다.
- 바탕 지도: OpenStreetMap에서 잘라 사이트와 함께 올린다. 전국은 넓게 보는 정도까지, 자세한 지도는 코스가 생기는 지역마다 늘린다. 지도에 '© OpenStreetMap'을 표시한다.
- 새로 생긴 건물·길은 정부 공개 데이터(국토교통부·행정안전부)로 채운다 (준비 중).
- 경로선은 답사 때 기록한 GPX로 그린다.
- 목표 속도: 휴대폰에서 첫 화면 2.5초 안 (PageSpeed Insights로 확인).
- 디자인: 종이색 #F5EFE7, 먹색, 본문 서체 Noto Serif KR. 사진 자리는 비워 두고 사진 배치는 웅님이 정한다.

## 구조

| 파일 | 내용 |
| --- | --- |
| `public/index.html` | 지도 화면 (시안). 코스 데이터와 화면 코드가 들어 있다. |
| `public/js/basemap.js` | 바탕 지도 색과 그리는 규칙 (밝은 화면·어두운 화면), 전국/자세한 지도 두 겹 |
| `public/js/tilesets.js` | 지역별 지도 조각 주소와 범위. `split.mjs`가 만든다. |
| `public/tiles/<지역>-<날짜>/` | 바탕 지도 조각 (gzip). `tools/basemap/split.mjs`가 만든다. 손으로 고치지 않는다. |
| `public/vendor/` | Leaflet 1.9.4, protomaps-leaflet 5.1.0 (사이트에서 직접 내려보낸다. 라이선스는 `LICENSES.txt`) |
| `public/_headers` | 지도 조각과 라이브러리는 브라우저에 1년 보관 (주소에 날짜·버전이 들어 있어서 안전하다) |
| `public/favicon.svg` | 탭 아이콘 |
| `wrangler.jsonc` | Cloudflare 배포 설정. `public/` 폴더만 사이트로 올라간다. |
| `tools/basemap/areas/*.env` | 지도 지역: `korea`(전국, 5~11줌), `gpg`(고양·파주·김포, 12~15줌). 코스가 생기는 지역마다 하나씩 더한다. |
| `tools/basemap/split.mjs` | 잘라 온 데이터를 사이트용 조각으로 나누는 도구 |
| `tools/gpx/clean.py` | 답사 GPX 정리 (멈춘 자리 흔들림 정리, 점 줄이기, 좌표만 남기기) |
| `data/*-info.txt` | 지역별로 잘라 온 지도 데이터 정보. 원본(`*.pmtiles`)은 저장소에 올리지 않는다. |
| `.github/workflows/basemap.yml` | 지역마다 지도 데이터를 잘라 조각까지 만들어 올리는 GitHub Actions 작업 |

사이트에 보일 파일은 반드시 `public/` 안에 둔다. 그 밖의 파일(README, 설정, 작업용 스크립트)은 사이트에 올라가지 않는다.

## 배포와 작업 순서

- `main` 브랜치에 올라간 내용이 Cloudflare Workers Builds를 거쳐 자동으로 배포된다 (thisisnotawalk.guide-htmltv.workers.dev, 도메인 연결 후 thisisnotawalk.com).
- 새 작업은 별도 브랜치에 올려 Cloudflare가 만들어 주는 미리보기 주소(preview URL)에서 먼저 확인하고, 웅님이 확인하면 `main`에 합친다.

## 바탕 지도 새로 받기

OpenStreetMap은 매일 바뀐다. 몇 달에 한 번, 또는 코스 근처 길이 바뀌었을 때 새로 받는다.

1. `tools/basemap/areas/`의 파일을 고치거나(지역 추가도 여기서) 주석만 바꿔서 `main`이 아닌 브랜치에 올린다.
2. GitHub Actions의 `basemap` 작업이 Protomaps 일일 빌드에서 지역마다 잘라, 조각(`public/tiles/`)과 `public/js/tilesets.js`까지 만들어 그 브랜치에 올려 준다 (10분 안팎).
3. 화면을 확인하고 합친다.

무료 요금제의 한도는 사이트 파일 2만 개, 파일 하나 25MB다. 지금 전국 약 2,100개 + 고양·파주·김포 약 4,100개. 자세한 지역 하나가 보통 3~5천 개라서, 지역이 서너 곳을 넘으면 저장 방식을 바꿔야 한다 (Cloudflare R2 등).

조각을 만들 때 지도에 그리지 않는 것(가게, 버스정류장, 주소, 주거지·공장 색, 군사시설 구역, 읍면동 경계)은 빼고 이름은 한국어 하나만 남긴다.

## 데이터 출처

- 바탕 지도: © OpenStreetMap contributors (ODbL), 타일 구성 [Protomaps Basemap](https://protomaps.com)
- 첫 시안의 약도(행정동 경계)는 통계청 SGIS 가공본 [vuski/admdongkor](https://github.com/vuski/admdongkor)를 썼으나 지금은 쓰지 않는다.

## 다음 작업 (2단계)

1. ~~바탕 지도를 OpenStreetMap 지역 데이터로 바꾸기~~ (osm-map 브랜치, 전국 + 고양·파주·김포 자세히, 내 위치 버튼)
1-1. 정부 공개 데이터로 새 건물·새 길 채우기 (파일 받는 곳 확인 중)
2. 코스마다 따로 주소가 있는 코스 페이지 만들기
3. 사진을 넣으면 화면 크기별 웹용 사진이 자동으로 만들어지게 하기
4. 휴대폰 확인과 속도 측정

진행 상황 체크리스트와 처음 시안은 claude.ai의 '걸어본 길 만들기', '일,요사진이 걸어본 길' 아티팩트에 있다.
