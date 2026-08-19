# master.md — Innovo Xpress TMS Design System

> **This file defines the visual identity only** — the palette, typography, spacing, radii, elevation, motion, iconography, and component styling for the Innovo Xpress TMS console. It is the design layer that `ARCHITECTURE.md` deliberately left blank.
>
> **Scope split:** `ARCHITECTURE.md` owns *what the product does and how it is engineered* (domain, behavior, contracts, folder structure). This file owns *how it looks and feels*. The **field inventory of any screen (which inputs a form has) is the builder's choice** — this file only dictates how those fields, tables, chrome, and states are *styled*.
>
> **Source of the look:** the approved **"Iris"** design (from `consignment_inline_mockup.html`). Direction: a cool **lavender-grey** canvas, a confident **flat indigo** single accent, soft rounded surfaces, and a mono face used for small technical micro-labels. Validated with the UI/UX Pro Max engine (the *Enterprise-SaaS / Plus Jakarta Sans / indigo* pairing and an indigo-violet dashboard palette). Light mode, WCAG AA.
>
> **How it plugs in (per ARCHITECTURE §12):** every value here is a CSS custom property, mapped into the Tailwind v4 theme via `@theme inline` and consumed only through the `@/ui` wrappers. No component hardcodes a hex. Rebuild any page against these tokens and it inherits the Iris look automatically.

---

## 0. Design Principles

The product is an internal console a dispatcher lives in for 8 hours a day — but the Iris look is **calm, soft, and modern**, not cramped. Density stays high; the chrome is quiet and rounded.

1. **Data first, chrome light.** Legible data per screen; the table is the hero. Chrome is quiet — soft fills, hairlines, one confident accent.
2. **Layered depth, softly.** Flat surfaces (table, tiles) sit on **1px hairlines**. Genuinely *lifted* surfaces (the create card, dropdowns, modals, toasts) carry **one soft diffuse shadow**. The **primary action** carries a subtle **indigo glow**. No random per-component shadows.
3. **One primary action per context.** Exactly one **indigo** primary button per screen/card; everything else is a neutral utility or ghost button. The eye always knows where "commit" is.
4. **Single-accent system.** **Indigo** is the one brand/interactive color (CTA, active nav, focus, links, key highlights). There is **no second brand accent** — status hues (green/amber/red/cyan/violet) are reserved for lifecycle meaning only.
5. **Color is never the only signal.** Every status is a colored **dot + text label** so it survives greyscale and colorblindness.
6. **Numbers are tabular.** Figures in tables, KPIs, money, weight, cubic, counts use the tabular **mono** face so columns never jitter.
7. **Mono for micro-labels.** The mono face also sets small **technical eyebrows / tags / table headers / order-ids** (uppercase, letter-spaced) — an Iris signature that reads as "operational".
8. **Motion is feedback.** 120–320ms transitions that explain a state change. One orchestrated reveal (the create card expanding). Always honor `prefers-reduced-motion`.
9. **Accessible by construction.** WCAG AA contrast on every text pair, a visible focus ring on every control, real semantics, full keyboard flow.

**Avoid:** ornate styling, decorative gradients/textures in chrome, emoji as icons, arbitrary z-index, a second competing accent color, hard/black shadows.

---

## 1. Color — Primitive Palette

Raw scale values. Components never reference these directly — they reference the **semantic tokens** in §2. (Lavender-grey neutral ramp + flat-indigo primary + status hues.)

### Neutrals — Lavender-grey
| Token | Hex | Typical use |
|---|---|---|
| `lav-50` | `#F5F5FB` | soft surface, input fill, row/ghost hover |
| `lav-100` | `#EFEFF5` | **app canvas background** |
| `lav-150` | `#EEEEF6` | subtle divider (inside cards/rows) |
| `lav-200` | `#E6E6F0` | **hairline border / divider** |
| `lav-300` | `#D8D8E6` | control border (inputs, buttons) |
| `lav-400` | `#ADADC2` | placeholder, faint text, neutral status dot |
| `lav-500` | `#7A7A93` | muted / secondary text |
| `lav-700` | `#45455C` | **body text** |
| `lav-900` | `#1A1A2E` | **headings / strongest ink** (indigo-charcoal) |
| `white` | `#FFFFFF` | cards, surfaces, on-primary text |

### Primary — Iris (the single accent)
| Token | Hex | Use |
|---|---|---|
| `iris-50` | `#ECEBFB` | **primary-soft** tint — selected row, active chip fill, card header strip, avatar bg |
| `iris-100` | `#DEDCF7` | soft primary border |
| `iris-600` | `#4B3FCF` | **primary** (CTA, active nav, focus ring, links, key accent) |
| `iris-700` | `#3D33B0` | primary hover |
| `iris-800` | `#332A94` | primary active / pressed |

`iris-600` on white ≈ 12:1 contrast (AAA) — safe for links, labels, and icons, not just large UI.

### Feedback hues
| Role | Base (dot) | Text-on-light | Soft bg |
|---|---|---|---|
| Success | `green-600 #16A34A` | `green-700 #15803D` | `#EAF7EE` |
| Warning | `amber-600 #D97706` | `amber-700 #B26A00` | `#FBF1DD` |
| Danger | `red-600 #DC2626` | `red-700 #C6413B` | `#FBEBEA` |
| Violet (status) | `violet-600 #7C3AED` | `violet-700 #6D28D9` | `#F4ECFE` |
| Cyan (status) | `cyan-600 #0891B2` | `cyan-700 #0E7490` | `#E6FAFD` |
| Info | = primary indigo | `iris-600 #4B3FCF` | `iris-50 #ECEBFB` |

---

## 2. Color — Semantic Tokens (the layer components use)

These map to CSS custom properties and to the Tailwind theme. **Every component references these, never a raw hex.**

| Semantic token | Value | Meaning |
|---|---|---|
| `--color-background` | `lav-100` | app canvas |
| `--color-surface` | `white` | cards, table, inputs |
| `--color-surface-soft` | `lav-50` | input fill, hover fills, muted panels |
| `--color-foreground` | `lav-900` | primary text / headings |
| `--color-body` | `lav-700` | default body text |
| `--color-muted` | `lav-500` | secondary/muted text |
| `--color-placeholder` | `lav-400` | input placeholders, faint |
| `--color-border` | `lav-200` | hairline borders & dividers |
| `--color-border-subtle` | `lav-150` | in-card row dividers |
| `--color-border-control` | `lav-300` | input/button borders |
| `--color-primary` | `iris-600` | primary action / brand interactive |
| `--color-primary-hover` | `iris-700` | |
| `--color-primary-active` | `iris-800` | |
| `--color-primary-soft` | `iris-50` | selected row, active chip, header strip, soft fills |
| `--color-primary-soft-border` | `iris-100` | border on soft-primary surfaces |
| `--color-on-primary` | `white` | text/icon on primary |
| `--color-ring` | `iris-600` | focus ring |
| `--color-success` / `-text` / `-soft` | `#16A34A` / `#15803D` / `#EAF7EE` | |
| `--color-warning` / `-text` / `-soft` | `#D97706` / `#B26A00` / `#FBF1DD` | |
| `--color-danger` / `-text` / `-soft` | `#DC2626` / `#C6413B` / `#FBEBEA` | destructive / error |
| `--color-on-danger` | `white` | text on danger button |
| `--color-scrim` | `rgba(26,26,46,0.42)` | modal/drawer backdrop |

> **Token architecture:** primitive (§1) → semantic (§2) → component (per-component tokens read semantics). Never skip a layer. Re-theme = edit primitives + semantics; components inherit for free. **There is no `--color-accent`** — Iris is single-accent; if a secondary is ever needed, add it as a new primitive, don't overload a status hue.
>
> **✓ These names ship in code.** `src/styles/tokens/colors.css` defines these `--color-*` tokens verbatim — the old `--bg-*` / `--text-*` / `--border-*` / `--green-*` names were renamed to match this doc (§14), so components reference `var(--color-foreground)`, `var(--color-surface-soft)`, etc. **Two small real-world deviations:** `--color-surface` is white via `--white` / shadcn `--card`/`--popover` (there is no standalone `--color-surface` token), and the backdrop ships as `--scrim` (not `--color-scrim`). Everything else in this table exists as written. Full shadcn mapping in §17; the actual `:root` is in §14.

---

## 3. Status Color System (lifecycle chips)

The app's **8 lifecycle statuses** each get a **dot / text / soft-bg / border** quartet, tuned to the Iris palette. All text-on-tint pairs meet WCAG AA (≥4.5:1). Chips are **pills** (`--radius-pill`). **Always render as `● Label`** — colored dot + text — so status reads without color.

Eight states, but **six hues** — the two "travelling" states share one and the two "arrived" states share
another. That is not a shortage; the pair genuinely means the same thing at either end of the job, and
eight near-identical hues would be noise.

| Status | Label | Shipped token | Hue |
|---|---|---|---|
| `UNASSIGNED` | Unassigned | `--status-neutral` | `#7A7A93` grey |
| `ASSIGNED` | Assigned | `--status-info` | `#4B3FCF` **iris** |
| `EN_ROUTE_TO_PICKUP` | Going for pickup | `--status-en-route` | `#D97706` amber |
| `AT_PICKUP` | At pickup | `--status-arrived` | `#0891B2` cyan |
| `PICKED_UP` | Picked up | `--status-collected` | `#7C3AED` violet |
| `EN_ROUTE_TO_DELIVERY` | Going to delivery | `--status-en-route` | `#D97706` amber |
| `AT_DELIVERY` | At delivery | `--status-arrived` | `#0891B2` cyan |
| `DELIVERED` | Delivered | `--status-success` | `#16A34A` green |

`ASSIGNED` intentionally shares the indigo brand hue — a driver is attached, so the job is "engaged".
`PICKED_UP` gets its own violet because it is the one irreversible midpoint: the goods are on board.

The three app-specific tokens live in `src/styles/app-tokens.css`; the rest come from the DS. Chips are
rendered by `StatusChip`, coloured through `domain/status.ts → STATUS_META.colorVar`, so a retheme edits
values only.

> **There is no failed or cancelled state**, by explicit product decision — the lifecycle is happy-path
> only and forward-only. Do not design a red terminal chip; there is nothing for it to represent. Danger
> red is reserved for destructive *actions* and validation errors.

**Tabs** (Active · New · Delivered · Search) are structural, not colored — the active tab is weight 600 + a 2px **indigo** underline, never a fill.

---

## 4. Typography

Three faces (from the Iris design; Plus Jakarta Sans confirmed by the engine as the indigo enterprise-SaaS body). Load via Google Fonts, `font-display: swap`.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sometype+Mono:wght@400;500;600&family=Unbounded:wght@600;700;800&display=swap');
```

### Font roles
- **`--font-display` = "Unbounded"** → the wordmark, page **H1**, card titles, and section headings. Geometric and distinctive — **used with restraint** and always with tight tracking (`-0.02em` to `-0.03em`). Weights 600/700/800. Fallback: `system-ui, sans-serif`.
- **`--font-sans` = "Plus Jakarta Sans"** → **all UI**: body, labels, buttons, table cells, nav. Weights: 400 body · 500 labels/nav · 600 buttons/emphasis/active · 700 strong · 800 for large display if Unbounded isn't used. Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.
- **`--font-mono` = "Sometype Mono"** → **tabular data** (order/tracking ids, weights, cubic, money, times) **and** small **technical micro-labels** (eyebrows, tags, table headers) uppercase + letter-spaced. Weights 400/500/600. Fallback: `ui-monospace, "SFMono-Regular", Consolas, monospace`.

### Type scale (desktop-first)
| Token | Font / Size / LH | Weight / tracking | Use |
|---|---|---|---|
| `display-lg` | Unbounded · 22 / 1.15 | 700 · `-0.03em` | **page title** (H1) |
| `display-sm` | Unbounded · 15 / 1.2 | 700 · `-0.02em` | card / modal title |
| `heading` | Unbounded · 13 / 1.2 | 600 · `-0.02em` | section heading |
| `body-lg` | Plus Jakarta · 16 / 1.5 | 400/500 | primary form inputs (16px avoids mobile zoom) |
| `body` | Plus Jakarta · 14 / 1.5 | 400 | **default UI / body** |
| `cell` | Plus Jakarta · 13.5 / 1.4 | 400 | table cells |
| `label` | Plus Jakarta · 11.5 | 500 | field labels |
| `eyebrow` | Sometype Mono · 10 | 500–600 · `0.1em` UPPER | tags, section eyebrows, "New" ribs |
| `col-head` | Sometype Mono · 10 | 500 · `0.08em` UPPER | table headers |

### Rules
- **Tabular numerals:** `font-variant-numeric: tabular-nums` (or the mono face) on every numeric column, price, weight, cubic, count, time.
- **Table headers & eyebrows are mono, uppercase, letter-spaced** — the one place caps belong.
- **Body measure:** 60–75 chars; forms cap field/section width ~640px.
- **Line-height:** body 1.5, table rows 1.4, display 1.15–1.2.
- **Never** ship body below 13px (desktop) / 16px for primary mobile inputs. No gray-on-gray below AA.

---

## 5. Spacing & Layout

**Base unit 4px.** Iris is comfortable-dense — a touch roomier than a hard operator grid. Scale: `1=4 · 1.5=6 · 2=8 · 2.5=10 · 3=12 · 4=16 · 4.5=18 · 5=20 · 5.5=22 · 6=24 · 8=32`.

### Component spacing defaults
| Surface | Padding / gap |
|---|---|
| Button (md) | `0` v × `14` h, height 36 |
| Button (lg CTA) | height 38–40 |
| Input / Select | `0` v × `11` h, height 38 |
| Table cell | `13` v × `16` h |
| Table header | `12` v × `16` h |
| Card / panel | `18` |
| Card header / footer | `14` v × `18` h |
| Field grid gap | `10` |
| Section gap inside card | `16` (col gap `22`) |
| Page gutter | `24` |

### App shell (top-nav — the Iris shell)
- **Top nav bar:** `58px`, flat `--color-surface`, hairline bottom border, sticky (`z 20`). Holds: brand (indigo mark + Unbounded wordmark) · horizontal nav links · flex spacer · soft-filled search · icon buttons · avatar. Active link = `--color-primary` text + 2px indigo underline.
- **Page head:** title (`display-lg`) + a mono meta tag; below it the status **tab strip** (hairline baseline).
- **Toolbar:** filter/utility buttons · spacer · mono count summary · in-table search · one **indigo** primary ("New …").
- **Content:** full-width for the data table, `24px` gutters; forms/detail constrained ~720px.
- **Table row height:** `44px` default (comfortable), `40px` compact.
- *(A left sidebar is an optional alternate shell; the Iris reference uses top-nav.)*

### Breakpoints
`375 · 768 · 900 · 1024 · 1440`. Primary ≥1280. Below 900 the nav search hides; below 720 multi-column card grids collapse to one column; below 1024 tables get an `overflow-x-auto` wrapper.

### z-index scale
`base 0 · sticky-nav 20 · dropdown/popover 30 · sticky-toolbar 30 · modal-scrim 40 · modal 50 · toast 60 · tooltip 70`.

---

## 6. Radii

Iris is **soft and rounded**. In code, corners ship through Tailwind's `rounded-*` utilities, mapped in `src/index.css` `@theme` off a `--radius` base of `0.625rem` (≈10px).

| Utility | Shipped value | Use |
|---|---|---|
| `rounded-sm` | ~6px | small badges, tags, "New" rib |
| `rounded-md` | ~8px | **buttons, inputs, selects, icon buttons, list rows** (the control radius) |
| `rounded-lg` | ~10px | list / table cards, popovers |
| `rounded-xl` | ~14px | **master-detail panels, the create card** (the surface radius) |
| `rounded-full` | 9999px | avatars, status dots, **status/toggle chips (pills)** |

*Design intent was 9px control / 14px surface; the shipped scale lands at ~8px control (`rounded-md`) and ~14px surface (`rounded-xl`) — close enough, and accepted as the operating scale. Hitting exactly 9/14 would mean retuning the `@theme` `--radius-*` calc ratios, but "control" vs "surface" don't map 1:1 onto single utilities across every component, so it's kept as shipped.*

---

## 7. Elevation & Depth

| Level | Token | Spec | Applies to |
|---|---|---|---|
| `e0` (flat) | `--elevation-0` | none; `1px solid --color-border` | table, tiles, flat panels |
| `e1` (lifted) | `--elevation-1` | `0 10px 34px rgba(26,26,46,0.08)` + hairline | **the create card**, dropdowns, popovers, filter panels |
| `e2` (overlay) | `--elevation-2` | `0 20px 60px rgba(26,26,46,0.18)` | centered modals / dialogs (when used) |
| glow | `--glow-primary` | `0 4px 14px rgba(75,63,207,0.26)` | the **primary CTA** (indigo button) |
| scrim | `--color-scrim` | `rgba(26,26,46,0.42)` | modal/drawer backdrop |

Shadows are **soft, diffuse, indigo-tinted-dark** — never hard black. Flat surfaces stay hairline; only lifted things and the primary button carry depth.

---

## 8. Motion

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | hover, color/background, focus |
| `--motion-base` | 180ms | small state changes, toggles |
| `--motion-enter` | 300ms | card open / reveal, card content fade-up |
| `--motion-exit` | 200ms | close (≈65% of enter) |
| `--ease-standard` | `cubic-bezier(0.22, 0.72, 0.24, 1)` | the Iris ease (soft ease-out) |

Rules: prefer `opacity`, `background-color`, `color`, `border-color`, `transform`. Press = `transform: translateY(1px)` on buttons. **One deliberate height reveal is allowed** — the inline create card expands via `grid-template-rows: 0fr → 1fr` (a controlled, non-janky reveal) with its content fading up; nothing else animates layout. No linear easing, no bounce, no infinite decorative motion.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

---

## 9. Interaction States

| State | Treatment |
|---|---|
| **Input (rest)** | **soft-filled**: `--color-surface-soft` fill, `1.5px solid transparent` border, radius `sm` |
| **Input (focus)** | fill → `--color-surface` (white) + border → `--color-primary`; no glow ring on inputs |
| **Focus-visible** (buttons/links/controls) | `outline: 2px solid --color-ring; outline-offset: 2px` — always visible |
| **Hover** — row / ghost button | background → `--color-surface-soft` |
| **Hover** — primary CTA | background → `--color-primary-hover` |
| **Hover** — utility control border | border → `--color-muted` |
| **Active / press** | `transform: translateY(1px)`; primary also → `--color-primary-active` |
| **Selected row** | `--color-primary-soft` fill (optional 2px indigo left indicator) |
| **Toggle chip (on)** | `--color-primary` border + text + `--color-primary-soft` fill |
| **Disabled** | `opacity: 0.5; cursor: not-allowed` + `aria-disabled`; no hover |
| **Read-only** | plain text on `--color-surface-soft`; distinct from disabled |

All clickable elements use `cursor: pointer` and `touch-action: manipulation`.

---

## 10. Iconography

- **Set:** Lucide (SVG, 2px stroke, 24px grid). One family only. **No emoji, no raster.**
- **Sizes:** `icon-sm 15–16` (inline / table / inputs) · `icon-md 18` (buttons, nav) · `icon-lg 24` (empty states).
- **Color:** `currentColor` — muted by default, darkens to `--color-foreground` on hover.
- **Stroke:** consistent 2px; outline style only; never mix filled + outline at one level.
- **Contrast:** UI glyphs ≥3:1, small meaningful icons ≥4.5:1. Icon-only buttons carry `aria-label`.

---

## 11. Component Specs

Each component reads semantic/status tokens. Sizes/paddings from §4–§7. States from §9.

### Buttons
| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| **Primary** | `--color-primary` + `--glow-primary` | `--color-on-primary` | none | the one commit action |
| **Utility** (default) | `--color-surface` | `--color-foreground` | `--color-border-control` | toolbar / secondary |
| **Ghost** | transparent | `--color-muted` | none | low-emphasis |
| **Danger-ghost** | transparent | `--color-danger-text` | none | Discard / destructive |

Radius `sm` (9px), height 36 (md) / 38–40 (CTA), weight 600. Press → `translateY(1px)`. **One primary per context.** `IconButton`: 32–34px square, radius `sm`, `aria-label` required.

### Inputs / Select / Textarea
**Soft-filled** (§9): `--color-surface-soft` fill, `1.5px` transparent border, radius `sm`, `body` size. Focus → white fill + `--color-primary` border. Placeholder `--color-placeholder`. Visible `<label>` (`label` token) above every field; required `*`. Error → `--color-danger` border + message below in `--color-danger-text`. Selects show a chevron on the right; validate on blur.

### Status Chip / Toggle Chip
- **Status chip:** pill (`--radius-pill`), `● Label`, Plus Jakarta 600 12px, `2×9` padding, using the §3 quartet. Clickable variant is a real `<button>` with hover-darken + focus ring.
- **Toggle chip (handling/requirements):** pill, `--color-border-control` + `--color-muted` at rest; **on** = `--color-primary` border/text + `--color-primary-soft` fill.

### Tabs
- **Page tabs:** text row, active = weight 600 + `--color-foreground` + 2px `--color-primary` underline; inactive `--color-muted`. Hairline baseline.
- **In-card sub-tabs:** same logic, tighter.

### DataTable (primary work surface)
Semantic `<table>` inside a `--radius-lg` card (`e0`). Header: `--color-surface-soft`, hairline bottom, **mono `col-head`** (uppercase, letter-spaced, muted). Rows: white, `--color-border-subtle` dividers, `cell` size, row height per §5, hover `--color-surface-soft`, selected `--color-primary-soft`. Order id (`cid`) = mono. **Route cell** = `● origin ···→ ● drop` (origin dot `--color-primary`, drop dot cyan, dotted connector). Numeric columns right-aligned + tabular. Sticky header (`z 20`). `overflow-x-auto` below 1024.

### Create Card (the Iris signature — inline expand)
The primary "new record" surface. A `--radius-lg` card, `e1` soft shadow, that **expands in place** at the top of the list (`grid-template-rows 0fr→1fr`, content fades up — §8). Structure: header strip in `--color-primary-soft` (a mono **"New" rib** + `display-sm` Unbounded title + mono ref + close), a body (any field layout — builder's choice), and a footer in `--color-surface-soft` (one Discard ghost · one Save-& variant utility · one **indigo primary**). *(A centered modal, drawer, or sheet may reuse the same card skin + `e2`/scrim when a screen needs an overlay instead of an inline expand.)*

### Card / KPI StatTile
Flat white, `1px --color-border`, radius `lg`, padding `18`. StatTile: mono `eyebrow` label + Unbounded `display-lg` value (tabular) + optional delta (success/danger text + arrow icon — never color alone). No heavy shadow.

### Toast
Bottom-center, `--color-foreground` (ink) fill, white text, `--radius-md`, `e1`, `z 60`, with a small **indigo check circle**. Auto-dismiss 3–5s, `aria-live="polite"`, never steals focus. Offer Undo on destructive/bulk actions.

### Nav bar
`58px`, `--color-surface`, hairline bottom. Brand = indigo `--radius-sm` mark + Unbounded wordmark. Links = Plus Jakarta 500 muted, hover `--color-surface-soft`, active `--color-primary` + 2px underline. Soft-filled search. Avatar = `--radius-full`, `--color-primary-soft` bg + `--color-primary` initials (mono).

### Popover / Menu · Filter menus
Anchored, `--color-surface`, radius `md`, `e1`, `z 30`. Items `body`, `8×12`, hover `--color-surface-soft`; destructive item `--color-danger-text`. Close on outside-click + `Esc`; arrow-navigable. Filters reflect into a compact chip summary on the toolbar.

### Empty / Loading / Error
Flat, factual — no illustrations. **Loading:** skeleton rows (`animate-pulse` on `--color-surface-soft`) >300ms. **Empty:** centered muted line ("No data available") + optional primary. **Error:** danger-text message + Retry utility button.

### Pagination
Server-side. Utility prev/next + tabular page indicator + page-size select, right-aligned under the table.

---

## 12. Data Visualization (dashboard KPIs)

Rendered with **Recharts** (shadcn `ChartContainer`). Match chart to intent: single KPI → gauge/bullet or StatTile; trend → line; category compare → bar (horizontal >15 cats); proportion → keep it a bar unless ≤5 slices.

**Viz palette** (categorical, indigo-led, colorblind-aware; differentiate by style too, not color alone):
`#4B3FCF · #7C3AED · #0891B2 · #D97706 · #16A34A · #DC2626 · #DB2777 · #7A7A93`

Rules: gridlines `--color-border` (subtle), axis text `--color-muted`, tabular numerals, legend near the chart, tooltip on hover/tap with exact values, direct labels for small sets, locale-aware formatting. Always provide a **table fallback** + `aria-label` summary. Respect `prefers-reduced-motion`. Empty/loading/error per §11.

---

## 13. Accessibility Standards (enforced)

- **Contrast:** normal text ≥4.5:1, large/UI ≥3:1. Body uses `lav-700/900`; indigo `#4B3FCF` is ~12:1 on white (safe for links/labels/icons). All status text-on-tint pairs (§3) verified AA.
- **Color never alone:** status = dot + label; KPI deltas = arrow + sign; chart series = style + color; errors = icon + text.
- **Focus:** visible 2px indigo ring on every interactive element; tab order matches visual order; never remove focus.
- **Keyboard:** full operation — menus arrow-navigate, overlays trap focus + `Esc`, actions are real `<button>`s, tables sortable via keyboard with `aria-sort`.
- **Semantics:** `<table>` for data, `<label for>` per input, `aria-label` on icon-only buttons, `role="alert"`/`aria-live` for validation + toasts.
- **Forms:** visible labels, required markers, on-blur validation, error below field, auto-focus first invalid.
- **Motion & type:** honor `prefers-reduced-motion`; layout survives 200% text zoom.

---

## 14. Implementation — Tokens → Tailwind v4 → shadcn

Tokens live once as CSS custom properties, mapped into Tailwind v4 via `@theme inline`; shadcn primitives read the same variables. This is the entire theming seam.

> **✓ Doc == code.** The block below is the **actual** `src/styles/tokens/colors.css`. Components reference these semantic `--color-*` names directly — the old `--bg-*` / `--text-*` / `--green-*` names were renamed to match this doc, so there is now **one** naming system. Values flow `:root` → `@theme` → shadcn `:root`; no component hardcodes a hex.

### `src/styles/tokens/colors.css` — the `:root` (as shipped)
```css
:root {
  /* primitives that feed the Tailwind @theme */
  --white:#FFFFFF; --body:#45455C; --muted:#7A7A93;
  /* iris (indigo) brand ramp */
  --iris-50:#ECEBFB; --iris-100:#DEDCF7; --iris-600:#4B3FCF; --iris-700:#3D33B0; --iris-800:#332A94;
  /* primary / brand (semantic) */
  --color-primary:#4B3FCF; --color-primary-hover:#3D33B0; --color-primary-active:#332A94;
  --color-primary-disabled:#C9C5EC; --color-primary-soft:#ECEBFB; --color-on-primary:#FFFFFF;
  /* surfaces (white cards on the lavender-grey canvas) */
  --color-background:#EFEFF5; --color-surface-soft:#F5F5FB; --color-border-subtle:#EEEEF6;
  /* text */
  --color-foreground:#1A1A2E; --color-body:#45455C; --color-muted:#7A7A93; --color-placeholder:#ADADC2;
  /* borders */
  --color-border:#E6E6F0; --color-border-control:#D8D8E6; --color-ring:#4B3FCF;
  /* status (flat) + scrim */
  --status-info:#4B3FCF; --status-success:#16A34A; --status-warning:#D97706; --status-danger:#DC2626; --status-neutral:#7A7A93;
  --scrim:rgba(26,26,46,0.42);
}
/* per-lifecycle status colors live in src/styles/app-tokens.css:
   --status-en-route:#D97706 · --status-arrived:#0891B2 · --status-collected:#7C3AED */
/* Surface = white (shadcn --card/--popover). Type / radii / elevation / motion tokens live in
   src/styles/tokens/{typography,fonts,radii,spacing}.css and are mapped in src/index.css. */
```

shadcn reads these through its **own** `:root` in `src/index.css`:
```css
/* src/index.css — shadcn semantic tokens → Iris DS tokens */
:root {
  --background:var(--color-background); --foreground:var(--color-foreground);
  --card:#ffffff; --card-foreground:var(--color-foreground);
  --popover:#ffffff; --popover-foreground:var(--color-foreground);
  --primary:var(--color-primary); --primary-foreground:var(--color-on-primary);
  --secondary:var(--color-surface-soft); --secondary-foreground:var(--color-foreground);
  --muted:var(--color-surface-soft); --muted-foreground:var(--color-muted);
  --accent:var(--color-primary-soft); --accent-foreground:var(--color-primary);
  --destructive:var(--status-danger);
  --border:var(--color-border); --input:var(--color-border-control); --ring:var(--color-primary);
  --chart-1:var(--color-primary); --chart-2:#7C3AED; --chart-3:#0891B2; --chart-4:#D97706; --chart-5:#16A34A;
  --radius:0.625rem;
  --sidebar:#ffffff; --sidebar-foreground:var(--color-body);
  --sidebar-primary:var(--color-primary); --sidebar-primary-foreground:var(--color-on-primary);
  --sidebar-accent:var(--color-primary-soft); --sidebar-accent-foreground:var(--color-primary);
  --sidebar-border:var(--color-border); --sidebar-ring:var(--color-primary);
}
```

### Conceptual token model (reference only — **not** a second file)
> The **real** `colors.css` is the block above. This fuller model is *illustrative*: its `--lav-*` primitive ramp, `--color-surface`, and the per-status `--status-*-{dot|fg|bg|border}` quartets are the design *concept* — the shipped app uses the flat tokens above (+ `app-tokens.css`) instead. The **type / radii / elevation / motion** tokens shown here **are** real, living in `src/styles/tokens/{typography,fonts,radii,spacing}.css` and `src/index.css`.
```css
:root {
  /* neutrals — lavender-grey */
  --lav-50:#F5F5FB; --lav-100:#EFEFF5; --lav-150:#EEEEF6; --lav-200:#E6E6F0;
  --lav-300:#D8D8E6; --lav-400:#ADADC2; --lav-500:#7A7A93; --lav-700:#45455C; --lav-900:#1A1A2E;
  --white:#FFFFFF;
  /* primary — iris (single accent) */
  --iris-50:#ECEBFB; --iris-100:#DEDCF7; --iris-600:#4B3FCF; --iris-700:#3D33B0; --iris-800:#332A94;
  /* status hues */
  --green-600:#16A34A; --green-700:#15803D; --green-soft:#EAF7EE;
  --amber-600:#D97706; --amber-700:#B26A00; --amber-soft:#FBF1DD;
  --red-600:#DC2626;   --red-700:#C6413B;   --red-soft:#FBEBEA;
  --violet-600:#7C3AED; --violet-700:#6D28D9; --violet-soft:#F4ECFE;
  --cyan-600:#0891B2;  --cyan-700:#0E7490;  --cyan-soft:#E6FAFD;

  /* semantic */
  --color-background:var(--lav-100);
  --color-surface:var(--white);
  --color-surface-soft:var(--lav-50);
  --color-foreground:var(--lav-900);
  --color-body:var(--lav-700);
  --color-muted:var(--lav-500);
  --color-placeholder:var(--lav-400);
  --color-border:var(--lav-200);
  --color-border-subtle:var(--lav-150);
  --color-border-control:var(--lav-300);
  --color-primary:var(--iris-600);
  --color-primary-hover:var(--iris-700);
  --color-primary-active:var(--iris-800);
  --color-primary-soft:var(--iris-50);
  --color-primary-soft-border:var(--iris-100);
  --color-on-primary:var(--white);
  --color-ring:var(--iris-600);
  --color-success:var(--green-600); --color-success-text:var(--green-700); --color-success-soft:var(--green-soft);
  --color-warning:var(--amber-600); --color-warning-text:var(--amber-700); --color-warning-soft:var(--amber-soft);
  --color-danger:var(--red-600);    --color-danger-text:var(--red-700);    --color-danger-soft:var(--red-soft);
  --color-on-danger:var(--white);
  --color-scrim:rgba(26,26,46,0.42);

  /* status: dot / fg / bg / border — one quartet per LIFECYCLE state (§3).
     The shipped app takes a leaner route: flat single-hue tokens
     (--status-neutral/-info/-en-route/-arrived/-collected/-success) with the
     tint derived at render time. Names here follow the real 8 states; there is
     no failed or cancelled quartet because there are no such states. */
  --status-unassigned-dot:#ADADC2; --status-unassigned-fg:#7A7A93; --status-unassigned-bg:#EFEFF5; --status-unassigned-border:#E6E6F0;
  --status-assigned-dot:#4B3FCF;   --status-assigned-fg:#4B3FCF;   --status-assigned-bg:#ECEBFB;   --status-assigned-border:#DEDCF7;
  --status-en-route-dot:#D97706;   --status-en-route-fg:#B26A00;   --status-en-route-bg:#FBF1DD;   --status-en-route-border:#F4E3BE;
  --status-arrived-dot:#0891B2;    --status-arrived-fg:#0E7490;    --status-arrived-bg:#E6FAFD;    --status-arrived-border:#C7EEF5;
  --status-collected-dot:#7C3AED;  --status-collected-fg:#6D28D9;  --status-collected-bg:#F4ECFE;  --status-collected-border:#E9D8FB;
  --status-delivered-dot:#16A34A;  --status-delivered-fg:#15803D;  --status-delivered-bg:#EAF7EE;  --status-delivered-border:#CFEEDA;

  /* type */
  --font-display:"Unbounded", system-ui, sans-serif;
  --font-sans:"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:"Sometype Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;

  /* radii */
  --radius-xs:6px; --radius-sm:9px; --radius-md:11px; --radius-lg:14px; --radius-pill:20px; --radius-full:9999px;

  /* elevation */
  --elevation-1:0 10px 34px rgba(26,26,46,.08);
  --elevation-2:0 20px 60px rgba(26,26,46,.18);
  --glow-primary:0 4px 14px rgba(75,63,207,.26);

  /* motion */
  --motion-fast:120ms; --motion-base:180ms; --motion-enter:300ms; --motion-exit:200ms;
  --ease-standard:cubic-bezier(.22,.72,.24,1);
}
```

### `src/index.css` — Tailwind v4 theme mapping
```css
@import "tailwindcss";
@import "./styles/tokens/colors.css";

@theme inline {
  --color-background: var(--color-background);
  --color-surface:    var(--color-surface);
  --color-foreground: var(--color-foreground);
  --color-muted:      var(--color-muted);
  --color-border:     var(--color-border);
  --color-primary:    var(--color-primary);
  --color-danger:     var(--color-danger);
  --font-display: var(--font-display);
  --font-sans:    var(--font-sans);
  --font-mono:    var(--font-mono);
  --radius-sm: var(--radius-sm);
  --radius-lg: var(--radius-lg);
  /* → bg-primary, text-foreground, border-border, rounded-lg, font-display, font-mono, etc. */
}
```
- **No component hardcodes a hex** — every value flows `:root` → `@theme` → components. That single rule is what makes handing over `master.md` reproduce the Iris look.
- A **dark theme** later re-points the *semantic* + *status* variables (deep indigo-charcoal surfaces, ice text, indigo accent) — primitives/components stay untouched (v1 ships light).
- shadcn primitives read the semantic variables — never `bg-indigo-500`, always `bg-primary` / `text-foreground`.

---

## 15. Do / Don't

**Do**
- Reference semantic/status tokens; keep exactly one indigo primary per context.
- Use **soft-filled inputs** (surface-soft → white on focus) and **9px control / 14px surface** radii.
- Give lifted surfaces one soft indigo-tinted shadow; the primary CTA a soft indigo glow; flat surfaces hairlines.
- Set small technical labels / table headers / order-ids in the **mono** face, uppercase + letter-spaced.
- Pair every status/delta/series with text or shape; tabular numerals on all figures.
- Keep transitions 120–300ms; the create card may reveal via `grid-template-rows`.

**Don't**
- Hardcode a hex, use `bg-indigo-500`-style raw utilities, invent radii/shadows, or add a second brand accent.
- Use hard/black shadows, gradients, textures, photography, or emoji in chrome.
- Put two primary buttons in one context.
- Animate width/height/top/left (except the one grid-rows create-card reveal), use linear easing, or infinite decorative motion.
- Convey state by color only, remove focus outlines, or use `<div onClick>` for actions.

---

## 16. Pre-Delivery Checklist

- [ ] Icons: Lucide (or vector SVG) only — **no emoji, no raster**; consistent 2px stroke, one family.
- [ ] Fonts: Unbounded (display, sparingly) · Plus Jakarta Sans (UI) · Sometype Mono (data + micro-labels).
- [ ] Palette: lavender-grey neutrals + single flat indigo; no second accent; status hues only for lifecycle.
- [ ] Radii: 9px controls / 14px surfaces / 20px chips; no sharp corners.
- [ ] Depth: hairline flats · one soft shadow on lifted cards · indigo glow on the primary CTA.
- [ ] Inputs soft-filled; focus → white + indigo border; visible focus ring on all controls.
- [ ] Status = dot + label; deltas/series readable in greyscale; tabular numerals; numeric columns right-aligned.
- [ ] Hover/press(translateY)/selected/disabled/read-only states defined and distinct.
- [ ] Motion 120–300ms, `--ease-standard`; only the create card reveals via grid-rows; `prefers-reduced-motion` honored.
- [ ] Table: semantic `<table>`, mono uppercase headers, `aria-sort`, sticky header, `overflow-x-auto` <1024, skeleton loading.
- [ ] Zero hardcoded hexes; every value flows `:root` → `@theme` → components.
- [ ] Verified at 375 / 768 / 1024 / 1440 and at 200% text zoom.

---

## 17. Token Name Mapping (existing app + shadcn)

The app's color tokens now use the **canonical `--color-*` / `--iris-*` names from this doc** — the pre-Iris `--bg-*` / `--text-*` / `--border-*` names and the indigo-under-`--green-*` primitives were **renamed** (§14), so components reference `var(--color-*)` directly. shadcn reads them through its own variable names — its `:root` lives in `src/index.css` (shown in §14).

| Iris role (this doc) | App token (`src/styles/tokens/colors.css`) | shadcn variable (`src/index.css`) |
|---|---|---|
| canvas | `--color-background` (`#EFEFF5`) | `--background` |
| surface (card) | `#ffffff` / `--white` (no `--color-surface`) | `--card`, `--popover` (both `#ffffff`) |
| surface-soft | `--color-surface-soft` (`#F5F5FB`) | `--muted`, `--secondary` |
| foreground | `--color-foreground` (`#1A1A2E`) | `--foreground`, `--card`/`--popover-foreground` |
| body text | `--color-body` (`#45455C`) | `--sidebar-foreground` |
| muted text | `--color-muted` (`#7A7A93`) | `--muted-foreground` |
| placeholder | `--color-placeholder` (`#ADADC2`) | — |
| border | `--color-border` (`#E6E6F0`) | `--border`, `--sidebar-border` |
| control border | `--color-border-control` (`#D8D8E6`) | `--input` |
| subtle divider | `--color-border-subtle` (`#EEEEF6`) | — |
| primary (indigo) | `--color-primary` (+ `-hover/-active/-soft/-disabled`), from the `--iris-*` ramp | `--primary`, `--sidebar-primary`, `--ring`, `--chart-1` |
| on-primary | `--color-on-primary` | `--primary-foreground` |
| primary-soft | `--color-primary-soft` (`#ECEBFB`) | `--accent`, `--sidebar-accent` |
| focus ring | `--color-ring` (`#4B3FCF`) | `--ring` |
| backdrop | `--scrim` (`rgba(26,26,46,.42)`) | — |
| danger | `--status-danger` (`#DC2626`) | `--destructive` |
| status (flat) | `--status-info/-success/-warning/-danger/-neutral` | `--chart-2..5` (violet/cyan/amber/green literals) |
| status.{lifecycle} | app-tokens `--status-en-route` (`#D97706`) · `--status-arrived` (`#0891B2`) · `--status-collected` (`#7C3AED`) + `domain/status.ts` | custom (via `StatusChip`) |
| radius | `--radius: 0.625rem` in `src/index.css`; `--radius-sm` ≈ 6px, `--radius-lg` ≈ 10px | `--radius` |

> **✓ Radius (resolved):** §6 now documents the **shipped** scale (`--radius: 0.625rem`; `rounded-sm` ~6px, `rounded-md` ~8px control, `rounded-lg` ~10px, `rounded-xl` ~14px surface). The earlier 9/14px "design intent" is noted there for reference but not enforced — the shipped soft scale is the accepted operating radius.

Status colors stay driven by `domain/status.ts` → `STATUS_META.colorVar → var(--status-*)`; a retheme edits only the `--status-*` **values**. The pre-Iris `ds/*.jsx` layer is superseded by the shadcn primitives in `src/components/ui/*`.

---

## 18. Surfaces added since the Iris reference

The original mockup covered the consignment list and create card. These screens came later and are
styled entirely from the tokens above — no new primitives, no new colours.

### Sign-in
Full-viewport `--color-background` canvas, a single centred card (max ~380px, `radius-xl`, `e0` hairline
+ soft shadow). Above it: the indigo brand mark and an Unbounded wordmark. Inside: two soft-filled
inputs and **one** full-width indigo primary. Errors appear as a `--color-danger-soft` panel with
`--color-danger-text` above the fields, with `role="alert"`.

It is the one screen with no nav and no data — resist adding either.

### Users (admin only)
Standard page head + toolbar + `DataTable` (§11). Role is a **`Badge`**, not a status chip — those are
reserved for lifecycle. Active/inactive is a dot + label, same construction as a status chip.
Destructive row actions live behind a `⋯` menu, with the reversible action (Deactivate) above the
irreversible one (Delete), which is `--color-danger-text`.

### Confirm dialog
Any irreversible action gets one: `Modal` at ~440px, plain body text, a utility Cancel and a
**danger** confirm. Never a primary indigo button — commit-blue on a delete reads as "safe".

### Address picker
The address field in a form is a **summary card**, not an input: pin icon tile, the address on one line,
coordinates muted beneath. Unpinned it takes a `--color-danger` border. Clicking opens a `Modal`
containing search, the structured fields, and a 300px map.

### Maps (Leaflet, OpenStreetMap)
Map surfaces sit in a `radius-lg` container with a hairline border. Markers are **`divIcon`s built from
tokens**, never Leaflet's default pin: pickup `--color-body`, delivery `--color-primary`, the driver
`--color-success` with a pulsing halo and a heading arrow. An accuracy circle uses success at 8% fill.

### Proof of delivery
A tab inside the task modal. One card per leg, each with two image tiles. **Signatures render on a
checkerboard** — they are dark-on-transparent PNGs and vanish on white. File size sits beside each
image in mono, so a broken upload is visible at a glance.

---

## 19. Surfaces added after §18

Same rule as above: no new primitives, no new hexes. Everything below is the existing token layer
arranged differently.

### Chat (`/chat`)

Two panes: a conversation list, and a message thread. Both flat (`e0`) with a hairline between them —
the whole screen is one working context, so nothing is lifted.

- **A selected conversation** uses `--color-primary-soft`, the same fill as a selected table row. Same
  idea, so the same treatment.
- **Message bubbles** are the one place a fill carries meaning without a label: yours is
  `--color-primary` with `--color-on-primary` text, theirs is `--color-surface-soft` with body text.
  Alignment does the rest, so it survives greyscale.
- **Unread** is a small indigo dot plus a mono count — never a bold row alone.
- **Attachments** are a bordered tile with a file-type glyph, name, and size in **mono**, the same
  construction as the POD tiles and for the same reason: a broken upload should be visible without
  opening anything.

### Dispatch map (`/map`)

Full-bleed map with a fixed-width right sidebar. The one screen where the data surface is the map rather
than a table, so the chrome floats on top of it.

- **Floating panels** — legend, notices, the selection bar — are `--color-surface` at 90–95% opacity with
  a backdrop blur, `radius-xl`, `e1`. Lifted things over a busy background take the lifted treatment; a
  hairline alone disappears over tiles.
- **Pins are `divIcon`s built from tokens**, as §18 requires. Colour is either the lifecycle hue (§3) or
  the driver's palette entry, **never both at once** — the legend switches wholesale, so an operator is
  never reading two colour systems on one screen.
- **The driver palette is an 8-entry index, not hexes in the database.** A driver stores `mapColorIndex`;
  the values live in `domain/serviceZone.ts`. That is what keeps a retheme or a colour-blind-safe pass a
  token edit rather than a data migration.
- **Coincident pins** (several orders at one address) render as one pin with a mono count badge.
- **The sidebar is the accessible interface to the map**: the same rows, keyboard-navigable, each with a
  3px left border in its pin's colour so a row and its pin are obviously the same thing.

### Lasso selection

Shift-drag draws a **transparent rectangle with a 2px `--color-danger` border** and a 10% danger fill.
Red, deliberately, and the one exception to "red means destructive": a selection box is transient,
disappears on release, and must read instantly over any map tile. An indigo box would compete with the
pins it is selecting.

Once something is caught, a **selection bar** appears bottom-centre using the floating-panel treatment,
holding a mono count and three buttons. It follows §11's one-primary rule by having *no* primary at all —
Assign, Create route and Unselect are utility/ghost, because none of them commits anything. The commit
happens inside the dialog each one opens.

### Assign picker — the side-by-side

For a single order the dialog widens to ~960px and splits: the ranked driver list left, a map of those
same drivers right.

- **The map is a pane inside the dialog, not a second dialog.** Leaflet's panes sit at z-index 200–700 and
  beat Radix's 50, so a modal opened over a map lands *behind* it. Nesting is not a styling preference
  here; it is the only arrangement that works.
- **Rank badges** are a small `--color-success` circle on the avatar, numbered in mono. The badge and the
  map marker carry the same number — that is what ties the two panes together.
- **Off-shift drivers stay in the list**, at 55% opacity, `cursor: not-allowed`, labelled "Off shift". A
  list that silently shrinks from eight names to three reads as broken.
- **Drive time is the emphasis**, distance the sub-line: `13px/600` over `11px` muted, both tabular.

### Route planning

- **The route line is drawn twice** — an 8px white casing under a 4px `--color-primary` stroke. A single
  thin line vanishes over a busy city map. It sits *under* the markers: the line is context, the numbers
  are the subject.
- **Numbered stops** are `--color-primary` circles with mono figures. A stop that has drifted from its
  plan turns `--status-warning`, matching the flagged row in the sidebar so the two cannot disagree.
- **The depot keeps the teardrop place-pin** from §18 (`S`, and `E` for an end point). Places are
  teardrops, drivers and stops are circles — never confusable at a glance.
- **The route panel** lists stops with a numbered rib, drag-to-reorder, and ▲▼ buttons that appear on
  hover or focus. Two ways on purpose: dragging is what a mouse reaches for, the buttons are what a
  keyboard and a long scrolling list need.
- **A re-optimise proposal** is a `--color-surface-soft` panel stating what it would save, with Apply and
  "Keep mine". It never applies itself — the numbers are an argument, not an action.
- **Stop issues** ("Address changed since planning", "Moved to another driver") are `--status-warning`
  text on the row plus a warning strip above the list. A flag, never a silent correction.

> **File structure is not documented here any more.** It rotted, which is what a file tree does inside a
> design doc. The frontend layout lives in `frontend/innovo-frontend/CLAUDE.md`, the backend in
> `backend/README.md`. This file owns the visual identity and nothing else.

---

*This is the Iris visual identity for Innovo Xpress TMS, derived from the approved `consignment_inline_mockup.html` and validated with the UI/UX Pro Max engine. Rebuild any screen against these tokens — the field inventory is yours; the look is guaranteed by the token layer.*
