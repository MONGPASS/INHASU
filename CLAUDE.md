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
| 테스트 | `tests/*.test.mjs` (`npm test`, 121건) | 견적 문서·예약·이미지·SEO와 실제 Cloudflare HTMLRewriter/D1을 검사 |

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

### 3.8 그 밖의 함정
- `categories` 테이블에는 `updated_at`/`created_at`이 없다 — 시간 기준 정렬/조회 금지.
- `magazines`는 환경에 따라 `is_published` 또는 `is_active` 컬럼(sitemap이 둘 다 시도).
- 사이트 API 응답은 snake_case와 camelCase가 섞여 내려간다(예: `mainImages`와 `main_images`).
- 고객 상담은 `KAKAO_CHANNEL_CHAT_URL`로 연결한다. Channel Talk SDK는 제거했으므로 다시 로드하지 말 것.
- 모바일 화면의 사진은 `<img>` 대신 `MPhoto`(`mobile/mobileUi.tsx`)를 쓴다.
- 새 사이트 이미지 업로드는 WebP와 320/640/960/1280px 사본을 R2에 함께 저장한다. URL에 저장된 실제 크기가 들어가며 `productImage.ts`가 그 사본만 srcset에 넣는다. 기존 이미지는 재업로드 전까지 원본을 쓴다. 별도 Cloudflare Image Transformations는 존에서 활성화·검증한 뒤 `VITE_IMAGE_TRANSFORM=1`로만 켠다.
- 상품의 대표·본문 이미지는 업로드 후 **상품 저장 + 판매중**일 때 공개된다(본문 이미지는 상세에만 표시). 배너는 **변경사항 저장** 후 공개된다. 같은 출처의 열린 홈은 저장 이벤트로 갱신하며, 다른 브라우저는 포커스/최대 60초 조회로 갱신한다.
- 공개 이미지 `/api/images/*`·`/api/img/images/*`만 immutable 캐시를 허용한다. 견적 고객 첨부 `FILES/uploads/*`와 JSON·관리자 API의 no-store를 풀지 말 것.

## 4. 화면 구조 메모

- 페이지 파일(`src/pages/*`)은 `useIsDesktop()`으로 분기만 하고, 화면은 `*-desktop` / `*-mobile` 폴더에 있다. 스타일은 인라인 `style` + `MW` 토큰, 폰트는 **전부 Pretendard**(오너 지정, CDN 동적 서브셋 — `index.html`과 견적 페이지가 같은 jsDelivr 주소를 쓴다). 다른 웹폰트를 추가하지 말 것(아이콘용 Material Symbols만 예외). `MW_FONT_EN`은 `MW_FONT`와 같은 값이다.
- 모바일 공통: `src/components/mobile/` — `MobileShell`(헤더·검색·푸터·하단 탭), `mobileUi.tsx`, `mobileTheme.ts`. 시트·드로어에는 `data-mw-overlay`, 하단 액션 바 화면에는 `data-mw-actionbar`(플로팅 상담 버튼 숨김, `index.css`).
- 리디자인되지 않은 옛 화면(후기/동행 작성, 채팅, 견적 상세 `/estimate/:id`, 문서 출력 일부)은 Tailwind + 틸 `#0f766e` 스타일 그대로. 옛 디자인 가이드는 `docs/design-system/`(일본어 사이트 시절 문서 — 카피·통화 규칙은 무시).
- 고객 로그인은 Google OAuth뿐(이메일/비밀번호는 관리자 전용). 견적 흐름은 로그인 없이 매직링크(`?t=` 토큰).
- 견적 고객 페이지(`내견적`·`계약서`·`여행자정보`·`견적서`·`확정일정표`·`일정지도`)는 `public/quote-theme.css`로 사이트 톤을 입혔다. 견적서·확정일정표는 A4 794px 고정 레이아웃 + 브라우저 인쇄(PDF).
- 상품 고객 일정표 `/documents/itinerary/:id`도 기존 `확정일정표` PC/모바일 디자인으로 연결된다(`?reservationId=`). `?t=` 견적 링크는 그대로 유지한다. 가이드용 `?guide=1`은 기존 출력 화면을 쓴다.
- 상품 PDF는 `functions/lib/productItinerary.ts`가 고객별 저장 일정 → 선택한 템플릿 → 예약 상품 ID 순으로 읽는다. 상품별 일정·사진·포함/불포함과 원 단위 팀 금액을 사용하며 샘플 고객/일정으로 대체하지 않는다.
- 관리자 미리보기는 `?preview=1` + 관리자 세션이 필요하다. 고객 이메일/링크 공유 전에 `POST /api/documents/itinerary/:id/publish`로 공개한다(확정·결제·완료 예약과 저장된 일정 필요). 마이페이지는 공개된 일정표만 연결한다. 실제 발송 실패는 발송 완료로 기록하지 않는다.
- 상품 PDF 검증: `npm test`, `npm run build`, `node scripts/check-product-documents.mjs`(npm ci 필요). 마지막 검사는 로컬 SQLite D1과 Lucia 세션만 사용하며 운영 DB/고객 이메일에 접근하지 않는다. `--serve`는 브라우저 확인용 테스트 예약을 8791번 포트로 연다.

## 5. 관리자 (하나로 통합)

- 사이드바는 **대시보드 / 예약 관리 / 견적 관리 / 상품 관리 / 배정·자원 / 여행 자료 / 고객·콘텐츠 / 사이트 관리** 8개 업무로 묶는다. 현재 업무만 펼치며 원래 라우트는 유지한다. 새 견적 작성은 견적 문의 화면의 **견적 작성** 버튼으로 들어간다.
- **실제 예약 목록** `/admin/reservations`는 상품·수동 예약(`reservations`)과 INHASU 견적 예약(`requests.booking`이 있거나 `status=예약확정`)을 함께 보여 준다. 단순 견적 문의는 예약 건수에 포함하지 않는다. 이전 MILKYWAY 견적 문의는 별도 필터로 유지한다.
- 견적 예약 요약은 `GET /api/admin/bookings/quote`(Lucia 관리자 세션 필수, no-store)로 읽는다. 금액·예약금·잔금·서명 여부·출발일을 공통 표시 형식으로 바꾸지만 DB 데이터를 복사하거나 이관하지 않는다. 고객 토큰·서명 이미지·여권 정보는 요약에서 제외한다.
- 견적 예약 상세는 `/admin/quote-desk/bookings?id=...` → `/예약관리?id=...`로 최신 원본을 읽는다. 기존 localStorage 전달 방식과 고객 문서 링크도 유지한다. 새 ID 진입이 실패하면 이전 고객 데이터를 대신 열지 않는다.
- 같은 ID가 두 표에 있어도 목록의 키·편집·삭제·캘린더 연결은 예약 종류까지 구분한다. 출발 예정·캘린더·예약확정 Excel도 견적 예약을 포함한다. 일부 조회 실패 시 이전 목록을 유지하고 누락 경고를 표시한다.
- 통합 예약 검증: `npm test`, `npm run build`, `node scripts/check-admin-bookings.mjs`. 마지막 검사는 로컬 SQLite·실제 Lucia 로그인만 사용하며 운영 DB/알림에 접근하지 않는다. `--serve`로 8792번 포트의 테스트 관리자 화면을 확인할 수 있다.

- `/admin` = React 관리자(`src/components/admin/AdminLayout.tsx`·`AdminSidebar.tsx`). 이메일·비밀번호 로그인(Lucia 세션).
- **맞춤 견적 메뉴** = INHASU 관리 도구를 같은 출처 iframe으로 끼운 것: `/admin/quote-desk/:tool`(`src/pages/AdminQuoteDesk.tsx`, `src/components/admin/quoteDesk.ts`). 진입 시 `GET /api/auth/quote-desk`로 `ADMIN_TOKEN`을 받아 `sessionStorage['leaders_admin_token']`에 넣는다(견적 도구가 원래 쓰던 자리). 견적 도구는 `public/admin-embed.js`로 임베드 상태에서 자체 메뉴를 숨긴다.
- INHASU의 `admin.html`은 `public/견적관리.html`(+`견적관리-모바일.html`)로 이름을 바꿨다. `/admin`은 React 관리자다.
- **최초 1회**: 통합 DB에는 관리자 계정이 없으므로 `/admin/login`이 "처음 설정" 폼을 띄운다 — 기존 견적 관리자 비밀번호(`ADMIN_TOKEN`) + 새 이메일·비밀번호(`POST /api/auth/admin-setup`, 관리자가 0명일 때만 동작).
- 휴대폰에서는 React 관리자가 반응형이 아니어서 `/견적관리-모바일`(공유 비밀번호)을 쓴다.
- 관리자 UI는 한국어. `AdminAccommodationOps`만 몽골어(현지 스태프용).
- 이미지·홈 공개 검증: `node scripts/check-admin-media.mjs`(npm ci 필요). 로컬 Lucia/SQLite/메모리 R2로 관리자 업로드·상품/배너 저장·초안 비노출·작은 이미지·ETag·Cache API를 검사한다. `--serve`는 8793번 포트의 테스트 관리자 화면을 연다. 운영 DB·R2·발송 서비스에 연결하지 않는다.
- 검색 기준은 **몽골 여행·몽골 투어**. 공개 상품·매거진·카테고리·기획전은 서버가 메타와 읽을 수 있는 본문을 주입한다. 실제 공개 데이터만 sitemap/상품 schema에 넣고, 숨김·없는 상세는 404, 일시 DB 실패는 재시도 가능한 503으로 응답한다. 관리자·고객 문서·미리보기 호스트는 noindex다. `tests/public-seo.test.mjs`는 Miniflare의 실제 HTMLRewriter/D1도 검증하므로 로컬 루프백 연결이 필요하다.

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
- **보안 보완**: 견적 문서 페이지의 `esc()`가 이스케이프를 하지 않는다(`견적서*.html`, `확정일정표*.html`, `확정안내.html`, `일정지도.html` — 고객 입력 이름이 innerHTML로 들어감). 견적 API는 공유 토큰 하나 + 시도 제한 없음, 토큰이 URL 쿼리에 실리는 곳이 있다(`/api/file`, `/api/notify-test`).
- **메일 발신 도메인**: 발신 주소가 아직 `noreply@mongolryokou.com`(Resend 인증 도메인). 새 도메인 인증 후 교체.
- **SEO 운영**: Search Console에 새 도메인 등록·`/sitemap.xml` 제출, `index.html`의 google-site-verification을 실제 소유자 값으로 재발급. OG 기본 이미지는 존재하는 `/img/home/1.webp`를 사용한다. 기술 개선만으로 순위는 보장되지 않으며 실제 상품·일정·여행 정보 등록이 필요하다.
- `functions/api/auth.ts`는 `ENVIRONMENT !== 'production'`이면 고정 로컬 관리자를 시드한다 — 미리보기 배포에 이 변수가 빠지지 않게 주의.

---

마지막 업데이트: 2026-10-13 (상품 일정표·실제 예약 통합, 관리자 업무 메뉴 정리, 이미지 업로드·홈 갱신·캐시와 몽골 여행·몽골 투어 SEO 보완)
