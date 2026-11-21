# 관리자 전면 리뉴얼 — 작업 인계 문서 (2026-11-21)

Claude Code가 이 문서 하나로 관리자 리뉴얼을 이어서 진행할 수 있게 지금까지의 결정·현황·다음 작업을 정리한다.
규칙의 정본은 `CLAUDE.md` 5.0절과 `docs/admin-design-system.md`, 화면 목록은 `docs/admin-screen-inventory.md`, 화면별 전환율은 `docs/admin-design-adoption.md`이다. 이 문서와 정본이 다르면 정본을 따르고 이 문서를 고친다.

---

## 1. 목표 (오너 결정)

- `/admin`의 **모든 관리자 화면**을 사용하기 편하게 전면 리뉴얼한다(범위: Full — 일부 화면만 하는 Lite가 아님).
- 같은 레이아웃에 색만 바꾸는 것이 아니라 **레이아웃·UX까지 실제로 다시 설계**한다.
- 디자인 시스템은 **Montage**(원티드, `@montage-ui/core`·`@montage-ui/icon` 4.3.2, MIT). 관리자에만 쓰고 고객 사이트는 기존 색(민트 `#27AB8F` + 네이비 `#0A1F2E`)을 유지한다.
- 브랜드 색은 **배민 민트**(2026-11-21): 채움 `#0CEFD3`, 글자 `#222222`, 패널(작업 바탕) `#F6F6F6`.
- 디자인은 Figma 없이 Claude가 직접 만든다. 시안은 "보고 결정하는 용도"이며, 시안 HTML을 그대로 붙여 넣지 않고 **실제 부품으로 다시 짠다**.

## 2. 왜 지금까지 규칙이 안 지켜졌나 (진단)

오너가 겪은 문제: "4~5개 템플릿을 만들어 전체에 적용하려 해도 모든 화면이 바뀌지 않고 규칙을 지키지 않는다."

원인(2026-11-21 레포 점검):
1. **규칙을 강제하는 장치가 없었다.** 문서(`admin-design-system.md`)와 토큰(`--adm-*`)은 잘 정리돼 있었지만, ESLint에는 디자인 규칙이 하나도 없었고 그 ESLint마저 기존 오류 1,157개라 CI에서 돌지 않는다.
2. **부품을 바꿔 끼우지 않고 CSS로 덮었다.** 옛 마크업 위에 `admin-console.css` → `admin-shell-v3.css` → `admin-montage.css` → `admin-mobile.css` → 화면별 CSS가 겹겹이 쌓였고 `!important`가 200곳이 넘는다. 화면마다 결과가 달라질 수밖에 없다.
3. **Montage 부품을 실제로 쓰는 파일은 관리자 TSX 64개 중 3개뿐**이다(대시보드, 통합 예약 목록 일부, Provider).
4. 견적 도구 9개는 React가 아닌 정적 HTML(iframe)이라 같은 부품을 쓸 수 없다.

큰 플랫폼들의 방식(Shopify Polaris, Atlassian, GitHub Primer, 원티드 Montage): 디자인 시스템을 **코드 부품 라이브러리**로 운영하고, 린트·테스트로 생 요소와 직접 적은 값을 막고, 화면별 전환율을 숫자로 추적하며, 한 화면씩 바꾼다.

## 3. 이미 끝난 작업 — PR #119

https://github.com/MONGPASS/INHASU/pull/119 (브랜치 `feature/admin-baemin-mint-guardrails`, CI·Cloudflare 미리보기 성공, 머지 대기)
미리보기: https://feature-admin-baemin-mint-gu.inhasu.pages.dev/admin

1. **배민 민트 토큰** (`public/admin-tokens.css`, `src/styles/admin-montage-brand.css`)
   - `--adm-accent #0CEFD3` / `-hover #0BDFC5` / `-strong #06796B`(민트 글자, 흰 바탕 5.3:1·#F6F6F6 4.9:1) / `-deep #056B5E` / `-soft #0CEFD31A` / `-line #0CEFD38C`, `--adm-accent-rgb 12, 239, 211`
   - `--adm-text`·`--adm-ink #222222`, `--adm-canvas`·`--adm-gray-50 #F6F6F6`, `--adm-ring 0 0 0 3px #0CEFD340`, `--adm-info #06796B`
   - **새 토큰 `--adm-on-primary #222222`**: 민트 채움 위 글자·아이콘. `#0CEFD3` 위 흰 글자는 대비 1.47:1이라 금지(검은 글자는 10.8:1).
   - Montage `Button`(solid·primary)은 글자를 static white로 그리므로 `className="adm-on-primary"`를 준다(`admin-montage-brand.css`의 규칙).
2. **일괄 수정**: 민트 채움 위 흰 글자 → `--adm-on-primary`(CSS 120곳, 견적 도구 인라인 5곳, TSX 4곳). 민트를 글자색으로 쓴 64곳 → `--adm-accent-strong`. 관리자 TSX의 옛 민트 hex(`#06C4A0`, `#029F85`, `rgba(6,196,160,…)`) → 변수. 견적 도구 스파크라인 → `#06796B`. `quote-spot-selector.css`의 `--p` 등 → 변수.
3. **점검 스크립트** `scripts/check-admin-design.mjs`
   - 화면별(인벤토리 기준 묶음) Montage 전환율 = Montage 부품 ÷ (Montage + 생 `<button>`·`<input>`·`<select>`·`<textarea>`·`<table>`). `adm-` 클래스 버튼은 공통 부품으로 센다.
   - 인라인 `style={{}}`, 숫자 크기(TSX·CSS), 직접 색(hex), `!important`, 기본 확인창도 센다.
   - `--md` → `docs/admin-design-adoption.md`, `--write-baseline` → `scripts/admin-design-baseline.json`.
4. **기준선(ratchet) 테스트** `tests/admin-design-budget.test.mjs` — CI(`validate.yml`의 `node --test tests/*.test.mjs`)에서 PR마다 돈다.
   - 기존 파일: 위 수치가 기준선보다 늘면 실패.
   - **새 파일: 생 부품·숫자 크기·직접 색·`!important`·기본 확인창 0**이어야 통과.
   - 기준선이 현재보다 느슨해도 실패 → 줄였으면 반드시 `node scripts/check-admin-design.mjs --write-baseline --md` 실행.
5. **민트 대비 테스트** (`tests/admin-design-tokens.test.mjs`): 민트 채움(별칭 포함) 블록에 흰 글자가 있으면 실패, solid primary Montage `Button`에 `adm-on-primary`가 없으면 실패.
6. 문서: `CLAUDE.md` 5.0절, `docs/admin-design-system.md` 1절(M-14)·2절 토큰 표 갱신.
7. 검증: `npm test` 897개 통과, `tsc` 통과, `npm run build` 통과. 로컬 합성 관리자 23개 화면을 Playwright로 계산 색 검사 → 민트 관련 대비 3:1 미만 0건.

## 4. 현재 수치 (2026-11-21, `docs/admin-design-adoption.md`)

| 화면 | Montage 전환율 | 생 HTML 부품 | 인라인 style |
|---|---:|---:|---:|
| 대시보드 | 81% | 4 | 10 |
| 통합 예약 목록 | 53% (2단계 후) | 78 (고객 상세 부분) | 154 |
| 고객 예약 상세(상품·이전 견적) | 0% | 126 | 204 |
| 상품 목록·추가·수정 | 0% | 162 | 210 |
| 숙소 배정·현지 운영 | 0% | 85 | 7 |
| 가이드 배정 현황 | 0% | 44 | 23 |
| 그 밖의 목록 화면(카테고리·템플릿·문의·후기·FAQ·매거진·배너·기획전·상품용 가이드/숙소) | 0% | 각 13~48 | — |
| 견적 도구 9개(정적 HTML) | 해당 없음 | 전부 생 HTML | 견적관리-모바일만 689 |

전체: 생 HTML 부품 약 1,000개, 인라인 style 약 1,700곳. **색(토큰)은 모든 화면에 적용됐지만 부품·레이아웃은 대부분 아직 옛 것**이다.

## 5. 결정한 방향

### 5.1 "Montage 직접 사용"이 아니라 "우리 관리자 부품 사용"
Montage를 화면에서 직접 쓰게 강제하면 단점이 있다:
- 외부 라이브러리 버전 변경·중단에 관리자 전체가 묶인다.
- 원티드 파랑 기준이라 브랜드 예외가 계속 생긴다(예: solid primary 버튼의 흰 글자 고정).
- 숙소 배정 시트·가이드 타임라인·캘린더처럼 Montage에 없는 업무 부품이 있다.
- 정적 HTML 견적 도구는 Montage(React)를 쓸 수 없다.

그래서 **Montage를 감싼 우리 부품**을 만들고 화면은 그 부품만 쓴다. Montage가 바뀌거나 갈아탈 때 부품 파일만 고친다. 브랜드 예외(민트 위 검은 글자 등)도 부품 안 한 곳에서 처리한다.

### 5.2 견적 도구 9개는 React로 옮긴다(마지막 단계)
지금은 "새 React 관리자 + 옛 견적 프로그램(iframe)"을 붙여 놓은 상태다. React로 옮기면:
- 관리자가 하나의 앱이 된다(같은 부품·뒤로가기·새로고침·휴대폰 동작).
- iframe 연결 코드(토큰 전달 `sessionStorage['leaders_admin_token']`, `inhasu-embed-overlay` 신호, `clickFrameButton` 대리 클릭, `admin-embed.js`, `admin-tools.css`)가 필요 없어진다.
- 견적 예약과 상품 예약이 같은 상세 화면을 쓸 수 있다.
- 공유 비밀번호로 들어가는 `견적관리-모바일`을 없앨 수 있다.
- 디자인 기준선 검사가 견적 화면까지 적용된다.

바뀌지 않는 것: **고객 견적 문서**(`내견적`·`견적서`·`계약서`·`여행자정보`·`확정일정표`·`일정지도`)와 그 주소(카카오 알림톡 템플릿 고정, `CLAUDE.md` 3.1), 서버 API·DB·알림톡·결제 흐름.

위험: 약 10,800줄(견적관리-모바일 3,267 · 예약관리 1,806 · 견적만들기 1,375 · 견적관리 1,135 · 예약목록 955 · 리소스관리 794 · 코스관리 569 · 명소관리 559 · 일정관리 343), 돈·계약이 걸린 흐름(견적 발행·예약금·계약 서명 요청·알림톡), 기존 테스트가 이 HTML의 id·class·함수를 직접 검사한다.

## 6. 다음 작업 (순서대로)

각 단계는 **화면 하나(또는 부품 세트 하나) = PR 하나**. 바꾸기 전후 스크린샷(1440px·390px)을 PR에 남긴다.

### 단계 0. PR #119 머지
- 미리보기에서 주요 버튼(민트 바탕 + 검은 글자), 사이드바 선택·필터 칩의 민트 글자, 작업 바탕 `#F6F6F6` 확인 후 머지.
- Preview 환경도 운영 D1·R2를 쓰므로 저장·발송 버튼은 누르지 않는다.

### 단계 1. 우리 관리자 부품 세트 (`src/components/admin/ui/`)
> **완료(2026-11-21, `feature/admin-ui-components`)** — 부품 목록과 쓰는 법은 `docs/admin-design-system.md` 3절, 미리보기 `/admin/__ui`. 아래는 처음 계획이다.

만들 부품(모두 Montage를 감싸고, 색·크기는 `--adm-*`만):
- `AdminButton` — 종류 primary(민트 채움 + `--adm-on-primary` 글자) / secondary(흰 바탕 테두리) / weak(회색) / danger, 크기 32·40·48(휴대폰 36·44·48), loading·disabled. 화면당 primary 하나.
- `AdminIconButton`, `AdminTextButton`
- `AdminField`(라벨 위 13px 600, 필수 `adm-req`, 칸 아래 오류), `AdminTextInput`, `AdminTextArea`, `AdminSelect`, `AdminCheckbox`, `AdminSearch`(돋보기)
- `AdminTable`(머리 13px·줄 14px·여백 16px, 줄 끝 32px 보조 버튼, 휴대폰 카드 전환은 기존 `useCardTables` 유지), `AdminPagination`
- `AdminBadge`(상태색 + 문장, 색만으로 알리지 않기), `AdminChip`, `AdminSegmented`, `AdminTabs`(밑줄형)
- `AdminCard`, `AdminStat`(지표 32px 700, 처리할 일은 주의 테두리)
- `AdminDialog`(가운데 440/640px, 모서리 24, 머리/본문/발 — 발은 왼쪽 삭제·오른쪽 취소·저장, Esc·바깥 누르기 + 고친 내용 확인. 휴대폰은 아래 시트)
- `AdminEmpty` / `AdminLoading` / `AdminError`(이유 + 다시 시도), 기존 `adm-msg`는 `AdminMessage`로 감싼다
- 화면 틀 4종: `ListPage`(제목+추가 → 요약 → 검색 줄 → 표 → 페이지), `FormPage`(목록으로 → 구역 카드 → 아래 고정 막대: 왼쪽 상태·오른쪽 취소/저장), `DetailPage`(머리 카드 → 진행 단계 → 왼쪽 업무/오른쪽 고정 정보 → 이력), `DashboardPage`(제목+기간 → 요약 줄 → 카드 격자). `AdminLayout`의 `title`·`description`·`actions`를 그대로 쓴다.

검사 변경:
- `scripts/check-admin-design.mjs`의 "Montage 부품 수"를 "우리 부품(`Admin*`) + Montage 부품 수"로 바꾼다.
- `src/components/admin/ui/` 밖의 화면 파일에서 `@montage-ui/core`를 직접 import하면 실패하는 테스트를 추가한다(부품 폴더만 Montage를 쓴다). 지금 직접 쓰는 `AdminDashboard.tsx`·`ReservationListV7.tsx`는 이 단계에서 우리 부품으로 바꾼다.
- `docs/admin-design-system.md` 3절을 부품 이름 기준으로 고친다. `CLAUDE.md` 5.0절의 "새 관리자 UI는 Montage 부품을 쓴다"를 "우리 관리자 부품(`components/admin/ui`)을 쓴다. Montage는 그 안에서만"으로 고친다.
- 부품 미리보기 화면(개발용 `/admin/__ui`, 운영 메뉴에는 넣지 않음)을 두면 오너가 부품을 한눈에 확인할 수 있다.

### 단계 2. 기준 화면 — 통합 예약 목록 (목록형)
> **완료(2026-11-21, `feature/admin-reservation-list`)** — Claude Design 시안(Montage, 오너 확인 ‘이대로 진행’)대로 다시 짰다.
> - 머리: 새로고침(`AdminIconButton`) · Excel 범위 메뉴(`AdminMenu`: 지금 보이는 목록 N건 / 선택한 예약 N건 / 전체 확정 팀 N팀) · 수동 예약 추가(primary).
> - 빠른 필터 6칸(`AdminStatRow`·`AdminStat`, 처리할 일은 주의 테두리) → 카드 하나 안에 탭 4개(`AdminTabs`) → 검색·건수·정렬(`AdminSearch`·`AdminSegmented`) → 표(`AdminTable`, 9칸 고정 너비로 1440 화면에서 가로 스크롤 없음) → 페이지(`AdminPagination` + 쪽당 10·20·50건).
> - 줄을 누르면 아래에 작업 패널(메타·진행상황·일정표 편집·예약 상세 열기 → 진행 단계 → 결제·배정·분류·서류 카드 4개). 선택하면 아래 고정 일괄 작업 줄.
> - 주소 보관: `tab`·`quick`·`q`·`sort`·`page`·`size`(`src/utils/reservationListView.ts`, 기본값은 주소에 적지 않고 옛 목록 키는 지운다). Excel ‘지금 보이는 목록’은 목록이 알려 준 `product:<id>`/`quote_booking:<id>` 키(모든 쪽)를 그대로 쓴다(`onScopeChange` → `reservationsByKeys`). 예전에는 숨겨진 옛 필터 기준이라 화면과 어긋났다.
> - 수동 예약 추가 창은 `AdminDialog` + `AdminField`(필수 고객명, 고친 내용이 있으면 닫을 때 묻는다). 휴대폰은 공통 카드 표(셀 높이 고정 해제를 공통 규칙에 추가).
> - 수치: 목록 파일 `ReservationListV7.tsx` 생 부품 8→0·인라인 style 40→0·숫자 크기 63→0. 화면 전체 전환율 5%→53%. 남은 생 부품 78개는 같은 페이지 파일의 고객 예약 상세 부분(4단계)이다.
> - 로컬 확인: 1440·375에서 합성 자료로 탭·검색·정렬 주소 복원, 펼침, 선택·일괄 줄, Excel 메뉴(고르면 닫힘), 수동 예약 추가 저장까지 확인. `npm run dev`(5173)에서는 개발 프록시가 `Origin`을 5173으로 넘겨 쓰기 요청이 403(`invalid_origin`)이 되므로 저장은 8804 서버(빌드본)에서 확인했다.

- `src/pages/AdminReservationManage.tsx`(4,012줄) + `components/admin/v7/ReservationListV7.tsx`.
- 레이아웃·UX를 다시 설계한다(색만 바꾸지 않기). 시안은 Claude Design으로 보여 주고 오너 확인 후 코드로.
- 완료 기준: 이 화면 파일들의 생 부품 0에 가깝게, 인라인 style·숫자 크기 대폭 감소, 기준선·현황 문서 갱신. 이 화면이 **목록형 화면의 기준**이 된다.
- 지켜야 할 기능: 검색·필터·정렬·페이지를 URL에 보관, 상품·견적 예약의 출처 구분 키(`product:<id>`/`quote_booking:<id>`), Excel 세 가지, 수동 예약 추가, 일괄 작업, 펼침 작업 패널, `returnTo` 허용 목록, 휴대폰 카드.

### 단계 3. 목록형 작은 화면 일괄
카테고리 → FAQ·상품별 FAQ → 후기 → 일반 문의 → 기획전 → 매거진 목록 → 상품용 가이드·숙소 → 문서 템플릿 → 맞춤견적 관리(이전). 틀이 같아 빠르다.

### 단계 4. 상세형·입력형·대시보드형
- 고객 예약 상세(`v7/ReservationDetailV7.tsx`, `CustomerWorkspaceOverview`, `Reservation*`) — 상세형 기준
- 상품 추가·수정(`AdminProductManage.tsx`의 `ProductModal`, 디자인 블록 편집기는 기능 유지) — 입력형 기준
- 홈 화면(배너), 매거진 글 쓰기, 로그인
- 숙소 배정 시트·가이드 배정 현황·투어 캘린더(Montage에 없는 업무 부품 → 우리 부품 + 토큰, 7절 예외 기록)

### 단계 5. 견적 도구 React 전환
순서: 일정관리(343줄) → 명소관리 → 코스관리 → 리소스관리(등록 정보) → 견적 문의 → 견적 예약 목록 → 견적서 만들기 → 예약관리(고객 통합 작업 화면과 함께 정리) → `견적관리-모바일` 제거.
도구 하나씩:
1. 같은 API(`/api/data/:key`, `/api/requests` 등)를 그대로 쓰는 React 화면을 `/admin/quote-desk/<tool>` 자리에 만든다. 데이터·저장 형식은 바꾸지 않는다.
2. 옛 HTML은 비교용으로 잠시 남긴다(링크만 끊기). 주소·id 의존 테스트(`tests/lodging-ui.py`, `quote-desk-standalone.test.mjs` 등)를 새 화면 기준으로 옮긴다.
3. 초안 복구(`quote-editor-state.js`), 공통 확인창, 알림톡 발송 확인창, 저장/발송 잠금을 같은 수준으로 유지한다.
4. 공유되는 공통 모듈(`quote-day-editor.js`·`quote-spot-selector.js`)은 React 래퍼(`QuoteDayEditor`, `QuoteSpotSelector`)가 이미 있으니 그대로 쓴다.
5. 돈·계약 흐름(견적 발행·예약금 확인·서명 요청·예약 확정·확정일정표 공개)은 `tests/quote-booking-flow.test.mjs`와 `scripts/check-reservation-workspace.mjs`로 전후 동일함을 확인한다.

## 7. 반드시 지킬 것 (요약 — 정본은 CLAUDE.md)

- 고객 링크 주소·파일명 변경 금지(3.1). 견적 페이지의 id·class·함수·API·`?t=`·`?adminId=`·`?adminPrint=1`·`leaders_*` 키 변경 금지(3.3) — React 전환 전까지.
- 줄바꿈 LF(3.2). Material Symbols 새 아이콘은 `index.html` 두 URL에 추가(3.6) — 리디자인 화면은 Montage 아이콘/인라인 SVG.
- 글자 크기는 Montage 단계만(11·12·13·14·15·16·17·18·20·22·24·28·36·40px, `tests/admin-font-scale.test.mjs`).
- 알림은 `adminNotify()`, 확인은 `await adminConfirm()`, 견적 도구는 `AdminDialog.confirm/prompt`. `alert()`·`confirm()` 새로 쓰지 않기.
- 사이트 API 쓰기 라우트에 `requireAdmin`(3.7). 배정 저장은 CAS(`expectedVersion`), 예전 예약 전체 PUT 금지.
- `main` 직접 푸시 금지. feature 브랜치 → PR → 미리보기 확인 → 머지. 커밋 메시지는 한국어 `[영역]: 설명`.
- Montage `global.css`는 불러오지 않는다(전역 초기화). `AdminMontageProvider`는 밝은 테마 고정.
- 민트 채움 위 글자는 `--adm-on-primary`. 민트 글자는 `--adm-accent-strong`.
- 위반 수치는 늘릴 수 없다. 줄였으면 기준선·현황 문서를 함께 낮춘다. 예외는 `admin-design-system.md` 7절에 한 줄 기록.

## 8. 작업할 때 쓰는 명령

```bash
npm ci
npm run dev                         # http://localhost:5173/__local-admin (합성 자료, 운영 DB 연결 없음)
npm test                            # 전체 테스트(디자인 기준선 포함)
npx tsc --noEmit -p tsconfig.app.json
npm run build
node scripts/check-admin-design.mjs                    # 화면별 전환율 표
node scripts/check-admin-design.mjs --write-baseline --md   # 줄인 뒤 기준선·현황 갱신
node scripts/check-admin-font-scale.mjs --fix          # 글자 크기 단계 맞추기
node scripts/check-reservation-workspace.mjs --serve --usability --customer-workspace --port=8804
# → http://localhost:8804/__local-admin (admin@example.invalid / local-workspace-test-2026)
```

화면 확인: 위 로컬 서버를 Playwright로 열어 1440px·390px 스크린샷을 찍고, 민트 대비(민트 바탕 흰 글자, 흰 바탕 민트 글자 3:1 미만)를 계산 색으로 검사한다. 이 환경에서 아이콘 글꼴(CDN)이 막히면 아이콘 자리에 영문 이름이 보이는데 운영과는 무관하다.

## 9. 오너가 정할 것 / 열린 질문

- PR #119 머지 여부(미리보기 확인 후).
- 단계 2 통합 예약 목록 PR 미리보기 확인·머지(시안은 2026-11-21 확인 완료).
- `견적관리-모바일` 제거 시점(React 휴대폰 관리자가 같은 기능을 갖춘 뒤).
- 숙소 배정 시트·가이드 타임라인처럼 Montage에 없는 화면의 디자인 방향.

## 10. Claude Code에서 시작할 때 쓸 첫 요청 예시

> `docs/admin-renewal-handoff.md`를 읽고 단계 1(우리 관리자 부품 세트)을 진행해 줘. 부품마다 Montage를 감싸고 `--adm-*` 토큰만 써. 화면 파일에서 `@montage-ui/core` 직접 import를 막는 테스트와 점검 스크립트 변경, 문서 갱신까지 하고, 개발용 부품 미리보기 화면을 만들어서 스크린샷을 보여 줘. 끝나면 feature 브랜치로 PR을 올려.
