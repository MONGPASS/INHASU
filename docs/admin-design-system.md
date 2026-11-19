# 은하수 관리자 디자인 규칙 — Montage

관리자(`/admin`과 그 안의 견적 도구)는 **Montage 디자인 시스템(`@montage-ui/core`)** 을 따른다. 이 문서는 Montage를 관리자에 맞게 쓰는 규격이다.
구조·업무 흐름(4절 화면 유형, 5절 저장·삭제·알림, 8절 휴대폰)은 INHASU 규칙을 따르고, 색·글자·모서리·부품의 겉모양은 Montage를 따른다. 둘이 부딪히면 구조·흐름은 이 문서, 겉모양은 Montage다.
화면 전체 목록은 [admin-screen-inventory.md](admin-screen-inventory.md)에 있다. 공통 틀·화면 유형·공통 부품·휴대폰 틀 시안은 claude.ai 디자인 아티팩트 `5e9ef812-8f43-4bcc-b218-6bded4cb9b25`(INHASU 관리자 공통 틀)다.

**대상 아님**: 고객 사이트, 상품 디자인 템플릿, 견적서·확정일정표·계약서·가이드 시트·가이드 피켓 같은 고객용 문서, `public/style.css`. 이곳의 민트(`#27AB8F`·`#06C4A0`)·네이비는 그대로 둔다.

**새 화면을 만들 때의 규칙**

1. 색은 Montage semantic 토큰만 쓴다. 관리자 CSS에서는 그것을 가리키는 `public/admin-tokens.css`의 `--adm-*` 변수를 쓴다. 화면별 CSS나 인라인 `style`에 hex 색을 새로 적지 않는다.
2. 글꼴은 Pretendard, 글자 크기는 Montage typography 단계(title·heading·headline·body·label·caption)만 쓴다.
3. 버튼·입력창·검색·표·배지·탭·팝업·알림·페이지 이동은 Montage 컴포넌트(3절)를 쓴다. 같은 일을 하는 부품을 새로 만들지 않는다. 아이콘은 `@montage-ui/icon`.
4. 주요 버튼(Solid Primary)은 화면당 하나. 버튼 높이는 목록 안 32 / 기본 40 / 저장 48.
5. 화면은 4절의 네 가지 유형 중 하나의 틀을 따르고, 저장·취소·삭제·오류·알림은 5절의 방식으로 동작하게 한다.
6. 규칙을 따를 수 없으면 7절 "예외 기록"에 화면·내용·이유를 한 줄 남긴다. 기록 없는 예외는 고친다.
7. 화면·팝업을 더하거나 없애면 화면 목록 문서를 함께 고친다.

`tests/admin-design-tokens.test.mjs`가 관리자 코드(`src/pages/Admin*`, `src/components/admin/`, `admin-*.css`, 견적 도구 8개)에 hex 색 고정값이나 직접 만든 버튼·입력창 클래스가 새로 들어오면 실패한다. 이미 있는 자리는 그 테스트의 목록(파일별 개수)에 있고, 단계마다 고친 만큼 숫자를 줄인다. 고객 화면 파일은 검사하지 않는다.

## 1. 진행 단계

범위가 커서 단계별로 나눠 적용한다. 단계마다 브랜치·PR로 올리고 적용 전후 화면(1440 / 900 / 390px, 휴대폰은 끝까지 내려서)을 남기며, 화면을 확인받은 뒤 다음 단계로 넘어간다.

**Montage 전환 (2026-11-19~)**

| 단계 | 내용 | 상태 |
|---|---|---|
| M1 | 규칙 고정(CLAUDE.md 5.0, 이 문서, 검사 테스트) + `@montage-ui/core`·`@montage-ui/icon` 설치, 관리자 영역만 `AdminThemeProvider`로 감쌈 + `--adm-*` 값을 Montage 토큰으로 연결(강조색 민트 → 브랜드 블루 `#0066FF`, 버튼 높이 32/40/48) | 완료(2026-11-19) |
| M2 | 관리자 공통 틀: 사이드바·상단 바·제목 줄을 시안 모양으로 | 예정 |
| M3 | 관리자 공통 부품(3절)을 Montage 컴포넌트로 교체 | 예정 |
| M4 | 화면 유형별 틀(4절, 화면 목록 문서의 유형대로 목록형 → 입력형 → 상세형 → 대시보드형) | 예정 |

**이전 단계 (민트 공통 규격, 2026-11-11)** — 아래 내용의 동작·구조는 유지하고 색만 M1에서 Montage로 바뀌었다.

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 공통 변수 파일을 만들고 React 관리자·견적 도구가 함께 읽게 연결. 화면마다 반복하던 민트 지정 정리 | 완료(2026-11-11) |
| 2 | 휴대폰 앱 틀(8절), 공통 알림·확인 창 부품, 주요 버튼 민트 통일, `alert()` 143곳을 공통 알림으로 교체 | 완료(2026-11-11) |
| 2-2 | 나머지 공통 부품(3절): 버튼·입력창·표·배지·탭·팝업 틀을 부품으로 만들고 화면별 교체 | 예정 |
| 3 | 유형별 틀(4절)을 목록형 → 입력형 → 상세형 → 대시보드형 순서로 적용 | 예정 |
| 4 | 업무 흐름(5절): 삭제·변경 확인 70곳을 공통 확인 창으로 교체 | 완료(2026-11-11) |
| 4-2 | 업무 흐름(5절): 필수 입력 표시(`adm-req`)와 칸 아래 오류 안내(`adminValidateRequired`)를 가이드·숙소·문서 템플릿·기획전 등록 창에 연결, 상품·카테고리는 표시 통일. 휴대폰 홈 화면에 추가(설치) 표시 | 완료(2026-11-11) |
| 4-3 | FAQ·후기·수동 예약 추가에 필수 입력 표시 연결 | 완료(2026-11-11) |
| 4-4 | 화면 이동 차단(`useBlocker`) 7곳의 확인을 공통 확인 창(`adminConfirmLeave`, 머무르기·이동)으로 교체. 고객 공개·전달 묶음의 주 버튼을 하나로(공개 전 ‘고객에게 공개’, 공개 뒤 ‘메일 발송’) | 완료(2026-11-11) |
| 4-5 | 저장·취소 위치 통일, 남은 나가기 보호 6곳 | 예정 |
| 5 | 견적 도구 7개(견적 문의·견적 예약 목록·견적서 만들기·코스·일정·여행지·등록 정보)의 버튼·입력창·서랍·알림을 `public/admin-tools.css` 한 파일로 같은 규격에 맞춤 | 완료(2026-11-11) |
| 5-2 | 견적 도구 4개(코스·일정·여행지·등록 정보)의 기본 확인창·입력창 16곳을 공통 창(`public/admin-dialog.js`)으로 교체 | 완료(2026-11-11) |
| 5-3 | 견적 문의·견적 예약 목록·견적서 만들기의 기본 확인창 9곳을 공통 창으로 교체, 견적 예약 편집기의 주 버튼(일차 추가·저장)을 공통 민트로, 상품 목록·문서 템플릿·매거진·FAQ에 불러오는 중·오류 안내 추가 | 완료(2026-11-11) |
| 5-4 | 견적 예약 편집기·상품 예약 일정표 편집기의 버튼·입력창 높이와 모서리를 공통 규격으로(알약 모양 → 공통 모서리), 고객 공개·전달 묶음의 주 버튼과 문서 편집 창(일정 프리셋·예약 문서)의 편집 틀·예약 상세 서랍에 남은 파란 고정값을 공통 민트로 | 완료(2026-11-11) |

## 2. 공통 변수 — `public/admin-tokens.css` → Montage 토큰

`--adm-*` 이름은 그대로 두고 값만 Montage 토큰(`@montage-ui/core` 4.3.2, 밝은 테마)을 가리킨다. 이 파일이 관리자 변수의 정본이다. React 관리자는 `src/styles/admin-console.css` 첫 줄의 `@import`로, 견적 도구는 각 문서의 `<link rel="stylesheet" href="/admin-tokens.css">`로 같은 파일을 읽는다. 사본을 만들지 않는다.

- React 관리자: `AdminThemeProvider`가 Montage `theme.css`를 읽으므로 `--adm-*`가 Montage 변수 값을 그대로 받는다.
- 견적 도구(iframe 문서): Montage `theme.css`를 읽지 않으므로 `var(--semantic-…, #값)`의 두 번째 값(Montage와 같은 값)이 쓰인다. Montage 버전을 올리면 두 번째 값도 함께 맞춘다.

| 종류 | 변수 | Montage 토큰 (값) |
|---|---|---|
| 강조색(brand) | `--adm-accent` / `-hover` / `-strong` / `-deep` / `-soft` / `-line` / `-rgb` | `semantic.surface.brand.primary` `#0066FF` / `surface.brand.strong` `#005EEB` / `foreground.brand.primary` `#0066FF` / `surface.brand.heavy` `#0054D1` / `atomic.blue.95` `#EAF2FE` / `line.brand.primary` `#0066FF47` / `0, 102, 255` |
| 주요 버튼 | `--adm-primary-bg` / `-hover` | `--adm-accent` / `--adm-accent-hover` (Solid Primary) |
| 글자 | `--adm-ink` / `--adm-text` / `-2` / `-3` / `-disabled` | `foreground.neutral.primary` `#171719` / 같음 / `neutral.secondary` `#2E2F33E0` / `neutral.tertiary` `#37383C9C` / `neutral.quaternary` `#37383C47` |
| 무채색 | `--adm-gray-50` / `100` / `200` / `300` | `atomic.coolNeutral.99` / `98` / `97` / `95` |
| 바탕 | `--adm-canvas` / `--adm-surface` / `--adm-sunken` | `background.neutral.secondary` `#F7F7F8` / `background.neutral.primary` `#FFFFFF` / `atomic.coolNeutral.98` `#F4F4F5` |
| 테두리 | `--adm-line` / `-subtle` / `-strong` | `line.neutral.secondary` `#70737C29` / `line.neutral.tertiary` `#70737C14` / `line.neutral.primary` `#70737C38` |
| 상태색 | `--adm-danger` / `--adm-warn` / `--adm-success` / `--adm-info` / `--adm-neutral` (+ `-soft`) | negative `#FF4242` / cautionary `#FF9200` / positive `#00BF40` / brand `#0066FF` / neutral(`foreground.neutral.tertiary`). `-soft`는 `atomic.*.95` |
| 글자 크기 | `--adm-fs-caption` / `-small` / `-body` / `-base` / `-lead` / `-section` / `-title` / `-title-sm` | caption2 11 / caption1 12 / label2 13 / label1 14 / body1 16 / headline1 18 / title2 28 / heading1 22px |
| 간격 | `--adm-space-1`~`8`, `--adm-gap-control`, `--adm-gap-section`, `--adm-pad-card`, `--adm-pad-page` | Montage spacing과 같은 4·8·12·16·20·24·32px, 8 / 24 / 20 / 28px |
| 모서리 | `--adm-radius-xs` / `-sm` / `-md` / `-lg` / `-pill` | `radius-4` / `radius-8` / `radius-12` / `radius-16` / `radius-full` |
| 높이 | `--adm-control-h` / `-sm` / `-lg` | 40 / 32 / 48px (Montage medium / small / large) |
| 그 밖 | `--adm-shadow-xs`~`lg`, `--adm-ring`, `--adm-scrim` | `elevation.shadow.normal.xsmall`~`large`, `line.brand.focus` 3px, `effect.dimmer.primary` |

- 강조 글자를 흰 바탕에 쓸 때는 `--adm-accent-strong`(`foreground.brand.primary`)을 쓴다.
- 상태색은 의미가 정해져 있다: 완료=positive, 주의·대기=cautionary, 삭제·오류·미처리=negative, 안내·진행=brand, 보류·종료=neutral. 꾸밈용으로 쓰지 않는다.
- 기존 이름(`--mrt-blue`, `--text-*`, `--border-*`, `--r-*`, 견적 도구의 `--accent`·`--p`·`--brand`, 화면별 `--la-mint`·`--gs-mint`·`--lo-mint` 등)은 `--adm-*`를 가리키는 별칭으로 남겨 두었다. 이름에 mint가 있어도 값은 브랜드 블루다. 새 CSS에서는 쓰지 않는다.
- 반투명 강조색은 `rgba(var(--adm-accent-rgb), .16)`처럼 쓴다.
- Montage 변수를 직접 써도 된다(`var(--semantic-foreground-positive-primary)` 등). 단 견적 도구 문서에는 `theme.css`가 없으므로 견적 도구 쪽은 `--adm-*`만 쓴다.

### Montage를 불러오는 곳

- `src/components/admin/AdminThemeProvider.tsx`: Montage `ThemeProvider`(밝은 화면만, 기본 전역 스타일 끔, 테마 쿠키 `/admin` 경로·현재 호스트 한정) + `@montage-ui/core/theme.css`(변수만).
- `App.tsx`가 관리자 경로(상품 미리보기 `/admin/products/:id/preview` 제외)에서만 이 파일을 lazy로 읽어 라우트 전체를 감싼다(AdminLayout 바깥). 고객 화면 번들에는 Montage가 들어가지 않는다.
- Montage `reset.css`·`global.css`는 `div`·`button` 등 모든 요소를 초기화해 고객 화면에 새어 나가므로 불러오지 않는다. 컴포넌트를 쓰기 시작하는 M3에서 관리자 범위(`.admin-app-wrapper`)로 한정한 초기화가 필요한지 확인한다.

## 3. 공통 부품 — Montage 컴포넌트

M3부터 아래 규격을 Montage 컴포넌트로 교체한다. 지금 있는 관리자 부품(`src/components/admin/ui/`)은 교체될 때까지 같은 자리를 지키며, 새로 같은 일을 하는 부품을 만들지 않는다.

| 부품 | Montage 컴포넌트 | 규격 |
|---|---|---|
| 페이지 제목 | (공통 틀) | `AdminLayout`의 `title`·`description`·`actions`만 쓴다. 제목 title2 28px 굵게, 설명 label2 13px, 주요 행동 버튼은 제목 오른쪽 |
| 버튼 | `Button`, `IconButton`, `TextButton` | 높이 small 32(목록 안) / medium 40(기본) / large 48(저장). 주요 = `variant="solid" color="primary"`(화면당 하나), 기본 = `variant="outlined" color="assistive"`, 약한 = `TextButton`, 위험 = negative |
| 입력창·선택 상자 | `TextField`, `Select`, `Checkbox`, `Radio`, `Switch` | 높이 40, 글자 label2 13px(휴대폰 16px). 라벨은 위. 필수 표시·오류는 5절 |
| 검색 영역 | `SearchField`, `Chip`, `SegmentedControl` | 본문 맨 위 한 줄: 왼쪽 검색창, 가운데 필터 칩·선택 상자, 오른쪽 정렬·보기 전환 |
| 표 | `Table`, `TableHead`, `TableRow`, `TableCell` | 머리 caption2 11px. 줄별 행동은 오른쪽 끝 small `IconButton` |
| 상태 배지 | `ContentBadge` | small, 상태색은 2절의 의미대로(positive / cautionary / negative / brand / neutral) |
| 탭 | `Tab`·`TabList`(화면·구역 전환), `SegmentedControl`(보기 방식 전환) | |
| 팝업 | Montage 모달·서랍 | 가운데 창(확인·짧은 입력, 폭 440/640px)과 오른쪽 서랍(편집, 폭 520px). 머리(제목·닫기) / 본문 / 발(왼쪽 삭제, 오른쪽 취소·저장). Esc와 바깥 누르기로 닫히되 고친 내용이 있으면 확인 |
| 알림 | Montage 토스트 | 화면 아래 가운데 하나. 성공(positive)·오류(negative)·안내. 3초 뒤 사라지고 오류는 눌러서 닫는다 |
| 확인 창 | Montage 모달 | 삭제·되돌릴 수 없는 일. 무엇이 지워지는지 한 문장 + negative 버튼 |
| 페이지 이동 | `Pagination` | 목록 아래 오른쪽, 왼쪽에 "전체 N건 중 a–b" |
| 아이콘 | `@montage-ui/icon` | 이모지를 쓰지 않는다 |
| 빈 목록·불러오는 중·오류 | (공통 틀) | 본문 자리에 같은 틀: 불러오는 중(회전 표시 + "불러오는 중…"), 빈 목록(안내 한 줄 + 첫 행동 버튼), 오류(이유 + "다시 시도") |

지금 있는 부품(M3에서 Montage로 바꾸되 부르는 방법은 유지한다):
- `adminNotify(문구, 종류?)` — 화면 아래 알림. `alert()` 대신 쓴다. 종류를 안 주면 문구로 성공·오류를 가린다.
- `await adminConfirm({ message, danger })` — 공통 확인 창. 새 코드는 `window.confirm` 대신 이것을 쓴다. 문구만 넘기면 ‘삭제’가 들어간 물음은 빨간 삭제 버튼으로 뜬다. 답을 기다려야 하므로 부르는 함수는 `async`여야 하고, 그 함수의 결과를 바로 `if (!fn())`처럼 쓰는 곳이 없는지 확인한다.
- `.adm-btn`(+ `.is-primary`, `.is-danger`) — 공통 버튼 클래스(`ui/admin-ui.css`).
- `AdminMobileTabBar` — 휴대폰 아래 메뉴(`AdminLayout`이 자동으로 넣는다).
- 필수 입력 — 라벨에 `className="adm-req"`를 주면 빨간 `*`가 붙는다(글자에 `*`를 직접 적지 않는다). 저장 함수 맨 앞에서 `if (!adminValidateRequired()) return;`을 부르면 열려 있는 팝업 안의 빈 필수 칸 아래에 안내가 뜨고 첫 칸으로 이동한다(`ui/adminForm.ts`).
- 홈 화면에 추가 — `useAdminInstallMeta`가 관리자 화면에서만 `admin.webmanifest`와 앱 아이콘 표시를 넣는다(고객 사이트에는 넣지 않는다. 오프라인 기능은 없다).

주요 버튼(`.btn-ink`, `.adm-btn.is-primary`, v7 `inkBtn`)의 바탕은 `--adm-primary-bg`(Montage 브랜드 블루) 하나다. 버튼·입력창 클래스(`.btn*`, `.adm-btn`, `.form-input` 등)를 새로 만들지 않는다 — 검사 테스트가 막는다.

## 4. 페이지 유형별 기본 틀

| 유형 | 틀(위 → 아래) | 해당 화면 |
|---|---|---|
| 목록형 | 제목 + 오른쪽 "추가" 버튼 → 요약 숫자(있을 때) → 검색 영역 → 표 또는 카드 → 페이지 이동 | 통합 예약, 상품, 카테고리, 템플릿, 문의, 후기, FAQ, 매거진, 기획전, 견적 문의, 견적 예약, 코스·일정·여행지, 등록 정보, 숙소 배정 |
| 입력형 | 제목 + 왼쪽 "목록으로" → 구역 카드(구역 제목 18px) → 아래 고정 막대(왼쪽 상태, 오른쪽 취소·저장) | 상품 추가·수정, 매거진 글 쓰기, 홈 화면 관리, 견적서 만들기, 로그인 |
| 상세형 | 머리 카드(이름·상태·주요 행동) → 진행 단계 → 왼쪽 업무 구역 / 오른쪽 고정 정보 → 이력 | 고객 예약 관리(상품·견적·이전 견적) |
| 대시보드형 | 제목 + 기간 선택 → 요약 카드 줄 → 그래프·목록 카드 격자 | 대시보드, 투어 캘린더, 가이드 배정 현황 |

같은 유형에서는 제목, 주요 행동 버튼, 검색 조건, 본문의 위치가 같아야 한다.

## 5. 업무 흐름 규칙

| 항목 | 규칙 |
|---|---|
| 저장·취소 위치 | 팝업·서랍은 발의 오른쪽에 `취소` `저장` 순서. 입력형 화면은 아래 고정 막대의 오른쪽. 저장 중에는 버튼을 잠그고 "저장 중…" |
| 필수 입력 | 라벨 뒤에 빨간 `*`. 비어 있으면 저장을 누를 때 그 칸 아래에 빨간 안내 문구를 띄우고 첫 칸으로 이동. `alert()`로 알리지 않는다 |
| 오류 안내 | 입력 오류는 칸 아래, 저장·불러오기 실패는 화면 위 빨간 안내 줄(이유 + 다시 시도). 실패해도 입력한 내용은 지우지 않는다 |
| 삭제 확인 | 공통 확인 창. 이름을 넣어 "‘○○’을(를) 삭제할까요? 되돌릴 수 없습니다." 버튼은 `취소` `삭제`(빨강) |
| 저장 완료 | 토스트 "저장했습니다." 팝업·서랍은 닫고 목록을 새로 고친다. 입력형 화면은 그대로 머문다 |
| 나가기 보호 | 고친 내용이 있는데 닫거나 이동하면 공통 확인 창으로 묻는다(기존 초안 복구 기능은 그대로 둔다) |

## 8. 휴대폰 앱 틀 (760px 이하)

PC와 같은 화면·같은 부품이 휴대폰 폭에서 앱 모양으로 바뀐다. 모바일 전용 화면을 따로 만들지 않는다. 규칙은 `src/styles/admin-mobile.css` 한 파일, 크기는 `public/admin-tokens.css`의 휴대폰 변수 블록에 있다.

| 부분 | 규격 |
|---|---|
| 위 고정 바 | 높이 56px. 왼쪽 화면 제목(18px), 오른쪽 검색·알림. 화면 작업 버튼은 그 아래 한 줄(옆으로 밀기) |
| 아래 고정 메뉴 | 높이 58px, 다섯 칸: 홈 · 예약 · 견적 · 배정 · 전체. ‘전체’가 서랍 메뉴(PC 사이드바와 같은 내용)를 연다 |
| 본문 | 좌우 여백 16px |
| 목록 | 표(`.tbl`, `.pd-table`)는 한 줄이 카드 한 장이 된다: 제목 칸이 맨 위, 나머지 칸은 이름표와 함께 두 칸씩, 관리 버튼은 맨 아래. `AdminLayout`의 `useCardTables`가 머리글을 칸 이름표로 자동으로 붙이므로 새 표도 `.tbl`만 쓰면 된다. 통합 예약 목록도 같은 카드 배치 |
| 버튼·입력창 | PC와 같은 Montage 고정 높이: 기본 40px, 목록 안 32px, 저장 48px. 입력 글자 16px(작으면 휴대폰이 화면을 확대한다) |
| 팝업 | 아래에서 올라오는 시트(위쪽 모서리 16px, 최대 높이 92%) |
| 알림·확인 창 | 알림은 아래 메뉴 바로 위, 확인 창은 아래 시트 |
| 편집 화면 | `hideHeading`인 화면은 아래 메뉴를 숨기고 위 바에 메뉴 버튼을 둔다(저장 막대와 겹치지 않게) |
| 견적 도구 | 관리자 안에서는 화면 폭과 관계없이 PC와 같은 문서를 쓴다(견적 문의는 `?m=0`). 폭을 줄였을 때와 휴대폰에서 새로 열었을 때 다른 화면이 나오면 안 된다. 견적 편집(`?qe=`)처럼 예전 모바일 문서가 열리는 경우에는 자체 머리를 숨기고 자체 아래 메뉴를 위쪽 탭 한 줄로 옮긴다(`admin-embed.js`) |

- 화면별 CSS에 휴대폰용 버튼·입력창 크기를 따로 적지 않는다. 배치만 화면별로 잡는다.
- 넓은 화면이 필요한 세 곳(상품 디자인 블록 편집, 숙소 배정 시트, 가이드 타임라인)은 휴대폰에서 보기와 간단한 수정까지만 맞춘다.
- 표를 카드로 바꾸지 않으려면 그 표에 `data-card-off`를 준다(이유를 7절에 적는다).
- 배정 화면: 숙소 배정 시트는 예약 머리와 숙박 줄이 카드가 되고(칸 이름표는 버튼 안에 표시), 가이드 배정 목록은 한 줄이 카드 한 장, 타임라인은 가이드 칸을 좁힌다. 숙소·등급·상태·가이드·차량 고르기 창(`.la-pop`, `.gs-pop`)도 아래 시트로 뜬다. 화면별 배치는 각 화면 CSS의 760px 블록에, 시트 모양은 `admin-mobile.css`에 둔다.
- 견적 도구의 확인·입력 창: `await AdminDialog.confirm(문구)` / `await AdminDialog.prompt(문구, 기본값)`(`public/admin-dialog.js`)을 쓴다. React의 `adminConfirm`과 같은 모양이고 ‘삭제’가 들어간 물음은 빨간 삭제 버튼이 된다. 부르는 함수는 `async`여야 한다. 견적 도구에 `confirm()`·`prompt()`를 새로 쓰지 않는다.
- 견적 도구: `public/admin-tools.css`가 관리자 안(`html.admin-embedded`)에서만 적용된다. 주요 버튼 브랜드 블루(`--adm-primary-bg`), 버튼·입력창 높이와 모서리, 편집 서랍 폭 520px(휴대폰에서는 아래 시트), 알림 모양을 맞추고, 바깥 제목과 겹치는 안쪽 제목을 숨긴다. 새 견적 도구 문서를 만들면 `</head>` 앞에 이 파일을 연결한다.
- 고객 예약 상세(v7): 바로가기는 두 칸, 결제·배정·분류·서류는 한 칸씩, 왼쪽·오른쪽 열은 같은 폭으로 세로로 쌓는다. 일자별 숙소는 머리글 줄 없이 한 박이 카드 한 장(숙소 → 등급·객실 → 수배 상태), 일정은 일차·날짜 / 제목 / 숙소 상태 세 줄. 칸 이름표는 `v7-nav`·`v7-quad`·`v7-cols`·`v7-main`·`v7-side`·`v7-stay-row`·`v7-day-btn`·`v7-asg-row`.
- 휴대폰 화면은 **끝까지 내려서** 확인한다. 첫 화면만 보면 아래쪽 표·카드의 넘침과 잘림을 놓친다(고객 예약 상세에서 실제로 놓쳤다). 화면 밖으로 나간 것·옆으로 밀어야 보이는 칸·`…`로 잘린 글자를 함께 본다.
- 화면을 옆으로 넘치게 하지 말 것: 휴대폰에서는 화면이 넘치면 브라우저가 화면 폭 자체를 넓혀, 팝업·아래 메뉴까지 함께 넓어진다(가이드 목록의 4칸 격자 때문에 등록 창이 625px로 뜨던 문제). 고정 칸 수 격자(`.grid-3`, `.guide-grid` 등)는 `admin-mobile.css`에서 두 칸으로 줄인다. 새 격자 클래스를 만들면 그 목록에 더한다.

## 6. 확인 방법

- 로컬 합성 자료로만 확인한다: `npm run dev` → `/__local-admin`. 운영 자료를 고치거나 발송해서 디자인을 확인하지 않는다.
- 크기: 데스크톱 1440×900, 태블릿 900×1100, 휴대폰 390×844.
- 상태: 기본·불러오는 중·빈 목록·오류·팝업.
- 휴대폰: 모든 React 화면이 8절의 앱 틀로 열린다. 기존 `/견적관리-모바일`은 새 화면이 같은 기능을 갖출 때까지 그대로 둔다.
- 검사: `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

## 7. 예외 기록

| 화면 | 예외 | 이유 |
|---|---|---|
| 견적 도구 전체 | 선택자·id·파일 이름을 그대로 두고 변수 값만 연결 | 알림톡 링크와 테스트(`tests/lodging-ui.py` 등)가 이 이름을 쓴다 |
| `public/admin-tokens.css`의 `var()` 두 번째 값(hex) | hex 검사에서 뺀다 | 견적 도구 문서는 Montage `theme.css`를 읽지 않아 Montage와 같은 값을 직접 둔다(M1). 이 파일 밖에는 hex를 새로 쓰지 않는다 |
| `--adm-accent-soft`·상태색 `-soft`·`--adm-sunken`·`--adm-gray-*` | Montage semantic이 아니라 atomic 단계(`atomic.blue.95`, `atomic.coolNeutral.98` 등)를 가리킨다 | Montage의 옅은 semantic 바탕(`surface.brand.subtle` 등)은 반투명이라, 다른 바탕 위에 겹쳐 쓰는 관리자 칸·배지에서 색이 달라진다. 불투명한 같은 계열 단계를 쓴다(M1) |
| 휴대폰 버튼 높이 | 이전 규칙(기본 44 / 작은 36)을 버리고 PC와 같은 40 / 32 / 48 | Montage 컴포넌트 높이가 고정이다. 입력 글자만 16px로 키운다(M1) |
| Montage `reset.css`·`global.css` | 불러오지 않음 | 모든 요소를 초기화해 고객 화면·견적 도구에 새어 나간다. M3에서 관리자 범위로 한정해 필요한 만큼만 쓴다 |
| 기존 hex 색 고정값 1,850곳·직접 만든 버튼/입력창 89곳(`tests/admin-design-baseline.json`) | M1에서는 그대로 | 대부분 TSX 인라인 `style`의 상태색(완료 초록 등)·견적 도구 스크립트 문자열·차트 그림이라, 부품 교체(M3)·화면 유형별 틀(M4) 때 화면을 보며 Montage 토큰·컴포넌트로 바꾸고 목록 숫자를 줄인다. M1에서는 강조색으로 쓰던 민트(`AdminToolbar.css`·`CustomerWorkspaceOverview.css`·`AdminAccommodationOps.css`·`LodgeAssignBoard.css`·`GuideSchedule.css`·`AdminDashboard.module.css`의 민트 바탕·그림자, `admin-dialog.js`·`admin-embed.js`의 민트 대체값)만 변수로 바꿨다 |
| 상품 디자인 블록 편집기의 선택 테두리(`DesignTemplateBlockEditor.tsx`, `designEditor/*`의 `rgba(6,196,160,…)`) | 민트 유지 | 고객에게 보이는 상품 디자인 템플릿 미리보기 위에 겹치는 표시라, 템플릿 색과 함께 본다. M3에서 편집 도구 부분만 브랜드 블루로 바꿀지 정한다 |
| 대시보드 그래프의 민트 그라데이션(`AdminDashboard.tsx`의 날짜 막대·도넛, `dashboard/TrafficSources.tsx`) | M1에서는 그대로 | 대시보드형 틀(M4)에서 Montage 색으로 다시 그린다 |
| 배너 기본색 `EVENT_COLORS`(`AdminBannerManage.tsx`) | 바꾸지 않음 | 관리자 화면 꾸밈이 아니라 고객 홈에 보이는, DB에 저장되는 값이다 |
| 견적 도구의 상태색(`--prog`, `--book`, `--hold` 등) | 1단계에서는 기존 값 유지 | 상태 의미를 화면별로 확인한 뒤 5단계에서 맞춘다 |
| `견적관리`·`예약목록`·`예약관리`·`견적만들기`의 일부 민트 고정값(`#06c4a0` 약 17곳, 반투명 민트 20곳) | M1에서도 그대로(검사 목록에 포함) | 스크립트가 만드는 문자열 안에 있어 5단계에서 화면을 보며 바꾼다 |
| 나가기 보호의 `window.confirm` 6곳(예약 문서·매거진·상품 편집기와 견적 도구 새로고침·편집기 전환의 ‘초안을 보관하지 못했습니다’ 확인, 문의 패널 닫기) | 브라우저 기본 확인창 유지 | 그 자리에서 참·거짓을 돌려줘야 하는 함수라 답을 기다리는 공통 확인 창으로 바꾸면 부르는 쪽 동작이 달라진다. 화면 이동 차단(`useBlocker`) 7곳은 `adminConfirmLeave`(`src/components/admin/ui/adminLeaveConfirm.ts`)로 바꿨다 |
| TSX 인라인 `style`의 민트 고정값(`v7Ui.tsx` 제외) | M1에서도 그대로(검사 목록에 포함) | 엑셀·인쇄용 HTML, 저장되는 기본색, 캔버스 그림과 섞여 있어 부품 교체(2~3단계) 때 함께 바꾼다 |
| 배너·카테고리의 기본색 `#0f766e` | 바꾸지 않음 | 화면 꾸밈이 아니라 DB에 저장되는 값이다 |
| 견적 예약 편집기 `예약관리.html` | `admin-tools.css`를 연결하지 않음 | React가 약 1,200줄의 작업 화면 CSS를 이 문서에 넣고, 테스트가 그 CSS의 문자열을 검사한다. 따로 화면을 보며 맞춘다(5-2단계) |
| 문서 편집 창 안의 문서 미리보기(파란 머리 그림·아이콘·DAY 표시, `AdminTemplateManage.tsx`의 문서 영역과 `TripDocParts.tsx`) | 파란 고정값 유지 | 관리자 화면이 아니라 고객이 받는 일정표·계약서 문서의 디자인을 그대로 보여 주는 영역이다. 편집 틀(머리·왼쪽 목록·오른쪽 요약·탭)만 공통 민트를 쓴다 |
| 견적 문의·견적 예약 목록·견적서 만들기의 확인 창 9곳 | `AdminDialog`가 없으면 기본 `confirm`으로 물러난다 | 이 문서들의 스크립트를 가상 환경에서 돌리는 테스트에는 `AdminDialog`가 없고 `confirm`을 직접 바꿔 끼운다. 실제 화면에서는 항상 공통 창이 뜬다 |
| 코스·일정관리의 관리자 비밀번호 `prompt()` 2곳 | 브라우저 기본 입력창 유지 | 단독으로 열었을 때만 뜨고(관리자 안에서는 뜨지 않음), 값을 그 자리에서 돌려줘야 하는 동기 코드다 |
| 견적 도구의 선택 칩(`.chip.on`)·단계 표시 | 검정 그대로 | React 관리자의 선택 칩도 검정이다. 주요 버튼만 공통 강조색(M1부터 브랜드 블루)으로 통일했다. M3에서 Montage `Chip`으로 바꾼다 |
| 가이드 시트·가이드 피켓 | 관리자 규격 대상 아님 | 가이드에게 전달하는 인쇄 문서다 |
