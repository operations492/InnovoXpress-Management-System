# Re-skin the Tasks screen to the Iris design system (master.md) + swap to shadcn

## Context

`master.md` now defines the **"Iris"** visual identity (lavender-grey canvas, flat-indigo single accent, Unbounded / Plus Jakarta Sans / Sometype Mono, 9/14px radii, soft-filled inputs, top-nav shell, inline-expand create card) — derived from the boss-approved `consignment_inline_mockup.html`.

The built React app (`frontend/innovo-frontend/`) still wears the **old emerald design system** and a different arrangement:
- Shell = left **Sidebar (230px) + Topbar (56px)** (`layouts/ConsoleLayout.tsx`), not a top nav bar.
- "New Task" = a **centered 700px modal that overlays** the table (`features/tasks/components/NewTaskModal.tsx`).
- `TaskForm.tsx` = **single-column**, old Woodly labels (Merchant/Requester/Recipient/External ID/Time Window/Requirements…).
- Tokens in `src/styles/tokens/*.css` = emerald `#2ea86a` + slate + Inter + radii 3/4/6/8; components read them via `var(--…)`.
- **shadcn is not installed** (no `components.json`, no radix/cva/tailwind-merge/clsx/lucide, no `cn`). Groundwork ready: `@/*` alias (tsconfig + vite), Tailwind v4 via `@tailwindcss/vite`, React 19 / TS 6.

**Goal (confirmed with user):** keep the same 10 consignment fields, but **re-map arrangement + design to Iris**, adopting the full inline-mockup arrangement, doing a **full swap of the `@/ui` layer to shadcn**, and adopting the **Iris field vocabulary**. Field *inventory* is unchanged; only layout, labels, chrome, and component library change.

**Are we borrowing the inline-mockup arrangement? → YES, fully:** top nav bar replaces the sidebar; New consignment opens an **inline-expand card that pushes the table down** (focus); fields regroup into the two-column **Shipment / Logistics** layout.

## Approach — sequenced so the app keeps compiling at every phase

Keep the **`src/ui/index.tsx` barrel API stable** throughout (same export names) so feature files barely change. Retheme tokens first (both old-DS and shadcn read them), then swap components behind the barrel, then change shell → flow → form.

### Phase 0 — master.md touch-ups (small)
- Restore the two dropped checklist bullets to §16 (no-emoji-icons; Lucide/vector-SVG only).
- Add a short **appendix** mapping Iris semantic tokens → the app's existing token names (`--color-primary`, `--bg-canvas/-soft`, `--text-strong/-body/-muted`, `--border-hairline/-control`, `--status-*`, `--radius-*`) → shadcn's CSS-variable names (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`). Makes Phases 1–2 mechanical.
- File: `master.md`.

### Phase 1 — Retheme tokens to Iris (variable **names stay**, values change)
Components reference `var(--…)`, so editing values propagates automatically.
- `src/styles/tokens/colors.css` — replace emerald+slate raw palette with lavender-grey + indigo; remap semantic aliases: `--color-primary` → `#4B3FCF` (+ hover `#3D33B0`, active `#332A94`, soft `#ECEBFB`); `--bg-canvas` `#EFEFF5`, `--bg-soft` `#F5F5FB`; `--text-strong` `#1A1A2E`, `--text-body` `#45455C`, `--text-muted` `#7A7A93`; `--border-hairline` `#E6E6F0`, `--border-control` `#D8D8E6`; `--scrim` `rgba(26,26,46,.42)`. Status: `--status-info`→indigo `#4B3FCF`, `--status-success` `#16A34A`, `--status-warning` `#D97706`, `--status-danger` `#DC2626`, `--status-neutral` `#7A7A93`.
- `src/styles/app-tokens.css` — `--status-processed` `#7C3AED` (violet), `--status-loaded` `#D97706` (amber) to match Iris §3.
- `src/styles/tokens/typography.css` + font `@import` at `index.css:7` — swap Inter → load **Plus Jakarta Sans + Unbounded + Sometype Mono**; add `--font-display` (Unbounded) and `--font-mono` (Sometype Mono) tokens; keep the per-role scale but set titles → Unbounded, table-headers/eyebrows → mono uppercase (per master.md §4). (Also wire or delete the orphaned `tokens/fonts.css`.)
- `src/styles/tokens/radii.css` — `--radius-sm` 4→**9**, `--radius-md` 6→**11**, `--radius-lg` 8→**14**, `--radius-pill` 16→**20** (keep `--radius-xs` 6, `--radius-full`). Shadows → Iris soft/diffuse: `--shadow-dropdown`/`--shadow-modal` to the e1/e2 spec + add `--glow-primary: 0 4px 14px rgba(75,63,207,.26)`.
- `src/index.css` `@theme inline` — add `--font-display`, `--font-mono`, and `rounded-*` mappings so shadcn utilities resolve to Iris values; verify `--color-*` still map.
- **Skip** patching the 6 hardcoded-hex leaks in `ds/*.jsx` (Button danger, Badge/Avatar soft tints, Switch/Checkbox/DataTable/SidebarItem `#fff`) — `ds/` is deleted in Phase 2.

### Phase 2 — shadcn init + rebuild `@/ui` (full swap)
Use the **/shadcn skill** for init + component installs.
- Init: create `components.json` (Tailwind-v4 / CSS-variables mode, `@/*` alias, baseColor neutral); add deps (radix, `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, `tailwindcss-animate`); create `src/lib/utils.ts` (`cn`).
- Point shadcn's theme vars at the Iris tokens from Phase 1 (in `:root`/`@theme`), so `--primary`, `--background`, `--border`, `--ring`, `--radius` = Iris. No new palette — reuse Phase 1.
- Install shadcn primitives: `button, input, select, checkbox, switch, tabs, dialog, table, badge, popover, dropdown-menu, avatar, textarea, tooltip, sonner, separator, label, scroll-area` (and `command` if we upgrade search later).
- Rewrite `src/ui/index.tsx` wrappers to render shadcn under the **same export names**: `Button, IconButton, SplitButton (Button+dropdown-menu), DataTable (@tanstack/react-table + shadcn Table), Card/StatTile, Avatar, Badge, Input, Select, Checkbox, Switch, Tabs, SidebarItem, Textarea, StatusChip (Badge + statusColorVar dot/label pill), Modal (Dialog wrapper — keep the modal-stack/Esc/scroll-lock behavior from current `ui/Modal.tsx`), Popover, useOnClickOutside`. `Icon.tsx` → back with `lucide-react`, keep `<Icon name/>` API + `IconName` union.
- Delete `src/ui/ds/` once nothing imports it. Feature files (TaskForm/TaskTable/TaskToolbar/…) stay unchanged because the barrel API is stable.
- Critical files: `src/ui/index.tsx`, `src/ui/Modal.tsx`, `src/ui/StatusChip.tsx`, `src/ui/Icon.tsx`, new `src/ui/shadcn/*` (or `src/components/ui/*` per shadcn default) + `src/lib/utils.ts`.

### Phase 3 — Shell: Sidebar → Top nav bar
- New `src/components/TopNav/TopNav.tsx` — 58px sticky, indigo brand mark + Unbounded wordmark; horizontal nav (reuse the existing `NAV` array from `components/Sidebar/Sidebar.tsx`); search input; icon-button cluster (reuse Topbar's icons); avatar; active link = indigo text + 2px underline. Collapse nav under 900px.
- `layouts/ConsoleLayout.tsx` — change to a column: `<TopNav/>` over scrollable `<main><Outlet/></main>`.
- Retire `Sidebar` + `Topbar` (delete or leave unused); drop `--sidebar-width` usage.

### Phase 4 — Create flow: modal → inline-expand card
- New `src/features/tasks/components/NewConsignmentCard.tsx` — the inline card: `grid-template-rows 0fr→1fr` expander (master.md §8/§11), iris-soft header strip + Unbounded title + "New" mono rib + close; body = the re-arranged `TaskForm`; footer **Discard · Save & new · Save consignment** (one indigo primary). Content fades up; honors reduced-motion.
- `features/tasks/TasksPage.tsx` — replace the always-mounted `NewTaskModal` with the inline card **above** the `TaskToolbar`+`TaskTable`; New Task button toggles it (table pushed down = focus). Reuse `actions.create`, `useTaskFilters`, current selection/local state. On save → switch to `new` tab + toast (sonner).
- **Edit / View / Change-Status / Bulk / Table-Settings stay shadcn Dialogs** (overlay) — only *create* becomes inline, matching the mockup. (Row click still opens the edit modal.)

### Phase 5 — Field re-arrangement + Iris vocabulary (same 10 fields)
- `features/tasks/components/TaskForm.tsx` — single-column → **two-column** grid mirroring the mockup `card-b`: **Shipment** (Type, Priority, Client, Reference, Note, Sender block, Receiver block) | **Logistics** (Ready by, Deliver by, Service, Vehicle, Crew, Driver, COD due, Delivery fee, Handling). Items + Attachments full-width below. **Keep the RHF `taskFormSchema` field keys** — change display labels + layout only.
- Rename **labels** (UI text): Merchant→Client, External ID→Reference, Requester/Recipient→Sender/Receiver, Complete After/Before→Ready by/Deliver by, Team→Crew, Requirements→Handling, Due Amount→COD due, Shipping Fee→Delivery fee. Update any label maps in `domain/status.ts` / `tasks.types.ts` `COLUMNS` if they surface these strings.
- **Handling** → render the existing requirements field as **toggle chips** (shadcn Toggle/Button group) instead of a Select, bound to the same value (single-select chips if the field is scalar; keep schema unchanged).
- `features/tasks/components/ItemsEditor.tsx` — restyle to the Iris ledger (shadcn Table, mono headers, cubic column in indigo, grand total); keep add/edit via `ItemModal` (now shadcn Dialog).
- Soft-filled inputs, indigo focus border, pill status chips, indigo primary + glow — all inherited from Phase 1–2.

### Phase 6 — Polish
- Toast → shadcn **sonner** (ink bg + indigo check) or restyle existing `components/Toast.tsx`.
- Page tabs (`TasksPage` Tabs) → indigo underline; DataTable header mono uppercase; route cell dot(indigo)→dot(cyan) dotted connector; tabular numerals on figures.

## Reuse (don't rebuild)
- `src/domain/*` (status/mutations/derive/format/schemas/types) — untouched; `STATUS_META.colorVar → var(--status-*)` already indirected, so Phase 1 remaps colors for free.
- `src/store/TasksProvider` + `actions.create/update/...`, `useTaskFilters`, `useSelection`, `useTableColumns`, `useTaskActions` — reused as-is.
- Existing `NAV` array, Topbar icon set, `ItemModal`, `TaskCardModal`/`ViewTaskModal` flows — reused (reskinned).
- The `@/ui` barrel stays the single import surface for all features.

## Verification
- `npm run typecheck` (`tsc -b`) → 0 errors, after each phase.
- `npm run build` → clean.
- `npm run test` (Vitest) — 23 tests; **update the `TasksPage.smoke.test.tsx` selectors** for renamed labels / inline card (domain tests unaffected — schema keys stable).
- `npm run dev` → verify against `consignment_inline_mockup.html`: top nav bar; New pushes table down with the inline card; lavender-grey + indigo, Unbounded/Plus-Jakarta/Sometype; shadcn controls; two-column Shipment/Logistics; pill status chips (indigo/violet/amber/cyan/green/red).
- A11y pass: visible indigo focus rings, Esc closes the inline card, `prefers-reduced-motion`, 200% zoom, responsive (nav collapse <900, columns stack <720), status = dot+label.

## Risks / notes
- Large change; the phase order keeps the app compiling (barrel API stable → shadcn behind it → shell → flow → form). Each phase is independently testable.
- One open micro-decision to confirm at build time: whether **Handling** is single- or multi-select (drives chip behavior) — keep the existing field's cardinality; no schema change intended.
- shadcn default install path is `src/components/ui/*`; we re-export those through `src/ui/index.tsx` so the rest of the app keeps importing from `@/ui`.
