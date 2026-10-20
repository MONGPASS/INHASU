# 고객 카카오 자동 알림

2026-10-20 로그인된 Solapi 콘솔의 승인 템플릿과 기존 견적 코드를 비교했다. 채널 `KA01PF260709023307591VCu6JTR2UNU`의 아래 템플릿은 발송 사용 가능 상태였다. 콘솔의 별도 워크플로우는 0개였다. 자동 발송은 플랫폼 서버가 저장된 업무 이벤트를 처리한 뒤 요청한다.

## Cloudflare 설정 확인 기록 (2026-10-20)

실제 Pages 프로젝트는 `inhasu`이며 `MONGPASS/INHASU` 저장소와 `mongolia-milkyway.com`·`www.mongolia-milkyway.com` 도메인이 연결되어 있었다. 과거 `milkway-mongolia` 프로젝트명·배포 명령은 사용하지 않는다. 빌드 결과는 `dist`이며 로컬 배포 설정도 `wrangler.toml`의 `inhasu`를 사용한다.

확인 시 Production은 `main`의 `c93f978`, 최근 Preview는 `c69dd9b`였다. 새 자동 알림 코드 `8f1430d`는 로컬 반영 상태로 아직 운영 배포되지 않았다. 이번 설정 확인에서는 Production 재배포를 실행하지 않았다. 환경변수 추가 완료와 새 기능 운영 반영 완료를 구분한다.

Production의 Variables and Secrets에서 아래 **키 이름과 존재 여부만** 확인했다. 기존 Secret 값은 열람하거나 문서에 기록하지 않았고, 기존 자격증명·기존 템플릿 override는 변경하지 않았다.

| 구분 | 확인된 키 이름 | 조치 |
|---|---|---|
| 발송 자격증명 | `SOLAPI_API_KEY`, `SOLAPI_API_SECRET` | 기존 Secret 존재 확인, 값 미열람·미변경 |
| 채널·관리자 문자 발신 | `SOLAPI_PF_ID`, `SOLAPI_SENDER` | 기존 Secret 존재 확인, 값 미열람·미변경 |
| 기존 종류별 템플릿 | `SOLAPI_TEMPLATE_QUOTE_ID`, `SOLAPI_TEMPLATE_CONTRACT_ID`, `SOLAPI_KAKAO_CONTRACT_TEMPLATE_ID`, `SOLAPI_TEMPLATE_ITINERARY_ID`, `SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID` | 기존 Secret 존재 확인, 값 미열람·미변경 |
| 과거 별칭·generic 설정 | `SOLAPI_TEMPLATE_ACCEPT_ID`, `SOLAPI_TEMPLATE_CHANGE_ID`, `SOLAPI_TEMPLATE_CONFIRM_ID`, `SOLAPI_TEMPLATE_DEPOSIT_ID`, `SOLAPI_TEMPLATE_SIGN_ID`, `SOLAPI_TEMPLATE_TRAVELERS_ID`, `SOLAPI_TEMPLATE_ID` | 기존 Secret 보존. 새 registry의 별칭으로 추정 연결하지 않음 |
| 견적 요청 접수 | `SOLAPI_TEMPLATE_REQUEST_RECEIVED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 일정 변경 요청 | `SOLAPI_TEMPLATE_CHANGE_REQUESTED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 예약 진행 요청 | `SOLAPI_TEMPLATE_RESERVATION_REQUESTED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 예약금 안내 | `SOLAPI_TEMPLATE_DEPOSIT_REQUESTED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 여행자 정보 요청 | `SOLAPI_TEMPLATE_TRAVELERS_REQUESTED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 계약서 서명 접수 | `SOLAPI_TEMPLATE_CONTRACT_SIGNED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |
| 예약 확정 | `SOLAPI_TEMPLATE_BOOKING_CONFIRMED_ID` | 승인 ID로 신규 Secret 저장 후 암호화된 키 이름 존재 확인 |

위 7개 신규 Secret은 저장 후 이름·암호화 상태를 확인했으며 값을 다시 열지 않았다. 기존 암호화된 채널·템플릿 ID 값이 승인 목록과 일치하는지까지 확인한 것은 아니다. 실제 고객에게 발송하여 설정을 검증하지 않았다.

Preview에는 텍스트 변수가 있었지만 고객 발송 API 키 등 **Secret은 등록되어 있지 않았다**. Production의 발송 키를 복제하지 않았다. 그러나 Preview의 D1·R2 바인딩은 Production과 **같은 운영 리소스**에 연결되어 있었다. 따라서 Preview에서 실제 고객의 견적·예약·입금·서명·업로드를 생성하거나 수정하는 테스트를 하지 않는다. 고객 알림과 업무 저장 검증은 별도 로컬 SQLite·메모리 R2·외부 발송 스텁·합성 고객 자료로 수행한다.

## 연결된 업무

| 알림 | 현재 견적 `requests` | 상품·수동 예약 `reservations` | 승인 템플릿 ID |
|---|---|---|---|
| 맞춤 견적 요청 접수 | 공개 견적 요청 저장 성공 | 해당 없음 | `KA01TP2607130715542944mHt7DCfdl6` |
| 견적서 도착 | 최초 발행 또는 명시적 공유 | 해당 없음 | `KA01TP260713071649273oEGvOPMTakg` |
| 일정 변경 요청 접수 | 새로운 변경 요청 기록 | 해당 없음 | `KA01TP260713071753441oFcWkUwDsqw` |
| 예약 진행 요청 접수 | 고객 수락을 새로 기록 | 해당 없음 | `KA01TP260713071911685KZAkkwcrS9q` |
| 예약금 입금 안내 | 예약금 안내 요청 | 기존 결제 안내 화면 유지 | `KA01TP2607130720577712Kt4V9ywVK3` |
| 여행자 정보 입력 요청 | 여행자 입력 안내 요청 | 계약 안내에 포함 | `KA01TP260713072146949PhEo09o6Hx6` |
| 계약서·여행자 정보 안내 | 최초 예약금 확인 또는 명시적 계약 안내 요청 | 최초 예약금 확인 | `KA01TP260818040134973vh8mMoMR2gq` |
| 계약서 서명 접수 | 최초 고객 서명 저장 | 최초 고객 서명 저장 | `KA01TP260713072305355gT1HCnc32cr` |
| 예약 확정 | 최초 예약 확정 | 최초 예약 확정 | `KA01TP260713072344844VSbYqd8dAAu` |
| 확정 일정표 안내 | 최초 일정표 공개 | 최초 일정표 공개 | `KA01TP260713072507314ax4oJkW3a5K` |
| 여행 주의사항 | 최초 고객 서명 저장 후 | 최초 고객 서명 저장 후 | `KA01TP260820081146181ADPL9Ew1eIN` |

견적 고객의 수락·변경 요청은 현재 고객 페이지의 카카오 상담 흐름을 통해 접수하고 관리자가 저장한다. 새 공개 쓰기 API를 만들거나 상담 링크 클릭을 수락으로 간주하지 않는다. 상품 신규 예약에 견적 전용 접수 문구를 보내지 않는다. 이전 MILKYWAY `quotes` 문의는 별도 원본이며 현재 견적 예약 이벤트와 합치지 않는다.

콘솔에 남은 예전 ‘여행계약서 서명 요청’ 템플릿은 최신 ‘계약서 및 여행자 정보 안내’로 대체했다. ‘출발 7일 전 가이드북’ 자동화는 2026-08-20 서명 직후 여행 주의사항 정책으로 전환된 이력이 있어 재활성화하지 않는다. 주의사항 템플릿은 계약 작성 완료를 알리므로 서명 전에는 수동 발송도 차단한다.

## 설정과 발송 결과

- `functions/lib/customerNotifications.ts`가 승인 템플릿 목록·이벤트별 문구·변수를 관리한다. `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`은 서버 환경변수가 필요하다. API 키를 코드나 고객 응답에 포함하지 않는다.
- 명시적인 종류별 `SOLAPI_TEMPLATE_*_ID` 설정이 우선이다. 채널 설정이 없거나 위 검증 채널과 같을 때만 승인 목록의 기본 ID를 사용한다. 다른 채널은 그 채널의 명시적 템플릿 설정이 필요하다. 서로 다른 종류에 같은 ID를 복사하면 발송을 차단한다. 예전 `SOLAPI_TEMPLATE_GUIDEBOOK_ID`를 여행 주의사항에 대체 사용하지 않는다.
- 일반 조회·저장·미리보기는 발송 이벤트가 아니다. 업무 저장에 성공한 뒤 서버가 알림을 요청한다. 발송 실패 때문에 입금·공개·고객 서명 저장을 실패로 돌리지 않는다.
- 자동·수동 모두 `admin_delivery_attempts`에 출처·예약 ID·종류·요청 키·문서 버전·결과를 기록한다. 같은 자동 이벤트는 문서가 나중에 바뀌어도 다시 실행하지 않는다. 이미 같은 문서 버전을 카카오로 안내했으면 자동 안내를 생략한다. 여행 주의사항은 자동·수동 사이 1분 중복을 막는다.
- 서비스 영수증이 있는 `accepted`는 **발송 서비스 접수**다. 고객 수신·열람·계약 동의를 뜻하지 않는다. 명시적 거절은 `failed`, 네트워크·응답 불명은 `unknown`으로 남긴다. 처리 중·결과 불명 요청은 중복 발송하지 않는다. 문자 대체 발송을 사용하지 않는다.
- 자동 처리에 실패한 기존 이벤트를 재시도하거나 과거 고객에게 일괄 발송하는 작업은 추가하지 않았다. 관리자 발송 이력에서 확인한 뒤 필요한 안내를 명시적으로 다시 보낸다.

## 관리자 화면

‘지금 할 일’은 가이드·차량·숙소 배정과 문서 준비 같은 관리자 업무이므로 유지한다. 대표 업무 한 줄과 관리자 처리·고객 대기 건수를 표시하고 나머지는 기본 접는다. ‘고객 알림 자동발송 · 이력/다시 보내기’도 기본 접힘으로 제공한다. 상품 5종·현재 견적 11종의 자동 안내 상태와 기존 견적서·계약서·일정표·여행 준비 수동 발송을 구분한다. 카카오 접수를 메일 완료로 표시하지 않는다.

`GET /api/admin/customer-notices/:source/:id`는 저장된 상태만 조회하며 외부 호출이나 발송을 하지 않는다. 수동 POST는 관리자 세션과 동일 출처 요청을 확인하고 원장 확보 뒤에도 취소·수신자·토큰·문서 버전을 다시 확인한다.

검증은 SQLite 합성 고객과 외부 발송 스텁으로 수행한다. 로그인된 Solapi에서는 템플릿·워크플로우만 조회했으며 실제 고객 발송이나 채널·템플릿 설정 변경은 하지 않았다.
