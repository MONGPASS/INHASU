# 관리자 디자인 전환 현황

`node scripts/check-admin-design.mjs --md`가 만든 문서다. 손으로 고치지 않는다. 규칙은 [admin-design-system.md](admin-design-system.md), 화면 목록은 [admin-screen-inventory.md](admin-screen-inventory.md).

- **부품 전환율** = 공통 부품 수 ÷ (공통 부품 + 생 `<button>`·`<input>`·`<select>`·`<textarea>`·`<table>`). 공통 부품은 우리 관리자 부품(`components/admin/ui`의 `Admin*`·`ListPage` 등, 당근 Seed 모양)이다. 그 폴더는 생 HTML 요소로 부품을 만드는 곳이라 생 부품 수를 세지 않는다. `adm-` 클래스를 단 버튼은 공통 부품으로 센다.
- **직접 지정**: 인라인 `style={{}}` 수, 숫자로 적은 크기(px), 직접 적은 색(hex), `!important`, CSS에 숫자로 적은 크기(글자·모서리·높이·여백).
- 이 수치는 `scripts/admin-design-baseline.json`의 상한보다 늘어나면 `tests/admin-design-budget.test.mjs`가 실패한다(PR마다 CI에서 검사). 줄였으면 `--write-baseline`으로 상한을 낮춘다.

전체: 공통 부품 1837개 / 생 HTML 부품 66개 → **전환율 97%** · 인라인 style 994 · 숫자 크기 2103 · 직접 색 264 · !important 260

| 화면 | 파일 | 부품 전환율 | 공통 부품 | 생 HTML 부품 | 인라인 style | 숫자 크기(TSX/CSS) | 직접 색 | !important | 기본 확인창 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 공통 틀·부품 | 27 | 100% | 174 | 0 | 1 | 0 / 271 | 0 | 93 | 0 |
| 대시보드 | 5 | 100% | 8 | 0 | 4 | 0 / 0 | 0 | 0 | 0 |
| 통합 예약 목록 | 3 | 100% | 142 | 0 | 0 | 0 / 52 | 0 | 0 | 0 |
| 고객 예약 상세(상품·이전 견적) | 23 | 100% | 109 | 0 | 4 | 0 / 79 | 4 | 2 | 1 |
| 고객 통합 작업(견적)·견적 도구 틀 | 6 | 100% | 89 | 0 | 0 | 0 / 1 | 0 | 0 | 0 |
| 투어 캘린더 | 2 | 100% | 48 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 이전 견적 고객 상세 | 1 | 0% | 0 | 41 | 84 | 88 / 0 | 0 | 0 | 0 |
| 숙소 배정 · 배정 보드(새 디자인) | 4 | 100% | 71 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 숙소 배정·현지 운영 | 5 | 100% | 95 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 가이드 배정 현황 | 5 | 100% | 39 | 0 | 10 | 0 / 0 | 0 | 0 | 0 |
| 상품 목록·추가·수정 | 22 | 100% | 209 | 0 | 3 | 5 / 24 | 0 | 138 | 1 |
| 상품 카테고리 | 2 | 100% | 69 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 문서 템플릿 | 2 | 68% | 43 | 20 | 40 | 0 / 0 | 49 | 0 | 1 |
| 일반 문의 | 2 | 100% | 24 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 후기 관리 | 2 | 100% | 47 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| FAQ·상품별 FAQ | 5 | 100% | 85 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 매거진 관리 | 2 | 100% | 19 | 0 | 0 | 0 / 0 | 0 | 0 | 1 |
| 홈 화면(배너) | 2 | 100% | 27 | 0 | 2 | 0 / 0 | 6 | 0 | 0 |
| 여행기획전 | 2 | 100% | 39 | 0 | 2 | 0 / 0 | 0 | 0 | 0 |
| 상품용 가이드·숙소 | 3 | 100% | 49 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 콘텐츠 공통 CSS | 1 | — | 0 | 0 | 0 | 0 / 46 | 2 | 0 | 0 |
| 관리자 로그인 | 2 | 100% | 20 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 견적 문의(React 전환) | 2 | 100% | 24 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 견적 예약 목록(React 전환) | 2 | 100% | 34 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 견적서 만들기(React 전환) | 2 | 100% | 76 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 코스 관리(React 전환) | 2 | 100% | 90 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 가이드·숙소·차량 등록 정보(React 전환) | 2 | 100% | 79 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 일정 관리(React 전환) | 2 | 100% | 59 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 여행지 관리(React 전환) | 2 | 100% | 69 | 0 | 0 | 0 / 0 | 0 | 0 | 0 |
| 견적 도구 공통 CSS | 1 | — | 0 | 0 | 0 | 0 / 24 | 2 | 8 | 0 |
| (쓰이지 않는 파일) | 1 | 0% | 0 | 5 | 8 | 8 / 0 | 0 | 0 | 0 |
| 견적 도구: 견적관리 | 1 | — | 0 | 0 | 19 | 0 / 285 | 19 | 6 | 0 |
| 견적 도구: 견적관리-모바일 | 1 | — | 0 | 0 | 689 | 0 / 229 | 134 | 0 | 0 |
| 견적 도구: 예약목록 | 1 | — | 0 | 0 | 14 | 0 / 159 | 8 | 0 | 0 |
| 견적 도구: 예약관리 | 1 | — | 0 | 0 | 51 | 0 / 192 | 2 | 3 | 0 |
| 견적 도구: 견적만들기 | 1 | — | 0 | 0 | 28 | 0 / 241 | 11 | 10 | 0 |
| 견적 도구: 코스관리 | 1 | — | 0 | 0 | 5 | 0 / 120 | 2 | 0 | 1 |
| 견적 도구: 일정관리 | 1 | — | 0 | 0 | 2 | 0 / 63 | 1 | 0 | 1 |
| 견적 도구: 명소관리 | 1 | — | 0 | 0 | 22 | 0 / 77 | 5 | 0 | 0 |
| 견적 도구: 리소스관리 | 1 | — | 0 | 0 | 6 | 0 / 139 | 19 | 0 | 0 |

## 파일별 상위 20 (생 부품 + 인라인 style + 숫자 크기)

| 파일 | 화면 | 생 부품 | 인라인 style | 숫자 크기 | 직접 색 |
|---|---|---:|---:|---:|---:|
| `src/components/admin/QuoteModals.tsx` | 이전 견적 고객 상세 | 41 | 84 | 88 | 0 |
| `src/pages/AdminTemplateManage.tsx` | 문서 템플릿 | 20 | 40 | 0 | 49 |
| `src/pages/AdminAssignment.tsx` | (쓰이지 않는 파일) | 5 | 8 | 8 | 0 |
| `src/components/admin/guides/GuideSchedule.tsx` | 가이드 배정 현황 | 0 | 8 | 0 | 0 |
| `src/pages/AdminProductManage.tsx` | 상품 목록·추가·수정 | 0 | 1 | 5 | 0 |
| `src/components/admin/guides/GuideAssignList.tsx` | 가이드 배정 현황 | 0 | 2 | 0 | 0 |
| `src/components/admin/v7/ReservationDetailV7.tsx` | 고객 예약 상세(상품·이전 견적) | 0 | 2 | 0 | 0 |
| `src/pages/AdminBannerManage.tsx` | 홈 화면(배너) | 0 | 2 | 0 | 6 |
| `src/pages/AdminDashboard.tsx` | 대시보드 | 0 | 2 | 0 | 0 |
| `src/pages/AdminPromotionManage.tsx` | 여행기획전 | 0 | 2 | 0 | 0 |
| `src/components/admin/Admin3DIcon.tsx` | 공통 틀·부품 | 0 | 1 | 0 | 0 |
| `src/components/admin/ReservationWorkflow.tsx` | 고객 예약 상세(상품·이전 견적) | 0 | 1 | 0 | 0 |
| `src/components/admin/dashboard/DashboardIcon.tsx` | 대시보드 | 0 | 1 | 0 | 0 |
| `src/components/admin/dashboard/TrafficSources.tsx` | 대시보드 | 0 | 1 | 0 | 0 |
| `src/components/admin/designEditor/PopoverShell.tsx` | 상품 목록·추가·수정 | 0 | 1 | 0 | 0 |
| `src/components/admin/designEditor/SectionToolbar.tsx` | 상품 목록·추가·수정 | 0 | 1 | 0 | 0 |
| `src/components/admin/v7/v7Ui.tsx` | 고객 예약 상세(상품·이전 견적) | 0 | 1 | 0 | 0 |
| `src/components/admin/AdminDeliveryHistory.tsx` | 고객 예약 상세(상품·이전 견적) | 0 | 0 | 0 | 0 |
| `src/components/admin/AdminLayout.tsx` | 공통 틀·부품 | 0 | 0 | 0 | 0 |
| `src/components/admin/AdminSidebar.tsx` | 공통 틀·부품 | 0 | 0 | 0 | 0 |
