# 안전한 배포 및 테스트 가이드 (Safe Deployment & Testing Guide)

사용자가 늘어났을 때, 서비스 중단 없이 안전하게 업데이트를 하기 위한 표준 작업 절차입니다.

## 1. 핵심 원칙
*   **Main 브랜치는 언제나 '정상 작동' 상태여야 합니다.**
*   모든 새로운 기능이나 수정 사항은 **별도의 '가지(Branch)'**에서 작업합니다.
*   별도의 가지에서 충분히 테스트한 뒤, 합격점을 받으면 Main으로 합칩니다(Merge).

## 2. 권장 워크플로우 (작업 순서)

### 1단계: 작업용 브랜치 만들기
`main` 브랜치에 직접 코드를 쓰지 않고, 작업 목적에 맞는 브랜치를 새로 팝니다.
```bash
# 최신 main 상태에서 시작
git checkout main
git pull origin main

# 새로운 작업 브랜치 생성 및 이동 (예: 새 피쳐, 버그수정)
git checkout -b feature/change-font
```

### 2단계: 작업 및 로컬 테스트
평소처럼 코드를 수정하고, `npm run dev` (localhost)로 확인합니다.
```bash
# 작업 후 저장
git add .
git commit -m "style: 폰트 변경"
```

### 3단계: 브랜치 푸시 (Push Branch)
`main`이 아닌 작업 브랜치를 깃허브에 올립니다.
```bash
git push origin feature/change-font
```
> **💡 중요:** 이렇게 하면 **실제 서비스(Main)**에는 아직 아무런 영향이 없습니다.

### 4단계: 미리보기(Preview) 및 검토
*   **Github 웹사이트**에 접속하면 "Compare & pull request" 버튼이 뜹니다.
*   **Cloudflare Pages**를 연동했다면, PR 생성 시 **'임시 미리보기 주소(Preview URL)'**가 자동으로 댓글로 달립니다.
*   이 주소는 실제 유저들은 모르는 비밀 주소입니다. 여기서 모바일/PC 등 다양한 환경에서 테스트를 진행합니다.

### 5단계: 병합 (Merge)
테스트 결과 문제가 없다면, Github에서 **"Merge Pull Request"** 버튼을 누릅니다.
*   이때 작업 브랜치의 내용이 `main`으로 합쳐집니다.
*   Cloudflare Pages가 변경된 `main`을 감지하고 **실제 운영 서버(Production)**에 배포합니다.

---

## 3. 요약
| 단계 | 위치 | 설명 | 안전도 |
| :--- | :--- | :--- | :--- |
| 1 | **Localhost** | 내 컴퓨터에서 개발 | 🟢 안전 (나만 봄) |
| 2 | **Feature Branch** | 깃허브의 별도 가지 | 🟢 안전 (운영 반영 X) |
| 3 | **Preview URL** | 테스트용 임시 주소 | 🟢 안전 (테스트용) |
| 4 | **Main Branch** | 실제 운영 서버 | 🔴 **주의** (모든 유저에게 반영됨) |

---

## 4. 자동 후기 요청 이메일 설정

Cloudflare Pages Functions에는 별도 예약 실행이 없으므로, `.github/workflows/review-request.yml`의 GitHub Actions 스케줄이 아래 API를 하루 한 번 호출합니다.

- URL: `https://mongolia-milkyway.com/api/cron/review-request`
- Method: `POST`
- Header: `Authorization: Bearer {CRON_SECRET}`
- 권장 시간: 매일 한국시간 오전 9시(UTC 00:00)

Cloudflare Pages의 Production 환경 변수에는 `CRON_SECRET`과 `RESEND_API_KEY`가 설정되어 있어야 합니다. 종료일이 지난 `confirmed`, `paid`, `completed` 예약이 대상이며, 전날 실행을 놓쳐도 다음 실행에서 자동 보충합니다. 예약 이력에 발송 완료 상태를 기록하므로 같은 예약에 중복 발송하지 않습니다.

GitHub 저장소의 Actions secret에도 Cloudflare와 동일한 이름과 값의 `CRON_SECRET`을 등록해야 합니다. Actions 화면의 `Send post-tour review requests` 워크플로에서 `Run workflow`를 실행하면 예약 실행을 기다리지 않고 즉시 연결 상태를 확인할 수 있습니다.

## 5. 관리자 초안·문서 발송 변경 확인 (2026-10-14)

- 상품 등록 초안은 계정·상품별, 상품 예약 문서 초안은 **계정·예약 ID별**로 현재 브라우저에 650ms 뒤 보관된다. 예약 문서는 일정표·계약 조건·여행 날짜를 함께 복원/버리기하며 서버 저장 성공 시에만 해당 초안을 정리한다. 저장 실패·화면 이동·새로고침 복구, 저장/사진 업로드 중 중복 작업 차단을 확인한다.
- 견적 PC·모바일·예약관리 초안은 **계정·요청 ID별**이다. 토큰·서명 원본·파일 바이트·임시 URL을 제외하며 복원은 서버 저장과 구분한다. PC의 `id`, 모바일 편집의 `qe`, 예약 상세의 `id`가 iframe 전체 새로고침 후에도 유지되는지, 바깥 메뉴/Back/새로고침에서 안쪽 초안을 보호하는지 확인한다.
- 스키마 v4는 `admin_delivery_attempts`를 자동 추가한다. 기존 예약·입금·계약 원본과 견적 표를 이관하거나 삭제하지 않는다. 관리자 공통 5단계(예약 접수·예약금 확인·계약 동의·일정 준비·일정표 공개)와 별도로 발송 이력을 확인한다. `accepted`는 서비스 접수이며 수신 완료를 의미하지 않는다. `failed` 재시도는 새 키를 사용하고, `sending`/`unknown`은 기존·새 견적 발송 경로를 포함해 중복 발송을 차단한다.
- 고객 PDF는 `document-safe.js`로 고객 텍스트와 관리자 HTML 서식을 구분해 처리한다. 원래 디자인·사진·굵게/줄바꿈/색상과 `*` 강조·`(` 회색 표시를 확인한다. 비공개 첨부는 관리자 헤더 인증과 기존 다운로드 링크를 함께 지원하며 `private, no-store`·`nosniff`를 유지한다.
- `npm test`, `npx tsc --noEmit`, `npm run build`와 로컬 합성 자료로 초안 복원·권한·발송 실패/미확인·양쪽 ledger 경합을 검사한다. 실제 고객에게 발송하는 검증은 로컬 테스트에 포함하지 않는다. 공유 관리자 토큰과 인증 시도 제한 부재는 남은 보안 작업이다.

## 6. 메일 발신 도메인 교체

1. Resend에 새 발신 도메인을 등록하고 안내된 DNS 인증을 완료해 **Verified** 상태를 확인한다. 인증이 끝날 때까지 현재 발신 주소를 유지한다.
2. 인증된 도메인의 발신 주소를 사용해 Cloudflare Pages의 적용할 환경에 `MAIL_FROM`을 설정한다. 형식은 `몽골리아 은하수 <noreply@verified-domain.example>`처럼 표시 이름과 **실제 인증된 주소**를 넣는다. Production/Preview의 변수 적용 범위를 구분한다.
3. 변수 변경을 반영하는 배포 후, 지정한 검증 수신자로 발신 이름·주소·회신 주소와 발송 이력을 확인한다. 도메인 인증과 계정 설정 확인 없이 운영 고객 발송으로 시험하지 않는다.

`MAIL_FROM`을 설정하지 않거나 공백으로 두면 기존 `몽골리아 은하수 <noreply@mongolryokou.com>`을 유지한다. 공통 `resolveMailFrom(env)`가 문서·문의·예약·가이드·예약 실행 메일에 적용되며 잘못된 주소·복수 주소·CRLF는 서비스 호출 전에 거부한다. 키·토큰·인증값은 문서나 로그에 기록하지 않는다.

## 7. Search Console 및 대표 주소 확인

2026-10-14 기준 `www` URL 접두어 속성은 이미 등록돼 있다. 사이트의 대표 주소는 **`https://mongolia-milkyway.com`**이다. 이번 www→apex 308 변경은 `main` 병합과 운영 배포 후 적용되며 경로·쿼리와 요청 메서드를 유지한다. 배포 후 대표 주소 이동과 기존 고객 문서 링크를 확인한다.

- Domain 속성을 DNS로 인증해 하위 도메인까지 관리하거나, `https://mongolia-milkyway.com/` apex URL 접두어 속성을 추가한다.
- 해당 속성에 `https://mongolia-milkyway.com/sitemap.xml`을 제출하고 공개 상품·카테고리·매거진의 색인 상태를 확인한다.
- 기존 DNS 인증 레코드와 `index.html`의 `google-site-verification` 값은 소유권·사용 중인 속성을 확인하기 전 유지한다. 기존 `www` 속성도 대표 주소 설정을 확인하며 함께 관리한다.

## ✅ 당장 실천할 수 있는 방법
지금 당장 복잡한 PR(Pull Request) 과정이 귀찮다면, 최소한 **개발용 브랜치(dev)** 하나만이라도 만들어서 사용하는 것을 추천합니다.

1. `dev` 브랜치에서 작업하고 푸시합니다.
2. `dev` 버전 사이트에서 확인합니다.
3. 확실하면 `main`으로 합칩니다.

마지막 업데이트: 2026-10-14
