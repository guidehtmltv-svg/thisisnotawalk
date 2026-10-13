# thisisnotawalk.com — 일,요사진이 걸어본 길

일로, 요이와 직접 걸어본 길만 올리는 반려견 산책 코스 지도.
지도에서 코스를 고르면 노면, 폭, 그늘, 붐비는 시간, 주차, 편의 정보와 사진을 담은 코스 페이지로 이어진다.

## 지금 상태

- 시안 버전이 올라가 있다. 코스 값은 기획서의 예시이고, 경로선도 예시로 그린 선이다.
- 공개 전까지 검색 노출을 막아 둔다 (`index.html`의 `<meta name="robots" content="noindex, nofollow">`). 공개할 때 지운다.

## 정해진 것

- 주소: thisisnotawalk.com (도메인은 호스팅케이알, 네임서버는 Cloudflare)
- 사이트: Cloudflare Pages 무료 요금제. 원본은 이 저장소. 모두 웅님 계정.
- 광고 없음. 협찬은 직접 고른 곳만 받고 '광고'로 표시한다.
- 글은 일,요사진만 올린다. 제보는 인스타 DM(@sun.dayphoto)으로 받는다.
- 바탕 지도: OpenStreetMap에서 고양·파주·김포만 잘라 사이트와 함께 올린다. 지도에 '© OpenStreetMap contributors'를 표시한다.
- 경로선은 답사 때 기록한 GPX로 그린다.
- 목표 속도: 휴대폰에서 첫 화면 2.5초 안 (PageSpeed Insights로 확인).
- 디자인: 종이색 #F5EFE7, 먹색, 본문 서체 Noto Serif KR. 사진 자리는 비워 두고 사진 배치는 웅님이 정한다.

## 구조

| 파일 | 내용 |
| --- | --- |
| `index.html` | 지도 화면 (시안). 약도는 행정동 경계와 한강으로 그렸다. |
| `favicon.svg` | 탭 아이콘 |

## 배포와 작업 순서

- `main` 브랜치에 올라간 내용이 Cloudflare Pages를 거쳐 thisisnotawalk.com에 자동으로 반영된다.
- 새 작업은 별도 브랜치에 올려 Cloudflare의 미리보기 주소에서 먼저 확인하고, 웅님이 확인하면 `main`에 합친다.

## 데이터 출처

- 행정동 경계: 통계청 SGIS(공공누리 제1유형), 가공본 [vuski/admdongkor](https://github.com/vuski/admdongkor) (CC BY 4.0)
- 한강 폭은 시·구 경계선을 따라 어림해 그렸다.
- 앞으로 쓸 바탕 지도: © OpenStreetMap contributors (ODbL)

## 다음 작업 (2단계)

1. 바탕 지도를 OpenStreetMap 지역 데이터로 바꾸기
2. 코스마다 따로 주소가 있는 코스 페이지 만들기
3. 사진을 넣으면 화면 크기별 웹용 사진이 자동으로 만들어지게 하기
4. 휴대폰 확인과 속도 측정

진행 상황 체크리스트와 처음 시안은 claude.ai의 '걸어본 길 만들기', '일,요사진이 걸어본 길' 아티팩트에 있다.
