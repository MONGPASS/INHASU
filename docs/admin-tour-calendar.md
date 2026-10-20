# 관리자 투어 캘린더

`/admin/calendar`는 월간 일정과 선택일의 팀별 운영 카드를 함께 표시한다. 월간/목록 보기, 고객·여행·예약번호·연락처·배정 검색, 출처 필터, 처리 필요/배정 겹침 필터를 제공한다. 선택일 카드에서 일차, 인원, 가이드, 차량, 당일 숙소, 전체 숙박 배정, 입금·계약·공개 상태를 확인한다.

## 데이터와 처리 원칙

- 상품 예약은 `/api/reservations`, 견적 예약은 `/api/admin/bookings/quote`, 이전 문의는 `/api/quotes`에서 읽는다. 키는 `product:ID`, `quote_booking:ID`, `legacy_quote:ID`로 구분한다. 같은 ID의 고객 화면이나 저장 내용을 합치지 않는다.
- 이전 문의는 기본 숨김이며 희망 일정으로 표시한다. 확정 운영 팀·인원 집계에서 제외한다. 취소는 표시·운영 집계에서 제외하고 보류는 운영 집계·배정 충돌에서 제외한다.
- 날짜는 한국 시간 기준으로 검증한다. 월을 걸치는 투어는 해당 월에도 표시한다. 미정·실재하지 않는 날짜·역전 범위는 임의로 보정하여 캘린더에 넣지 않는다. 원본은 예약 관리에서 확인한다.
- 미등록 금액·인원은 미등록으로 표시하며 실제 `0`과 구분한다. 숙소는 숙박 날짜 또는 일차별로 세므로 중복 행, 중간 날짜 누락, 취소 숙소를 배정 완료로 세지 않는다. 당일 투어와 마지막 날에는 숙박을 요구하지 않는다.
- 배정 겹침은 **저장된 동일 자원 ID**와 실제 겹치는 날짜가 있을 때만 판정한다. 동명 가이드·같은 차종·같은 기사 연락처만으로 확정하지 않는다. 현 API가 차량 ID를 제공하지 않는 예약은 차량 겹침 판정에 한계가 있다.
- 월간 겹침 건수는 그 월 안에 겹친 자원별 그룹 수다. 일별 표시·선택일 카드는 그 날짜에 실제 겹친 팀을 사용한다. 겹침 계산은 검색·출처 필터 밖의 다른 팀도 포함한다.
- 조회 일부가 실패하면 출처별 마지막 성공 자료를 유지하고 경고·재시도를 표시한다. 최초 전체 실패를 예약 0건으로 확정 표시하지 않는다. 깨진 견적 원본은 나머지 예약과 분리해 누락 경고를 표시한다.

캘린더 자체는 읽기 전용이다. 가이드·차량·숙소의 선택/관리와 입금 관리 버튼은 해당 출처의 고객 작업 화면에서 기존 패널만 연다. 실제 저장·입금 확인·고객 발송은 그 화면의 명시적인 작업으로 수행한다. 잘못된 출처나 ID를 다른 고객으로 대체하지 않는다.

## 화면 복귀

URL에 `month`, `date`, `q`, `source`, `attention`, `legacy`, `view`, `open`을 보존한다. 고객 화면의 `returnTo`에도 현재 캘린더 주소를 전달하므로 작업 후 선택일·필터·보기·선택 팀을 유지한다. 빠른 작업은 허용된 `action=guide|vehicle|stay|payments`와 캘린더 `returnTo`가 있을 때 한 번 소비하며, URL만으로 저장하거나 발송하지 않는다.

## 로컬 QA

운영 DB·R2·실제 알림 제공자에 접근하지 않는 메모리 SQLite/Lucia 합성 자료다. 다음 명령 전에 `npm run build`로 화면을 빌드한다.

```powershell
node scripts/check-reservation-workspace.mjs --serve --usability --customer-workspace --customer-notices --calendar --port=8819
```

`http://localhost:8819/__local-admin`으로 관리자 세션을 만든 뒤 `/admin/calendar?month=2026-10&date=2026-10-21`을 연다. `--serve`를 빼면 API 검증 후 종료한다. `--calendar`만으로도 검증할 수 있다.

추가 자료는 월 경계(`calendar-month-boundary`), 동일 가이드 ID와 동명 다른 ID, 동일 기사 연락처와 같은 차종 다른 기사, 3박 중 1·3일차만 배정(`calendar-lodge-gap`), 0원, 미정·오류·역전 날짜, 취소, 세 출처의 동일 ID(`calendar-shared-id`)를 포함한다. 기존 옵션의 정확한 건수 검증 뒤 추가하므로 기존 회귀 시나리오는 유지한다.

부분 실패는 `work/reservation-workspace/`에 아래 빈 파일을 만들고 새로고침하여 재현한다. 파일 제거 후 재시도로 복구한다. 최초 실패와 성공 후 실패를 각각 확인한다.

| 파일 | 실패하는 조회 |
| --- | --- |
| `calendar-reservations-unavailable` | 상품 예약 |
| `calendar-quote-bookings-unavailable` | 견적 예약 |
| `calendar-legacy-quotes-unavailable` | 이전 문의 |

집중 테스트는 `tests/admin-tour-calendar.test.mjs`, `tests/admin-calendar-view.test.mjs`, `tests/calendar-workspace-action.test.mjs`다. `npm test`, `npx tsc -b --pretty false`, `npm run build`와 위 API 합성 검증 후 브라우저에서 월/목록, 날짜 키보드 이동, 검색·필터, 고객 작업 복귀, 좁은 화면을 확인한다. 운영 배포는 별도다.
