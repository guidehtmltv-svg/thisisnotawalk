# thisisnotawalk.com — 일,요사진이 걸어본 길

일로, 요이와 직접 걸어본 길만 올리는 반려견 산책 코스 지도.
지도에서 코스를 고르면 노면, 폭, 그늘, 붐비는 시간, 주차, 편의 정보와 사진을 담은 코스 페이지로 이어진다.

## 지금 상태

- 시안 버전이 올라가 있다. 코스 값은 기획서의 예시이고, 경로선도 예시로 그린 선이다.
- 바탕 지도는 OpenStreetMap 데이터로 그린 종이 지도다 (2026-10-13 데이터). 고양·파주·김포 밖은 종이를 한 겹 덮어 흐리게 보인다.
- 공개 전까지 검색 노출을 막아 둔다 (`index.html`의 `<meta name="robots" content="noindex, nofollow">`). 공개할 때 지운다.

## 정해진 것

- 주소: thisisnotawalk.com (도메인은 호스팅케이알, 네임서버는 Cloudflare)
- 사이트: Cloudflare Workers(정적 파일) 무료 요금제. 원본은 이 저장소. 모두 웅님 계정.
- 광고 없음. 협찬은 직접 고른 곳만 받고 '광고'로 표시한다.
- 글은 일,요사진만 올린다. 제보는 인스타 DM(@sun.dayphoto)으로 받는다.
- 바탕 지도: OpenStreetMap에서 고양·파주·김포만 잘라 사이트와 함께 올린다. 지도에 '© OpenStreetMap contributors'를 표시한다.
- 경로선은 답사 때 기록한 GPX로 그린다.
- 목표 속도: 휴대폰에서 첫 화면 2.5초 안 (PageSpeed Insights로 확인).
- 디자인: 종이색 #F5EFE7, 먹색, 본문 서체 Noto Serif KR. 사진 자리는 비워 두고 사진 배치는 웅님이 정한다.

## 구조

| 파일 | 내용 |
| --- | --- |
| `public/index.html` | 지도 화면 (시안). 코스 데이터와 화면 코드가 들어 있다. |
| `public/js/basemap.js` | 바탕 지도 색과 그리는 규칙 (밝은 화면·어두운 화면) |
| `public/tiles/<날짜>/` | 바탕 지도 조각 (9~15줌, gzip). `tools/basemap/split.mjs`가 만든다. 손으로 고치지 않는다. |
| `public/vendor/` | Leaflet 1.9.4, protomaps-leaflet 5.1.0 (사이트에서 직접 내려보낸다. 라이선스는 `LICENSES.txt`) |
| `public/_headers` | 지도 조각과 라이브러리는 브라우저에 1년 보관 (주소에 날짜·버전이 들어 있어서 안전하다) |
| `public/favicon.svg` | 탭 아이콘 |
| `wrangler.jsonc` | Cloudflare 배포 설정. `public/` 폴더만 사이트로 올라간다. |
| `tools/basemap/` | 지도 범위(`area.env`)와 조각 만드는 도구(`split.mjs`) |
| `data/` | 잘라 온 원본 지도 데이터(`basemap.pmtiles`)와 정보. 사이트에 올라가지 않는다. |
| `.github/workflows/basemap.yml` | 원본 지도 데이터를 잘라 오는 GitHub Actions 작업 |

사이트에 보일 파일은 반드시 `public/` 안에 둔다. 그 밖의 파일(README, 설정, 작업용 스크립트)은 사이트에 올라가지 않는다.

## 배포와 작업 순서

- `main` 브랜치에 올라간 내용이 Cloudflare Workers Builds를 거쳐 자동으로 배포된다 (thisisnotawalk.guide-htmltv.workers.dev, 도메인 연결 후 thisisnotawalk.com).
- 새 작업은 별도 브랜치에 올려 Cloudflare가 만들어 주는 미리보기 주소(preview URL)에서 먼저 확인하고, 웅님이 확인하면 `main`에 합친다.

## 바탕 지도 새로 받기

OpenStreetMap은 매일 바뀐다. 몇 달에 한 번, 또는 코스 근처 길이 바뀌었을 때 새로 받는다.

1. `tools/basemap/area.env`의 범위를 고치거나 날짜 주석만 바꿔서 `main`이 아닌 브랜치에 올린다. GitHub Actions의 `basemap` 작업이 Protomaps 일일 빌드에서 범위만 잘라 `data/basemap.pmtiles`로 올려 준다 (몇 분).
2. `tools/basemap`에서 `npm install` 후 `node split.mjs`. 옛 조각을 지우고 `public/tiles/<새 날짜>/`를 만들고 `public/js/basemap.js`의 타일 주소를 고친다.
3. 화면을 확인하고 올린다. `main`에 합칠 때 `data/basemap.pmtiles`(약 38MB)는 빼고 합친다.

조각을 만들 때 지도에 그리지 않는 것(가게, 버스정류장, 주소, 주거지·공장 색, 군사시설 구역, 읍면동 경계)은 빼고 이름은 한국어 하나만 남긴다.

## 데이터 출처

- 바탕 지도: © OpenStreetMap contributors (ODbL), 타일 구성 [Protomaps Basemap](https://protomaps.com)
- 고양·파주·김포 테두리, 시·구 이름 자리: 통계청 SGIS(공공누리 제1유형), 가공본 [vuski/admdongkor](https://github.com/vuski/admdongkor) (CC BY 4.0)

## 다음 작업 (2단계)

1. ~~바탕 지도를 OpenStreetMap 지역 데이터로 바꾸기~~ (osm-map 브랜치)
2. 코스마다 따로 주소가 있는 코스 페이지 만들기
3. 사진을 넣으면 화면 크기별 웹용 사진이 자동으로 만들어지게 하기
4. 휴대폰 확인과 속도 측정

진행 상황 체크리스트와 처음 시안은 claude.ai의 '걸어본 길 만들기', '일,요사진이 걸어본 길' 아티팩트에 있다.
