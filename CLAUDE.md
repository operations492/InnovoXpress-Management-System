# CLAUDE.md — Innovo Xpress dispatcher console

> **The root `.claude/CLAUDE.md` is authoritative for the domain, the lifecycle and the backend.**
> This file covers only what is specific to this frontend. Read the root file first.
>
> For anything server-side, `backend/README.md` is the complete guide.

---

## 1. What this is

The operator-facing web console. Vite · React 19 · TypeScript · Tailwind v4 · shadcn/Radix ·
TanStack Query · React Hook Form + Zod · React Router 7 · Leaflet · `@supabase/supabase-js`.

**110 tests passing** (Vitest + Testing Library, jsdom).

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
  features/                tasks · users · auth · finance
  ui/index.tsx             the @/ui barrel — hand-rolled wrappers over src/components/ui
```

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
- **Leaflet in a modal renders grey** unless you call `map.invalidateSize()` once it is visible, and its
  default marker icon breaks under the bundler — use `L.divIcon`.
- **`weightKg` arrives as a string** from the driver list endpoint (Prisma `Decimal`) and a number from
  the detail endpoint. Coerce.

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
