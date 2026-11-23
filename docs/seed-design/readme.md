# Seed Design System (당근)

Seed is the design system behind **당근 (Karrot)**, the Korean hyperlocal community and secondhand marketplace app. This project is a working copy of Seed's foundations — tokens, typography, icons — plus React recreations of every component family Seed documents, and a mobile UI kit that shows those components composed into screens.

## Sources

Everything here was read from the public repositories below. Explore them directly for anything this copy leaves out — they are the source of truth.

- **https://github.com/daangn/seed-design** — the design system. Token values come from `packages/stylesheet/global.css`; every component's geometry, colour, and motion comes from `docs/content/component/<name>/style.mdx`; the Pretendard font stack comes from `docs/src/styles/global.css.ts`.
- **https://github.com/daangn/seed-icon** — the icon set. 47 SVG glyphs are copied into `assets/svg/` from `assets/svg/` upstream (603 exist there).

No product source, Figma file, or app screenshots were provided, so nothing here reconstructs 당근's actual product screens. See `ui_kits/seed-app/README.md`.

## Index

| Path | What |
| --- | --- |
| `styles.css` | The single entry point consumers link. Imports everything below. |
| `tokens/colors.css` | Static, scale, and semantic colour tokens (light + dark scope). |
| `tokens/typography.css` | Font-size scale, weights, line heights, tracking, the semantic type ramp and its utility classes. |
| `tokens/fonts.css` | Pretendard `@font-face` rules and the font-family tokens. |
| `tokens/dimension.css` | Radii, control heights, spacing rhythm, focus ring. |
| `tokens/motion.css` | Durations, easings, press scale. |
| `tokens/base.css` | Minimal page reset: font stack, surface, link colours. |
| `guidelines/*.html` | Foundation specimen cards (colour ramps, type ladders, radii, spacing, elevation, focus, motion). |
| `components/**` | The component library — see below. |
| `ui_kits/seed-app/` | Five interactive mobile screens built from those components. |
| `assets/svg/` | Seed icon glyphs. `assets/seed-mark-*.svg` is the Seed mark; `assets/seed-cover.png` is the repo cover art. |
| `SKILL.md` | Agent-skill entry point. |
| `github.md` | Upstream sync record. |

## Components

Seed documents 34 component families; 33 are built here, grouped by concern.

- **`components/actions/`** — `BoxButton`, `TextButton`, `ChipButton`, `FloatingActionButton`, `ExtendedFloatingActionButton`, `MenuFloatingActionButton`
- **`components/selection/`** — `BoxToggleButton`, `CapsuleToggleButton`, `ChipToggleButton`, `ChipRadioGroup`, `Checkbox`, `RadioGroup`, `Switch`
- **`components/forms/`** — `TextField`, `MultilineTextField`, `SelectBox`, `Slider`, `RangeSlider`
- **`components/feedback/`** — `Callout`, `ActionableCallout`, `DismissableCallout`, `InlineAlert`, `ActionableInlineAlert`, `DismissableInlineAlert`, `Snackbar`, `Spinner`, `HelpBubble`
- **`components/overlay/`** — `AlertDialog`, `ActionSheet`, `BottomSheet`
- **`components/display/`** — `Avatar`, `AvatarGroup`, `Tabs`
- **`components/icon/`** — `Icon`

**Not built:** `chip-filter` — upstream's spec page reads "in progress", so there is nothing to copy. Ask 당근's design team, or build it from `ChipToggleButton` and label it as an extension.

**Provisional specs.** Three families are documented as families but have no published style tables: `SelectBox` (empty spec — geometry borrowed from the outlined TextField), `InlineAlert` and its actionable/dismissable siblings (options published, colours not — tints follow the Callout system). Each is flagged in its own `prompt.md`.

**Intentional additions.** `Icon` is not a Seed component; it is a thin wrapper that renders a glyph from `assets/svg` with `currentColor`, so components can take icons as props the way the specs describe.

## Content fundamentals

Seed's product surface is Korean. The register is **해요체** — polite but familiar, the way you'd speak to a neighbour, never the stiff 합니다체 of a bank app and never casual 반말.

- **Person.** The reader is addressed directly and implicitly; the subject is usually dropped. "직거래는 공공장소에서 만나세요." The app rarely says "우리" and never refers to itself in the first person.
- **Endings.** `-해요`, `-예요`, `-어요`, `-세요` carry almost every sentence. Explanations end in `-어요` ("이미 사용 중인 닉네임이에요"), instructions in `-세요` ("가격을 입력해주세요"), invitations in `-해보세요` ("다시 인증하고 이웃들과 거래해보세요").
- **Length.** One idea per sentence, usually under 20 characters for labels and under 40 for descriptions. Callouts run to two lines at most.
- **Buttons** are verb phrases, not nouns: 채팅하기, 작성 완료, 가격 제안하기, 나가기. Destructive labels say exactly what is destroyed: 삭제하기, 채팅방 나가기.
- **Errors** state the fact, then the fix, without apology or blame: "이미 사용 중인 닉네임이에요." Not "오류가 발생했습니다."
- **Numbers** use Korean units and comma grouping: 35,000원, 1,050,000원, 3km, 3분 전, 매너온도 40.5℃. Free items say 나눔, not 0원.
- **No emoji** anywhere in the documented system or its component specs. Meaning is carried by the icon set and by colour.
- **English** appears only in proper nouns and technical strings; the docs themselves are written in Korean with English component names.

## Visual foundations

**Colour.** One brand hue, the Milky Way mint, used for a single primary action per screen and for selected state. It lives under the original `carrot-*` token names (light: 50 `#ECFDF7` … 400 `#36D1A7` = primary … 950 `#032B25`; dark scope runs the same ramp reversed). The original Seed carrot orange (`#ff6f0f`) has been fully replaced in this project. Everything else is a neutral gray ramp of eleven steps. Blue is *accent* (links, informational), green *success*, yellow *warning*, red *danger*; pink and purple exist in the scale but no semantic token points at them. Alpha tints (`*-alpha-50/100/200`) do the tinting work — a low-emphasis primary button is `carrot-alpha-100` (mint at 14%), not a light mint, so it composites correctly over any surface. Every semantic name resolves in both light and dark scope; write semantic tokens, not scale tokens, and dark mode follows for free.

**Surfaces.** Named by role rather than elevation: `paper-default` (the page), `paper-contents` (recessed content, e.g. a chat backdrop), `paper-background` (gray-100 gutters between sections), `paper-sheet`, `paper-dialog`, `paper-floating`, `paper-accent`. Sections are separated by an 8px `paper-background` band, not by shadows.

**Type.** Pretendard, in exactly two weights: `normal` and `bold`. There is no medium/semibold in the token set — do not reach for 500 or 600. The ramp is semantic, not sized: `h1–h4`, `title1–3`, `subtitle1–2`, `body-l1/l2` (150% leading, for reading), `body-m1/m2` (135%, for compact UI), `caption1–2`, and `label1–6` for controls. Line height is only ever 135%, 150%, or 162%. Tracking is 0 on iOS and negative on Android (`-0.02em` to `-0.04em`) — the same design ships different tracking per platform via `[data-seed-scale-letter-spacing]`.

**Shape.** Radii are small and literal, not a smooth scale: 4px on small controls, 6px on medium and large buttons and fields, 8px on inline alerts, 10px on callouts and snackbars, 16px on the alert dialog, 20px on sheet tops, full on chips, FABs, switches, and avatars. Nothing is squircle-soft; corners are crisp.

**Depth.** Shadows appear only on things that float: `0 2px 6px rgba(0,0,0,.16)` on a medium FAB, `0 1px 3px rgba(0,0,0,.28)` on a small one, `0 4px 6px rgba(0,0,0,.15)` on a slider handle. Cards and list rows have **no** shadow and no border — they are separated by 1px `divider-1` hairlines. There are three divider weights (alpha-50, gray-200, gray-300) and you should reach for the lightest that reads.

**States.** Hover is a colour step, never an opacity change: carrot-500 → carrot-400 on primary, gray-100 → gray-300 on secondary. Pressed reuses the hover colour and adds the signature: `scale(0.95)` over 100ms with a standard ease, then back. Disabled is uniform across every variant — gray-300 fill, gray-500 label — so a disabled danger button and a disabled primary button look identical. Focus is a 2px `blue-600` outline on every focusable part, the one place blue appears structurally.

**Motion.** Short and functional. 100ms for press, 50ms for a colour change (often with a 20–50ms delay so colour lands after the squish), 150ms for the switch handle, 120ms for the slider handle ring, 300ms spring for a snackbar entering (`scale(0.7) → 1`), 100ms fade out. Nothing bounces except the snackbar. Upstream names its easing curves (`standard-easing`, `standard-entrance`, `standard-exit`, `spring-entrance`) but does not publish their numbers — the values in `tokens/motion.css` are stand-ins and are flagged there.

**Transparency and blur.** Alpha tints yes, backdrop blur no — the documented system has no blur anywhere. Modal backdrops are a flat `overlay-dim` (50% black); the low overlay is 20% black.

**Imagery.** The system defines no image treatment, no gradients, no illustration style, no patterns or textures. Product imagery is user-generated photography shown at its natural colour, cropped square with an 8px radius in list rows and full-bleed in detail views. There is no protection gradient in the specs — overlaid controls use the white `overImage` extended FAB instead.

**Layout.** Full-bleed edge-to-edge lists with 16px horizontal padding inside content; the primary action is pinned to the bottom edge as a full-width `xlarge` BoxButton; FABs sit bottom-right above the tab bar. Sections stack without cards.

## Iconography

Seed ships its own icon set (`daangn/seed-icon`, `@seed-design/icon`): 603 single-path SVGs on a 24×24 grid, painted with `fill="currentColor"`, each named `icon_<name>_<weight>.svg`.

- **Three weights**: `_thin`, `_regular` (the default UI weight), `_fill` (selected/active state, and the state icons inside callouts and snackbars). Tab bars swap regular → fill on selection rather than changing colour alone.
- **Sizes** are even and small: 12, 14, 16, 18, 20, 22, 24. Component specs name the size per part — a BoxButton's prefix icon is 16px at medium, its suffix 14px.
- **Colour** is always inherited from the label it sits beside. Icons are never multicolour and never carry their own brand colour.
- **No emoji** and no Unicode glyphs stand in for icons anywhere in the documented system.
- 47 glyphs are copied into `assets/svg/`; the other ~556 are one `github_copy_files` call away from `daangn/seed-icon@main` under `assets/svg/`. Upstream also ships PNG (`assets/png/`) and Android XML (`assets/xml/`) versions of every icon.
- The `Icon` component masks the SVG so it takes `currentColor`. Set `window.__seedIconBase` to the relative path of `assets/svg` on any page that uses it.

## Substitutions and gaps

- **Pretendard** is loaded from the author's jsDelivr distribution; upstream ships no font binaries. If 당근 licenses a different production face, drop the files in and rewrite `tokens/fonts.css`.
- **Easing curves** are stand-ins (see Motion above).
- **Radii, spacing, and control-height token names** (`--seed-radius-*`, `--seed-space-*`, `--seed-control-height-*`) are ours — Seed publishes those values inside each component's spec but has no abstract scale for them. The *values* are copied literally.
- **No 당근 logo** exists in either repository, so none is drawn here. `assets/seed-mark-*.svg` is the Seed design-system mark from the docs site favicon; the project thumbnail uses it with the word "Seed" set in type. If you need the 당근 wordmark, supply the file.
