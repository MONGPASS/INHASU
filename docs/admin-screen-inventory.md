# 관리자 화면 목록 (2026-11-11 조사)

관리자(`/admin`)의 모든 화면과 그 안의 팝업을 한곳에 적는다. 디자인 규칙은 [admin-design-system.md](admin-design-system.md)에 있다.
새 화면·팝업을 만들거나 없애면 이 표를 함께 고친다.

- **유형**: 목록형 / 입력형 / 상세형 / 대시보드형 (유형별 기본 틀은 디자인 문서 4절)
- **단계**: 이 화면이 공통 규격을 어디까지 따르는지 — ① 공통 변수 ② 공통 부품 ③ 유형별 틀 ④ 업무 흐름(저장·삭제·알림). 2026-11-11 현재 모든 화면이 ①까지 적용됐고, 휴대폰 앱 틀과 공통 알림은 모든 React 화면에 적용됐다.

## 1. React 관리자 화면

| 메뉴 | 화면 | 주소 | 파일 | 유형 | 화면 안의 팝업 |
|---|---|---|---|---|---|
| (없음) | 관리자 로그인·처음 설정 | `/admin/login` | `pages/AdminLogin.tsx` | 입력형 | 없음 |
| 대시보드 | 대시보드 | `/admin` | `pages/AdminDashboard.tsx` | 대시보드형 | 기간 선택 팝오버 |
| 예약 관리 | 통합 예약 목록 | `/admin/reservations` | `pages/AdminReservationManage.tsx` + `components/admin/v7/ReservationListV7.tsx` | 목록형 | 예약 상세 서랍, 가이드·숙소 고르기 창, 견적 상세 서랍, 예약 전환 선택 창, 수동 예약 추가 창, 줄별 더보기 메뉴, 일괄 작업 막대 |
| 예약 관리 | 투어 캘린더 | `/admin/calendar` | `pages/AdminCalendar.tsx` | 대시보드형 | 날짜 옆 패널(화면 안에 고정) |
| (목록에서 진입) | 고객 예약 관리 — 상품 예약 | `/admin/customer-workspace/product/:id` | `AdminReservationManage.tsx`(`customerPage`) + `v7/ReservationDetailV7.tsx` | 상세형 | 가이드·숙소·차량 고르기, 저장 전 미리보기(전체 화면), 일정표·계약 편집기(전체 화면), 휴대폰용 메뉴 |
| (목록에서 진입) | 고객 예약 관리 — 이전 견적 | `/admin/customer-workspace/legacy-quote/:id` | 위와 같음(`customerSource="quote"`) | 상세형 | 위와 같음 |
| (목록에서 진입) | 고객 통합 작업 — 견적 예약 | `/admin/customer-workspace/quote/:id` | `pages/AdminQuoteDesk.tsx`(`customerPage`) | 상세형(+견적 도구) | 더보기 메뉴, 발송 이력 옆 패널, 예약 편집기(`예약관리.html`)의 확인 창 |
| (목록 필터) | 맞춤견적 관리(이전 MILKYWAY 견적) | `/admin/quotes` | `pages/AdminQuoteManage.tsx` | 목록형 | 견적 상세 서랍, 예약 전환 선택 창 |
| 배정·자원 | 숙소 배정 · 현지 운영 | `/admin/accommodation-ops` | `pages/AdminAccommodationOps.tsx` + `accommodation/LodgeAssignBoard.tsx` | 목록형(칸에서 바로 고침) | 숙소·등급·상태 고르기 창, 숙박 추가 시트 |
| 배정·자원 | 가이드·숙소·차량 — 가이드 배정 현황 | `/admin/quote-desk/resources?view=schedule` | `components/admin/guides/GuideSchedule.tsx` | 대시보드형 | 가이드 상세 옆 패널, 가이드 피켓 미리보기, 배정 고르기 창 |
| 상품 관리 | 상품 목록 | `/admin/products` | `pages/AdminProductManage.tsx` | 목록형 | 없음(삭제 확인만) |
| 상품 관리 | 상품 추가·수정 | `/admin/products`(같은 주소에서 전환) | `AdminProductManage.tsx`의 `ProductModal` | 입력형 | 호텔 고르기, 코스에서 불러오기, 일정 가져오기, 관광지 고르기, 디자인 블록의 문구·사진 팝오버 |
| 상품 관리 | 상품 카테고리 | `/admin/categories` | `pages/AdminCategoryManage.tsx` | 목록형 | 카테고리 편집 서랍 |
| 상품 관리 | 문서 템플릿 | `/admin/templates` | `pages/AdminTemplateManage.tsx` | 목록형 | 일정표 편집기(전체 화면), 가이드·숙소 등록 창, 호텔·관광지 고르기 |
| 고객·콘텐츠 | 일반 문의 | `/admin/inquiries` | `pages/AdminInquiryManage.tsx` | 목록형 | 문의 상세 옆 패널(화면 안에 고정) |
| 고객·콘텐츠 | 후기 관리 | `/admin/reviews` | `pages/AdminReviewManage.tsx` | 목록형 | 후기 등록·수정 창 |
| 고객·콘텐츠 | FAQ 관리 | `/admin/faq` | `pages/AdminFAQManage.tsx` | 목록형 | FAQ 편집 창, 분류 편집 창 |
| (FAQ에서 진입) | 상품별 FAQ | `/admin/tour-faqs` | `pages/AdminTourFAQManage.tsx` + `TourFAQEditor.tsx` | 입력형 | 없음 |
| 고객·콘텐츠 | 매거진 관리 | `/admin/magazines` | `pages/AdminMagazineManage.tsx` | 목록형 → 입력형(글 쓰기) | 지도 위치 고르기, 분류 편집 창 |
| 사이트 관리 | 홈 화면 관리(배너) | `/admin/banners` | `pages/AdminBannerManage.tsx` | 입력형 | 없음 |
| 사이트 관리 | 여행기획전 관리 | `/admin/promotions` | `pages/AdminPromotionManage.tsx` | 목록형 | 기획전 편집 창 |
| (메뉴 없음) | 상품용 가이드 | `/admin/guides` | `pages/AdminGuideManage.tsx` | 목록형 | 가이드 등록 창 |
| (메뉴 없음) | 상품용 숙소 | `/admin/accommodations` | `pages/AdminAccommodationManage.tsx` | 목록형 | 숙소 등록 창 |
| 모든 화면 | 상단 바의 업무 알림·통합 검색 | — | `components/admin/AdminToolbar.tsx` | — | 업무 알림 패널, 검색 결과 |

다른 화면으로 넘기기만 하는 주소: `/admin/hotels`·`/admin/guide-intro` → 가이드·숙소·차량, `/admin/tourist-spots`·`/admin/design-spots` → 여행지 관리.
쓰이지 않는 파일: `pages/AdminAssignment.tsx`(연결된 주소 없음), `components/admin/Admin3DIcon.tsx`(불러오는 곳 없음).

## 2. 견적·일정·관광지 도구 (관리자 안에 끼워 넣은 예전 화면)

`/admin/quote-desk/:tool`이 같은 출처의 문서를 iframe으로 보여 준다(`src/components/admin/quoteDesk.ts`). 파일 이름·주소·id·class는 바꾸지 않는다(`CLAUDE.md` 3.1, 3.3).

| 메뉴 | 화면 | 주소 | 파일(`public/`) | 유형 | 화면 안의 팝업 |
|---|---|---|---|---|---|
| 견적 관리 | 견적 문의 | `/admin/quote-desk/inbox` | `견적관리.html` | 목록형 | 문의 상세 서랍(`#drawer`), 삭제·상태 확인 |
| 견적 관리 | 견적 예약 목록 | `/admin/quote-desk/bookings` | `예약목록.html` | 목록형 | 출발 일정 패널(`#tlMask`) |
| (목록에서 진입) | 견적 예약 편집 | 고객 통합 작업 화면 안 | `예약관리.html` | 상세형 | 확인 창(`#confirmLayer`), 더보기 메뉴, 확정일정표 알림 창 |
| 견적 관리 | 견적서 만들기 | `/admin/quote-desk/builder` | `견적만들기.html` | 입력형(4단계) | 고객 링크 창(`#linkMask`) |
| 견적 관리 | 코스 관리 | `/admin/quote-desk/courses` | `코스관리.html` | 목록형 | 코스 편집 서랍 |
| 견적 관리 | 일정관리 | `/admin/quote-desk/itinerary` | `일정관리.html` | 목록형 | 일정 문구 편집 서랍 |
| 견적 관리 | 여행지 관리 | `/admin/quote-desk/spots` | `명소관리.html` | 목록형(카드) | 여행지 편집 서랍 |
| 배정·자원 | 가이드·숙소·차량 — 등록 정보 | `/admin/quote-desk/resources?view=registry` | `리소스관리.html` | 목록형(카드/목록) | 등록 정보 편집 서랍 |
| (휴대폰 전용) | 모바일 관리자 | `/견적관리-모바일` | `견적관리-모바일.html` | 여러 유형 | 아래 시트·전체 화면 시트·확인 창(`appConfirm`) |
| (새 창 문서) | 가이드 시트 | `/가이드시트?id=` | `가이드시트.html` | 인쇄 문서 — 관리자 규격 대상 아님 | 없음 |

## 3. 조사에서 확인한 차이 (정리 전 상태)

같은 일을 하는 부품이 화면마다 따로 만들어져 있었다. 아래 수치가 이후 단계의 작업 목록이다.

| 부품 | 서로 다른 구현 수 | 대표 예 |
|---|---|---|
| 강조색(민트) | React 9가지 값 + 견적 도구 5가지 값 | `#12B28C`, `#0E9E7A`, `#06C4A0`, `#36D1A7`, `#1EB496` … → 1단계에서 `--adm-accent` 하나로 연결 |
| 버튼 | 약 9종 | `.btn`, `.cm-btn`, `.lo-btn`, `.tc-button`, `.cw-button`, v7 `ghostBtn/inkBtn`, Tailwind 버튼, 견적 도구 `.hbtn/.add/.rg-add` |
| 버튼 높이 | 28·32·34·36·40·44·46·48px | 모서리도 6·8·10·11·999px이 섞임 |
| 입력창 | 약 7종, 높이 36·38·40·44·46px | `.inp`, `.cm-input`, `.lo-input`, `.hm-field`, Tailwind 입력창 |
| 검색·필터 줄 | 약 10종 | `.tb-search`, `.pd-search`, `.cm-search`, `.lo-search`, `.tc-search` … |
| 표 | 약 8종 | `.tbl`, `.pd-table`, `.cm-table`, Tailwind 표, 견적 도구 표 |
| 상태 배지 | 약 11종 | `.badge`, `.cm-pill`, `.lo-status`, `.pd-status`, v7 `chip()` … |
| 탭 | 약 14종 | `.tab`, `.seg`, `.cm-tabs`, `.hm-tabs`, `.la-tabs` … |
| 팝업 | 약 10종, 겹침 순서 29~10010 | `.drawer`, `.picker`, `.cm-modal`, Tailwind `fixed inset-0` 8개, 견적 도구 `#drawer` 폭 432~600px |
| 알림 | 약 6종 + `alert()` 143곳 | `.page-toast`, `V7Toast`, `.gs-toast`, `.la-toast`, 견적 도구 `toast()` |
| 삭제 확인 | `window.confirm` 약 82곳(React) + 16곳(견적 도구) | 공통 확인 창 없음. `예약관리.html`의 `askConfirm`, 모바일의 `appConfirm`만 자체 창 |
| 글자 크기 | 약 30가지 | 9~44px, 12.5·13.5px 같은 반 단위 포함 |
| 불러오는 중·빈 목록 | 공통 부품 없음 | "불러오는 중" 문구 23곳, `*-empty` 클래스 15종 |
| 휴대폰 화면 | (2단계에서 해결) 모든 React 화면이 앱 틀로 열림 | 정리 전에는 390px에서 25개 화면이 가로로 넘쳤다. 지금은 넘치는 화면이 없고, 목록 표는 카드로 보인다 |
