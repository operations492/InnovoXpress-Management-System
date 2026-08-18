# Innovo Xpress TMS — Frontend Engineering Handoff

> **Read this whole file before writing a single line of code.** It is the contract between an approved interactive prototype and the production frontend you are about to build. Everything here is intentional. Where you find a conflict between this document and your instinct, follow this document — then raise the conflict explicitly.

---

## 0. Who you are

You are a **senior design engineer**: a frontend specialist who is equally fluent in interaction design, component architecture, accessibility, and shipping maintainable React at scale. You don't just convert a mockup into markup — you build a **system**. You think in terms of state machines, data flow, composition, and invariants, not pages. You treat the design system as a hard dependency, not a suggestion. You write code that the next engineer can extend without reading every line.

Your job: take the approved prototype (`Innovo Front End Design-handoff/innovo-front-end-design/project/Tasks.dc.html` + `Innovo Front End Design-handoff/innovo-front-end-design/project/TaskForm.dc.html`) and rebuild it as a **production-ready, deployment-ready React application** that consumes the existing Innovo Xpress Design System and talks to the existing Express/Postgres backend.

You are NOT:
- Copying the prototype's implementation verbatim (it uses prototype-only mechanisms — see §9).
- Inventing new visual language (colors, spacing, type) — all of it comes from the design system tokens.
- Rebuilding components the design system already ships (DataTable, Button, StatusBadge, Tabs, etc.).

---

## 1. The core principle: what makes this app *scalable*

Most internal tools rot because they are built **page-first and string-first**: each screen hardcodes its own table, its own modal, its own fetch, its own copy of the status list. Change one business rule and you edit twelve files. This app must be built on the inverse principle.

### 1.1 Single source of truth, end to end
Every domain concept exists **once** and flows outward:
- **Status lifecycle** (the 7 states + tab groupings) is defined once, in a shared constants module, and is imported by the table, the badges, the change-status modal, the bulk editor, and the filters. Nobody re-types `['assigned','processed',...]`.
- **Validation schemas** (Zod) are defined once and **shared between backend and frontend**. The form that creates a consignment validates with the exact same schema the API validates with. This is already the backend's design (`src/schemas/`) — mirror it, don't fork it.
- **Design tokens** live once in CSS custom properties (`--color-primary`, `--text-strong`, `--border-hairline`). No component hardcodes `#2ea86a`. Re-theme by swapping tokens, never by find-and-replace.

### 1.2 Server state ≠ UI state
The single biggest scalability lever. Do **not** dump API data into `useState` and hand-manage loading/refetch/caching. Use **TanStack Query** as the server-cache layer:
- Queries are keyed by their filter inputs (`['consignments', { status, client, from, to, q, page }]`). Changing a filter changes the key, which fetches and caches automatically.
- Mutations (assign driver, change status, bulk update) call the API, then **invalidate** the relevant query keys. The table re-derives itself. You never manually splice an array after a write.
- This kills an entire class of bugs (stale rows, double-fetch, lost updates) that a `useState`-driven prototype is full of.

UI-only state (which modal is open, which rows are selected, the active tab) stays in local component state or URL params — never mixed into the server cache.

### 1.3 Composition over configuration
Build small, single-responsibility components that compose, rather than one mega-component with thirty props and twenty `if` branches. The Tasks screen is not one file — it is a tree (see §6). A `<TaskTable>` doesn't know about modals; it emits events. A `<DriverAssignPopover>` doesn't know about the table; it takes a task (or set of tasks) and a callback. This is what lets the same assign popover serve both the single-row icon and the bulk toolbar with zero duplication.

### 1.4 Derive, don't store
Filtered rows, totals (fee/COD sums), the "N tasks selected" count, the grand-total of an items grid — these are **derived** from base state every render (memoized), never stored as separate state that can drift out of sync. The prototype already does this; preserve the discipline.

### 1.5 URL is state
Tab, filters, page, and the open record should be reflected in the URL (`/tasks?tab=active&status=transit&page=2`, `/tasks/:id`). This gives you shareable links, working back-button, and refresh-survival for free — and it forces the filter state to live in one canonical place (the router) instead of scattered `useState`. This is the modern replacement for the prototype's in-memory `tab`/`filter` state.

### 1.6 Accessibility and semantics are not optional
The prototype fakes some controls with `<div onClick>`. Production uses real semantics: `<button>` for actions, `<table>` for tabular data (the design system's DataTable handles this), `<label>`+`<input>` pairs, focus traps in modals, `Esc` to close, arrow-key nav in menus, `aria-*` on custom widgets. A dispatcher lives in this tool 8 hours a day — keyboard flow is a feature, not a polish item.

---

## 2. Files you must study first (and why)

Read these before designing your component tree. Do not skim.

### 2.1 The approved prototype — *the behavioral spec*
- **`Innovo Front End Design-handoff/innovo-front-end-design/project/Tasks.dc.html`** — the entire Tasks screen. This is the single source of truth for **what the UI does**: every tab, the data table, the 5-tab task card, New Task, Change Status, Table Settings, multi-select bulk toolbar, Bulk Update, the driver Assign popover (single + bulk), Search, and the read-only View Task. Read its logic class top-to-bottom to extract the **state model and the interaction rules** (e.g. "assigning a driver auto-sets status to Assigned", "a task is `isNew` until any change touches it", "assignment is orthogonal to status").
- **`Innovo Front End Design-handoff/innovo-front-end-design/project/TaskForm.dc.html`** — the shared task form (sender/recipient/time-window/assign/options). This is the field inventory for both Create and Edit.
- **Screenshots** (if provided) — pixel reference for spacing and density. The prototype is the source of truth for behavior; screenshots for look.

> ⚠️ Study the prototype for **intent and behavior**, then reimplement cleanly. Do not port its DOM-reading or `React.createElement` shortcuts (§9).

### 2.2 The Design System — *the visual + component source of truth*
Bound at `Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/`. Full source tree at `Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/`. Study:

- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/colors.css`** — the palette as CSS variables. Emerald `--color-primary` (#2ea86a) and its hover/active steps; slate ink `--text-strong` (#2f343b), `--text-body`, `--text-muted`; surfaces `--bg-canvas` (white), `--bg-soft`, `--bg-adornment`; borders `--border-hairline` (#e6e8eb) and `--border-control` (#d5d8dc); status colors incl. danger `--status-danger` (#e8432e). **Never hardcode these hexes — reference the vars.**
- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/typography.css` + `Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/fonts.css`** — Inter, loaded via Google Fonts. Page titles 18px, table headers 13px, body 13–14px. Hierarchy is **weight (600 vs 400) + accent + hairlines**, never a loud type scale.
- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/spacing.css`** — 4px base, 2px micro-step. Tuned for operator density.
- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/radii.css`** — 3px chips, 4px buttons/inputs, 6px modal, full-round avatars/toggles only.
- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/tokens/base.css` + `Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/styles.css`** — resets + the global entry point. Linking `styles.css` (and the token files) is how you inherit the system.
- **`Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/_ds_bundle.js`** — the prebuilt component bundle exposing `window.InnovoXpressDesignSystem_8c8c9b.*`. In production you will instead consume the **source components** (below), but study the bundle's component list to know what exists.
- **Component source** (`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/` in the DS project):
  - `buttons/` — **Button** (variants: primary / utility / ghost / danger), **IconButton**, **SplitButton**
  - `forms/` — **Input** (icon gutter / prepend slot), **Select**, **Checkbox**, **Switch**
  - `feedback/` — **StatusBadge** (lifecycle chips), **Badge**, **Avatar** (initials chip, never a photo)
  - `navigation/` — **SidebarItem**, **Tabs** (page-level + modal-level)
  - `data/` — **DataTable** (the primary work surface: header, selectable rows, column config), **Card**, **StatTile**
  - `overlay/` — **Dialog** (the tabbed record-creation modal shell)
  - `Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/assets/icons.jsx` — the Lucide-derived inline glyph set (2px stroke, 24px grid). Use these, not a new icon dependency.
- **`Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/readme.md`** (the design-system guide) — the written law: voice/tone, the "one green CTA per context" rule, hairline-not-shadow depth, no gradients/emoji/photography, hover/press/focus behavior.

### 2.3 The backend — *the data contract*
Study (do not re-architect):
- **`backend/prisma/schema.prisma`** — the normalized domain: Consignment (+ 1:1 ConsignmentDetails, N Items, M Services via junction, N TrackingEvents), Client, Driver, ServiceType, User. This is the **shape of every object your UI renders**. Map prototype fields → schema fields here (the prototype's "task" = a consignment).
- **`backend/src/schemas/`** — the **Zod schemas you will import into the frontend** (`createConsignmentSchema`, `updateConsignmentSchema`, `changeStatusSchema`, `listConsignmentsQuerySchema`, `itemSchema`). Note: `cubic` is server-computed and **not** accepted from the client.
- **`backend/src/constants/`** — `enums.ts` (status/medium/serviceLevel + label maps + `asOptions()`), `statusFlow.ts` (`STATUS_TRANSITIONS` + `canTransition`), `serviceTypes.ts` (the 26 services). **Mirror or import these — do not re-type the status list in the frontend.**
- **The API surface** (already implemented): `GET /api/consignments` (filters: status, client, from, to, q, page, pageSize), `GET /api/consignments/:id`, `POST /api/consignments`, `PUT /api/consignments/:id`, `PATCH /api/consignments/:id/status`, `GET /api/dashboard/today`, `GET /api/reference`, plus **allocation**: `GET /api/allocation`, `GET /api/allocation/drivers` (drivers + live `activeLoad`), `POST/DELETE /api/allocation/:id/assign`. Auth is `POST /api/auth/login` → JWT, `GET /api/auth/me`.
- **`CLAUDE.md`** — the project brief: locked stack, domain decisions (dual AUTO/MANUAL order numbers, status lifecycle, order-id policy), and the source-data quirks the UI must tolerate (`#ERROR!` cells, garbage Service Level/State, inconsistent dimension strings, free-text order ids).

---

## 2b. Navigation map — fetch exactly these, don't crawl the tree

Two separate projects are in play. **Do not explore the whole codebase** — the files below are the only ones that matter, with their exact locations. Open them on demand.

### Project A — this prototype project (root = where this `HANDOFF.md` lives)

```
Innovo Front End Design-handoff/innovo-front-end-design/project/Tasks.dc.html          ← THE behavioral spec. One file holds: the template (markup) AND the logic class (state + handlers). The flow lives in the logic class — read it end-to-end.
Innovo Front End Design-handoff/innovo-front-end-design/project/TaskForm.dc.html       ← shared task form fields (sender/recipient/time-window/assign/options); template + (empty) logic.
Innovo Front End Design-handoff/innovo-front-end-design/project/handoff.md             ← this document.
Innovo Front End Design-handoff/innovo-front-end-design/project/CLAUDE.md              ← project brief: stack, domain model, status lifecycle, data quirks.
Innovo Front End Design-handoff/innovo-front-end-design/project/screenshots/           ← pixel reference for key states (open if present).
Innovo Front End Design-handoff/innovo-front-end-design/project/support.js             ← PROTOTYPE RUNTIME ONLY — the engine that runs .dc.html. Ignore; do not port.
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/_ds_bundle.js   ← prebuilt copy of the design-system components for the prototype. Ignore in prod; pull source from Project B.
```

> In a `.dc.html` file: everything between `<x-dc>`…`</x-dc>` is the **template**; the `class Component extends DCLogic { … }` block is the **logic** (state, `renderVals()`, all handlers). When you need "how does X behave?", read the logic class; the template only wires buttons to handlers.

### Project B — the Design System (id `8c8c9b09-67cf-420f-ad7a-98fb50a86570`)

Two ways to reach it: the **bound subset** copied into this project at `Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/` (tokens, bundle, styles), and the **full source tree** at `Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/` (every component's `.jsx`). Fetch precisely:

```
# Tokens (bound copy — read these for the palette/type/spacing values)
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/colors.css        ← --color-primary, --text-strong/body/muted, --bg-*, --border-hairline/control, --status-danger
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/typography.css    ← Inter sizes/weights
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/fonts.css         ← Inter @font-face / Google Fonts link
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/spacing.css       ← 4px base, 2px micro-step
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/radii.css         ← 3/4/6px + full-round
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/tokens/base.css          ← resets + type utilities
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/styles.css               ← global entry (imports only)
Innovo Front End Design-handoff/innovo-front-end-design/project/_ds/innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570/_ds_bundle.js            ← list of exported components (window.InnovoXpressDesignSystem_8c8c9b.*)

# Component SOURCE (full tree — these are what you reuse/wrap in prod, one file each)
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/data/DataTable.jsx     ← the consignments grid (header, selectable rows, column config) — your TaskTable wraps this
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/data/Card.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/data/StatTile.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/overlay/Dialog.jsx     ← tabbed record-creation modal shell — Task Card / New Task build on this
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/navigation/Tabs.jsx    ← page + modal tab strips
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/navigation/SidebarItem.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/feedback/StatusBadge.jsx ← lifecycle chips (status colors live here)
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/feedback/Badge.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/feedback/Avatar.jsx     ← initials chip (driver/recipient)
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/buttons/Button.jsx      ← primary/utility/ghost/danger variants
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/buttons/IconButton.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/buttons/SplitButton.jsx ← the "New …" split button
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/forms/Input.jsx         ← icon-gutter / prepend-slot field
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/forms/Select.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/forms/Checkbox.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/components/forms/Switch.jsx
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/assets/icons.jsx                   ← Lucide-derived inline glyph set — reuse these paths, add no icon dependency
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/assets/logo-innovo-xpress.svg      ← red-pin + "Innovo Xpress" wordmark
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/assets/mark-pin.svg
Innovo Xpress Design System-handoff/innovo-xpress-design-system/project/readme.md                          ← the written design law (voice, one-green-CTA, hairline depth, hover/press/focus)


```

> Folder names in Project B can vary by brand — if a path 404s, `list_files` the nearest parent and match by component name. The `…8c8c9b09…` segment in the bound copy is the literal `innovo-xpress-design-system-8c8c9b09-67cf-420f-ad7a-98fb50a86570`.

### Project C — the backend (the data contract; `backend/` at the repo root)

```
backend/prisma/schema.prisma             ← the normalized domain (Consignment + Details + Items + Services + TrackingEvents + Client/Driver/User). The shape of every object you render.
backend/src/schemas/consignment.schema.ts ← createConsignmentSchema, updateConsignmentSchema, changeStatusSchema, itemSchema (cubic NOT client-accepted) — IMPORT these into the frontend.
backend/src/schemas/query.schema.ts       ← listConsignmentsQuerySchema (status, client, from, to, q, page, pageSize, sort, order)
backend/src/schemas/auth.schema.ts        ← loginSchema
backend/src/constants/enums.ts            ← status/medium/serviceLevel enums + label maps + asOptions() — mirror, don't re-type
backend/src/constants/statusFlow.ts       ← STATUS_TRANSITIONS + canTransition(from,to) — drives Change Status valid options
backend/src/constants/serviceTypes.ts     ← the 26 services (the Requirements/Additional Services list)
backend/src/modules/consignments/         ← routes → controller → service → repository (the list/create/update/changeStatus contract)
backend/src/modules/allocation/           ← assign/unassign + drivers-with-load (the Driver Assign popover's API)
backend/src/app.ts                         ← where every route is mounted (the full API surface in one place)
```

---

## 3. Target stack (locked — from CLAUDE.md)

- **Vite + React 19 + TypeScript** (strict mode on).
- **Tailwind CSS** for layout/utility, **driven by the design-system tokens** — map `--color-primary` etc. into the Tailwind theme so `bg-primary` resolves to the token. Tailwind is the spacing/flex/grid tool; the **tokens remain the source of truth** for values.
- **shadcn/ui** for unstyled primitives **only where the design system has no equivalent**. The DS Button/Input/Select/Dialog/Tabs/Checkbox win over shadcn versions — wrap, don't replace.
- **TanStack Query** — all server state (§1.2).
- **TanStack Table** — the consignments grid (sorting, column visibility/reordering, selection). The DS **DataTable** is the presentational layer; TanStack Table is the headless engine behind it.
- **React Hook Form + Zod** — every form, validated with the **shared backend Zod schemas**.
- **React Router** — routing + URL-as-state (§1.5).
- **Recharts** — dashboard KPIs (later).
- **bcrypt/JWT** handled by backend; frontend stores the token and attaches it (see §7).

---

## 4. Deployment-ready folder structure

This is the structure to scaffold. It separates **app shell**, **feature modules**, **shared UI**, **server-state hooks**, and **shared domain logic**. A new screen = a new folder under `features/`, nothing else moves.

```
innovo-frontend/
├── public/
│   └── favicon, static assets
├── src/
│   ├── main.tsx                    # React root, providers (Query, Router, Auth)
│   ├── App.tsx                     # Router outlet + top-level layout
│   │
│   ├── app/                        # App-wide wiring (not feature-specific)
│   │   ├── router.tsx              # Route table; lazy-loaded feature routes
│   │   ├── queryClient.ts          # TanStack Query client + defaults
│   │   ├── providers.tsx           # Compose all context providers
│   │   └── env.ts                  # Typed, validated env (VITE_API_URL, …)
│   │
│   ├── layouts/
│   │   └── ConsoleLayout.tsx       # 230px sidebar + 56px topbar + content outlet
│   │
│   ├── components/                 # App-level shared UI (NOT design-system primitives)
│   │   ├── Sidebar/                # Nav rail (Dashboard, Tasks, Map, Users, …)
│   │   ├── Topbar/                 # Logo, page title, action icons
│   │   ├── PageTabs.tsx            # Active/Completed/Failed/New/Cancelled/Search strip
│   │   ├── Toolbar/                # Default toolbar + bulk-action toolbar
│   │   ├── FilterMenus/            # Date (All Days) + Status/Type/Driver filter popovers
│   │   ├── Modal.tsx               # App modal shell (wraps DS Dialog; scrim, focus trap, Esc)
│   │   └── Toast.tsx               # Toast host (status feedback)
│   │
│   ├── ui/                         # Thin wrappers around the DESIGN SYSTEM components
│   │   ├── index.ts                # Re-export Button, Input, Select, Checkbox, Switch,
│   │   │                           #   StatusBadge, Avatar, Tabs, DataTable, Dialog, Icon
│   │   └── (each wrapper adds app-typed props / sane defaults only)
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── useAuth.ts          # token storage, me(), login(), logout()
│   │   │   └── RequireAuth.tsx     # route guard
│   │   │
│   │   ├── tasks/                  # ← the screen you are building
│   │   │   ├── TasksPage.tsx       # Orchestrator: tabs + toolbar + table + modal routing
│   │   │   ├── components/
│   │   │   │   ├── TaskTable.tsx           # DS DataTable + TanStack Table; columns, selection
│   │   │   │   ├── taskColumns.tsx         # Column defs (incl. dotted-destination, driver cell,
│   │   │   │   │                           #   status cell → both open their own flows)
│   │   │   │   ├── TaskToolbar.tsx         # Default vs bulk toolbar (count badge, actions)
│   │   │   │   ├── TaskCardModal.tsx       # 5 tabs: Overview/Items/Attachments/Invoice/History
│   │   │   │   ├── NewTaskModal.tsx        # Overview(form+items)/Attachments
│   │   │   │   ├── ViewTaskModal.tsx       # read-only detail (two-column)
│   │   │   │   ├── ChangeStatusModal.tsx   # lifecycle radios (status-flow aware)
│   │   │   │   ├── TableSettingsModal.tsx  # column show/hide + reorder
│   │   │   │   ├── BulkUpdateModal.tsx     # multi-field bulk patch (no "Assigned" in Status)
│   │   │   │   ├── DriverAssignPopover.tsx # single + bulk; Manual/Auto tabs; load bars
│   │   │   │   ├── SearchPanel.tsx         # filter form + results
│   │   │   │   └── TaskForm.tsx            # shared create/edit form (sender/recipient/…)
│   │   │   ├── ItemsEditor.tsx             # items grid + add/edit/delete item modal
│   │   │   ├── hooks/
│   │   │   │   ├── useConsignments.ts      # list query (keyed by filters)
│   │   │   │   ├── useConsignment.ts       # single record query
│   │   │   │   ├── useCreateConsignment.ts # mutation + invalidation
│   │   │   │   ├── useUpdateConsignment.ts
│   │   │   │   ├── useChangeStatus.ts
│   │   │   │   ├── useAssignDriver.ts      # single + bulk assign/unassign
│   │   │   │   └── useDrivers.ts           # drivers + activeLoad
│   │   │   └── tasks.types.ts              # view-model types (Task = mapped Consignment)
│   │   │
│   │   ├── dashboard/              # (later) Today KPIs, quick links
│   │   ├── allocation/            # (later) allocation grid + driver panel
│   │   └── …                      # one folder per nav item, added over time
│   │
│   ├── api/
│   │   ├── client.ts              # fetch/axios wrapper: base URL, auth header, error envelope
│   │   ├── consignments.ts        # typed endpoint fns (list/get/create/update/changeStatus)
│   │   ├── allocation.ts          # assign/unassign/drivers
│   │   ├── reference.ts           # clients/drivers/serviceTypes/options
│   │   └── dashboard.ts
│   │
│   ├── domain/                    # SHARED business logic (no React, no styling)
│   │   ├── status.ts              # 7-state lifecycle, tab groupings, labels, colors,
│   │   │                          #   canTransition() — mirrors backend constants
│   │   ├── schemas.ts             # re-export / mirror backend Zod schemas
│   │   ├── cubic.ts               # L×W×H display helper (server computes the stored value)
│   │   ├── format.ts              # money (£), tabular numbers, timestamps, weight
│   │   └── mappers.ts             # Consignment (API) ⇄ Task (view-model)
│   │
│   ├── styles/
│   │   ├── tokens.css             # @import the design-system token CSS (single place)
│   │   └── tailwind.css           # Tailwind layers; theme maps to tokens
│   │
│   └── types/
│       └── api.d.ts               # API response/envelope types
│
├── .env.example                   # VITE_API_URL, …
├── index.html
├── tailwind.config.ts             # theme.extend.colors → design-system tokens
├── tsconfig.json                  # strict; path aliases (@/features, @/ui, @/domain)
├── vite.config.ts
├── package.json
└── README.md                      # run/build/deploy instructions
```

**Why this shape scales:**
- A **feature folder owns its screen end-to-end** (UI + hooks + types). Delete the folder, the feature is gone cleanly. Add a folder, a new screen exists.
- **`ui/` wraps the design system** so the rest of the app imports from `@/ui`, never from the bundle path. The day the design system updates, you touch one folder.
- **`domain/` is framework-free** — pure functions and constants, unit-testable, shared by every feature. The status list, formatters, and mappers live here once.
- **`api/` is the only place that knows URLs**; features call typed hooks, never `fetch` directly.

---

## 5. The Tasks screen — behavioral contract to preserve

Reproduce **all** of this. Source of truth is `Innovo Front End Design-handoff/innovo-front-end-design/project/Tasks.dc.html`; this is the checklist.

**Tabs:** Active / Completed / Failed / New / Cancelled / Search.
- **Active** = any task not Completed/Failed/Cancelled.
- **New** = freshly created **and untouched** (`isNew`). A task created shows in **both** Active and New. **Any** change (assign, status change, edit, bulk update, unassign) clears `isNew` → it leaves New but stays in Active. Unassigning does **not** send a task to New.

**Row interactions (important — these are distinct targets):**
- Clicking the **destination address** (dotted underline on hover) opens the **read-only View** modal.
- Clicking the **driver cell** opens the **Driver Assign popover** (assign if empty; change if assigned).
- Clicking the **status badge** opens **Change Status** for that row.
- The row's **pencil** opens the editable **Task Card**; the **▾** menu offers View / Change Status / Delete.
- A generic click elsewhere on the row does **nothing** (no accidental open).

**Driver assignment (orthogonal to status):**
- Assigning a driver sets `driverId` and **auto-sets status Unassigned→Assigned**; writes a tracking/audit event; never otherwise touches the lifecycle.
- A task **never disappears** from its list on assignment. To clear a driver, set status → Unassigned (via Change Status), which restores the assign icon.
- The **Assign popover** has **Manual** (driver list with avatars + live load bars + radio select → Notify / Assign) and **Auto-Assign** (display-only). Same popover serves the single-row icon **and** the bulk toolbar's Assign (shows "N task/s").

**Change Status:** lifecycle radios, **status-flow aware** — show only valid transitions (driver-assigned vs not yields different option sets). Save applies + audits.

**Task Card (5 tabs):** Overview (the shared form) · Items (grid with grand total; add/edit/delete) · Attachments (POD thumbnails, "visible to driver") · Invoice (items total / shipping fee / COD due / amount due) · History (tracking-event timeline). Footer: Close / Linked Task List / More (tracking, label, docket, change status, delete) / Save & Close.

**New Task:** Overview tab contains the **form and the Items section directly below the recipient block** (not a separate tab). Add Item opens the item modal; **Save & Add Another** commits the item and **clears the form** for the next; **Save & Close** commits and closes. Items render live with a grand total and carry into the created task. Editing an item **prefills** the modal; delete removes it; both recompute totals. Saving New Task **appends a row** and switches to the New tab. Attachments tab is present but secondary.

**Multi-select → bulk toolbar:** Assign / Edit (→ Bulk Update) / Delete / Label / Docket / Download, plus a red "N tasks selected" badge with clear. Bulk **Assign** opens the assign popover for all selected; bulk **Edit** opens **Bulk Update** (Status [no "Assigned" option], Merchant, Priority, Description, Complete After/Before, Due Amount, Shipping Fee, External ID, Task Form, Notifications, Requirements) — only filled fields apply; setting status Unassigned clears the driver; any bulk change clears `isNew`.

**Table Settings:** show/hide every column (live) + reorder + reset. Default vs full column sets per the prototype.

**Filters (functional):** **All Days** date dropdown (All/Today/Tomorrow/Overdue/Next 3/Next 7 + calendar) filters by Complete-Before; **Active Tasks** panel (Status/Type/Driver checkboxes) filters the list with Clear All. In production these become **query params** feeding the list query, not in-memory array filters.

**Search tab:** filter form (Task ID, Type, External ID, Driver, Keyword, Merchant, Status, Complete-Before range) + result-display radios + results table. Maps to `GET /api/consignments?…`.

**View Task:** read-only two-column detail (Task Details / Items / Time Window / Linked Tasks / Attachments / History) with Edit → opens the Task Card.

---

## 6. Data mapping (prototype ⇄ backend)

The prototype's flat "task" object is a **denormalized view-model**. Map it:

| Prototype field | Backend source |
|---|---|
| `id` | `Consignment.id` (cuid) |
| `externalId` | `Consignment.orderNo` (MANUAL) / generated (AUTO) |
| `type` | derived from pickup vs delivery intent |
| `status` | `Consignment.status` (7-state enum) |
| `driver` / `driverAssigned` | `Consignment.driverId` → Driver (+ allocation) |
| `dest` / `destBuilding` / `destNotes` | `ConsignmentDetails` receiver address fields |
| `recipient` / `recipientPhone` / `recipientEmail` | `ConsignmentDetails` receiver snapshot |
| `requester` / dispatch fields | `ConsignmentDetails` sender snapshot |
| `completeAfter` / `completeBefore` | `ConsignmentDetails` booking/close times |
| `items[]` (product/qty/lineTotal/weight) | `Item[]` (cubic server-computed) |
| `requirements[]` | `ConsignmentService[]` (junction → ServiceType) |
| `feeNum` / `codNum` | details/amount fields |
| `history[]` | `TrackingEvent[]` |

Put this in `domain/mappers.ts`. Components consume the **view-model**, never raw Prisma shapes — so a schema change ripples through one mapper, not the whole UI.

---

## 7. Cross-cutting production concerns

- **Auth:** store JWT (memory + refresh strategy TBD; basic localStorage acceptable for v1 per CLAUDE.md). `api/client.ts` attaches `Authorization: Bearer …`; a 401 bounces to login. `RequireAuth` guards routes.
- **Error handling:** the backend returns a **central JSON error envelope** (maps Zod, Prisma P2002→409, etc.). The API client unwraps it into typed errors; surface them as toasts/inline field errors. Never swallow.
- **Loading/empty/error states:** every query renders three states. Empty states are flat and factual ("No data available") — no illustrations, per the design language.
- **Optimistic updates:** for fast actions (assign, status) use optimistic mutation + rollback on error, then invalidate. Keeps the dispatcher's flow snappy.
- **Pagination:** server-side (`page`, `pageSize ≤ 100`). Wire TanStack Table's pagination to query params.
- **Tolerate dirty data:** the import source has `#ERROR!` cells, garbage Service Level/State, inconsistent dimension strings, free-text order ids. Render defensively — never crash a row on a bad field; show "—" for missing values.
- **Performance:** virtualize the table body if row counts grow; memoize column defs and derived totals; code-split each feature route.
- **Testing:** unit-test `domain/` (status transitions, mappers, formatters) and the bulk-update field logic; component-test the assign popover and change-status flows. These are the rules most likely to regress.

---

## 8. Design-language guardrails (do not violate)

From the design system — these are visual law:
- **One emerald CTA per context.** Toolbar/filter buttons are **white bordered utility** buttons; only the in-context commit (modal "Save & Close", "Assign") is green.
- **Depth is hairlines, not shadows.** Only the modal (soft scrim + single drop shadow) and dropdowns (lighter shadow) lift. Cards/tiles are flat white + hairline border, **no shadow**.
- **No gradients, no images/textures in chrome, no emoji, no photography.** Avatars are initials chips.
- **Sharp radii:** 3px chips, 4px buttons/inputs, 6px modal, full-round only avatars/toggles.
- **Type hierarchy = weight + accent + hairlines**, not a loud scale. Title 18px, table header 13px (tracking-spaced near-caps is the one place caps read), body 13–14px. **Tabular numerals in tables.**
- **Hover:** rows/ghost buttons → `--bg-soft`; icons darken to ink; green CTA → `--color-primary-active`. **Focus:** input border flips emerald, **no glow ring**. **Selected row:** emerald-soft tint.
- **Motion:** 100–140ms color/bg transitions only. No bounce, no entrance animation.
- **Copy:** Title Case for buttons/tabs/labels; terse, label-only, no marketing tone, no exclamation marks; money carries `£`/currency symbol; counts bare ("0 Tasks").

---

## 9. What NOT to copy from the prototype

The prototype is a high-fidelity DC (Design Component) build. These mechanisms are **prototype-only** — reimplement them the React-idiomatic way:

1. **DOM-reading on save.** The prototype reads form values by `document.getElementById(...).querySelectorAll('input')` and positional indexing. **Replace with React Hook Form** controlled state. No `document.querySelector` for form data.
2. **`React.createElement` blocks in the logic class** (the table cells, the row action menu). These exist because the DC template couldn't express them. **Rewrite as normal JSX components.** Anything built this way in the prototype should become a real, inspectable component.
3. **The `_skip` flag hack** for outside-click menu handling. **Replace with a proper `useOnClickOutside` hook / Radix Popover** (via shadcn) with correct event semantics.
4. **In-memory `seed()` data and array splicing.** **Replace with TanStack Query** against the real API. No hardcoded task array, no manual `tasks.map(...).filter(...)` after writes.
5. **In-memory tab/filter state.** **Replace with URL/query-param state** feeding the list query.
6. **The `children`-slot composition** used to inject the items grid into the form. In React this is trivial real composition — `<TaskForm>{items section}</TaskForm>` or just render siblings. Don't recreate the slot indirection.
7. **One giant file.** The prototype is a single `.dc.html` for prototyping speed. Production is the **component tree in §4**. Do not ship a 1000-line component.

---

## 10. Known inconsistencies / open decisions to resolve

Flag these to the team; pick a convention and apply it once in `domain/`:
- **Currency symbol.** The design guide specifies `£`; the prototype's demo data uses `$`. Pick the real operating currency (Innovo Xpress is Canadian — likely `CAD $`) and centralize in `format.ts`. Do not scatter symbols.
- **Status vocabulary drift.** The backend lifecycle is `RECEIVED → PICKUP_RECEIVED → GOING_FOR_PICKUP → PICKED_UP → GOING_TO_DELIVERY → DELIVERED (+ CANCELLED)`; the prototype/UI uses friendlier labels (Unassigned/Assigned/Processed/Loaded/Transit/Completed/Failed) and an extra "Failed" notion. **Reconcile to one canonical enum + label map** in `domain/status.ts`, and confirm whether "Failed" is a real backend state or a UI rollup. The tabs (Active/New/Completed/Failed/Cancelled) are **groupings** over the enum — define the grouping in one place.
- **"Assigning" intermediate state.** The filter panel lists an "Assigning" status not in the core 7. Decide if it's real or cosmetic; don't let it leak into the API contract.
- **Order id is both AUTO and MANUAL.** UI must support entering a manual id (e.g. a Purolator number) or leaving it blank for `ORD-YYYYMMDD-NNNN`. Surface the 409 on duplicate manual ids as an inline field error.
- **Design-system caveats.** Per its own guide, the palette hexes are eyeballed and **Inter/Lucide are substitutions** for the unconfirmed real brand font/icons. Keep them behind tokens so a later swap is one change.
- **Cubic is server-authoritative.** Show it, let users enter L/W/H, but never send a client-computed `cubic` — the API rejects it.

---

## 11. Definition of done

- Tasks screen reproduces **every** behavior in §5, wired to the real API, with no in-memory seed.
- All UI composes design-system components via `@/ui`; zero hardcoded hexes; tokens drive Tailwind.
- All forms use React Hook Form + the **shared** Zod schemas; cubic never sent.
- Server state via TanStack Query with correct invalidation; URL reflects tab/filters/page/open-record.
- No `document.querySelector` for app data; no `React.createElement` UI; no outside-click hacks.
- Loading/empty/error states everywhere; dirty data never crashes a row.
- Keyboard + a11y: modals trap focus, `Esc` closes, menus arrow-navigate, actions are real `<button>`s.
- Folder structure matches §4; a new screen is a new `features/*` folder and nothing else.
- `README.md` documents env, run, build, deploy.

---

*Build the system, not the screen. When in doubt, centralize it in `domain/` or `ui/` and import it everywhere — that is the whole game.*

---
---

# PART II — Implementation Handoff (the build that followed)

> PART I (§0–§11) is the **spec**; PART II is the **as-built system** now in the repo. Read PART I for intent, PART II for what actually exists. **Nothing in PART I was removed** — this part only adds. It is written like §9 ("file map so you don't re-explore") so a new engineer/AI can continue the frontend without re-exploring the tree.

## 12. Implementation status — what's built (frontend)

**The Tasks screen is fully implemented and verified**, living at `frontend/innovo-frontend/`. It runs on **static fixtures** (an in-memory store seeded from the prototype data), so it is fully functional standalone; the real backend is **not yet wired** (deliberate — see §21).

Verified green (as run):
- `npm run typecheck` (`tsc -b`, strict) → **0 errors**
- `npm run build` (`tsc -b && vite build`) → clean, **164 modules**, no warnings
- `npm run test` (Vitest) → **23/23 pass** — domain rules (status/mutations/derive) **plus a full-page smoke test** that mounts `TasksPage` and asserts seed rows render (catches runtime/hook errors a typecheck cannot)
- `npm run dev` → boots clean, serves at `http://localhost:5173`

Not done (deferred by decision): backend wiring (API client + TanStack Query), real auth/login, the other nav screens (Dashboard/Map/Users…), CSV import.

## 13. Decisions locked for this build (answered before coding)

| Decision | Choice |
|---|---|
| Data layer | **Static fixtures** in an in-memory store (context + reducer). No mock server, no API calls yet. |
| App location | **`frontend/innovo-frontend/`** — a sibling of the two `-handoff` reference folders; reference material left untouched. |
| Fidelity | **Exact flow + design (1:1)** with the prototype, composed from DS tokens/components. |
| Scope | **Tasks screen only, but ALL of its behavior.** Shell (sidebar/topbar) only as needed to host Tasks; login/auth stubbed. |

## 14. As-built stack (versions actually installed)

Vite 8 · React 19.2 · TypeScript 6 (strict; `moduleResolution: bundler`; `verbatimModuleSyntax`; `allowJs:true`+`checkJs:false` so vendored DS `.jsx` resolve but aren't type-checked) · **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config`; theme mapped in CSS via `@theme inline`) · React Router 7 · React Hook Form 7 + Zod 4 + `@hookform/resolvers` 5 · Vitest 4 + Testing Library + jsdom · **oxlint** (the Vite scaffold uses oxlint, **not** eslint). `@tanstack/react-table` is installed for later (see §20). Path alias `@/* → src/*` (vite `resolve.alias` + tsconfig `paths`). Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`.

## 15. Frontend file map (so you don't re-explore) — mirrors §9

All paths under `frontend/innovo-frontend/`.

**Entry / config**
- `index.html` — title "Innovo Xpress TMS".
- `vite.config.ts` — `react()` + `tailwindcss()` plugins, `@`→`src` alias, Vitest `test` block (jsdom, setup `src/test/setup.ts`).
- `tsconfig.app.json` — strict; `paths` `@/*`; `allowJs:true`+`checkJs:false`.
- `src/main.tsx` — React root; wraps `<AppProviders><App/></AppProviders>`.
- `src/App.tsx` — Routes: `/tasks` under `ConsoleLayout`; `*` → redirect `/tasks`.
- `src/app/providers.tsx` — `BrowserRouter > ToastProvider > TasksProvider` (TanStack Query joins here when wired).

**Styles**
- `src/index.css` — remote Inter `@import` first → `@import 'tailwindcss'` → vendored token CSS → `@theme inline` (maps DS vars to Tailwind colors) → app helper classes (`.ix-reset-btn`, `.ix-dest:hover` dotted underline, `.ix-menu-item`, `.ix-clip`, `.ix-input:focus`).
- `src/styles/tokens/*.css` — **vendored DS tokens** (colors/typography/fonts/spacing/radii/base) — the source of truth for every value.
- `src/styles/app-tokens.css` — two app-only tokens `--status-processed` (#8b5cf6) and `--status-loaded` (#a9743b) for statuses the DS has no color for.

**`src/ui/` — the `@/ui` layer (wraps the design system)**
- `ds/` — **vendored DS component source verbatim** (`buttons/`, `data/`, `feedback/`, `forms/`, `navigation/`, `overlay/`). Consumed only through the wrappers below — the rest of the app never imports from `ds/`.
- `index.tsx` — typed wrappers + barrel: `Button, IconButton, SplitButton, DataTable<Row>, Card, StatTile, Avatar, Badge, Input, Select, Checkbox, Switch, Tabs, SidebarItem` (+ exported types `ColumnDef`, `ButtonProps`, …). Re-exports `Icon, Textarea, StatusChip, Modal, Popover, useOnClickOutside`.
- `Icon.tsx` — **ESM port** of the DS `icons.jsx` (which was a `window.IX` IIFE, unusable as a module). `ICON_PATHS` + `<Icon name size strokeWidth/>`, 37 glyphs, `currentColor`.
- `Modal.tsx` — wraps DS `Dialog` and **adds** Esc-to-close, Tab focus trap, body scroll-lock, and a module-level **modal stack** so only the topmost modal handles Esc/Tab (nested item modal over New Task works).
- `Popover.tsx` — anchored popover (trigger + floating panel); closes on outside-click (`useOnClickOutside`) + Esc. The React-idiomatic replacement for the prototype's `_skip` hack (§9 PART I).
- `StatusChip.tsx` — DS StatusBadge box, but color/label driven by `domain/status` (the DS badge only knows the **backend** enum keys; our screen uses the prototype's 8 statuses). Renders as a real `<button>` when clickable.
- `Textarea.tsx` — token-styled multiline input (DS ships none). `hooks/useOnClickOutside.ts`.

**`src/domain/` — framework-free business logic (unit-tested)**
- `status.ts` — **the canonical status model** (see §17): `TaskStatus` (8 values), `STATUS_META` (label/description/colorVar), `TASK_TABS`/`TAB_LABELS`, `isInTab`, `changeStatusOptions(driverAssigned)`, `BULK_STATUS_OPTIONS`, `FILTER_STATUS_KEYS`/`FILTER_STATUS_LABELS`.
- `mutations.ts` — pure task mutations: `assignDriver`, `changeStatus`, `bulkUpdate` (+`BulkPatch`), `createTask`, `updateTask`, `deleteMany`, `buildItem`, `expandRequirements`/`requirementsLabel`, `taskToFormValues`; consts `DEFAULT_DRIVER`, `REQUIREMENTS_ALL`.
- `derive.ts` — `visibleRows(tasks, filters)` (tab + date + checklists + in-table search + sort), `matchDate`, `totals`, `itemsGrandTotal`, `driversWithLoad`, `searchTasks`, `EMPTY_FILTERS`, type `TaskFilters`.
- `format.ts` — `CURRENCY` (`$`), `money`, `weightKg`, `qty`, `dash` (blank/`#ERROR!` → "—"), `parseMoney`, `parseWeight`, `nowLabel`.
- `schemas.ts` — Zod `taskFormSchema` + `EMPTY_TASK_FORM`, `itemFormSchema` + `EMPTY_ITEM`. **No `.default()`** (it makes the RHF resolver input optional and clashes with the output type); numeric item fields are strings, parsed in `buildItem`.
- `types.ts` — the `Task` view-model (flat, mirrors the prototype "task"), `TaskItem`, `HistoryEvent`, `Driver`. `id.ts` — `genId()` (10-char hex). `mappers.ts` — **placeholder** for Consignment ⇄ Task (the wiring phase).

**`src/fixtures/`** — `tasks.ts` (the 11 seed tasks, with Complete-After/Before dates computed **relative to today** so every date-filter bucket has matching rows), `drivers.ts` (5), `reference.ts` (merchants/teams/package types/requirement options).

**`src/store/`** — `TasksProvider.tsx`: context + reducer seeded from `SEED_TASKS`; actions `assign/changeStatus/bulkUpdate/create/update/remove` delegate to `domain/mutations`. `useTasksStore()`.

**`src/components/` (app shell)** — `Sidebar/Sidebar.tsx` (230px; red-pin wordmark, user chip, nav rail, Tasks active), `Topbar/Topbar.tsx` (56px; title from active tab, action-icon cluster), `Toast.tsx` (`ToastProvider`/`useToast`, single transient flash).

**`src/layouts/`** — `ConsoleLayout.tsx` (sidebar + topbar + scrollable `<Outlet/>`).

**`src/features/tasks/`** — the screen:
- `TasksPage.tsx` — **orchestrator**: page tabs + filters + toolbar + table, and routing of every modal/popover. Selection + which-modal-open are local state; tab/filters/sort are URL state.
- `tasks.types.ts` — re-exports domain types + `COLUMNS` (the **32-column registry**, 8 default-visible) + `COLUMN_LABEL`.
- `components/` — `TaskTable.tsx`, `taskColumns.tsx` (column defs, special cells, `RowActions`), `TaskToolbar.tsx` (default + bulk), `DriverAssignPopover.tsx`, `ChangeStatusModal.tsx`, `TaskForm.tsx`, `ItemsEditor.tsx`, `ItemModal.tsx`, `TaskCardModal.tsx`, `NewTaskModal.tsx`, `ViewTaskModal.tsx`, `BulkUpdateModal.tsx`, `TableSettingsModal.tsx`, `SearchPanel.tsx`, `DateFilterMenu.tsx`, `ActiveTasksFilterMenu.tsx`.
- `hooks/` — `useTaskFilters.ts` (URL search-params ↔ filters/sort), `useTasks.ts` (`useTasks`/`useTask`), `useDrivers.ts`, `useSelection.ts`, `useTableColumns.ts`, `useTaskActions.ts` (store + toast), `useItemsEditor.ts`.

**`src/test/`** — `setup.ts` (jest-dom), `factory.ts` (`makeTask`). Tests: `src/domain/__tests__/{status,mutations,derive}.test.ts` + `src/features/tasks/__tests__/TasksPage.smoke.test.tsx`.

## 16. Data flow & the backend seam

`Component → feature hook (useTasks / useTaskActions / useDrivers) → TasksProvider (state) → pure domain/mutations + domain/derive`. Components never import fixtures or the store directly. **Swap point for the API:** replace each hook's internals with TanStack Query (`useQuery`/`useMutation` against `src/api/*`) — component code stays the same. Tab/filters/sort are **URL state** (`useTaskFilters` over `useSearchParams`, §1.5 PART I).

## 17. Domain rules — the reconciliation (cross-reference §5 / §10 PART I)

**Status vocabulary.** The UI uses the **prototype's 8 statuses** — `unassigned, assigned, processed, loaded, transit, completed, failed, cancelled` — defined once in `domain/status.ts`. The backend's 7-state enum (`RECEIVED…DELIVERED + CANCELLED`) is mapped later in `mappers.ts`. Colors reference DS status tokens where one exists; `processed` (purple) and `loaded` (brown) use the two app tokens (§15).
- **Tabs** (`isInTab`): Active = not completed/failed/cancelled; New = `isNew`; the rest = exact status.
- **`isNew`**: set on create (Unassigned); cleared by ANY action (assign / changeStatus / update / bulk). Unassigning does **not** return a task to New.
- **Change-Status options** (`changeStatusOptions`): driver-assigned → full set incl. assigned/loaded/transit; not assigned → `unassigned/processed/completed/failed` only.
- **Assign** auto-promotes Unassigned→Assigned, writes a history event, never drops the row; clear a driver via Change Status → Unassigned.
- **Bulk Update**: only non-empty fields apply; status omits "Assigned"; status=Unassigned clears the driver; any change clears `isNew`.
- **"Assigning"** appears in the Active-Tasks filter (1:1 with the prototype) but is **cosmetic** — matches no task.

## 18. UI layer notes
DS components are **vendored verbatim and wrapped** ("wrap, don't replace", §1/§2b PART I). All DS form controls use **native DOM events** (`onChange(e)` — read `e.target.value`/`.checked`); `Select` renders its `options` internally (do **not** pass `<option>` children). `Modal` supplies the a11y the DS `Dialog` lacks (Esc / focus-trap / scroll-lock + a topmost-only stack). Icons are the ESM-ported `<Icon>` — no new icon dependency.

## 19. Tasks screen — as-built components (checklist against §5)
- **TasksPage** — tabs `Active/Completed/Failed/New/Cancelled/Search` + DateFilterMenu + ActiveTasksFilterMenu; Search tab → SearchPanel, else Toolbar + Table; routes all modals.
- **TaskTable + taskColumns** — DS `DataTable` driven by `useTableColumns` (32 cols / 8 default) + `useSelection`; distinct cell targets — dest→View, driver→Assign, status chip→Change Status, pencil→Card, ▾→View/Change Status/Delete; sortable headers via `useTaskFilters.setSort`.
- **TaskToolbar** — default (New Task split button · icon group · `N Tasks / $Fee / $COD` summary · in-table search) vs bulk (Assign/Edit/Delete/Label/Docket/Download + red "N tasks selected" with clear).
- **DriverAssignPopover** — single + bulk ("N task/s"), Manual (avatars + live load bars + radio) / Auto tabs, Notify/Assign.
- **ChangeStatusModal** — transition-aware radios (chip + description).
- **TaskForm** — shared RHF form (every PART I §5 field); items injected below the recipient block via `itemsSlot`.
- **ItemsEditor + ItemModal** — items grid + grand total; Save & Add Another (commit + clear, stay) vs Save & Close; edit prefills; delete recomputes.
- **TaskCardModal** — 5 tabs (Overview/Items/Attachments/Invoice/History) + footer Close / Linked Task List / More (tracking/label/docket/change status/delete) / Save & Close.
- **NewTaskModal** — Overview (form+items) / Attachments; Save & Add Another / Save & Close; new task → Unassigned + isNew, appends and switches to New tab.
- **ViewTaskModal** — read-only two-column; Edit → Task Card.
- **BulkUpdateModal** — multi-field patch (only-filled; no "Assigned" in Status).
- **TableSettingsModal** — show/hide (live) + reorder (up/down) + reset.
- **SearchPanel** — filter form + result-display radios + results table.
- **DateFilterMenu / ActiveTasksFilterMenu** — anchored popovers feeding URL filters.

## 20. Intentional deviations from PART I (with rationale)
1. **Data = static fixtures + in-memory store** (not TanStack Query) — per §13's locked decision; the seam (§16) keeps the later swap contained.
2. **Driver Assign is a small focused Modal**, not an anchored popover — accessible and identical from row and bulk toolbar, without fragile anchoring to a scrolled cell.
3. **Table engine** — `@tanstack/react-table` is installed but the table is currently driven by `domain/derive` (sort/filter) + `useSelection` + `useTableColumns` over the DS `DataTable`. Adopt TanStack Table's row model when virtualization/scale demands it.
4. **Two app status tokens** added (`--status-processed`, `--status-loaded`) for prototype colors with no DS equivalent — still CSS vars, no inline hex.
5. **Driver/Team applied on Task Card save** (the form's Assign selects) in addition to the dedicated Assign popover.
6. **Currency `$`** centralized in `format.ts` (`CURRENCY`); flip to `CAD $` when confirmed (§10 PART I).

## 21. Backend wiring — next phase (remaining DoD §11 items)
The API is **already implemented** in `backend/` (PART I §2b "Project C"). To wire:
1. Add `src/api/{client,consignments,allocation,reference,dashboard}.ts` — typed fetch with auth header + error-envelope unwrap.
2. Add TanStack Query (`src/app/queryClient.ts`, provider in `app/providers.tsx`); move query/mutation logic **into the existing hooks** (`useTasks` → `useQuery(['consignments', filters])`; `useTaskActions` → `useMutation` + invalidate). Components don't change.
3. Implement `domain/mappers.ts`: Consignment (+ details / items / services / trackingEvents) ⇄ `Task`. **Cubic is server-computed — never send it.**
4. Map status vocab (8 UI ↔ 7 backend); resolve the field gaps the prototype carries but the backend lacks — pricing (`feeNum`/`codNum`/item `lineTotal`), `priority`, `team`, `merchant`, requirements-as-label.
5. Real auth (`features/auth/`: `LoginPage`, `useAuth`, `RequireAuth`) + token storage; 401 → login.

**Contract recap** (response shapes the mappers consume): list → `{ data: ConsignmentListRow[], total, page, pageSize, totalPages }`; detail/create/update/changeStatus/assign → full `fullInclude` record; `GET /api/allocation/drivers` → `[{ id, name, code, mobile, activeLoad }]`.

---

*PART II reflects the build as of the Tasks-screen completion. Keep it updated as the backend is wired and new screens land — same rule as PART I: centralize in `domain/` or `@/ui` and import everywhere.*
