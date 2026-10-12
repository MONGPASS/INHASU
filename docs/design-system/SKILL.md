---
name: milkyway-japan-design
description: Use this skill to generate well-branded interfaces and assets for Milkyway Japan (モンゴリア銀河系, Mongolia Milky Way Travel), a Japanese-language Mongolia tour-booking platform. Contains brand guidelines, colors, type, fonts, logos, photography, a 3D plasticine icon set, and mobile-first React UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files — `colors_and_type.css`, `assets/`, `fonts/`, `ui_kits/customer-web/`.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

Key principles to preserve:
- **Japanese-language-first.** Copy in polite form (〜ください / ご〜します). Never use first-person brand pronouns.
- **One primary color: teal `#0f766e`.** No secondary accent. Everything else is slate neutrals.
- **Mobile-first max-width 480px**, centered on desktop with a soft shadow frame.
- **Real photography** of Mongolian landscapes over gradients/illustrations.
- **Material Symbols Outlined** for UI icons (use `'FILL' 1` for active). **3D plasticine icons** in `assets/icons/` for shortcut rows — never hand-roll these.
- **Cards:** `rounded-xl` (12px) + `1px` slate-100 border + `shadow-toss` (0 2px 8px rgba(0,0,0,.04)).
- **Hero banners:** `rounded-3xl` (24px) + real photo + `linear-gradient(to top, rgba(0,0,0,.7), transparent)` protection overlay.
- **No emoji in headings or CTAs.** Emoji only in filter-chip labels.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
