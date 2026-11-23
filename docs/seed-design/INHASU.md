# Seed 디자인 시스템 — 은하수 판 (관리자 기준)

관리자(`/admin`과 그 안의 견적 도구)의 디자인 기준이다(2026-11-23 오너 결정, Montage 대신).
당근 Seed 디자인 시스템(https://github.com/daangn/seed-design)을 Claude Design에서 은하수 색으로 바꾼 판
(‘Seed Design System (당근)’)을 내보내 그대로 넣었다. 고객 사이트·인쇄 문서는 대상이 아니다.

## 어디에 무엇이 있나

| 경로 | 내용 | 쓰임 |
|---|---|---|
| `public/seed/colors.css` · `typography.css` · `dimension.css` · `motion.css` | Seed 토큰 원본(내보내기 그대로) | `public/admin-tokens.css`가 `@import`해 `--adm-*`에 잇는다. **직접 고치지 않는다** — Seed를 다시 내보내면 통째로 바꾼다 |
| `docs/seed-design/readme.md` | Seed 원본 안내(색·글자·모양·움직임·문구 규칙) | 디자인 판단의 기준 |
| `docs/seed-design/components/**` | Seed 부품 설계(React 예시 `*.jsx`, 속성 `*.d.ts`, 사용법 `*.prompt.md`) | 우리 관리자 부품(`src/components/admin/ui`)을 Seed 모양으로 만들 때 치수·색·상태를 여기서 읽는다. 앱에서 직접 import하지 않는다 |
| `docs/seed-design/guidelines/*.html` | 색 단계·글자·모서리·간격·그림자 견본 | 브라우저로 열어 본다 |
| `docs/seed-design/assets/svg/` | Seed 아이콘 67종(24×24, `currentColor`) | 관리자 아이콘(`ui/AdminIcons.tsx`)의 원본. 모자란 아이콘은 `daangn/seed-icon` assets/svg에서 가져온다 |

## 은하수 판에서 바뀐 것

- 토큰 이름은 Seed 그대로(`carrot-*`)이고 값만 은하수 민트다: primary `#36D1A7`(carrot-400), 누름 `#12B28C`(carrot-500).
- purple·red·yellow·blue 단계도 민트에 맞춰 바꿨다. **yellow는 민트 계열이 되었다** — 관리자의 주의 색은 이것을 쓰지 않고
  당근 Seed 원래 노랑(`--adm-warn` 등, `admin-tokens.css`에 hex로 적음)을 쓴다.
- Seed의 on-primary는 흰색이지만 `#36D1A7` 위 흰 글자는 1.9:1이라 관리자는 `--adm-on-primary`(#032B25)를 쓴다.

관리자에서의 규칙·값 표는 [admin-design-system.md](../admin-design-system.md) 2절에 있다.

## 진행

1. 토큰 — `--adm-*`를 Seed 값으로(완료, 2026-11-23)
2. 부품 — `src/components/admin/ui`를 Montage 없이 Seed 모양으로 다시 만들고 `@montage-ui/core` 제거(완료, 2026-11-23). 같은 props라 화면 코드는 그대로이고, 모양은 `ui/admin-components.css` 한 파일. 부품별 대응은 [admin-design-system.md](../admin-design-system.md) 3절 표의 ‘Seed 설계’ 칸
3. 아이콘 — `@montage-ui/icon` → Seed 아이콘(완료, 2026-11-23). `src/components/admin/ui/AdminIcons.tsx`는 `scripts/build-seed-icons.mjs`가 `assets/svg`로 만드는 생성 파일이다. 이름은 예전 그대로(`IconPlus` 등), 어느 Seed 모양인지는 그 스크립트의 MAP
