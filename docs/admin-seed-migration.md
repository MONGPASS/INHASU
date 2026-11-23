# 은하수 관리자 SEED 전환

[관리자 화면 및 iframe 목록](admin-screen-inventory.md)과 실제 관리자 라우트(`src/App.tsx`)를 함께 기준으로 삼는다. 첫 작업 브랜치는 `feat/admin-seed-migration`이며 기준 커밋은 `cee1f4d`다.

| 관리자 공통 흐름 | 기존 구현 | SEED 대응 및 진행 상태 |
| --- | --- | --- |
| 주요·보조·위험 버튼 | Montage Button | SEED ActionButton 적용 |
| 상태 및 사이드바 알림 배지 | Montage ContentBadge 및 직접 구현 | SEED Badge 적용. 은하수 6px 모서리 사용 |
| 아이콘·텍스트 버튼 | Montage IconButton·TextButton | ActionButton의 iconOnly·ghost 검토 |
| 입력·검색·체크·선택 | AdminFields | TextField·Checkbox·Select·Switch 검토 |
| 필터 및 탭 | AdminChoice | Chip·SegmentedControl·Tabs 검토 |
| 확인 및 메뉴 | AdminDialog·AdminMenu | Dialog·AlertDialog·Menu 및 포커스 복귀 검증 |
| 로딩 및 알림 | AdminSurface·관리자 공통 알림 | LoadingIndicator·Snackbar 검토 |
| 대형 표·차트·캘린더 | AdminTable·Recharts·FullCalendar | 기존 데이터와 상호작용을 유지하며 컨트롤 전환 |
| 견적 문의 및 계산기 | HTML iframe | 별도 단계. React 견적 상세의 상태 표시부터 적용 |

SEED React와 CSS는 3.4.0이다. SEED Vite 플러그인의 HTML 테마 주입은 앱 전역에 적용되므로 관리자 CSS에서 공식 base 스타일을 불러오고 PostCSS로 관리자 스코프를 적용한다. SEED 배포 패키지의 Apache-2.0 LICENSE와 NOTICE를 배포 고지 검토에 포함한다.

이어 공통 입력·탭·다이얼로그 및 관리자 셸을 전환하고 견적 파일럿을 리뷰한다. 승인 후 예약 → 고객·일정 → 상품·코스·관광지 → 숙소·가이드·차량 → 콘텐츠·설정으로 확대한다. `rg -n '@montage-ui/(core|icon)' src`로 잔여 사용처를 확인한다. Font, 테마와 아이콘 서브셋까지 확인하고 사용처가 0건일 때 패키지를 제거한다.

기준선에서 설치·빌드·린트가 통과했다. 전체 테스트는 115개 통과, 2개 실패(`public-seo`, `representative-spots-integration`)했다. 변경 후 빌드가 통과했고 전체 테스트 결과는 동일하다. 브라우저 반응형 및 견적 저장·발송은 별도 검증 항목이다.

롤백은 병합 전에는 작업 PR을 닫고, 병합 후에는 PR 변경을 되돌리는 별도 PR을 사용한다. DB 롤백은 필요하지 않다.
