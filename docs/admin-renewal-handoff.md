# 관리자 전면 리뉴얼 — 작업 인계 문서 (2026-11-21)

Claude Code가 이 문서 하나로 관리자 리뉴얼을 이어서 진행할 수 있게 지금까지의 결정·현황·다음 작업을 정리한다.
규칙의 정본은 `CLAUDE.md` 5.0절과 `docs/admin-design-system.md`, 화면 목록은 `docs/admin-screen-inventory.md`, 화면별 전환율은 `docs/admin-design-adoption.md`이다. 이 문서와 정본이 다르면 정본을 따르고 이 문서를 고친다.

---

## 1. 목표 (오너 결정)

- `/admin`의 **모든 관리자 화면**을 사용하기 편하게 전면 리뉴얼한다(범위: Full — 일부 화면만 하는 Lite가 아님).
- 같은 레이아웃에 색만 바꾸는 것이 아니라 **레이아웃·UX까지 실제로 다시 설계**한다.
- **2026-11-23 변경: 디자인 시스템을 Montage → 당근 Seed(은하수 색 판)로 바꾼다.** 1단계(토큰: `public/seed/*.css` + `admin-tokens.css` 연결, 글자 크기 단계)·2단계(우리 부품을 Montage 없이 Seed 모양으로 다시 만들고 `@montage-ui/core` 제거, 같은 props) ·3단계(아이콘 `@montage-ui/icon` → Seed 아이콘, `ui/AdminIcons.tsx`) 모두 완료. 이제 Montage 패키지는 하나도 없다. 값은 `docs/admin-design-system.md` 2절, Seed 원본 자료는 `docs/seed-design/`. 아래의 Montage·배민 민트 내용은 그 전 기록이다.
- (이전) 디자인 시스템은 **Montage**(원티드, `@montage-ui/core`·`@montage-ui/icon` 4.3.2, MIT). 관리자에만 쓰고 고객 사이트는 기존 색(민트 `#27AB8F` + 네이비 `#0A1F2E`)을 유지한다.
- (이전) 브랜드 색은 배민 민트(2026-11-21): 채움 `#0CEFD3`. **2026-11-23부터 Seed 민트 `#36D1A7`**(글자용 `#067661`, 민트 위 글자 `#032B25`, 작업 바탕 `#F2F3F6`).
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
| 그 밖의 목록 화면(템플릿·문의·매거진·배너·기획전·상품용 가이드/숙소) | 0% | 각 13~48 | — |
| 상품 카테고리·FAQ·상품별 FAQ·후기 (단계 3) | 100% | 0 | 0 |
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
- 지켜야 할 기능: 검색·필터·정렬·페이지를 URL에 보관, 상품·견적 예약의 출처 구분 키(`product:<id>`/`quote_booking:<id>`), Excel 세 가지, 수동 예약 추가, 일괄 작업(펼침 작업 패널은 2026-11-23 상세와 중복이라 제거 — 줄을 누르면 예약 상세), `returnTo` 허용 목록, 휴대폰 카드.

### 단계 3. 목록형 작은 화면 일괄
카테고리 → FAQ·상품별 FAQ → 후기 → 일반 문의 → 기획전 → 매거진 목록 → 상품용 가이드·숙소 → 문서 템플릿 → 맞춤견적 관리(이전). 틀이 같아 빠르다.
브랜치 `feature/admin-list-screens`(단계 2 PR 위에 쌓음). 화면마다 새 시안은 만들지 않고 단계 2 목록 기준을 따른다.

> **상품 카테고리 완료(2026-11-21)** — 머리 ‘카테고리 추가’(primary) → 카드 하나(제목 ‘카테고리 N개’, 저장 중 상태 글) 안의 표(`AdminTable`: 순서 위·아래 `AdminIconButton` · 아이콘 · 이름 · 설명 · 상품 수 · 노출 `AdminSwitch` · 수정/삭제, ‘전체’는 `AdminBadge` 기본). 읽기 실패는 `AdminError`(다시 시도), 빈 목록은 `AdminEmpty`.
> - 오른쪽 서랍이던 편집을 `AdminDialog`(md)로 바꿨다. 고친 내용이 있으면 닫을 때 창 안에서 묻고(옛 브라우저 확인 대신), 저장·업로드 중에는 닫기·저장을 막는다(업로드 중 닫기는 ‘끝난 뒤 닫아 주세요’). 저장 성공 때만 닫고 실패하면 입력·올린 사진을 유지하는 기존 보호(`useAdminContentGuard`·`createAdminContentTask`)는 그대로다.
> - 새 부품 `AdminSwitch`(Montage `Switch`)·`AdminFileButton`(숨은 파일 칸을 여는 버튼). 히어로 이미지의 순서·삭제 버튼은 사진 위 검은 덧칠 대신 사진 아래 줄로 옮겼다. 랜딩 강조 색상의 옛 기본값은 `types/category.ts`의 `LEGACY_LANDING_ACCENT` 한 곳에 둔다(사이트 `accentOf`도 같은 값).
> - 공통 `AdminDialog`: 긴 창에서 Montage 스크롤 상자가 머리·저장 줄까지 굴리던 것을 본문만 스크롤하도록 고쳤다(수동 예약 추가 창도 같은 혜택).
> - 수치: 생 부품 34→0 · 인라인 style 62→0 · 숫자 크기 78/42→0/0 · 직접 색 5→0 · `!important` 1→0, 전환율 0%→100%. `tests/admin-content-workflow.test.mjs`의 얕은 렌더 하네스는 우리 부품·Montage 아이콘을 이름 문자열로 바꿔 같은 보호 시나리오를 그대로 검사한다.
> - 로컬 확인(8804, 합성 자료): 1440·375에서 표·휴대폰 카드(가로 넘침 0), 수정 창(머리·저장 줄 고정), 고친 뒤 취소 → 창 안 확인, 설명 저장 → 목록 반영, 순서 위·아래, 노출 스위치 켜고 끄기(원래대로 되돌림).

> **FAQ·상품별 FAQ 완료(2026-11-21)** — 단계 2 목록 기준 그대로: 머리(설명은 탭마다 바뀜, ‘FAQ 추가’ primary는 투어 공통 FAQ 탭에서 숨김) → 카드 하나 안에 `AdminTabs`(건수) → 검색(`AdminSearch`)·카테고리 칩(`AdminChipGroup`) → 표.
> - FAQ 목록 표: 순서 위·아래 · 카테고리 `AdminBadge`(카테고리마다 `tag-*` 색, 모르는 값은 기본) · 질문(답변 보기/접기 → 아래 줄에 답변) · 조회 · 노출 `AdminSwitch` · 수정/삭제. 휴대폰 카드에서는 카테고리 아래에 질문이 한 줄 전체로 온다.
> - 카테고리 관리 탭: 위의 빠른 추가 칸 + 표(순서·이름·FAQ 수·노출·이름/노출 수정·삭제). FAQ가 남은 카테고리는 삭제 버튼을 끄고 이유를 라벨로 알린다. 이름을 바꾸면 그 카테고리의 FAQ도 함께 옮기는 기존 동작은 그대로다.
> - FAQ 편집·분류 수정 창을 `AdminDialog`로 바꿨다(고친 내용이 있으면 닫을 때 창 안에서 묻기, 저장 중 닫기·중복 저장 막기). 투어 공통 FAQ 편집(`TourFAQEditor`)은 안내 `AdminMessage` → 건수·저장됨 상태·‘전체 저장’ → 질문마다 카드(`AdminField` 질문·답변, 위·아래·삭제) → ‘질문 추가’. `/admin/tour-faqs` 단독 화면은 같은 편집기를 `AdminCard`에 담는다. API 호출·저장 순서는 바꾸지 않았다.
> - 수치: 생 부품 32→0 · 인라인 style 2→0, 전환율 0%→100%(우리 부품 73개). 전체 전환율 30%→34%.
> - 로컬 확인: 8804 합성 서버에는 FAQ API가 없어(404) 브라우저 안에서만 fetch를 가짜 응답으로 바꿔 확인했다(서버·DB에는 쓰지 않음). 1440: 목록·답변 펼치기, FAQ 추가(첫 카테고리 기본, 다 채우기 전 저장 꺼짐), 노출 켜고 끄기, 순서 바꾸기, 고친 뒤 취소 → 창 안 확인, 카테고리 빠른 추가·이름 바꾸기(FAQ 2건 함께 이동)·삭제 막힘, 투어 공통 FAQ 질문 추가 → 전체 저장 → ‘저장됨’. 375: 가로 넘침 0, 카드(카테고리 배지·질문 한 줄 전체·스위치·관리 버튼).

> **후기 완료(2026-11-21)** — 단계 2 목록 기준 그대로: 머리(‘새 후기 등록’ primary) → 지표 4칸(전체·평균 평점·포토·숨김, 누르면 거르기·다시 누르면 전체, 숨김이 있으면 주의 표시) → 카드 하나 안에 검색(`AdminSearch`)·평점 칩(`AdminChipGroup`, 1·2점은 실제 후기가 있을 때만)·건수 → 표.
> - 표: 후기(별점·제목·본문 두 줄·사진 썸네일 링크) · 작성자 · 상품 · 작성일 · 노출 `AdminSwitch`(상품 상세 노출, 실패하면 되돌림) · 삭제 `AdminIconButton`(`adminConfirm`). 숨긴 후기는 흐리게. 휴대폰 카드에서는 후기가 한 줄 전체로 맨 위에 온다. 아래 안내 문구(홈·후기 모아보기는 숨김과 관계없이 보임)는 그대로 둔다.
> - 수동 후기 등록 창을 `AdminDialog`로 바꿨다: 작성자(필수)·상품명·작성일(비우면 오늘) 세 칸 → 평점 칩(★ 5~1점) → 제목 → 내용(필수) → 사진(썸네일마다 빼기, `AdminFileButton` 여러 장, 최대 5장). 필수가 비었거나 사진을 올리는 중이면 등록 버튼이 꺼지고, 고친 내용이 있으면 닫을 때 창 안에서 묻는다. 처음 불러오기 실패는 `AdminError`(다시 시도)이고 지표는 0 대신 ‘–’로 둔다. API 호출·저장 형식은 바꾸지 않았다.
> - 옛 `.rv-*` 규칙을 `AdminContentManage.css`에서 빼고 `AdminReviewManage.css`(토큰만)로 옮겼다. 수치: 생 부품 17→0 · 인라인 style 1→0 · 직접 색 1→0, 전환율 0%→100%(우리 부품 47개). 전체 전환율 34%→37%.
> - 로컬 확인: 8804 합성 서버에는 후기 API가 없어(404, 이때 오류 상태 확인) 브라우저 안에서만 fetch를 가짜 응답으로 바꿔 확인했다(서버·DB에는 쓰지 않음). 1440: 지표·칩 거르기, 노출 끄기(`PUT is_approved:0`), 삭제 확인 → `DELETE`, 등록 창(빈 칸이면 꺼짐 → 작성자·내용·작성일·4점 → `POST` 후 다시 불러오기). 375: 가로 넘침 0, 카드(후기 한 줄 전체·스위치·삭제).


> **투어 캘린더·일반 문의 완료(2026-11-24, `feature/seed-calendar-inquiry`)** — Seed 부품으로 바꿨다. 레이아웃·데이터 흐름은 그대로다.
> - 투어 캘린더: 요약 4칸 `AdminStat`(처리 필요·배정 겹침은 누르면 거르기, 건수가 있으면 주의 테두리) · 검색 `AdminSearch` · 출처/처리 상태 `AdminChipGroup` · 이전 문의 `AdminCheckbox` · 월간/목록 `AdminSegmented` · 목록 `AdminTable` · 경고 `AdminMessage` · 빈 화면 `AdminEmpty`. 팀 카드의 출처는 `AdminBadge`(상품 tag-blue · 견적 tag-violet · 이전 문의 주의색), 처리할 업무는 주의 배지, 바로가기는 `AdminTextButton to`(전체 새로고침 없는 화면 이동). 달력 칸·일정 막대·팀 카드는 `AdminCalendar.css`가 변수만으로 그린다(7절 예외). 생 부품 20→0, CSS 숫자 크기 184→0.
> - 일반 문의: 현황 4칸 `AdminStat` · 검색 · 상태 `AdminChipGroup` · 답장·메모 `AdminTextArea`/`AdminField` · 버튼 `AdminButton`. 옛 화면 알림(page-toast)은 `adminNotify`로, 문의 패널 닫기의 `window.confirm`은 `adminConfirm`으로 바꿨다(부르는 쪽을 기다리게 바꿈, 확인 창이 떠 있는 동안 다른 이동은 무시). `.iq-*` 규칙은 `AdminContentManage.css`에서 빼고 `AdminInquiryManage.css`로 옮겼다. 생 부품 13→0 · 인라인 style 4→0 · 기본 확인창 1→0.
> - 전체 전환율 80%→82%.

> **거의 끝난 화면 마무리(2026-11-24, `feature/seed-leftovers`)** — 공통 틀·숙소 배정·상품 화면의 남은 생 부품을 우리 부품으로 바꿨다(세 묶음 모두 100%).
> - 새 부품: `AdminRadio`(Seed RadioGroup 한 칸)·`AdminSlider`(Seed Slider), `AdminSelect` 선택지 `group`(optgroup). 새 Seed 아이콘 `IconMenu`·`IconBell`.
> - 공통 틀: 휴대폰 메뉴·추가 작업 버튼은 `AdminIconButton`, 서랍 뒤 막은 초점 없는 덮개(`div`), 머리·본문의 인라인 style 3곳은 CSS로. 상단 바 도구(통합 검색·업무 알림)는 `AdminSearch`·`AdminIconButton`·`AdminTextButton`과 Seed 아이콘, `AdminToolbar.css`는 변수만(숫자 크기 40·직접 색 3 → 0). 검색 칸에서 Esc는 예전처럼 창만 닫고 검색어는 남긴다.
> - 진한 채움 위 흰 글자는 새 변수 `--adm-on-dark`(Seed static white)로 — 공통 CSS의 직접 색 44곳 → 0. 인라인 style을 이기려고 적었던 `!important` 4곳(머리 설명·flush 본문)을 뺐다.
> - 숙소 배정 ‘등록 숙소 선택’, 디자인 블록 여행지 이름·추가, 숙소·여행지 고르기 창 검색, 상품 구분선 높이·일정 간격(`AdminSlider`)·기본 숙소(`AdminRadio`), 일정 편집기·대표 명소 불러오기/오류.
> - 남겨 둔 것(7절 예외): `quote-day-editor.css`의 `!important` 137(일차 카드 정본), `admin-mobile.css`의 `!important` 87(옛 화면 휴대폰 덮개), 통합 예약 목록의 인쇄·엑셀 문자열 표 6·색 26.
> - 틀 CSS 읽는 순서 고정: 상단 바 도구가 `console/Icon`을 그만 쓰자 빌드가 `admin-console.css`(로그인과 함께 씀)를 따로 떼어 맨 뒤에 읽게 되어 화면 제목이 상단 바로 올라갔다. 틀 CSS 네 장을 `src/styles/adminShell.ts` 한 모듈로 묶어 AdminLayout·로그인이 함께 가져오게 했다(`tests/admin-design-tokens.test.mjs`가 순서를 검사).
> - 전체 전환율 82%→83%.

> **관리자 아이콘 전부 Seed로(2026-11-24, `feature/seed-icons-all`)** — 예전 이름으로 부르는 두 부품이 Seed 모양을 그린다.
> - `ui/legacyIconNames.ts`: Lucide 이름 81개(`DashboardIcon`)·Material 이름 236개(`console/Icon`) → Seed `Icon*`. `DashboardIcon`은 Lucide 선을 더 그리지 않고, `console/Icon`은 바깥 `span.material-symbols-outlined`를 그대로 두어 화면 CSS가 정한 크기·색이 Seed 아이콘(1em, `.adm-glyph > svg`)에 똑같이 적용된다. 표에 없는 이름만 Material 글꼴.
> - Seed 아이콘 29개 추가(76개): 저장소에 있던 SVG 11개 + `daangn/seed-icon`(Apache-2.0)에서 받은 18개(copy·car·restaurant·translate·handle·view_count·near_me·convert·filter02·call·note·photo_several·certification·ai·chatting_send·prohibition·list_card·walk). Seed에 없는 호텔·침대는 집, 비행기는 보내기 화살표(near_me).
> - 휴대폰 아래 메뉴는 사이드바와 같은 Seed 아이콘을 바로 쓴다. 대시보드·홈 화면 관리·매거진의 화면 전용 Lucide 선도 Seed로.
> - Material 그대로(7절): 카테고리·배너 아이콘(자료), 문서 템플릿 화면(고객 문서 미리보기). Lucide 그대로: 홈 화면 관리의 휴대폰·PC 미리보기 2종.
> - `tests/admin-legacy-icons.test.mjs`: 예전 부품을 새 파일에서 쓰면 실패, `console/Icon`에 넘기는 글자 이름이 모두 표에 있는지, 표가 실제 Seed 아이콘만 가리키는지 검사.

### 단계 4. 상세형·입력형·대시보드형
- 고객 예약 상세(`v7/ReservationDetailV7.tsx`, `CustomerWorkspaceOverview`, `Reservation*`) — 상세형 기준
- 상품 추가·수정(`AdminProductManage.tsx`의 `ProductModal`, 디자인 블록 편집기는 기능 유지) — 입력형 기준
- 홈 화면(배너), 매거진 글 쓰기, 로그인
- 숙소 배정 시트·가이드 배정 현황·투어 캘린더(Montage에 없는 업무 부품 → 우리 부품 + 토큰, 7절 예외 기록)
  - **숙소 배정 배정 보드 완료(2026-11-21, `feature/lodge-assign-board`)**: Claude Design ‘숙소 배정 · 현지 운영’ A안을 우리 부품으로 옮긴 기본 보기 `accommodation/LodgeAssignQueue.tsx`. 상태 카드 4장(미배정·배정·진행 중·배정 완료, 누르면 거름) → 왼쪽 체크인 빠른 순 대기열(D-day·숙박 칩) → 오른쪽 숙박별 펼침(예약일자·인원·숙소지역·숙소정보·등급·방수·배정 구분 + 숙소 연락 단계 숙소 배정→1·2·3메일, 메일발송·발송일자·예약상태, 예약메모) · 숙박 추가 · 배정 저장. 값·저장은 표로 보기와 같다(`lodgeBoardModel.ts` 공용 계산, 예약 단위 배정 API, 브라우저 초안). 새 부품 `AdminPickCard`(고를 수 있는 카드). 숙소정보는 고르기 칸이 아니라 숙소 고르기 창 `accommodation/LodgePicker.tsx`다(2026-11-22, 숙소가 많아 찾기 어렵다는 운영 요청 → Claude Design ‘HotelPicker’). 920 넓이 창: 위 찾기(이름·주소, 모든 지역) · 왼쪽 지역 메뉴(울란바타르·근교/중부/고비·남부/북부/서부/동부/기타 — 등록 정보에 묶음이 없어 지명으로 나눔, 숙소 수, 그 숙박의 ‘숙소지역’ 표시) · 오른쪽 등급 칩(호텔·고급게르·일반게르·목조·게스트하우스·기타)·‘이 지역에서 자주 쓴 숙소’(불러온 예약에서 배정된 수)·동그라미 줄 목록(30곳씩 더 보기) · 발 ‘선택: …’ + 이 숙소로 배정. 디자인의 영문 숙소명 줄은 등록 정보에 영문 이름이 없어 주소로 대신한다. 공통 부품에 `AdminDialog` size `lg`·`flush`·`footNote`, `AdminPickCard` variant `row`·`nav`를 더했다.
  - 디자인과 다른 점: 숙소에 메일을 보내는 기능이 없어 ‘요청 메일 보내기’는 **‘N메일 보냄으로 표시’**(다음 회차 + 오늘 날짜)로 했고, 없는 기능인 ‘엑셀 내보내기’는 넣지 않았다. 가이드·차량·여행자·고객 일정은 상세의 ‘여행자·일정·가이드·차량 보기’로 카드 보기에서 본다.

### 단계 5. 견적 도구 React 전환
순서: 일정관리(343줄) → 명소관리 → 코스관리 → 리소스관리(등록 정보) → 견적 문의 → 견적 예약 목록 → 견적서 만들기 → 예약관리(고객 통합 작업 화면과 함께 정리) → `견적관리-모바일` 제거.
도구 하나씩:
1. 같은 API(`/api/data/:key`, `/api/requests` 등)를 그대로 쓰는 React 화면을 `/admin/quote-desk/<tool>` 자리에 만든다. 데이터·저장 형식은 바꾸지 않는다.
2. 옛 HTML은 비교용으로 잠시 남긴다(링크만 끊기). 주소·id 의존 테스트(`tests/lodging-ui.py`, `quote-desk-standalone.test.mjs` 등)를 새 화면 기준으로 옮긴다.
3. 초안 복구(`quote-editor-state.js`), 공통 확인창, 알림톡 발송 확인창, 저장/발송 잠금을 같은 수준으로 유지한다.
4. 공유되는 공통 모듈(`quote-day-editor.js`·`quote-spot-selector.js`)은 React 래퍼(`QuoteDayEditor`, `QuoteSpotSelector`)가 이미 있으니 그대로 쓴다.
5. 돈·계약 흐름(견적 발행·예약금 확인·서명 요청·예약 확정·확정일정표 공개)은 `tests/quote-booking-flow.test.mjs`와 `scripts/check-reservation-workspace.mjs`로 전후 동일함을 확인한다.

> **일정관리 완료(2026-11-21, `feature/quote-tool-itinerary`)** — `/admin/quote-desk/itinerary`가 iframe 대신 React 화면 `pages/AdminItineraryManage.tsx`를 연다(라우트가 `:tool?`보다 앞). 옛 `public/일정관리.html`은 비교용으로 남고, 데스크톱 단독 접속은 기존 `admin-legacy-redirect.js`가 같은 주소로 보낸다.
> - 목록형 기준: 머리(‘새 일정 추가’) → 카드 안 검색(`AdminSearch`)·지역 칩(`AdminChipGroup`, 전체·지역·미분류 건수)·지역 추가/이름 바꾸기/삭제 → 표(일정 이름·지역 배지 · 목적지·이동 · 세부 일정 3줄(`*` 강조·`(` 회색) · 숙소·태그 · 식사 · 편집/삭제). 휴대폰 카드에서는 세부 일정이 이름 아래 한 줄 전체.
> - 편집 창(`AdminDialog`): 일정 이름(필수, 같은 이름이 있으면 막음) · 지역(`AdminSelect`, ‘새 지역 만들기’를 고르면 이름 칸) · 목적지 · 이동(마지막 괄호가 거리) · 세부 일정 · 숙소 · 숙소 태그 · 조식/중식/석식. 지역 추가·이름 바꾸기도 작은 `AdminDialog`(옛 `AdminDialog.prompt` 대신).
> - **저장 형식 그대로**: `/api/data/snippets`(이름 → `{cat,dest,move,dist,items,stay:{name,tags},meals}`)·`snippet_cats`(순서·빈 지역 보존). 읽기·쓰기는 `components/admin/quoteLibraryStore.ts`(옛 `presets.js`의 cloudPull·cloudPush와 같은 약속: `x-admin-token`, `?base=` 충돌 확인 → 409면 ‘덮어쓰기’ 확인, 취소하면 최신 목록을 다시 불러오고 편집 창은 유지, 브라우저 캐시 `leaders_snippets`·`leaders_snippet_cats`도 갱신). 서버에 저장된 일정이 없으면 옛 도구처럼 이 브라우저 저장분 → `presets.js` 기본 일정을 보여 준다(`quoteLibrary.ts`의 `loadFallbackSnippets`).
> - 옛 도구와 달라진 점(데이터 보존 쪽으로만): 편집해도 이 화면이 다루지 않는 칸(일정·숙소 사진 `images`·`stay.img`·`stay.desc` 등)과 4번째 이후 식사 칸을 지우지 않는다. 목적지·숙소 이름을 고치지 않으면 저장된 `<br>` 줄바꿈도 그대로 둔다. 다른 일정과 같은 이름으로 바꾸면 덮어쓰지 않고 막는다. 관리자 값이 없을 때 ‘이 브라우저에만 저장’하던 동작은 없애고 연결 오류를 보여 준다.
> - 계산은 `components/admin/itinerarySnippets.ts`, 테스트 `tests/itinerary-snippets.test.mjs`(형식 보존·이동 나누기·지역 이름 바꾸기/삭제·거르기·라우트 순서).
> - 로컬 확인(8804, 실제 `/api/data` 함수 + 메모리 DB): 1440 — 목록, 새 지역과 함께 추가, 기존 일정 점심만 고쳐 저장(사진 2장·숙소 사진·설명 보존), 다른 탭 저장 뒤 편집 → 충돌 창 → 취소(최신 목록, 편집 유지) → 다시 저장(다른 탭 일정 유지), 지역 이름 바꾸기(일정 함께 이동)·삭제(일정은 미분류로 남음)·일정 삭제. 375 — 가로 넘침 0, 카드.

> **명소관리 완료(2026-11-21, `feature/quote-tool-spots`)** — `/admin/quote-desk/spots`(메뉴 이름 ‘여행지 관리’)가 React 화면 `pages/AdminSpotManage.tsx`를 연다(라우트가 `:tool?`보다 앞, 옛 주소 `/admin/tourist-spots`·`/admin/design-spots`도 이 화면). 옛 `public/명소관리.html`은 비교용으로 남는다.
> - 공통 저장 훅 `components/admin/useQuoteLibrary.ts`: ‘항목 + 지역 목록’ 한 쌍(`snippets`+`snippet_cats`, `spots`+`spot_cats`)의 연결·불러오기·충돌 확인·저장을 한곳에 모았다. 일정 관리도 이 훅으로 옮겼다(동작 같음, 로컬 재확인). 다음 도구(코스·리소스)도 같은 훅을 쓴다.
> - 목록형 기준: 머리(‘문구 초안 가져오기’·‘새 여행지 추가’) → 카드 안 검색(이름·몽골어 지명·소개·다른 이름)·지역 칩(전체·지역·미분류·**사진 필요**)·지역 추가/이름 바꾸기/삭제 → 표(사진 · 여행지·몽골어 지명·지역 · 한 줄 소개 · 다른 이름 · 사진 수(2장 미만은 경고 배지) · 편집/삭제).
> - 편집 창: 대표 사진(가로 1000px·화질 0.82 WebP) + 추가 사진 4칸(500px·0.72) — 옛 도구와 같은 크기로 줄여 같은 `/api/upload?folder=images`에 올린다(`quoteLibraryStore.uploadQuoteImage`, 올리는 동안 저장·닫기 잠금). 이름(필수, 같은 이름 막음) · 몽골어 지명 · 지역(새 지역 만들기) · 한 줄 소개 · 다른 이름(쉼표) · 상세 설명 · 위도/경도.
> - 문구 초안 가져오기: `/spot-copy-draft.json`을 읽어 옛 도구와 같은 규칙으로 바꿀 항목을 보여 주고(한 줄 소개는 비었거나 `replaceShort`일 때만, 다른 이름은 없는 것만, 새 여행지는 소개가 있을 때만), 고른 것만 반영한다. 사진·상세 설명은 바꾸지 않고, 사진이 필요한 여행지가 있으면 ‘사진 필요’로 넘어간다.
> - **저장 형식 그대로**: `/api/data/spots`(이름 → `{nameMn,region,short,aliases[],desc,lat?,lng?,img,subImgs[4]}`)·`spot_cats`. 옛 도구와 달라진 점(보존 쪽으로만): 이 화면이 모르는 칸은 지우지 않고, 같은 이름으로 바꾸면 막는다. 서버 자료가 없으면 이 브라우저 저장분 → `presets.js` 기본값(`quoteLibrary.loadFallbackSpots`).
> - 계산은 `components/admin/spotLibrary.ts`, 테스트 `tests/spot-library.test.mjs`.
> - 로컬 확인(8804, `/api/upload`만 브라우저에서 가짜 응답): 1440 — 새 지역과 함께 추가(대표·추가 사진 WebP 변환 후 올림), 다른 탭 저장 뒤 편집 → 충돌 창 → 취소 → 다시 저장(다른 탭 여행지 유지·모르는 칸 보존), 지역 이름 바꾸기·삭제, 문구 초안 2건 반영(‘사진 필요’로 전환), 여행지 삭제. 375 — 가로 넘침 0, 카드. 일정 관리 추가·삭제 재확인.

> **코스관리 완료(2026-11-24, `feature/quote-tool-courses`)** — `/admin/quote-desk/courses`가 React 화면 `pages/AdminCourseManage.tsx`를 연다(라우트가 `:tool?`보다 앞). 옛 `public/코스관리.html`은 비교용으로 남고, 데스크톱 단독 접속은 기존 `admin-legacy-redirect.js`가 같은 주소로 보낸다.
> - 목록형 기준: 머리(‘새 코스 추가’) → 카드 안 검색 + 고르기 칸 다섯(일정·여행지·명소·금액·이동 강도, 옛 도구와 같은 구간) → 표(코스·여행지/기간/차량 · N일 일정 · 기본 1인 · 대표 명소 · 이동 강도 · 편집/복제/공유 견적). 짧은 일정부터, 같으면 이름 순(옛 도구와 같음).
> - 편집 창(`AdminDialog` lg): 이름(필수, 다른 코스와 같은 이름 막음)·여행지·기간·차량·이동 강도 → ① 요금(1인 예약금, 추가·할인 안내, 인원별 잔금 실속형/풀패키지 — 새 코스는 2~6인 빈 줄, 0원 줄은 저장 안 함, 기본가 = 예약금 + 최소 인원 실속형) → ② 대표 명소(여행지 관리 목록, 고른 순서 번호) → ③ 일자별 일정(목적지 “ / ”는 `<br>`, 이동 마지막 괄호가 거리, 조·중·석, 일정 관리의 하루 일정 ‘불러오기’는 지역 순서대로 묶음). 일자 순서는 드래그 대신 위·아래 버튼.
> - **저장 형식 그대로**: `/api/data/courses`(이름 → `{destination,nights,intensity,base,price:{deposit,balances[{pax,economy,full}],options[{label,calc}]},vehicle,highlights[],days[]}`). 공통 훅 `useQuoteLibrary`를 지역 목록 없이 쓴다(`catsKey` 선택). 서버 자료가 없으면 이 브라우저 저장분 → `presets.js` 기본 코스(`quoteLibrary.loadFallbackCourses`).
> - 옛 도구와 달라진 점(보존 쪽으로만): 이 화면이 모르는 칸(코스·요금·일자·잔금 줄의 다른 칸, 네 번째 이후 식사 칸)을 지우지 않고, 목적지·숙소를 고치지 않으면 저장된 `<br>`도 그대로. 이름을 바꿔도 목록 자리 그대로, 다른 코스와 같은 이름으로 바꾸면 덮어쓰지 않고 막는다. 예전 잔금 형식(`amount` 한 칸)은 실속형·풀패키지 칸으로 읽어 저장한다.
> - 공통 훅 수정: `token()`·`isSaving()`을 렌더마다 같은 함수로(`useCallback`) — 화면 effect의 의존 값으로 쓰면 여행지·일정 목록을 반복 조회하던 문제를 확인 중 찾아 고쳤다.
> - 계산은 `components/admin/courseLibrary.ts`, 테스트 `tests/course-library.test.mjs`(형식 보존·입력 규칙·새 코스·옛 잔금 형식·거르기/정렬·복제 이름·일정 불러오기·라우트 순서·훅 함수 고정).
> - 로컬 확인(8804, 실제 `/api/data` 함수 + 메모리 DB): 1440 — 목록·거르기, 편집(목적지·일자 순서·잔금·옵션·명소 빼기·일정 불러오기·이름 바꾸기) 저장 후 서버 자료 확인, 복제(‘복사본’ 이름), 다른 탭이 먼저 저장 → 충돌 창 → 취소(최신 목록, 다른 탭 코스 유지), 삭제 확인, 공유 견적 → 견적서 만들기가 코스를 받아 채움. 390 — 가로 넘침 0.

> **리소스관리(등록 정보) 완료(2026-11-24, `feature/quote-tool-resources`)** — `/admin/quote-desk/resources`가 React 화면 `pages/AdminResourceManage.tsx`를 연다(라우트가 `:tool?`보다 앞). 제목 옆 탭은 그대로 ‘등록 정보’(새 React) / ‘가이드 배정 현황’(기존 `GuideSchedule`), `?view`·`?resourceType` 규칙도 같다(`resourceScheduleView`). 옛 `public/리소스관리.html`은 비교용으로 남고 `tests/lodging-ui.py`도 그 문서를 그대로 검사한다.
> - 등록 정보: 종류(가이드·숙소·차량, 건수) · 카드/목록 보기(옛 도구와 같은 브라우저 값 `leaders_resource_view`) · ‘새 … 추가’ → 숙소는 지역 칩(전체·지역·미분류)과 지역 추가·이름 바꾸기·삭제 → 종류 칩(유형·등급·탑승 인원, 정해 둔 순서 먼저) → 카드(4:3 사진·종류 배지·소개 또는 ‘작성해 주세요’ 주의·이번 달 이용 현황) 또는 표.
> - 편집 창(`AdminDialog` lg): 사진(가이드 1장, 숙소·차량 대표 포함 3장 — 빈 칸 누르기·끌어다 놓기, 앞으로·빼기, 숙소 보관 사진에서 고르기, 차량 4번째 이후 사진 보관) → 이름(같은 이름 막음) → 종류별 칸(가이드: 영문 이름·전화·유형 칩·카카오톡 QR 올리기·소개 / 숙소: 지역(새 지역 바로 만들기)·등급 칩·시설 태그·기존 소개·주소·전화·객실 비품·공용시설·운영 참고·공식 출처(http/https 확인) / 차량: 번호·기사·연락처·탑승 인원 칩·수하물·특징).
> - **저장 형식 그대로**: `/api/data/guides`·`lodges`·`lodge_cats`·`vehicles`, 공통 훅 `useQuoteLibrary`(숙소만 지역 목록, 새 `catsFallback`으로 서버에 지역 목록이 없으면 옛 도구의 기본 지역). 사진은 옛 도구와 같이 가로 1200px·0.82 WebP(QR 480px·0.9)로 `/api/upload?folder=images`. 숙소 사진 저장 규칙(representativePhotos·img·imgs = 보관 사진 + 대표)도 같다. 이번 달 이용 현황은 `/api/admin/assignments`에서 같은 이름의 배정을 센다(`countUsage`).
> - 옛 도구와 달라진 점(보존 쪽으로만): 이름을 바꿔도 목록 자리 그대로. 서버에 저장되지 않으면 ‘이 브라우저에만 저장’하지 않고 오류를 보인다(다른 견적 도구 전환과 같음).
> - 숙소 표시 규칙(`public/lodging.js`의 사진·상세 요약·옛 소개 글 나누기)은 `utils/lodgingDisplay.ts`로 옮겼고, 테스트가 두 파일의 결과를 같은 입력으로 비교한다.
> - 로컬 확인(8804, 실제 `/api/data` + 메모리 DB, `/api/upload`만 이 탭에서 가짜 응답): 숙소 — 새 지역 만들기·주소·공식 출처(틀린 주소 막힘) 저장 후 서버 자료·지역 목록 확인, 모르는 칸 보존. 가이드 — 사진 빼고 새로 올리기(WebP)·유형 칩·소개 글자 수 저장. 차량 목록 보기·보기 값 기억. 가이드 배정 현황 탭 전환. 390 가로 넘침 0.

> **견적 문의 목록 완료(2026-11-24, `feature/quote-tool-inbox`)** — `/admin/quote-desk/inbox`(와 도구 이름 없는 `/admin/quote-desk`)가 React 화면 `pages/AdminQuoteInbox.tsx`를 연다(라우트가 `:tool?`보다 앞). 새 관리자 안에서 옛 `견적관리.html`이 보여 주던 부분(요약 4칸·고객·예약 행동 알림·검색·상태 칩·정렬·표)만 옮겼다. 줄과 알림을 누르면 예전처럼 고객 통합 작업 화면으로 간다.
> - 그대로 둔 것: `?id=`(고객 화면으로 넘김)·`?qe=`(휴대폰 견적 편집)는 `AdminQuoteDesk tool="inbox"`가 예전대로 맡는다. 고객 화면 안의 문의 상세(상태·메모·수락 기록·고객 링크·삭제)는 `견적관리.html?workspace=1`을 계속 쓰므로 옛 문서를 지우지 않는다(그 부분은 예약관리와 함께 정리 — 아래 ‘고객 화면 문의 상세 완료’에서 React로 옮겼다). 자료는 같은 `GET /api/requests`(x-admin-token)이고 이 화면은 읽기만 한다.
> - 다음 할 일(`nextAction`)·검색 칸·정렬 비교는 옛 문서와 같다 — `tests/quote-inbox.test.mjs`가 `견적관리.html`의 함수를 꺼내 같은 자료로 결과를 비교한다(계산 `components/admin/quoteInbox.ts`). 30초마다 다시 읽어 새 문의·새 고객 행동을 화면 알림(`adminNotify`)으로 알리고, 다른 탭을 보고 있으면 탭 제목에도 표시한다. 다시 읽기에 실패하면 목록을 비우지 않고 위에 알린다.
> - 옛 화면과 달라진 점: 정렬은 표 머리 대신 고르기 칸(접수 최신·오래된·출발일 빠른·늦은·이름순), ‘더보기’ 대신 50건씩 페이지, ‘할 일 있음’ 칩·요약 칸을 더했다(행동 알림이 6건을 넘으면 거기서 본다). 검색·필터·정렬·페이지를 주소에 두어 고객 화면의 ‘목록으로’가 같은 목록으로 돌아온다. 새 관리자 안에서 이미 숨겨 두었던 개요 도구 줄(폼 미리보기·링크 복사·백업·복원·CSV)은 넣지 않았다.

> **고객 화면 견적 편집 완료(2026-11-24, `feature/quote-customer-builder`, 예약관리 전환 2단계)** — 고객 통합 작업 화면에서 견적서 작성·수정·링크 공유를 열면 옛 `/견적만들기?id=` iframe 대신 React 견적서 만들기 편집기가 그 자리에 들어간다.
> - `pages/AdminQuoteBuilder.tsx`를 `QuoteBuilderEditor`(편집기, forwardRef)와 `AdminQuoteBuilder`(독립 화면 틀 = AdminLayout)로 나눴다. 독립 화면 `/admin/quote-desk/builder`의 동작은 그대로다.
> - `embedded`일 때: 받은 `requestId`만 연다(코스 관리의 공유 견적·옛 `leaders_prefill`을 읽거나 지우지 않음), 저장 뒤 주소를 바꾸지 않는다, 머리 버튼(초기화·지도/견적서 미리보기·저장하기·링크 공유하기)은 편집 카드 위 한 줄, 아래 막대는 화면 여백 안쪽(`.qbd-embedded`).
> - 바깥 화면과의 약속(옛 `QuoteEditorState`와 같다): `flushAll()` — 저장·공유 중이면 `busy`, 초안 보관 실패면 그 문구, 아니면 초안을 보관하고 통과. `onState` — 저장 중 · 미저장(원본과 다름, 초안 복원 선택 전은 제외) · 초안 오류. `navigate()` — quote-share는 마지막 단계(링크 공유), 그 밖은 일자별 일정(옛 `setStep(4)`·`setStep(1)`); 불러오기 전에 고르면 불러온 뒤 그 단계로 연다. `onSaved` — 서버 저장이 성공한 뒤 고객 현황을 다시 읽는다.
> - `AdminQuoteDesk`: `nativeBuilder`일 때 iframe을 만들지 않고 `lazy`로 편집기를 받는다. 문의 상세와 같은 상태 받기(`receiveNativeState`)가 편집기가 준비되면 기다리던 작업 위치로 옮긴다. ‘작업 화면 다시 불러오기’는 React 작업 화면을 새로 그린다(`nativeReload`).
> - 남은 예약관리 전환: 3) 예약 편집기 `예약관리.html` → React(의존 테스트 15개) 4) iframe·옛 문서·`견적관리-모바일` 정리.

> **고객 화면 문의 상세 완료(2026-11-24, `feature/quote-customer-inquiry`, 예약관리 전환 1단계)** — 고객 통합 작업 화면(`/admin/customer-workspace/quote/:id`)에서 예약 전 고객의 ‘문의 · 고객 정보’ 작업을 열면 옛 `견적관리.html?workspace=1` iframe 대신 React `components/admin/QuoteInquiryPanel.tsx`가 그려진다(우리 관리자 부품: 진행 상태 칸 고르기 · 지금 할 일/예약 진행 기록 안내 · 문의 내용 · 상담 메모 · 견적서·고객 링크 · 고객 진행 타임라인 · 아래 고정 줄(삭제 · 정보 복사 · 견적서 만들기/수정)).
> - **같은 API**: `PATCH /api/requests/:id`(status·memo·quoteExpiresAt·rotateCustomerLink·acceptQuote) · `DELETE`. 예약확정 검사·유효기간 7일 연장·고객 링크(`내견적.html?t=`)·정보 복사 글·타임라인은 `components/admin/quoteInquiryDetail.ts`이고 `tests/quote-customer-inquiry.test.mjs`가 `견적관리.html`의 함수를 꺼내 같은 자료로 비교한다. 화면 동작(메모 저장 한 번·실패 유지·저장 중 잠금·상태 되돌리기·수락·삭제·링크)은 실제 컴포넌트 handler로 검사한다.
> - **바깥 화면 연결**: `AdminQuoteDesk`의 `nativeInquiry`(고객 화면 + 문의 도구)일 때 iframe을 만들지 않고, `flushFrame`·섹션 이동·캘린더/목록 바로가기(`?action=notes` 등)·카카오 발송 잠금이 이 화면의 ref(`flushAll`·`navigate`)와 `onState`(저장 중·미저장)를 쓴다. [견적서 만들기]·[예약관리 열기]는 같은 화면 안의 견적 편집기·예약 편집기(아직 iframe)로 바꾼다. 삭제하면 목록(`returnTo`)으로 돌아간다.
> - 옛 도구와 달라진 점: [예약 진행 기록]은 고객 현황의 [고객이 예약하겠대요]와 같은 서버 `acceptQuote`로 저장한다 — 예약금이 0원인 견적에도 예약(예약금 안내 없이)이 만들어진다(옛 브라우저 저장은 예약금이 있을 때만 예약을 만들었다). 첨부는 `?token=` 링크 대신 관리자 헤더로 받아 이 컴퓨터에 저장한다. 상태를 바꾸면 고객 현황도 다시 읽는다. 그림 문자(📋·🔗 등)는 뺐다.
> - 로컬 확인(8804 합성 자료): 메모 입력 → 칸 벗어나면 서버 저장, 예약확정 차단 안내, 진행중 저장 후 머리 상태 갱신, 발행 견적 고객의 견적서·링크 칸, [예약 진행 기록] → 서버에 수락·예약 생성 후 ‘예약금 안내 필요’로 바뀜, [예약관리 열기] → `/예약관리?id=` 편집기, 휴대폰 폭(375) 가로 넘침 없음, `?action=notes&returnTo=/admin/reservations` → 메모 칸으로 이동 후 주소에서 action 제거.
> - 남은 예약관리 전환: 2) 고객 화면 안의 견적 편집(`견적만들기?id=` iframe → React `AdminQuoteBuilder` 끼우기) 3) 예약 편집기 `예약관리.html` → React(의존 테스트 15개) 4) iframe·옛 문서·`견적관리-모바일` 정리.

> **견적 예약 목록 완료(2026-11-24, `feature/quote-tool-bookings`)** — `/admin/quote-desk/bookings`가 React 화면 `pages/AdminQuoteBookings.tsx`를 연다(라우트가 `:tool?`보다 앞). 옛 `public/예약목록.html`은 비교용으로 남고, 데스크톱 단독 접속은 기존 `admin-legacy-redirect.js`가 같은 주소로 보낸다. `?id=`는 `AdminQuoteDesk tool="bookings"`가 예전대로 고객 화면으로 넘긴다.
> - 목록형 기준: 요약 4칸(예약 확정·계약 미서명·배정 미완료·14일 내 출발, 누르면 거르기) → 카드 안 검색(고객명·여행지·날짜·차량·숙소·가이드·입금상태·여행자 여권번호 등, 공백으로 나눈 낱말 모두)·거르기 칩·정렬(8가지 + 오름/내림) → 출발월 줄(전체·날짜 미정·해 넘기기·12달) → 선택 작업 줄 → 표(선택 · 고정 번호/예약일 · 고객명/인원 · 여행 기간·지역(D-14 안 배지) · 계약 · 배정 상태(가이드·차량·숙소 세 칸) · 결제(예약금·잔금 금액과 상태 고르기) · 진행 상황(마지막 기록, 누르면 날짜별 진행 기록 창) · 관리(배정 관리 → 고객 통합 작업 화면, 일정표·계약서/서명 원본·가이드 시트는 새 탭)).
> - **같은 API·같은 저장 형식**: 목록 `GET /api/requests`, 결제 상태 `PATCH /api/requests/:id { booking }`(contractInfo·checklist를 옛 도구와 같이 함께 바꿈), 선택 복제 `POST /api/requests`(고객 링크 값 새로·서명 비움·견적 번호 `-COPY`), 선택 영구 삭제 `DELETE`. 가이드 시트는 옛 `booking.js`와 같은 자료를 인쇄 창 sessionStorage에 넣고 `/가이드시트?adminPrint=1&print=1&id=`를 연다.
> - 옛 도구와 달라진 점(보존·안전 쪽으로만): 결제 상태는 저장 직전에 그 예약을 서버에서 다시 읽어 바꾼다(목록을 연 뒤 다른 화면에서 고친 일정·배정을 덮지 않는다). 예약금을 처음 입금완료로 바꾸면 서버가 계약서 서명 요청을 기록하고 알림톡을 보낼 수 있어 확인 창을 거친다. 견적서가 든 예약을 복제하면 서버가 새 견적 발행으로 보고 같은 연락처로 견적 안내를 보낼 수 있어(옛 도구도 같았음, `functions/api/requests.js`의 `quoteCreated`) 복제 확인 창에 그 건수를 알린다. 50건씩 페이지, 목록 상태(거르기·검색·출발월·정렬·페이지)를 주소에 둔다. 요약 칸의 작은 그래프와 머리의 새로고침·‘N분 전 업데이트’는 넣지 않았다. 일정표·계약서도 관리자 화면을 벗어나지 않도록 새 탭으로 연다.
> - 계산은 `components/admin/quoteBookingList.ts`, 테스트 `tests/quote-booking-list.test.mjs`가 `예약목록.html`의 `rows`·`rowNumbers`·`customerTimeline`·`cloneRecord`를 꺼내 같은 자료로 비교한다(거르기 4 × 정렬 8 × 방향 2 + 검색·출발월).

> **견적서 만들기 완료(2026-11-24, `feature/quote-tool-builder`)** — `/admin/quote-desk/builder`(대시보드·견적 문의의 ‘견적 작성’, 코스 관리의 ‘공유 견적’, 데스크톱에서 옛 `/견적만들기?id=`를 단독으로 열 때)가 React 화면 `pages/AdminQuoteBuilder.tsx`를 연다(라우트가 `:tool?`보다 앞). **고객 통합 작업 화면 안의 견적 편집(iframe `/견적만들기?id=`)은 아직 옛 문서**이고, 예약관리 전환 때 함께 바꾼다.
> - 입력형 기준: 머리(초기화·지도 미리보기·견적서 미리보기·저장하기·링크 공유하기) → 단계 탭 5개(기본정보·코스 / 일자별 일정 / 요금 / 대표 명소 / 혜택·비고) → 아래 고정 막대(예상 총액·이전/다음, 마지막 단계에 저장하기·링크 공유하기). 일자별 일정·대표 명소는 옛 도구와 같은 공용 부품(`QuoteDayEditor`에 `extras={false}` 추가, `QuoteSpotSelector`).
> - **같은 견적 문서·같은 저장**: `components/admin/quoteBuilder.ts`가 옛 `buildQuote`·`restoreFromQuote`·`importQuoteContent`·`loadCourse`·`matchCourse`와 저장 내용(요청에서 열었으면 `PATCH { quote, notifyQuote|silentQuote, 인원 구성·일정·여행지·연락처·이메일 }`, 아니면 `POST`(walkin/course-share))을 옮겼다. 기본값은 `public/data.js`의 QUOTE(`quoteLibrary.loadQuoteBase`). 고객 링크는 알림톡 템플릿과 같은 `내견적.html?t=`. 미리보기는 옛 도구와 같이 `localStorage.leaders_quote`에 넣고 `/견적서`·`/일정지도`를 연다.
> - **초안**: `components/admin/quoteDraftStore.ts`가 `quote-editor-state.js`의 키·형식·정리 규칙(`clean`·`fingerprint`·`validQuote`·`read`·`write`)을 그대로 옮겨, 옛 편집기와 React가 서로의 초안을 복원한다(옛 형식 `leaders_quote_draft`도 읽음). 원본과 다른 초안이 있으면 복원/버리기를 고를 때까지 편집을 잠근다. 저장에 성공하면 초안을 지우고 새 견적은 그 ID 자리로 옮긴다.
> - 옛 도구와 달라진 점: 숙소 이름만 고칠 때 그 숙소의 다른 칸(사진·설명)을 지우지 않는다. 확인 창·알림은 관리자 공통 부품. 링크 공유는 옛 도구처럼 알림톡 확인 창을 거친다.
> - 테스트 `tests/quote-builder.test.mjs`: 옛 문서의 함수를 꺼내 견적 문서·코스 불러오기·되돌리기·복제가 같은지, 초안이 옛 파일과 서로 읽히는지 비교. 로컬(8804)에서 새 견적 저장(POST·초안 정리) 뒤 **같은 견적을 옛 견적만들기에서 열어 만든 문서와 저장된 문서가 발행일 빼고 같음**을 확인했고, 고객 문의에서 시작한 견적도 같았다. 링크 공유(확인 창·서버 알림 시도·링크 형식), 초안 복원, 미리보기(견적서에 고객명·기간), 일정 편집(“ / ” → `<br>`, 이동 거리 나누기), 다른 견적 복제, 390 폭(가로 넘침 0)을 확인.

> **0% 화면 Seed 전환(2026-11-24, `feature/seed-zero-screens`)** — 남아 있던 0% 화면을 우리 관리자 부품으로 바꿨다. 화면마다 저장 API·잠금·초안·이동 보호 같은 동작은 그대로 두고 그리는 부분만 바꿨다. 전체 전환율 86%→96%(생 부품 255→83).
> - 관리자 로그인 · 여행기획전 · 상품용 가이드·숙소 · 매거진 관리 · 홈 화면 배너: 100%. 매거진은 편집기(Quill) 안 슬라이더·위치 카드 블록의 직접 색·크기를 클래스로 옮겼다. 배너는 숨은 파일 칸 다섯 개를 `AdminFileButton`으로, 미리보기 사진을 `<img>`로 바꿨고 행동 테스트(`tests/admin-content-workflow.test.mjs`)를 새 부품 이름으로 옮겼다.
> - 문서 템플릿: 0%→68%. 탭·템플릿 카드·가이드/숙소 탭을 바꿨고, 어디서도 쓰지 않던 일정 편집기 두 개(`ProductStyleItineraryEditor`·`ProductDayInfoItineraryEditor`, 약 450줄)를 지웠다. 남은 생 부품 20곳은 고객 문서 모양 미리보기(`TemplatePreview`, 예약 문서 편집기가 함께 씀)라 디자인 문서 7절 예외로 남긴다.
> - 맞춤견적 관리(이전, `/admin/quotes`)는 대시보드의 ‘답변 대기 견적’·‘견적 문의 보기’가 아직 연결하고 있어 지우지 않았다(오너 결정 필요).

## 7. 반드시 지킬 것 (요약 — 정본은 CLAUDE.md)

- 고객 링크 주소·파일명 변경 금지(3.1). 견적 페이지의 id·class·함수·API·`?t=`·`?adminId=`·`?adminPrint=1`·`leaders_*` 키 변경 금지(3.3) — React 전환 전까지.
- 줄바꿈 LF(3.2). Material Symbols 새 아이콘은 `index.html` 두 URL에 추가(3.6) — 리디자인 화면은 Montage 아이콘/인라인 SVG.
- 글자 크기는 Montage 단계만(11·12·13·14·15·16·17·18·20·22·24·28·36·40px, `tests/admin-font-scale.test.mjs`).
- 알림은 `adminNotify()`, 확인은 `await adminConfirm()`, 견적 도구는 `AdminDialog.confirm/prompt`. `alert()`·`confirm()` 새로 쓰지 않기.
- 사이트 API 쓰기 라우트에 `requireAdmin`(3.7). 배정 저장은 CAS(`expectedVersion`), 예전 예약 전체 PUT 금지.
- `main` 직접 푸시 금지. feature 브랜치 → PR → 미리보기 확인 → 머지. 커밋 메시지는 한국어 `[영역]: 설명`.
- 부품은 `components/admin/ui`가 Seed 설계대로 직접 그린다. `@montage-ui/core`·`@montage-ui/icon`·`AdminMontageProvider`·`admin-montage-brand.css`는 2·3단계(2026-11-23)에서 지웠다 — 다시 들이지 않는다. 아이콘은 `components/admin/ui`의 `Icon*`(Seed).
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
