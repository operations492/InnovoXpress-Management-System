# CLAUDE.md — Innovo Xpress dispatcher console

> **The root `.claude/CLAUDE.md` is authoritative for the domain, the lifecycle and the backend.**
> This file covers only what is specific to this frontend. Read the root file first.
>
> For anything server-side, `backend/README.md` is the complete guide.

---

## 1. What this is

The operator-facing web console. Vite · React 19 · TypeScript · Tailwind v4 · shadcn/Radix ·
TanStack Query · React Hook Form + Zod · React Router 7 · Leaflet · `@supabase/supabase-js`.

**203 tests across 22 files** (Vitest + Testing Library, jsdom). Run them rather than trusting that
number — it moves as features land.

---

## 2. Authentication

Supabase Auth issues tokens; this app never mints one and the API only verifies.

- **`src/lib/supabase.ts`** — the browser client. `persistSession` + `autoRefreshToken`.
- **`src/state/AuthProvider.tsx`** — renders `LoginPage` **instead of its children** when signed out, so
  no store ever mounts without a session. It sits above every store in `app/providers.tsx` for exactly
  that reason: `TasksProvider` queries on mount.
- **`/login` is a render state, not a route.** `App.tsx` ends with `path="*" → /tasks`, which would
  swallow it.
- **`src/lib/api.ts`** — `ensureToken()` reads the Supabase session. A 401 triggers one
  `refreshSession()`; if that fails it signs out.
- Role and `active` come from **`GET /api/auth/me`**, not the token. Supabase's own `role` claim is always
  `authenticated` — it is the Postgres role for RLS, not ours.

> **Never reintroduce `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD`.** Vite inlines `VITE_*` into the public
> bundle; that put the admin password in shipped JavaScript. Only `VITE_API_URL`,
> `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in `.env`, and all three are public by
> design.

---

## 3. Layout of the code

```
src/
  app/providers.tsx        Query → Router → Toast → Auth → Users → Tasks → finance stores
  state/AuthProvider.tsx   session + profile; gates the whole tree
  store/                   server state (TasksProvider, UsersProvider) — Query lives here
  domain/                  FRAMEWORK-FREE: types, status machine, mappers, trail cleaning
  lib/                     api.ts, supabase.ts, queryClient.ts, geocode.ts
  features/                tasks · users · auth · chat · map · finance
  components/map/          MapCanvas · FitBounds · InvalidateOnResize · RectangleSelect · markers
  ui/index.tsx             the @/ui barrel — hand-rolled wrappers over src/components/ui
```

### The newer screens

- **`/chat`** — spaces and direct messages, operator+. `ChatProvider` subscribes to a per-user Realtime
  inbox (`chat:<uid>:inbox`); `chatCache.ts` patches messages into the cache because a chat event carries
  the whole message.
- **`/map`** — the dispatch map. **One `/api/map/pins` request feeds the map, the sidebar AND the pin
  widget**, so a badge can never disagree with the rows beneath it. Tab switching, driver filtering and
  search are pure functions over that one array.
  - The view rules live in **`features/map/state/mapView.ts`** — a reducer with **no React import**,
    unit-tested on its own. That file is where the "which pins, which colours, which tab" logic belongs;
    do not re-derive it in a component.
  - `DispatchRealtimeProvider` subscribes to `dispatch:tasks` and **invalidates, never patches** — the
    payload is `{id, op}` with no data in it, and `meta.counts` cannot be recomputed from one row.
  - **Query key is `['consignments','map',{}]`, deliberately.** `TasksProvider.invalidateAll()` already
    invalidates the `['consignments']` prefix, so assigning a driver refetches the map for free. Under
    `['map','pins']` a pin would keep its old colour until realtime happened to save us.
- **Route planning** — `usePlannedRoute` / `useRouteActions` under `['routes','driver',id]`, deliberately
  *not* under `['consignments']`: a route redraw costs an OSRM call, and refetching it on every unrelated
  task edit would be waste.

**The store/actions split**: mutations in `store/*Provider.tsx` are toast-free and only invalidate;
toasts live in `features/*/hooks/use*Actions.ts` and fire **after** the server answers. Copy that split.

---

## 4. Things that will bite you

- **`@/ui` has no `Field`** — every modal defines its own. There is a `ConfirmDialog` now; use it for
  anything destructive.
- **`Popover` is controlled** (`open` + `onClose`), not a render prop.
- **`DataTable` is hand-written**, not TanStack Table. Columns are `ColumnDef<Row>` objects from `@/ui`.
- **Never define a component inside another component** — it remounts on every parent render and loses
  its state. Row action menus especially.
- **Hooks before any early return.** A role-based `return` above a `useMemo` changes the hook count
  between renders and React throws.
- **`src/test/setup.ts` mocks Supabase and `/api/auth/me` globally.** Without it every page test asserts
  against the login screen. Page smoke tests must `await findBy*` — the tree is empty on the first
  synchronous render while the session resolves.
- **`weightKg` arrives as a string** from the driver list endpoint (Prisma `Decimal`) and a number from
  the detail endpoint. Coerce.
- **Address text is unvalidated on purpose.** City, province and postal code are filled by the picker
  from the geocoder and then left alone — no Zod refine, no DB CHECK, no format enforcement anywhere.
  An operator who edits them is taken at their word. `CA_PROVINCES` still exists, but only as the
  option list for the province `Select`.
- **Geocoding is one-way: pin → text, never text → pin.** Picking a suggestion or dragging the pin
  fills the fields; editing them afterwards costs no API call and does not move the pin.
- **`src/lib/geocode.ts` is TomTom Search, not Photon.** Two shapes to know, both verified against the
  live API: `/search` returns `position` as `{lat, lon}` while `/reverseGeocode` returns it as a
  `"lat,lon"` **string** (read `.lat` off the string and every pin lands at NaN), and Canadian
  `postalCode` is the **FSA only** — the full code is `extendedPostalCode` and is sometimes absent, so
  the field is left empty rather than pre-filled with a three-character stub.
- **Display order is city then province.** "Toronto, ON", never "ON, Toronto".

---

## 4a. Leaflet — every trap this codebase has actually hit

Its default marker icon breaks under the bundler, so **always `L.divIcon`**. Beyond that:

- **Never initialise a map into a container that has not been measured.** Leaflet derives its pixel origin
  from `getSize()` at init, and every marker is positioned against that origin. A zero-width container
  gives half-painted tiles *and* markers placed off-screen.
- **Correcting the size afterwards does not fix the markers.** `setView` to an unchanged centre takes the
  animated-pan fast path, returns early, and never fires `viewreset` — the event layers listen to in order
  to reposition. Markers then only snap into place when something changes their icon, because `setIcon`
  repositions as a side effect. The fix is to gate mounting on a measured container; if you must correct a
  live map, `invalidateSize()` **followed by `fire('viewreset')`**.
- **Gate on `clientWidth`, not `getBoundingClientRect`.** A dialog's entrance transform distorts the
  latter; `clientWidth` reports layout size regardless.
- **Cache `L.divIcon` objects at module level.** A fresh `icon` prop makes react-leaflet call `setIcon()`,
  which rebuilds the marker's DOM element — with a poll running that rebuilds every marker every tick and
  eats the click the operator was making.
- **Leaflet panes are z-index 200–700 and beat Radix's 50.** A dialog opened over a map lands behind it.
  Either `isolate` the map's section (the dispatch map does) or make the map a *pane inside* the dialog
  (the assign picker does) — never a modal stacked over a map.
- **jsdom performs no layout**, so `clientWidth` is 0 and the measurement gate never opens. Tests that
  mount a map shim it deliberately rather than weakening the gate. They must also mock every react-leaflet
  component in use — a missing `Polyline` or `Tooltip` renders as undefined and fails the whole file.

---

## 5. Deliberately inert

Fields with no backend column — COD, delivery fee, crew, handling, additional services, suite/floor, item
Product ID / Order ID / Line Total — stay on screen and simply do not persist. **Leave them alone.**

Finance pages are out of scope and still on in-memory fixtures.

---

## 6. STRICT AGENT RULES (non-negotiable)

- **ALWAYS use subagents to read and explore files. The main agent must NEVER read files directly**,
  except small targeted reads required to make an edit.
- **Every subagent prompt MUST state it may read AT MOST 3 files.**
- **Launch multiple subagents IN PARALLEL** when several files are needed — split the files between them.
- **Subagents return only concise summaries, exact signatures, or verbatim quotes of the lines asked
  for — never whole files.**
- **Match the *shipped* `@/ui` / `src/components/ui` components for styling, NOT `master.md`'s prose.**
  The design doc diverges from the build; `master.md` defines the *identity*, the built components define
  the *exact classes*. Reuse existing primitives before adding anything.
- Invoke the **`shadcn` skill** only to install a genuinely missing primitive.
