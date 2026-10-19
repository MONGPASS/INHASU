# CLAUDE.md

이 파일은 Claude Code가 이 저장소를 처음 열었을 때 빠르게 맥락을 잡기 위한 가이드입니다.
코드에서 바로 읽을 수 있는 구조 설명은 줄이고, **읽어도 모를 정보**(결정의 배경, 함정, 미해결 작업)를 적습니다.

---

## 1. 프로젝트 정체

- **사이트**: [mongolia-milkyway.com](https://mongolia-milkyway.com) — **몽골리아 은하수** (Mongolia Milky Way / SUUN ZAM, 한국 대리점 헬로볼라)
- **사업**: 한국인 대상 몽골 현지 여행사 (B2C). 여행상품 판매 + 맞춤 견적.
- **언어·통화**: 한국어, 원화(`1,290,000원`). 일본어·엔화·PayPal·LINE 문구를 새로 넣지 말 것.
- **두 플랫폼을 합친 저장소** (2026-10-12):
  - **INHASU** (`MONGPASS/INHASU`, 기준 저장소): 한국 고객용 맞춤 견적 시스템. 정적 HTML + 바닐라 JS + Pages Functions(JS). 견적요청 → 견적서 → 입금 신고 → 계약서 서명 → 여행자정보 → 확정일정표, Solapi 카카오 알림톡.
  - **MILKYWAY-JAPAN** (`arvijixmeat-maker/MILKYWAY-JAPAN`): 여행상품·예약·후기·매거진 사이트. React 19 + TS + Vite + Hono. 원래 일본인 대상 일본어 사이트였고, 한국어로 번역해 이 저장소에 넣었다.
- 오너 방침: 양쪽 기능 모두 유지, **관리자는 `/admin` 하나**, 고객 플랫폼은 MILKYWAY 디자인(민트 `#27AB8F` + 네이비 `#0A1F2E`)으로 통일.

## 2. 구조 — 한 Cloudflare Pages 프로젝트(`milkway-mongolia`)에 둘이 함께 산다

| 무엇 | 어디 | 비고 |
|---|---|---|
| 사이트(SPA) | `index.html`, `src/` → `npm run build` → `dist/` | 라우트는 `src/App.tsx` |
| 견적 정적 페이지 | `public/*.html`(한글 파일명), `public/*.js`, `public/img/`, `public/guidebooks/` | Vite가 `dist/`로 그대로 복사. **주소 고정**(아래 3.1) |
| 사이트 API | `functions/api/[[route]].ts`(Hono)가 `functions/api/*.ts` 라우터를 묶음 | `/api/products`, `/api/reservations`, `/api/auth` … |
| 견적 API | `functions/api/*.js`, `*.mjs`(파일 기반 라우트) | `/api/requests`, `/api/my/:token`, `/api/deposit`, `/api/sign`, `/api/travelers`, `/api/data/:key`, `/api/upload`, `/api/file`, `/api/img` — 더 구체적인 경로라 Hono보다 먼저 잡힌다 |
| 공통 미들웨어 | `functions/_middleware.js` | 보안 헤더. `X-Frame-Options: SAMEORIGIN`(여정 지도·통합 관리자의 iframe 때문에 DENY 아님) |
| SEO 메타 주입 | `functions/[[path]].ts` | SPA 화면에만. 루트의 한글 이름 문서(견적 페이지)는 `isQuoteStaticPage`로 통과 |
| DB | D1 `DB` = `leaders-requests` 하나 | 견적: `requests`·`kv`·`itinerary_notice_dispatches` / 사이트: `products`·`reservations`·`users` … |
| 파일 | R2 `FILES`(견적: `uploads/` 비공개, `images/` 공개) · R2 `BUCKET`(사이트 이미지, `/api/images/*` 공개) | **두 버킷을 같은 것으로 묶지 말 것** — 고객 첨부가 공개된다 |
| 테스트 | `tests/*.test.mjs` (`npm test`) | 견적 문서·초안 복구·발송 이력·권한·예약·이미지·SEO와 실제 Cloudflare HTMLRewriter/D1을 검사 |

- 업로드 주소가 둘: 견적은 `/api/upload`(JS), 사이트 이미지는 `/api/site-upload`(Hono, `functions/api/site-upload.ts`).
- 견적 요청 화면은 React `/custom-estimate` 하나다(`src/components/estimate-desktop/quoteForm.ts`가 선택지·검증·payload의 정본). 접수는 `POST /api/requests`로 들어가 견적 파이프라인을 탄다. 옛 `public/견적요청.html`은 리다이렉트 문서.
- 옛 MILKYWAY 자체 견적(`/api/quotes`, `/estimate/:id`, `/admin/quotes`, 마이페이지 견적 내역)은 코드만 남아 있고 새 요청은 들어오지 않는다.

## 3. ⚠️ 반드시 지킬 것

### 3.1 견적 고객 링크 주소를 바꾸지 말 것
카카오 알림톡 승인 템플릿의 버튼 URL이 `https://mongolia-milkyway.com/#{링크}`로 고정돼 있고, 링크에는 `내견적.html?t=`, `확정일정표.html?t=`, `guidebooks/…pdf`가 들어간다. 파일 이름·위치를 바꾸면 이미 보낸 알림톡과 새 알림톡이 모두 깨진다(도메인을 바꾸면 템플릿 재승인 필요).

### 3.2 줄바꿈은 LF (`.gitattributes`)
`public/lodging.<hash>.js`, `itinerary-notice.<hash>.*`는 내용 해시가 파일명과 일치해야 하고 테스트가 검사한다. CRLF로 바뀌면 깨진다. 이 파일들과 `lodging.js`/`itinerary-notice.*`는 함께 바꿔야 한다(`tests/itinerary-assets.test.mjs`).

### 3.3 견적 페이지를 고칠 때
스크립트가 쓰는 id·class·함수·API·`?t=`/`?adminId=`/`?adminPrint=1`·localStorage key(`leaders_*`)를 바꾸지 말 것. 고친 뒤 `npm test`.

### 3.4 공통 상수 사용 (`src/constants/company.ts`)
`BRAND`, `KAKAO_CHANNEL_URL`/`KAKAO_CHANNEL_CHAT_URL`, `DEPOSIT_ACCOUNT`(입금 계좌 — 견적 쪽 `public/booking.js` 기본 계좌와 같은 값), `DEPOSIT_PAYMENT_METHOD='계좌이체'`, `COMPANY_INFO`, `EMBASSY_INFO`(주몽골 대한민국 대사관). 금액은 `won(n)`(`desktop-primitives/mwTokens.ts`). 도메인은 `SEO_CONSTANTS.SITE_URL`.

### 3.5 옛 데이터 별칭을 지우지 말 것
DB에는 일본어 시절 값이 남을 수 있다(매거진 카테고리 `観光`, 기간 `3泊4日`, 성별 `男性`, 지명 등). 읽는 쪽 코드는 일본어·한국어를 둘 다 인식하게 돼 있다(`matesData.ts`, `magazineShared.ts`, `tourListFilters.ts`, `mapDestinations.ts`의 `jaLegacy`, `company.ts`의 `LEGACY_*`). 새로 저장하는 값과 화면 라벨만 한국어.

### 3.6 Material Symbols 아이콘 = 서브셋 폰트
`index.html`의 Material Symbols `<link>` 2개(preload + stylesheet)는 `icon_names=`로 쓰는 아이콘만 요청한다. **새 아이콘을 쓰면 두 URL 모두에 이름을 추가**해야 한다(안 하면 원시 텍스트로 보임). `npm run build`가 `scripts/check-icon-subset.mjs`로 검사한다.
⚠ 이 검사는 따옴표 문자열·단독 토큰도 아이콘 이름으로 오인한다 — `'book'`, `'tab'`, `'token'`, `'desk'`, `loop`, `role="switch"`처럼 Material Symbols 이름과 같은 표기는 피할 것. 리디자인 화면은 인라인 SVG를 쓴다.

### 3.7 API 권한
전역 인증 미들웨어가 없다. 사이트 API의 쓰기 라우트에는 `requireAdmin`(`functions/lib/adminAuth.ts`)을 반드시 붙일 것. 견적 API는 `x-admin-token` 헤더를 `env.ADMIN_TOKEN`과 비교한다(공유 비밀번호 하나).

견적 비공개 첨부 `/api/file/*`도 `x-admin-token`을 지원한다. 기존 `?token=` 다운로드 링크는 호환을 위해 유지하며, 응답은 `private, no-store`·`nosniff`다. 새 호출은 헤더 인증을 사용한다. 고객 링크 `/api/my/:token`의 여행자 목록과 서명 snapshot 모두 연락처·생년월일·여권번호를 마스킹하고, 계약 증빙 원본은 DB에 보존한다.

### 3.8 그 밖의 함정
- `categories` 테이블에는 `updated_at`/`created_at`이 없다 — 시간 기준 정렬/조회 금지.
- `magazines`는 환경에 따라 `is_published` 또는 `is_active` 컬럼(sitemap이 둘 다 시도).
- 사이트 API 응답은 snake_case와 camelCase가 섞여 내려간다(예: `mainImages`와 `main_images`).
- 고객 상담은 `KAKAO_CHANNEL_CHAT_URL`로 연결한다. Channel Talk SDK는 제거했으므로 다시 로드하지 말 것.
- 모바일 화면의 사진은 `<img>` 대신 `MPhoto`(`mobile/mobileUi.tsx`)를 쓴다.
- 새 사이트 이미지 업로드는 WebP와 320/640/960/1280px 사본을 R2에 함께 저장한다. URL에 저장된 실제 크기가 들어가며 `productImage.ts`가 그 사본만 srcset에 넣는다. 기존 이미지는 재업로드 전까지 원본을 쓴다. 별도 Cloudflare Image Transformations는 존에서 활성화·검증한 뒤 `VITE_IMAGE_TRANSFORM=1`로만 켠다.
- 상품의 대표·본문 이미지는 업로드 후 **상품 저장 + 판매중**일 때 공개된다(본문 이미지는 상세에만 표시). 배너는 **변경사항 저장** 후 공개된다. 같은 출처의 열린 홈은 저장 이벤트로 갱신하며, 다른 브라우저는 포커스/최대 60초 조회로 갱신한다.
- PC·모바일 홈 메인 배너는 `useHeroBanners`의 `heroBanners` 조회를 공유한다. 조회 전에는 같은 크기의 로딩 화면, 처음 조회 실패 시에는 재시도를 표시한다. 기본 견적 배너는 정상 응답에서 등록 배너가 실제로 없을 때만 표시하며, 재조회 실패 시 이미 받은 배너는 유지한다.
- 공개 이미지 `/api/images/*`·`/api/img/images/*`만 immutable 캐시를 허용한다. 견적 고객 첨부 `FILES/uploads/*`와 JSON·관리자 API의 no-store를 풀지 말 것.

## 4. 화면 구조 메모

- 페이지 파일(`src/pages/*`)은 `useIsDesktop()`으로 분기만 하고, 화면은 `*-desktop` / `*-mobile` 폴더에 있다. 스타일은 인라인 `style` + `MW` 토큰, 폰트는 **전부 Pretendard**(오너 지정, CDN 동적 서브셋 — `index.html`과 견적 페이지가 같은 jsDelivr 주소를 쓴다). 다른 웹폰트를 추가하지 말 것(아이콘용 Material Symbols만 예외). `MW_FONT_EN`은 `MW_FONT`와 같은 값이다.
- 모바일 공통: `src/components/mobile/` — `MobileShell`(헤더·검색·푸터·하단 탭), `mobileUi.tsx`, `mobileTheme.ts`. 시트·드로어에는 `data-mw-overlay`, 하단 액션 바 화면에는 `data-mw-actionbar`(플로팅 상담 버튼 숨김, `index.css`).
- 리디자인되지 않은 옛 화면(후기/동행 작성, 채팅, 견적 상세 `/estimate/:id`, 문서 출력 일부)은 Tailwind + 틸 `#0f766e` 스타일 그대로. 옛 디자인 가이드는 `docs/design-system/`(일본어 사이트 시절 문서 — 카피·통화 규칙은 무시).
- 고객 로그인은 Google OAuth뿐(이메일/비밀번호는 관리자 전용). 견적 흐름은 로그인 없이 매직링크(`?t=` 토큰).
- 견적 고객 페이지(`내견적`·`계약서`·`여행자정보`·`견적서`·`확정일정표`·`일정지도`)는 `public/quote-theme.css`로 사이트 톤을 입혔다. 견적서·확정일정표는 A4 794px 고정 레이아웃 + 브라우저 인쇄(PDF).
- 견적서·확정일정표 PC/모바일, 확정안내·일정지도는 `public/document-safe.js`를 공유한다. 고객 정보는 텍스트로 escape하고 관리자 작성 HTML은 번들 DOMPurify의 허용 서식만 유지한다. 굵게·줄바꿈·색상과 `*` 강조/`(` 회색 일정은 보존하며 스크립트·이벤트·위험한 사진/링크 URL을 제거한다. HTML 속성 escape와 모바일 `onclick`의 JS 인수 직렬화는 별도 처리한다(`QuoteEditorState.jsArgument`).
- 상품 고객 일정표 `/documents/itinerary/:id`도 기존 `확정일정표` PC/모바일 디자인으로 연결된다(`?reservationId=`). `?t=` 견적 링크는 그대로 유지한다. 가이드용 `?guide=1`은 기존 출력 화면을 쓴다.
- 상품 PDF는 `functions/lib/productItinerary.ts`가 고객별 저장 일정 → 선택한 템플릿 → 예약 상품 ID 순으로 읽는다. 상품별 일정·사진·포함/불포함과 원 단위 팀 금액을 사용하며 샘플 고객/일정으로 대체하지 않는다.
- 관리자 미리보기는 `?preview=1` + 관리자 세션이 필요하다. 고객 이메일/링크 공유 전에 `POST /api/documents/itinerary/:id/publish`로 공개한다(확정·결제·완료 예약과 저장된 일정 필요). 마이페이지는 공개된 일정표만 연결한다. 실제 발송 실패는 발송 완료로 기록하지 않는다.
- 상품 PDF 검증: `npm test`, `npm run build`, `node scripts/check-product-documents.mjs`(npm ci 필요). 마지막 검사는 로컬 SQLite D1과 Lucia 세션만 사용하며 운영 DB/고객 이메일에 접근하지 않는다. `--serve`는 브라우저 확인용 테스트 예약을 8791번 포트로 연다.

## 5. 관리자 (하나로 통합)

- 사이드바는 **대시보드 / 예약 관리 / 견적 관리 / 상품 관리 / 배정·자원 / 여행 자료 / 고객·콘텐츠 / 사이트 관리** 8개 업무로 묶는다. 현재 업무만 펼치며 원래 라우트는 유지한다. 새 견적 작성은 견적 문의 화면의 **견적 작성** 버튼으로 들어간다.
- **실제 예약 목록** `/admin/reservations`는 상품·수동 예약(`reservations`)과 INHASU 견적 예약(`requests.booking`이 있거나 `status=예약확정`)을 함께 보여 준다. 단순 견적 문의는 예약 건수에 포함하지 않는다. 이전 MILKYWAY 견적 문의는 별도 필터로 유지한다.
- 견적 예약 요약은 `GET /api/admin/bookings/quote`(Lucia 관리자 세션 필수, no-store)로 읽는다. 금액·예약금·잔금·서명 여부·출발일을 공통 표시 형식으로 바꾸지만 DB 데이터를 복사하거나 이관하지 않는다. 고객 토큰·서명 이미지·여권 정보는 요약에서 제외한다.
- 견적 고객 상세의 대표 주소는 `/admin/customer-workspace/quote/:id`다. 이전 `/admin/quote-desk/bookings?id=...`·`inbox?id=...` 진입은 새 고객 화면으로 연결하며, 실제 예약 업무는 원래 `/예약관리?id=...` 편집기로 최신 원본을 읽는다. 기존 정적 문서·고객 링크도 유지한다. 새 ID 진입이 실패하면 이전 고객 데이터를 대신 열지 않는다.
- 같은 ID가 두 표에 있어도 목록의 키·편집·삭제·캘린더 연결은 예약 종류까지 구분한다. 출발 예정·캘린더·예약확정 Excel도 견적 예약을 포함한다. 일부 조회 실패 시 이전 목록을 유지하고 누락 경고를 표시한다.
- 통합 예약 검증: `npm test`, `npm run build`, `node scripts/check-admin-bookings.mjs`. 마지막 검사는 로컬 SQLite·실제 Lucia 로그인만 사용하며 운영 DB/알림에 접근하지 않는다. `--serve`로 8792번 포트의 테스트 관리자 화면을 확인할 수 있다.
- 상품 예약 상세는 진행 순서 → 운영 준비 상태 → 일정표·계약서 작업 → 주문·배정·운영 정보로 구성한다. 계약서 메일 발송과 고객 동의, 일정표 공개와 메일 발송을 각각 구분한다. 예약 상품 ID로 문서를 초기화하며 저장된 빈 일정도 상품으로 덮어쓰지 않는다. 편집·가이드 배정 중 부모 갱신은 초안을 초기화하지 않는다.
- 상품 일정·계약 조건은 예약 상세 본문에서 `ReservationInlineEditor`로 편집한다. 일자별 카드는 원본 견적 STEP 2에서 추출한 `public/quote-day-editor.js`·CSS를 견적만들기와 React `QuoteDayEditor`가 함께 사용한다. 날짜·목적지·이동 한 줄, 줄별 일정 textarea, 숙소·식사 두 칸과 드래그 순서를 유지한다. 날짜 자동 채우기는 선택 버튼이며 자유 입력·빈 날짜·`items:[]`도 고객 PDF에서 정본이다. `*` 강조와 `(` 회색 안내를 그대로 저장한다. 시간·상세 설명·사진을 보존하며 사진 편집은 접힌 추가 영역에서 한다. 입력 중 커서·끝 개행을 유지하고, 외부 문서 교체는 강제로 동기화한다. 하단 고정 ‘문서 저장’으로 저장 후 계속 편집하며 저장 전 고객 화면 미리보기·공개·전달은 막고, 별도 관리자 초안 미리보기를 제공한다. 실제 배정 숙소가 기본 숙소보다 우선함을 표시한다.
- 상품 예약 문서 초안은 `adminReservationDraft.ts`가 **관리자 계정·예약 ID별**로 650ms 뒤 현재 브라우저에 보관한다. 일정표·계약 조건·여행 날짜를 함께 복구하며 재진입 시 복원/버리기를 고른다. 서버와 달라졌으면 충돌을 알리고, 해당 저장이 실제 성공한 경우에만 초안을 정리한다. 저장 실패·이동·새로고침 시 초안을 유지하고 저장·업로드 중 이동/중복 작업을 막는다. 파일 바이트와 임시 `data:`/`blob:` 사진은 제외한다.
- 견적 PC 작성·모바일 견적 편집·예약관리는 `public/quote-editor-state.js`로 **관리자 계정·요청 ID별** 초안을 보관한다. 복원/버리기는 서버 저장과 별개이며 토큰·서명 원본·파일 바이트·임시 URL을 제외한다. 새로고침 후에도 PC `id`·모바일 `qe`와 예약 `id`를 유지해 같은 고객을 다시 연다. 바깥 iframe의 메뉴 이동·Back·전체 새로고침도 안쪽 상태를 flush하고, 저장소 실패·저장/발송/업로드 중 이동을 보호한다. 계정 교체·로그아웃은 이전 연결 응답과 초안 scope를 무효화한다.
- 공통 업무 순서는 **예약 접수 → 예약금 확인 → 계약 동의 → 일정 준비 → 일정표 공개**이며 발송 결과는 별도로 표시한다. `GET /api/admin/deliveries`는 관리자 세션 전용이고 상품·견적 예약을 source+ID로 구분한다. 스키마 v4에서 `admin_delivery_attempts`를 추가했고, 현재 v5는 발송 당시 문서 fingerprint인 `document_revision`을 추가한다. 원래 예약·입금·계약 상태는 변경하지 않는다. `accepted`는 서비스 접수이고 수신 완료가 아니다. 명시적 `failed`는 확인 후 새 요청 키로 재시도할 수 있지만 `sending`/`unknown`은 새 키·다른 탭·다른 발송 경로에서도 차단한다. 기존 `itinerary_notice_dispatches`와 공통 이력이 함께 이 차단을 적용한다.
- `reservations.admin_operations`는 조인 여부·지역·차량·기사 연락처·현금영수증 기록·내부 운영 메모 JSON이며 관리자에게만 노출한다. 고객 예약 조회에서는 이 필드와 `admin_memo` 이력을 제외한다. 현금영수증 기능은 발급 이력 기록이며 외부 발급 서비스와 연결하지 않는다.
- 대표 명소는 원본 견적 STEP 4에서 추출한 `public/quote-spot-selector.js`·CSS를 견적·상품 등록 ‘대표 명소’ 탭·예약 일정표 편집이 함께 사용한다. 견적의 `spots`/`spot_cats` 자료를 같은 지역별 카드와 순서 번호로 선택한다. 상품은 판매 포인트 `highlights`와 별개인 `representative_spots`에 이름·사진·설명·지역 스냅샷을 저장한다(v3에서 추가, 현재 스키마 v5). 상품에서 예약 문서를 처음 만들거나 옛 문서에 명소 필드가 없을 때만 상속하며, 저장된 고객 선택과 빈 배열은 우선한다. 목록에서 없어진 선택도 ‘저장된 명소’로 표시해 해제할 수 있다.
- 상품 등록·수정의 자동 저장은 **현재 브라우저의 관리자 계정·상품별 초안**이다. 650ms 뒤 보관하고 재진입 시 복원/버리기를 고른다. 서버 상품 버전이 달라지면 충돌 안내를 표시한다. 공개 상품은 저장 버튼으로 확정하며, 성공할 때만 초안을 지운다. 실패·취소·새로고침·화면 이동 시 복구용 초안을 유지하고 저장/사진 업로드 중 중복 저장과 이동을 막는다. 파일 바이트와 임시 사진 URL은 초안에 보관하지 않는다.
- `GET /api/admin/workspace`는 관리자 세션 전용이며 상품 예약·실제 견적 예약·양쪽 견적 문의·상품 목록의 최소 필드만 제공한다. `AdminWorkspaceProvider`를 대시보드·통합 검색·업무 알림이 공유한다. 한국시간 오늘과 실제 투어 기간, 팀 총액(0 포함)을 사용하고 단순 문의는 예약/매출에서 제외한다. 일부 조회 실패 시 해당 합계는 미확인으로 표시한다. 고객 토큰·서명·여권·내부 메모는 보내지 않는다. 조회는 60초/창 포커스와 관련 저장 후 갱신하며 계정 변경·로그아웃 시 이전 자료를 차단한다. 업무 알림은 입금 신고·계약 동의·출발 전 배정·견적 답변 목록이고 해당 상세에서 처리하면 사라진다. 알림 패널을 여는 행위는 고객에게 메시지를 발송하지 않는다.
- 예약 작업 검증: `node scripts/check-reservation-workspace.mjs` (`--serve`는 기본 8795번 포트 `/__local-admin`, `--port=8796`으로 변경 가능). 로컬 SQLite와 실제 상품·문서·공개 자료 API로 저장/재조회·금액·사진·시간·이동 정보·명소·권한을 확인하며 이메일은 로컬 응답으로 대체하고 외부 호출을 차단한다.

- `/admin` = React 관리자(`src/components/admin/AdminLayout.tsx`·`AdminSidebar.tsx`). 이메일·비밀번호 로그인(Lucia 세션).
- **맞춤 견적 메뉴** = INHASU 관리 도구를 같은 출처 iframe으로 끼운 것: `/admin/quote-desk/:tool`(`src/pages/AdminQuoteDesk.tsx`, `src/components/admin/quoteDesk.ts`). 진입 시 `GET /api/auth/quote-desk`로 `ADMIN_TOKEN`을 받아 `sessionStorage['leaders_admin_token']`에 넣는다(견적 도구가 원래 쓰던 자리). 견적 도구는 `public/admin-embed.js`로 임베드 상태에서 자체 메뉴를 숨긴다.
- INHASU의 `admin.html`은 `public/견적관리.html`(+`견적관리-모바일.html`)로 이름을 바꿨다. `/admin`은 React 관리자다.
- **최초 1회**: 통합 DB에는 관리자 계정이 없으므로 `/admin/login`이 "처음 설정" 폼을 띄운다 — 기존 견적 관리자 비밀번호(`ADMIN_TOKEN`) + 새 이메일·비밀번호(`POST /api/auth/admin-setup`, 관리자가 0명일 때만 동작).
- 휴대폰에서는 React 관리자가 반응형이 아니어서 `/견적관리-모바일`(공유 비밀번호)을 쓴다.
- 관리자 UI는 한국어. `AdminAccommodationOps`만 몽골어(현지 스태프용).
- 이미지·홈 공개 검증: `node scripts/check-admin-media.mjs`(npm ci 필요). 로컬 Lucia/SQLite/메모리 R2로 관리자 업로드·상품/배너 저장·초안 비노출·작은 이미지·ETag·Cache API를 검사한다. `--serve`는 8793번 포트의 테스트 관리자 화면을 연다. 운영 DB·R2·발송 서비스에 연결하지 않는다.
- 검색 기준은 **몽골 여행·몽골 투어**. 공개 상품·매거진·카테고리·기획전은 서버가 메타와 읽을 수 있는 본문을 주입한다. 실제 공개 데이터만 sitemap/상품 schema에 넣고, 숨김·없는 상세는 404, 일시 DB 실패는 재시도 가능한 503으로 응답한다. 관리자·고객 문서·미리보기 호스트는 noindex다. `tests/public-seo.test.mjs`는 Miniflare의 실제 HTMLRewriter/D1도 검증하므로 로컬 루프백 연결이 필요하다.

### 5.1 관리자 사용성 변경 (2026-10-19)

1. **상품·견적 예약의 작업 흐름**: 공통 `ReservationWorkflow`와 고객 문서·주문 정보·결제·배정·이력 이동을 사용한다. 견적 상세는 같은 출처 iframe 안의 안정된 host에 React portal로 공통 UI를 연결하며 원래 `BK` 편집본·PATCH·공개/발송 동작을 유지한다. 예약관리 일차 카드도 견적 STEP 2의 공통 `QuoteDayEditor`를 쓰고, 기존 사진·상세 metadata·숙소 태그를 보존한다. 기존 견적서·확정일정표 PC/모바일 PDF와 고객 링크 주소는 유지한다.
2. **숙소 보드와 차량 정본**: `GET /api/admin/assignments`와 `PATCH /api/admin/assignments/:source/:id`는 상품·견적 예약을 함께 다룬다. 화면 키는 `product:<id>` / `quote_booking:<id>`이며 ID만 비교하지 않는다. 저장은 `expectedVersion`과 현재 원본을 비교하는 CAS이며, 읽은 뒤 다른 화면이 저장했으면 409로 거절한다. 다른 경로의 변경을 덮어쓰려고 예전 예약 전체를 PUT하지 말 것. 상품 차량은 `readProductVehicle`/`syncProductVehicle`로 운영 정보와 기존 계약 차량 값을 한 번의 조건부 저장에서 맞추며, 명시적인 빈 값은 배정 해제다. 기사 연락처 등 내부 정보와 고객용 projection을 구분한다.
3. **배너·카테고리 저장 실패 보호**: `useAdminContentGuard`와 동기 작업 잠금으로 저장/업로드 중 중복 실행·닫기·이동을 보호한다. 저장 실패 때 편집창과 입력을 유지하고, 업로드 실패 때 기존 이미지/문구를 지우지 않는다. 변경사항이 있는 화면 이탈은 확인한다. 이 보호를 매거진처럼 새로고침 뒤 복원하는 영속 초안 기능으로 설명하지 말 것.
4. **문서 수정 후 재안내**: `adminDocumentRevision.ts`가 현재 문서 내용과 마지막 발송의 `document_revision`을 비교한다. 달라졌으면 ‘수정 후 재안내 필요’로 표시하고 미발송·수정본 발송에 포함한다. 문서 버전이 없는 과거 이력은 ‘현재 내용까지 안내됐는지 확인 필요’이며 현재본 전달 완료로 단정하지 않는다. `accepted`는 서비스 접수이지 고객 수신/열람/계약 동의가 아니다. 불확실한 `sending`/`unknown`의 중복 발송 차단은 유지한다.
5. **목록 복귀·Excel·수동 예약**: 통합 예약 검색/필터/정렬/페이지를 URL에 보관한다. 새 고객 화면의 `returnTo`는 `customerWorkspaceReturnTo`가 허용한 관리자 목록 상대 경로만 사용한다(예약·견적·달력·숙소 보드 등). 외부 주소·임의 경로는 기본 목록으로 돌린다. 옛 예약 목록용 `reservationReturnTo`도 호환 경로에 남아 있다. Excel은 현재 조회 결과·선택 예약·전체 확정 팀을 구분하며 전체 확정 팀에는 `confirmed`와 `paid`를 포함한다. 선택 키도 예약 출처를 포함한다. 수동 예약은 기존 상품을 선택해 상품 ID와 연결하거나 별도 맞춤 예약으로 작성한다.
6. **가이드·숙소 찾기**: 가이드 이름/연락처 검색, 숙소 검색/지역 필터, 현재 관리자 계정의 최근 선택을 지원한다. 같은 기간의 가이드 배정은 경고 후 확인하며, 조회 실패나 여행일 미등록을 ‘배정 가능’으로 확정하지 않는다. 이 경고는 실시간 재고 잠금이 아니므로 실제 가이드에게 가능 여부를 확인해야 한다.
7. **저장 전 관리자 문서 미리보기**: 일정은 기존 `확정일정표` renderer와 상품 PDF 변환기를 재사용한다. 관리자 세션 확인 뒤 nonce·출처·부모 window·관리자 계정을 검증한 postMessage로 메모리 snapshot만 전달한다(`admin-document-preview.js`). URL/공유 저장소에 초안 본문을 넘기거나 서버 저장·고객 공개·발송·서명 동의를 실행하지 않는다. 계약 조건 미리보기는 입력된 원문을 escape한 인쇄 뷰이며 아래 ‘계약서 통일’ 과제를 완료한 것은 아니다.
8. **매거진·배정 초안 복구**: 매거진은 계정·글 ID(새 글 별도), 숙소 보드 배정은 계정·출처·예약 ID별로 650ms 뒤 현재 브라우저에 보관한다(`adminMagazineDraft.ts`, `adminAssignmentDraft.ts`). 재진입 때 복원/버리기·원본 충돌을 안내하고 저장 성공 시 자신의 revision만 정리한다. 저장 실패·취소·이동은 복구본을 유지하며 파일 바이트와 임시 사진 URL을 제외한다. 저장/업로드 중 이동과 늦게 도착한 이전 편집기의 응답이 새 초안을 덮는 것을 보호한다.

### 5.2 고객 전용 통합 작업 화면 (2026-10-19)

| 대표 관리자 주소 | 원본 자료 |
|---|---|
| `/admin/customer-workspace/product/:id` | `reservations`의 해당 상품·수동 예약 |
| `/admin/customer-workspace/quote/:id` | `requests`의 해당 문의·발행 견적·견적 예약. 예약 전 고객도 포함 |
| `/admin/customer-workspace/legacy-quote/:id` | `quotes`의 이전 MILKYWAY 견적 문의 |

- 세 주소 모두 `AdminGuard`로 보호한다. 같은 ID가 다른 표에 있어도 출처별로 분리하며, **이름·전화번호가 같다고 고객을 자동 병합하지 않는다**. 다른 예약을 선택하는 기능은 확인된 고객 계정의 `userId`가 일치하는 예약만 대상으로 한다. 견적 매직링크 자료를 이름·연락처만으로 로그인 계정에 붙이지 않는다.
- `CustomerWorkspaceOverview`는 고객 정보·내부 상담 메모 / 일정·문서 / 결제·가이드·차량·숙소의 3열 요약을 제공한다. 좁은 화면에서는 열을 줄인다. 각 수정·문서·결제·배정 버튼은 기존 업무 폼을 펼치거나 원래 견적 편집기를 연다. 별도의 샘플 일정이나 새 저장 API로 원본 업무를 대체하지 않는다.
- 상품은 고객별 저장 문서 → 선택한 템플릿 → 예약 상품 ID의 기존 우선순위와 원래 계약·가이드 시트·문서 저장/공개/메일 발송 기능을 유지한다. 견적은 원래 문의·견적 작성·예약 편집기와 고객 PDF/계약/서명 주소를 유지한다. 이전 견적은 별도 원본(`quotes`)을 사용하므로 `requests` 고객 주소로 잘못 보내지 않는다.
- 문의 접수·견적 작성/안내 요청·고객 수락과 예약금 확인·실제 계약 동의·일정 준비·고객 공개는 서로 다른 상태다. 서버 내부 저장, 발송 요청, 서비스 접수와 고객 수신/동의를 동일하게 표시하지 않는다. `quoteIssuedAt`만으로 실제 발송 완료를 판단하지 않는다. 기존 `document_revision` 비교·재안내·중복 발송 차단도 유지한다.
- 미예약 문의의 금액·입금 상태는 미확인으로 표시한다. 확인된 **0원은 0원**이며 누락·잘못된 금액을 0원으로 만들지 않는다. 일정·숙소 준비는 실제 내용과 여행 기간에 필요한 숙박 일수로 판단하고, 명시적으로 비운 일정/항목/배정은 원본 샘플로 다시 채우지 않는다.
- 상담·메모는 관리자 내부 자료다. 고객 문서/고객 링크 응답과 구분하며 채팅·카카오톡 자동 연동으로 설명하지 않는다. 기존 메모·서명 증빙·여행자 정보·관리자 계정/문서별 초안과 저장/업로드/발송 잠금을 보존한다.
- 대시보드·공통 검색·오늘 할 일·달력·숙소 보드·통합 예약/이전 견적 목록은 출처에 맞는 대표 주소로 진입한다. 목록의 검색·상태·페이지를 검증된 `returnTo`로 유지하며 기존 상세 링크도 호환한다. 사용자 이름이나 이전 `localStorage` 고객 전달값만으로 다른 고객을 대신 열면 안 된다.

로컬 QA는 운영 DB·R2·실제 발송을 사용하지 않는다. `--customer-workspace`는 기본 검증을 유지하면서 아래 합성 자료를 추가하며 `--usability`와 함께 사용할 수 있다.

| 합성 ID | 확인할 상태 |
|---|---|
| `workspace-customer-inquiry` | 예약·견적 작성 전 문의, 내부 상담 메모 |
| `workspace-customer-product-a` (`requests`) | 발행 견적·미예약, 상품 예약과 같은 ID지만 다른 출처 |
| `workspace-customer-product-a` (`quotes`) | 이전 견적 진행 중(`processing`), 0원·저장 일정·안내문. `/admin/customer-workspace/legacy-quote/workspace-customer-product-a`로 별도 진입 |
| `workspace-customer-product-a` / `workspace-customer-product-b` (`reservations`) | `workspace-customer-account-a` 계정의 서로 다른 두 예약. 첫 예약의 팀 총액은 0원 |
| `workspace-customer-other` | 이름은 같지만 `workspace-customer-account-b`에 속한 별도 예약 |
| `workspace-product` (`--usability`) | 상품 예약과 견적 예약에 같은 ID가 있는 경우 |

`workspace-customer-product-a`는 세 표에 각각 존재한다. 상품·현재 견적·이전 견적의 링크와 저장 내용을 바꾸어 열어도 서로 대체되거나 합쳐지면 안 된다.

```bash
# API 자체 검증 후 종료
node scripts/check-reservation-workspace.mjs --usability --customer-workspace
# 빌드된 dist + 실제 API를 사용하는 합성 관리자 화면
node scripts/check-reservation-workspace.mjs --serve --usability --customer-workspace --port=8804
```

브라우저는 `http://localhost:8804/__local-admin`으로 진입한다. 데이터는 메모리 SQLite/버킷이며 재실행하면 초기화된다. `tests/customer-workspace-routing.test.mjs`는 실제 App 등록 경로·관리자 보호·출처/ID·목록 복귀 주소를 검사한다. 전체 테스트·타입·빌드·브라우저 최종 결과는 해당 변경 PR에 별도로 기록한다.

## 6. 결제

- **상품 예약**: 예약(로그인 필수) → `pending_payment` → 고객이 `DEPOSIT_ACCOUNT`로 예약금 입금 → 마이페이지 예약 상세에서 **입금 완료 신고**(`POST /api/reservations/:id/deposit-report`, `reservations.deposit_report` JSON) → 관리자 예약 관리에서 입금 확인 → `confirmed`. 잔금은 현지 현금.
- **견적 예약**: 같은 방식이 견적 시스템에 원래 있다(`public/내견적.html` → `POST /api/deposit/:token`, 관리자 `예약관리.html`의 입금 확인).
- PayPal 코드(`functions/lib/paypal.ts`, 웹훅, 인보이스 발송)는 남아 있지만 `PAYPAL_ENABLED=true`일 때만 동작한다(기본 꺼짐).

## 7. 배포

`배포안내.txt` 맨 위 "통합 플랫폼" 절이 정본. 요약:

- 빌드: `npm run build` → `dist/`. 배포: `npx wrangler pages deploy dist --project-name=milkway-mongolia`(또는 Git 연동 시 빌드 명령 `npm run build`, 출력 `dist`).
- **통합 후 처음 배포할 때 한 번**: ① R2 버킷 `milkyway-assets` 생성 ② 환경변수 추가(Google 로그인·Resend 등) ③ `/admin/login`에서 관리자 계정 만들기. 사이트 테이블은 첫 요청 때 자동으로 만들어진다(아래).
- 규칙: `main`에 직접 푸시하지 말고 feature 브랜치 → PR → 미리보기 확인 → 머지(`DEPLOYMENT.md`). 커밋 메시지는 한국어 `[영역]: 설명`.
- **사이트 표·칸의 원본은 `functions/lib/siteSchema.ts`** 다. 새 표나 칸을 쓰게 되면 거기에 적고 `SITE_SCHEMA_VERSION`을 올린다 — `[[route]].ts`의 미들웨어가 서버 인스턴스마다 한 번 확인해 없는 표는 만들고 없는 칸은 더한다(추가만, 견적 표는 다루지 않음). `tests/site-schema.test.mjs`가 "견적 표만 있는 DB"에서 코드의 모든 SQL이 맞는지 검사하므로, 정의를 빠뜨리면 테스트가 실패한다.
- 그 밖의 운영 데이터 변경(값 옮기기·정리)은 `functions/api/migrate-db.ts`를 통해서만.

### 로컬 실행
- `npm run build` 후 `npx wrangler pages dev dist --port 8788`. 로컬 변수는 `.dev.vars`(gitignore) — `ENVIRONMENT=development`면 로컬 관리자 시드가 동작한다. 로컬 D1 초기화: `npx wrangler d1 execute leaders-requests --local --file=schema.sql` (사이트 표는 첫 요청 때 자동 생성).
- 로컬 wrangler는 `/견적서.html`처럼 `.html`이 붙은 한글 주소에서 502가 난다(리다이렉트 헤더 문제, 운영은 정상). **확장자 없는 주소**(`/견적서?t=…`)로 열 것. `내견적`은 localhost에서 API 대신 `localStorage.leaders_requests`를 읽는 데모 분기가 있다.
- ⚠ **Windows + 한글이 들어간 폴더 경로 + Node 24**에서는 `fs.rmSync`가 네이티브 충돌(0xC0000409)을 내서 두 번째 `vite build`와 `wrangler dev`가 조용히 죽는다. 영문 경로에 클론하거나(권장), 영문 경로의 디렉터리 정션을 만들어 그 경로에서 실행할 것.

## 8. 다음에 이어 할 작업 (오픈된 스레드)

- **상품 데이터**: 통합 DB에는 상품·카테고리·매거진이 없다. 관리자에서 한국어·원화로 등록해야 홈/목록이 채워진다. 코드에 박혀 있던 금액(가격대 필터 100만/150만 원, 1인 참가 추가 요금 180,000원, 템플릿 샘플 금액)은 엔 금액 ×10 임시값 — 오너 확인 필요.
- **계약서 통일**: 상품 예약용 계약서(`src/pages/DocumentContract.tsx` + `company.ts`의 취소 규정·고지)가 견적 쪽 오너 원문(`public/계약서.html`: 환불규정 3조, 건강 위험 고지, 필수 동의 3개 + 캔버스 서명)과 내용이 다르다. 용어·서문만 맞춘 상태.
- **마이페이지 견적 내역**: 새 견적 요청은 사용자 계정과 연결되지 않는다(매직링크 방식). 브라우저에 저장한 `mw_quote_links`(`estimate-desktop/quoteLinks.ts`)로만 "내 견적" 링크를 다시 보여 준다.
- **남은 보안 보완**: 견적 API는 공유 관리자 토큰 하나를 사용하고 인증 시도 제한이 없다. 기존 호환용 URL 토큰 경로(`/api/file`, `/api/notify-test`)도 남아 있다. 계정별 권한·시도 제한·기존 링크 전환은 별도 작업이다.
- **메일 발신 도메인**: `functions/lib/mailConfig.ts`의 `resolveMailFrom(env)`가 전체 메일의 `MAIL_FROM`을 읽는다. 새 발신 도메인을 Resend에서 인증 완료한 뒤 Cloudflare 환경 변수에 설정한다. 미설정이면 기존 `몽골리아 은하수 <noreply@mongolryokou.com>`을 유지하며 잘못된 주소·CRLF는 발송 전에 차단한다. 순서는 `DEPLOYMENT.md` 참조.
- **SEO 운영**: 2026-10-14 확인 기준 Search Console에는 `www` URL 접두어 속성이 등록돼 있다. 대표 주소는 `https://mongolia-milkyway.com`이며 이번 `functions/_middleware.js`의 www→apex 308은 main 병합·운영 배포 후 적용된다. Domain 속성/DNS 인증 또는 apex URL 접두어 속성을 추가하고 `https://mongolia-milkyway.com/sitemap.xml`을 제출한다. 기존 DNS·`google-site-verification` 값은 소유권 확인 전 바꾸지 않는다. OG 기본 이미지는 `/img/home/1.webp`이며 검색 노출에는 실제 상품·여행 정보 등록도 필요하다.
- `functions/api/auth.ts`는 `ENVIRONMENT !== 'production'`이면 고정 로컬 관리자를 시드한다 — 미리보기 배포에 이 변수가 빠지지 않게 주의.

---

마지막 업데이트: 2026-10-19 (고객 전용 통합 페이지, 출처별 예약/견적과 목록 복귀, 관리자 공통 예약 작업·문서 버전 v5·초안 복구)
