# 관리자 3D 아이콘 출처와 내보내기

2026-10-20 사용자가 로그인한 클립아트코리아 계정에서 다운로드한 원본 중 관리자 화면에 필요한 아이콘을 내보냈습니다. 다운로드는 사용자의 요청으로 이루어졌습니다. 계정의 이용권과 클립아트코리아 약관이 적용되며, 이 기록이 원본 재배포나 무제한 재사용을 허용하는 것은 아닙니다.

원본 JPG·EPS·PSD·AI는 사용자의 비공개 다운로드 폴더에 보관합니다. 원본 묶음, 편집용 원본 파일, 계정 정보는 `public/`에 포함하지 않습니다.

| 콘텐츠 코드 | 사이트 검색 결과 번호 | 검색 페이지 | 선택한 아이콘 |
| --- | --- | --- | --- |
| `td02480000831` | `10887548` | [3D 비즈니스 아이콘](https://www.clipartkorea.co.kr/search?menu=m&ska=2&sort=3&keyword=3D%20%EB%B9%84%EC%A6%88%EB%8B%88%EC%8A%A4%20%EC%95%84%EC%9D%B4%EC%BD%98) | `reservation`, `achievement`, `dashboard`, `target`, `customer`, `message`, `idea`, `calendar` |
| `ta0336a0305` | `18966166` | [3D 여행 아이콘](https://www.clipartkorea.co.kr/search?menu=m&ska=2&sort=3&keyword=3D%20%EC%97%AC%ED%96%89%20%EC%95%84%EC%9D%B4%EC%BD%98) | `travelers`, `flight`, `travel`, `route` |
| `ti013a33602` | `10690495` | [3D 여행 아이콘](https://www.clipartkorea.co.kr/search?menu=m&ska=2&sort=3&keyword=3D%20%EC%97%AC%ED%96%89%20%EC%95%84%EC%9D%B4%EC%BD%98) | `hotel` |
| `ti436a47512` | `16955257` | [3D 여행 아이콘](https://www.clipartkorea.co.kr/search?menu=m&ska=2&sort=3&keyword=3D%20%EC%97%AC%ED%96%89%20%EC%95%84%EC%9D%B4%EC%BD%98) | `vehicle` |
| `ti367a44202` | `16540501` | [3D 지갑 아이콘](https://www.clipartkorea.co.kr/search?menu=m&ska=2&sort=3&keyword=3D%20%EC%A7%80%EA%B0%91%20%EC%95%84%EC%9D%B4%EC%BD%98) | `payment` |

사이트가 상세 화면을 팝업으로 제공하여 재현 가능한 상세 URL을 얻지 못했습니다. 위 콘텐츠 코드와 검색 결과 번호로 원본을 식별할 수 있습니다.

## 내보내기 규칙

- 결과는 `public/assets/admin-3d/<이름>.webp`의 192 × 192px 이미지입니다. 180 × 180px 안에 비율을 유지해 배치합니다.
- 비즈니스 JPG는 아이콘별 사각 영역을 그대로 잘랐습니다. 흰 배경을 알파로 변환하거나 색상을 변경하지 않았습니다. 밝은 관리자 표면에서는 CSS `mix-blend-mode: multiply`로 표시합니다.
- 여행 PSD는 원래의 개별 그룹만 합성하여 알파를 보존합니다. 차량 PSD는 이미 분리되어 있는 차량 픽셀 레이어만 내보냅니다.
- 호텔·결제 AI는 PDF 호환 부분에서 호텔·여권 영역과 지갑·지폐·원화 동전 영역만 각각 렌더링합니다. 단일 배경 사각형만 메모리 안에서 숨겨 알파를 보존하며, 그림이나 원본 AI 파일은 변경하지 않습니다.
- 생성형 이미지, 픽셀 기반 배경 제거, 재채색, 개체 재구성은 사용하지 않습니다.
- 장식 이미지에는 빈 대체 텍스트와 고정 크기를 사용합니다. 메뉴 이름과 업무 상태는 텍스트로 계속 제공합니다. 작은 편집·화살표·상태 아이콘은 기존 글리프를 유지합니다.

## 다시 내보내기

`scripts/admin-3d-assets.py`는 Pillow, psd-tools, PyMuPDF가 있는 Python에서 실행합니다. 원본 다섯 파일이 있는 비공개 경로를 `--source-dir`로 지정합니다. 결제 AI의 다운로드 파일명은 `ti367a44202 (4).ai`입니다. psd-tools·PyMuPDF를 격리 설치했다면 `--python-deps`로 설치 경로를 지정할 수 있습니다.

```text
python scripts/admin-3d-assets.py --source-dir <private-download-directory>
```

스크립트는 원본 크기·레이어 경계·호텔 배경 도형을 확인한 뒤 내보내므로, 다른 버전의 원본이 들어오면 임의 영역으로 진행하지 않고 오류를 냅니다. 출력 파일별 바이트 수와 전체 크기는 실행 결과에 표시합니다.

## 내보낸 파일 크기

2026-10-20 내보내기 결과입니다. 15개, 합계 **83,340바이트(약 81.4KiB)**입니다. 모든 파일은 192 × 192px입니다.

| 파일 | 바이트 | 배경 |
| --- | ---: | --- |
| `reservation.webp` | 2,706 | 원본 흰 배경 |
| `achievement.webp` | 1,876 | 원본 흰 배경 |
| `dashboard.webp` | 1,900 | 원본 흰 배경 |
| `target.webp` | 4,132 | 원본 흰 배경 |
| `customer.webp` | 1,676 | 원본 흰 배경 |
| `message.webp` | 1,422 | 원본 흰 배경 |
| `idea.webp` | 2,278 | 원본 흰 배경 |
| `calendar.webp` | 2,796 | 원본 흰 배경 |
| `travelers.webp` | 14,412 | 알파 |
| `flight.webp` | 11,432 | 알파 |
| `travel.webp` | 10,396 | 알파 |
| `route.webp` | 7,066 | 알파 |
| `vehicle.webp` | 7,164 | 알파 |
| `hotel.webp` | 5,526 | 알파 |
| `payment.webp` | 8,558 | 알파 |
