# Milkyway Japan — Design System

**Milkyway Japan / モンゴリア銀河系 / Mongolia Milky Way** is a Mongolia-based travel agency specializing in **Mongolia tours for Japanese-speaking travelers**. The product is a mobile-first, Japanese-language booking platform at [mongolryokou.com](https://mongolryokou.com/) that sells guided tours (horseback riding, Gobi Desert, Terelj National Park, Lake Khuvsgul, stargazing, ger-stays), lets customers request custom quotes, find travel companions ("同行者募集"), and read reviews.

Primary audience: Japanese outbound travelers planning a Mongolia trip, booking from their phone. The vibe is **reassuring, warm, practical** — the brand leans on one big promise: **日本語完全対応** (full Japanese-language support) + 現地旅行社 (local agency). The visual tone is clean Japanese e-commerce (Toss / Hotel-style card systems) grounded in authentic real-photography of steppe / desert / horseback imagery — not illustrated, not gradient-soaked.

## Sources

This system was built by reading the production React/Vite/Tailwind codebase:

- **GitHub repo:** [`arvijixmeat-maker/MILKYWAY-JAPAN`](https://github.com/arvijixmeat-maker/MILKYWAY-JAPAN) (default branch `main`)
- **Live site:** https://mongolryokou.com/
- **Stack:** React 19 + Vite + Tailwind CSS 3 + React Router + i18next (ja/ko) + Cloudflare Workers. Icons via Google Material Symbols Outlined. Fonts: Noto Sans JP (primary), FlightSans + Pretendard (fallbacks in-repo).
- **Key files we read:** `tailwind.config.js`, `src/index.css`, `src/App.tsx`, `src/components/home/*`, `src/components/layout/*`, `src/components/product/ProductCard.tsx`, `src/pages/Home.tsx`, `src/pages/Login.tsx`, `src/pages/MyPage.tsx`, `src/locales/ja.json`.

## Products / surfaces represented

The codebase ships **two product surfaces** — we reproduce the customer surface:

1. **Customer mobile web app** (`/` and public routes) — a mobile-width (max 480px) PWA-like shell with a sticky header, dropdown menu, home feed (hero carousel, quick-links, theme tabs, promo banner, category rows, magazine, reviews) and a bottom nav (Home / Products / Travel Mates / Reviews / My Page). **This is the UI kit we reproduce.**
2. **Admin dashboard** (`/admin/*`) — full-width desktop CRUD for products/quotes/reservations/banners/etc. Noted but not reproduced; visually plainer.

## Index — files in this system

- [`README.md`](README.md) — this file. Read the **Content Fundamentals**, **Visual Foundations**, and **Iconography** sections before designing.
- [`colors_and_type.css`](colors_and_type.css) — all CSS custom properties for color, type, shadow, radius, spacing tokens. Import this at the top of any HTML file you create.
- [`SKILL.md`](SKILL.md) — entry point if used as a Claude Agent Skill.
- [`fonts/`](fonts/) — in-repo webfonts: FlightSans (Regular/Bold/Title), Pretendard (Regular/Medium/Bold). **Noto Sans JP is the primary type face and is loaded from Google Fonts.**
- [`assets/`](assets/) — logos, favicons, hero photography, icon set.
  - `logo_square.png` — primary brand mark (teal hand-drawn Korean 몽골리아 은하수 여행 brush + crescent + star)
  - `logo_horizontal.png` — horizontal lockup with Japanese tagline
  - `logo_white_full.png` — white version (nearly invisible on light bg; use on photography)
  - `favicon.png`
  - `bg_steppe.jpg`, `bg_horse.jpg`, `bg_ger.jpg`, `bg_desert.jpg` — login / hero background photography (real, warm, saturated)
  - `icons/` — 3D iconography set (plasticine Blender-style) used for Quick Links, My Page shortcuts
  - `social_icons/` — flat brand icons (Instagram, Line, Kakao, Channel Talk, Facebook)
- [`preview/`](preview/) — small HTML cards powering the Design System tab.
- [`ui_kits/customer-web/`](ui_kits/customer-web/) — React recreation of the mobile customer app, with `index.html` as a click-through prototype.

---

## Content Fundamentals

**Language.** Primary is **Japanese (ja)**. Korean (ko) exists as a secondary locale. Copy is written **directly in Japanese** — never translated from English with English rhythm. The `locales/ja.json` is the source of truth.

**Tone of voice.**

- **Polite, service-oriented, reassuring.** Heavy use of 丁寧語 (polite form): `〜します`, `〜ください`, `ご案内します`, `ご提案します`, `ご相談ください`. Never casual/plain form.
- **Company-first, not "you vs me."** The brand is always referred to in third person as **Milkyway Japan** or **モンゴリア銀河系** (Mongolia Galaxy). When addressing the user, it's the implied honorific "お客様" — so UI copy says things like "人数の選択" ("Select number of guests") rather than "あなたの人数を選択". No first-person pronouns from the brand. No "we" or "私たち" in UI copy.
- **Direct, numbered, benefit-led on the trust section.** `1. 日本語完全対応 / 2. 24時間サポート / 3. 日本人向けの食事対応 / 4. 安全第一の車両管理`. Short benefit title + 1 sentence of reassurance.
- **Enthusiastic headlines with line breaks.** Hero titles use poetic two-line breaks: `地平線の果てで出会う\n太古の大自然、モンゴル` and `夜空を彩る\n降り注ぐ星空探検`. Keep them.
- **Product titles are formulaic.** `[期間] 商品名` — `[3泊4日] ゴビ砂漠銀河ツアー` (duration in square brackets, then product name).
- **Prices are yen, comma-grouped, with `〜` suffix.** `¥78,000〜` and `250,000円〜` are both used. Settle on `¥NNN,NNN〜` for card UI.
- **Uppercase Latin tags for English badges.** `PREMIUM TRIP`, `NEW`, `HOT`, `GOBI ADVENTURE` — always on the banner tag chip (letter-spacing widened). Japanese tags (人気, おすすめ) are not cased specially.

**Casing.**

- Japanese body: mixed kanji + hiragana + katakana as natural (`モンゴル旅行専門の現地旅行社`). No forced all-caps on Japanese.
- Roman tag chips: ALL CAPS + `tracking-wider` / `letter-spacing: 0.08em`.
- Company names use Roman form in footers and formal contexts: `Mongolia Milky Way (SUUN ZAM)`, `Hello Bolor`.

**I vs. you.** No first-person brand pronouns. User-facing actions are written as infinitive UI labels: `予約する` (Book), `相談する` (Consult), `すべて見る` (View All), `ログイン` (Login). Never `あなたの予約` — instead `MY予約` or `マイページ`.

**Emoji.** Used **sparingly and only in filter chips / style tags**, not in headings or marketing copy. Seen examples: `🏞️ ヒーリング / 📸 人生ショット / 💪 アクティビティ / 🍽️ グルメ / ⛺ キャンプ` in travel-mate filter chips, and `🔥` / `📚` / `💡` / `👀` in a handful of secondary headings. **Never** in hero titles, CTAs, or product names.

**Vibe.** Safe, honest, homey. The brand does NOT lean on hype words ("amazing", "revolutionary"). It leans on practical reassurance ("日本語ガイド同行", "24時間サポート", "衛生管理を徹底") combined with awestruck descriptions of nature ("満天の星空", "太古の大自然", "地平線の果て"). Legal fine-print is thorough and present (travel-agency registration numbers, disclaimers about resale agent vs. direct seller).

**Examples from the codebase.**

> モンゴルツアー・モンゴル旅行専門の現地旅行社 (hero H1)
> 日本語完全対応 (trust badge 1)
> 日本語堪能な専門ガイドが同行し、言葉の壁なく安心して楽しめます。 (trust copy)
> 実際の旅行者のレビュー (section header)
> あなただけの特別なプランをご提案します (banner)
> 1分でリクエスト (CTA)
> 地平線の果てで出会う太古の大自然、モンゴル (hero headline)

---

## Visual Foundations

### Color

**One primary color, everywhere: teal.** The codebase hard-codes `--primary: #0f766e` (Tailwind teal-700) with a darker `--primary-dark: #115e59`. Teal is used for: logo, active nav, active tab chip, prices, "view all" links, CTA outlines, the loading spinner, focus rings, favorite/star fills, category tag chips. **There is no second accent color** — no "secondary brand." Everything else is neutral.

Neutrals are **slate** (Tailwind's slate-50 → slate-900). Text uses `#191f28` (close to Toss's signature main text) and `#8b95a1` (muted). Surfaces are pure `#ffffff` on a `#f3f4f6` app background to produce the floating-app-on-desktop look (see `.mobile-app-wrapper`).

Semantic colors are Tailwind defaults (yellow-400 for review stars, green-600 for success, red-500 for danger). The only "colorful" touch in the UI is the `#E8EFF5` soft-blue chip used for the footer's Line/Kakao/email contact buttons.

### Type

- **Primary:** Noto Sans JP (Google Fonts), weights 400/500/700. Loaded as `font-family: "Noto Sans JP", ...` on `body`.
- **Fallbacks stack:** FlightSans (custom, in-repo), Pretendard (Korean fallback, in-repo), system fonts (`-apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic"`).
- **Weights used:** 400 body, 500 meta, 700 headings + prices + CTAs. Weight 700 is the workhorse — most emphasis is weight-based, not color-based.
- **Sizes (px at mobile):** banner title 24; section title 20; card title 15; body 14; meta 13; caption 12; tag/nano 10–11. Line-height tight (1.15–1.3) for headings; 1.5 body.
- **Letter-spacing:** default, except uppercase roman tag chips which use `tracking-wider`.

### Spacing

- **Outer gutter:** 20px (`px-5`) on the mobile frame.
- **Section vertical rhythm:** sections use `py-8` to `py-12` (32–48px) with `mb-6` (24px) between header and content.
- **Card internal padding:** 12px (p-3) for product cards, 24px (p-6) for review cards.
- **Grid gaps:** 12px in the 3-up quick-links grid; 20px horizontal between review cards in the scroll rail.

### Backgrounds

- **App frame:** `.mobile-app-wrapper` is `max-width: 480px`, `background: #ffffff`, centered with `box-shadow: 0 0 40px rgba(0,0,0,0.08)` on a `#f3f4f6` desktop page background. On mobile it fills the screen.
- **Section backgrounds:** almost always pure white. Occasional `bg-slate-50` (`#f8fafc`) for footer and skeleton states. No gradients as section backgrounds. No repeating patterns. No illustrated decor.
- **Banner/hero backgrounds:** always real photography filling a `rounded-3xl` (24px radius) container, with a protection gradient overlay `from-black/70 via-black/10 to-transparent` burning up from the bottom so white text is always legible.
- **No textures, no grain, no brand pattern tile.**

### Animation

- **Duration:** 150–300ms for UI; 500ms for scroll-reveal fades.
- **Easing:** default CSS `ease` for transitions; `cubic-bezier(0.16, 1, 0.3, 1)` for reveal (imported as `--ease-out`).
- **No bounces, no springs, no scale-up on load.** Images use opacity fade-in on load (`opacity-0` → `opacity-100`).
- **One named keyframe:** `scroll-vertical` for auto-scrolling testimonial columns. Everything else is transition-based.
- **Hover / active effects are subtle:** `hover:-translate-y-1` on review cards; `active:scale-95` on product cards and icon buttons; `hover:scale-110` on social icons in footer.

### Hover & press states

- **Hover (desktop):** small shadow bump (`shadow-sm` → `shadow-lg`), a tiny `-translate-y-1` lift on review cards, opacity tweak (`hover:opacity-90`) on dark CTAs.
- **Press (mobile):** `active:scale-95` (product cards, quick-link buttons) or `active:scale-[0.98]` (banners). No color change on press. No haptic styling.
- **Active nav:** icon fills via `'FILL' 1` variable-font axis on Material Symbols + text color to `var(--primary)`. The inactive state uses `'FILL' 0` and `text-slate-400`.

### Borders

- **Card borders:** always `1px solid var(--border-subtle)` (`#f1f5f9`, slate-100). Soft, nearly invisible — the shadow does the heavy lifting.
- **Divider lines:** `1px` slate-200 inside review cards ("product name" footer strip) and slate-100 in the footer address blocks.
- **No outlines, no focus rings in the design** (accessibility improvement opportunity — flagged).

### Shadows (elevation system)

From lowest to highest:

1. **Flat** — no shadow. Used inside mobile when bottom-nav is flush.
2. **`shadow-toss`** `0 2px 8px 0 rgba(0,0,0,0.04)` — default card elevation.
3. **`shadow-soft`** `0 4px 20px -2px rgba(0,0,0,0.05)` — home feed cards.
4. **`shadow-review`** `0 4px 15px rgba(0,0,0,0.05)` — review cards.
5. **`shadow-toss-hover`** `0 4px 16px 0 rgba(0,0,0,0.08)` — on hover.
6. **`shadow-2xl shadow-slate-200`** — hero banner float (big soft colored shadow).
7. **`shadow-frame`** `0 0 40px rgba(0,0,0,0.08)` — the desktop wrapper around the mobile frame.

**Inner shadows are not used.** Protection gradients (`from-black/70 via-black/10 to-transparent`) are used **instead of solid capsule chips on photos** when text sits directly on imagery.

### Layout rules

- **Fixed max width 480px.** The site is mobile-first and does not have a desktop-specific layout — on desktop it remains a 480px column centered with a soft shadow.
- **Sticky top Header (`sticky top-0 z-50`)** — 64px tall, white, thin bottom border.
- **Fixed Bottom Nav (`fixed bottom-0`)** — 84px tall, 5 icons, flush white. Always visible on public routes (hidden on Admin).
- **Horizontal scroll rails** for hero banners, review cards, tab chips, and theme tabs. `snap-x snap-mandatory` is used on hero and reviews.
- **Content uses CSS `content-visibility: auto`** aggressively for performance.

### Transparency & blur

- **`backdrop-blur-[2px]` + `bg-black/20`** on the dropdown-menu scrim (very restrained blur).
- **`backdrop-blur-sm`** on the favorite-button pill sitting on product images.
- **No frosted-glass headers.** No hero blur. Blur is rare and deliberate.

### Color vibe of imagery

Saturated, warm, real. Every hero photo features **humans in the Mongolian landscape**: riders on horseback against a huge green steppe + dramatic sky, girls in front of rust-orange desert canyons, women in traditional Mongol silk costumes in front of temples. Skies are deep blue with big cumulus clouds; grass is electric green; deserts are sunset-orange. No B&W. No grain. No filter. Shot like a travel Instagram feed.

### Corner radii

- `rounded-xl` (12px) — product cards
- `rounded-2xl` (16px) — review cards, dropdown menu
- `rounded-3xl` (24px) — hero banners, category banners
- `rounded-full` — chips, pills, avatars, CTAs in the footer
- `rounded` (4px) — tiny uppercase Roman tag chips

### What a card looks like

Default card = white background + `rounded-xl` (12px) + `border border-slate-100` + `shadow-toss` (`0 2px 8px rgba(0,0,0,0.04)`). Image at top (aspect-square or fixed height), thin meta line under the image, bold title, bold teal price. Favorite heart sits `absolute top-2 right-2` inside a `rounded-full bg-black/20 backdrop-blur-sm` pill.

---

## Iconography

**The product uses three layered icon systems.** Follow this order when choosing an icon:

### 1. Google Material Symbols Outlined (primary UI icons)

Loaded via Google Fonts in `index.html` with `opsz,wght,FILL,GRAD@24,400,0,0`. Used everywhere for inline UI icons: nav, headers, chips, buttons (`home`, `inventory_2`, `group`, `rate_review`, `person`, `menu`, `chat_bubble`, `favorite`, `star`, `arrow_forward`, `grid_view`, `hiking`, `landscape`, `expand_more`). Active states toggle `'FILL' 1` via variable-font axes. Weight stays at 400.

**Use this first.** It is the authoritative icon set.

CDN load:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
```

Then: `<span class="material-symbols-outlined">home</span>`.

### 2. In-repo 3D plasticine icons (feature shortcuts)

Big soft 3D rendered objects (looks Blender-modeled with a matte plasticine material: orange/blue/green smiling blobs for travel mates, a yellow shopping tag for products, a 3D bell for notifications, a heart for wishlist, etc.). Used only on the **Quick Links** home-row and **My Page** shortcuts — never inline in text. Always displayed at 64×64px inside an invisible `p-2` padding box.

Files: `assets/icons/business_quote.png`, `faq.png`, `notification-bell-3d.png`, `recent.png`, `review.png`, `support.png`, `tour_quote.png`, `travel_mates.png`, `wishlist.png`. Copy them in — **do NOT substitute with Material icons when the design calls for the 3D shortcut row**.

### 3. Brand social icons (footer / share)

Flat color PNG icons for Instagram, Line, Channel Talk, Kakao, Facebook — in `assets/social_icons/`. Each is 40×40 flat brand-colored. Never mix these with Material Symbols.

### Not used

- **Emoji as icons** — only in filter chip labels (see Content Fundamentals). Never as UI icons.
- **Unicode glyphs as icons** (•, ★, etc.) — use Material Symbols instead.
- **Custom hand-rolled SVGs** — the brand has none; do not invent any. If you need an icon Material doesn't provide, flag it.

### Logo

The square mark (`logo_square.png`) is the face of the brand: a **hand-drawn Korean brush-script reading "몽골리아 은하수 여행" (Mongolia Milky Way Travel)** set against a large teal crescent moon with a small star, all in `#0f766e`. It is playful and hand-made, deliberately at odds with the rest of the otherwise slick-e-commerce UI — this is intentional and gives the brand warmth. Use it at 36–48px in headers, larger on login/splash.

`logo_horizontal.png` adds a "MILKY WAY MONGOLIA" English line plus Japanese tagline (`モンゴル旅行はモンゴリア銀河水`). Use it only on wide surfaces (footer, emails).

`logo_white_full.png` is a white-on-transparent variant — verify against photography before use (it's very sparse and tends to disappear on light skies).

---

## Font-file substitution note

Noto Sans JP is the intended primary face and is loaded from **Google Fonts** — no licensing risk. The in-repo webfonts (`FlightSans`, `Pretendard`) are present as fallbacks; FlightSans-Title is used nowhere in the current codebase that I could find, but I've kept it for future use. **I did not need to substitute any fonts** — all requested families are available.

---

## Usage

```html
<link rel="stylesheet" href="./colors_and_type.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
```

Then style with the CSS custom properties — e.g. `color: var(--primary); background: var(--bg-surface); border-radius: var(--radius-xl);`.
