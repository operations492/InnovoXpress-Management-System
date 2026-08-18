# Innovo Xpress TMS — Frontend

Production frontend for the Innovo Xpress TMS. This first cut delivers the **Tasks
screen** in full, reproducing the approved prototype 1:1 on the Innovo Xpress Design
System. It currently runs on **static fixtures** (an in-memory store seeded from the
prototype data) so it is fully functional standalone; wiring the real Express/Postgres
backend is a later, contained step (see **Backend wiring** below).

## Stack

- **Vite + React 19 + TypeScript** (strict)
- **Tailwind CSS v4** mapped onto the design-system tokens (tokens are the source of truth)
- **React Router** — tab/filters/sort live in the URL
- **React Hook Form + Zod** — every form
- **Vitest + Testing Library** — domain logic + a page smoke test
- Design system vendored under `src/ui/ds/` and wrapped by `@/ui`

## Run / build / test

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve the production build
npm run test       # vitest (domain rules + TasksPage smoke)
npm run typecheck  # tsc -b
```

Environment: copy `.env.example` → `.env`. `VITE_API_URL` is only needed once the
backend is wired.

## Architecture

```
src/
  ui/            # @/ui — typed wrappers over the vendored design system (ds/) + Icon, Modal, Popover, StatusChip
  domain/        # framework-free: status, mutations, derive, format, schemas, types (unit-tested)
  fixtures/      # seed tasks / drivers / reference lists (this phase's data source)
  store/         # TasksProvider — in-memory store (context + reducer) over domain/mutations
  components/    # app shell: Sidebar, Topbar, Toast
  layouts/       # ConsoleLayout (sidebar + topbar + outlet)
  features/tasks/ # the screen: TasksPage + components/ + hooks/ + tasks.types
  app/           # providers + (later) router/query client
  styles/        # vendored DS token CSS + app-tokens
```

**Data flow.** Components → feature hooks (`useTasks`, `useTaskActions`, `useDrivers`)
→ `TasksProvider` (state) → pure functions in `domain/mutations` and `domain/derive`.
Components never touch fixtures or the store directly, so the data layer can be swapped
without touching UI.

## The Tasks screen

Tabs **Active / Completed / Failed / New / Cancelled / Search**. A freshly created task
is `isNew` and shows in both Active and New until any action clears it. Row targets are
distinct: destination → View, driver cell → Assign, status chip → Change Status, pencil
→ Task Card, ▾ → View / Change Status / Delete. Driver assignment is orthogonal to
status (auto-promotes Unassigned → Assigned, writes a history event, never removes the
row). Includes: 5-tab Task Card, New Task (with inline Items + Save & Add Another),
read-only View, Change Status (transition-aware), multi-select bulk toolbar + Bulk
Update, Table Settings (show/hide + reorder + reset), driver Assign (single + bulk with
load bars), the date + active-tasks filters, and the Search tab.

## Backend wiring (next phase)

The screen is built against a documented contract; swapping fixtures for the API means
adding `src/api/*.ts` + TanStack Query inside the existing hooks (no component changes).
Endpoints (already implemented in `backend/`):

- `POST /api/auth/login` → JWT · `GET /api/auth/me`
- `GET /api/consignments?status&client&from&to&q&page&pageSize&sort&order` → `{ data, total, page, pageSize, totalPages }`
- `GET /api/consignments/:id` · `POST /api/consignments` · `PUT /api/consignments/:id` · `PATCH /api/consignments/:id/status`
- `GET /api/allocation` · `GET /api/allocation/drivers` (drivers + live `activeLoad`) · `POST|DELETE /api/allocation/:id/assign`
- `GET /api/reference` · `GET /api/dashboard/today`

`domain/mappers.ts` will translate the normalized Consignment (+ details/items/services/
tracking events) ⇄ the flat `Task` view-model. **Cubic is server-computed — never sent.**

### Known reconciliations / open items
- **Status vocabulary**: the UI uses the prototype's 8 statuses (`domain/status.ts`); the
  backend ships 7 (`RECEIVED…DELIVERED + CANCELLED`). Map them in `mappers.ts`.
- **Currency** is `$` (`domain/format.ts` `CURRENCY`); switch to `CAD $` when confirmed.
- **"Assigning"** filter status is cosmetic (matches no task), reproduced from the prototype.
- **Pricing fields** (`feeNum`/`codNum`/item `lineTotal`) and `priority`/`team`/`merchant`/
  requirements-as-label have no backend column yet — resolve when wiring.
- Two app tokens (`--status-processed`, `--status-loaded`) cover statuses with no DS color.
