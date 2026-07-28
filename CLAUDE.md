# Base de Datos — Campaña del Rosario

## 1. Project overview

A web-based digital inventory for the Campaña del Rosario. It replaces unorganised spreadsheets by tracking where every pilgrim image is, who has charge of it, and who has had charge of it before.

## 2. Read these first

- **`CONTEXT.md`** (repo root) — the domain glossary. It is authoritative for vocabulary. Use these exact terms in code, UI copy, and commit messages. Do not invent synonyms.
- **`docs/adr/`** — nine decisions that are hard to reverse. Read 0001 and 0003 before changing authorization or user provisioning, 0004 before touching charge of a Peregrina, 0005 before touching territory or Modalidad, 0006 before changing how the UI is tested, 0007 before touching a filter, a figure or an index, 0008 before touching pagination or a form's validation timing, and 0009 before touching a colour, a typeface or a border.
- **`docs/PRODUCTION-PLAN.md`** — current state, phases, and open questions.

## 3. Tech stack

- **Framework:** Next.js 16 (App Router), TypeScript strict. `next lint` no longer exists; the entry point is the ESLint CLI, and `eslint-config-next` ships flat config directly
- **Database:** Neon Postgres
- **ORM:** Drizzle
- **Auth:** Neon Auth (Managed Better Auth), identity in the `neon_auth` schema
- **Styling:** Tailwind CSS v4, with own primitives — no component library
- **Client data:** server components and server actions. TanStack Query is the chosen answer *when* a screen needs client-side fetching, and is deliberately **not installed yet** — nothing does. The one client-side read in the app, the territory picker, is an effect with three explicit states
- **Validation:** Zod
- **Tests:** Vitest, in two projects. `node` runs the services against a real Postgres; `navegador` runs the accessibility suite in Chromium through Playwright, with axe-core. `pnpm test` runs both — see `docs/TESTING.md` and ADR 0006

## 4. Architecture

Router–service–repository, one module per entity under `src/modules/<entity>/`:

- **`*.router.ts`** — Next.js server actions. Resolves the Actor, delegates, revalidates cache. No business logic.
- **`*.service.ts`** — all business rules. Takes an `Actor` as its first parameter, always. Derives its own territorial scope filter.
- **`*.repository.ts`** — Drizzle queries only. No rules, no permission checks. Excludes soft-deleted rows by default.
- **`*.schema.ts`** — Drizzle table and enum definitions.
- **`*.types.ts`** — DTOs and input types. Never leak Drizzle row types past the service.

Shared enums live in the module that owns the independent entity, re-exported by dependents. Imports between modules are one-way, and the chain is `territorio` → `misionero` → `peregrina` → `asignacion` → `tablero`.

`tablero` is the one module with no table: no schema, no repository. It composes the other three's repositories into the dashboard's figures, and nothing imports it — see ADR 0007. An aggregate over a table belongs in *that table's* repository, beside the filters its list read uses.

That direction between Misionero and Peregrina **reversed** in issue 3 (ADR 0004). Charge used to be `misionero.peregrina_id`; it is an Asignación now, and the only pointer left is Peregrina's denormalised `misioneroActualId`. One rule is explicit rather than implied: a service may read another module's **repository** for a cross-entity guard, never another module's **service** — that is what would create a cycle.

## 5. Access control

The hierarchy has four ranked roles: `admin`, `asesor_nacional`, `responsable_diocesano`, `referente_local`. A Usuario may only create or manage Usuarios of a strictly lower rank — with one exception settled on 2026-07-25: an `admin` is a real person and may invite another admin.

Two rules hold everywhere, and issue 2 made them true rather than aspirational (see ADR 0001 and ADR 0003):

- **Every service method takes an `Actor` first**, and every repository read takes the derived `Alcance` first. There is no signature that permits an unscoped query. Where a genuinely unscoped operation is needed — seeds, migrations, cron — pass `ACTOR_DE_SISTEMA` so the intent is visible.
- **A Usuario with no application-level record is unauthorized.** Never default an unknown authenticated user into a role. Provisioning is invitation-only and hierarchy-respecting; nobody self-registers.

Scope derivation lives in exactly one place, `derivarAlcance` in `src/lib/authorization/alcance.ts`. Both lower rols are bounded by their Diócesis/Localidad. A lower rol with no territory **fails closed** — it is refused, never treated as unscoped.

Territory *selection lists* reach one level wider, to the Actor's Provincia, because a picker with one entry is not a picker. Seeing a Diócesis in a list is not permission to read its records.

Misioneros are data entities. They have no credentials and never sign in.

## 6. UI/UX guidelines (critical)

The primary users are often older adults, entering every record by hand — there is no bulk importer. The forms carry the whole project.

- **The design system exists; use it, do not restate it.** Tokens are declared in `src/app/globals.css` and nowhere else: `tinta`/`tinta-suave` for text, `papel`/`fondo` for surfaces, `borde`/`borde-fuerte` for edges, `accion`/`peligro` for the two kinds of consequence, the four `*-fondo`/`*-tinta` state pairs, and `radius-control`/`radius-tarjeta`. The visual identity comes from schoenstatt.org.ar and is a second set beside those: `azul`/`azul-noche`, `celeste`, `oro`/`oro-tinta`, `lienzo`, `borde-suave`, `radius-marco` and `font-marca` — Inicio is the only screen wearing it so far, and ADR 0009 says what the site's own palette could *not* keep (its celeste and its dorado are not text colours, and its grey border is 1.3:1). The filete celeste goes **inside** a card's border, never in place of it. The primitives in `src/components/` read them: `Boton`/`BotonEnlace`, `Campo`, `AreaDeTexto`, `Eleccion`, `Tarjeta`, `Insignia`, `Mensaje`, `Volver`, `Dialogo`, `ConfirmarAccion`, `Paginador`, `Barras`, and the three separate `EstadosAsincronicos`. A screen that writes its own `border-neutral-400` has opted out of the accessibility floor, which is a property of the token layer rather than something each page remembers.
- **Accessibility, and what enforces each part.** 18px root on `html`; 4.5:1 for text and 3:1 for borders and focus, verified pairing by pairing in `src/app/contraste.test.ts`; 48px minimum targets, which `min-h-12` clears at 54px; one `:focus-visible` rule in `globals.css` whose ring is *geometry* rather than hue, so it works for somebody who cannot tell the colours apart. Never use a subtle hover effect as the only affordance — every `Boton` variant carries a border, which is why there is no ghost variant.
- **The two test files are complementary.** `contraste.test.ts` proves the token values clear their ratios against each other. The `navegador` project proves the components actually use them, by mounting them with the real stylesheet and reading computed styles. A perfect palette applied to nothing passes the first and fails the second.
- **Status never lives in colour alone.** Roughly one man in twelve cannot use the hue. `Insignia` and `Mensaje` each carry a glyph and a word; the glyph is `aria-hidden` because it is reinforcement, not a second thing to learn.
- **`Mensaje` derives its ARIA role from its tone.** `alerta` interrupts, everything else does not. A confirmation announced as an alert cuts a screen reader off mid-sentence; a refusal announced as a status is never read out at all. Do not choose the role at the call site.
- **Simplicity over density:** no nested menus, no dense tables.
- **Stepped flows:** complex actions are paginated — "Paso 1: Elegir Misionero" → "Paso 2: Elegir Imagen" → "Confirmar".
- **Every async surface has three states:** loading, error with a retry, and empty. A silently blank table is a bug.
- **Spanish throughout**, including validation messages.
- **Responsive:** must work one-handed on a phone.
- **Native `<dialog>` and native `<select>`.** The browser gives focus trapping, Escape handling, focus restore, and the OS picker for free.

## 7. Coding rules

- **Styling:** Tailwind utilities only. Tokens in a `@theme` block. No inline `style={{}}`, no bespoke CSS class systems, no CSS modules. This is a lint rule and not an aspiration: `no-restricted-syntax` in `eslint.config.mjs` fails `pnpm lint` on a `style={{}}` attribute, a `.module.css` import, or any `.css` import that is not `globals.css`. Do not add an `eslint-disable`; if a value is missing, add it to `@theme`.
- **Write the utility, not the variable.** Tailwind v4 mints utilities from `@theme`, so it is `bg-accion`, `text-tinta`, `rounded-control` — never `bg-[var(--color-accion)]`. Anything that is *not* meant to become a utility belongs in `:root` instead, which is why the focus ring's geometry lives there.
- **Validation:** Zod schemas are the source of truth for input shapes; infer types from them. Parse at the router boundary — invalid input must never reach a service.
- **Códigos are generated, never typed.** Format `[Provincia Modalidad Número]`, sequential per Provincia + Modalidad pair. There are **sixteen** Modalidades, as three-letter codes — build any picker from the enum through `MODALIDAD_LABELS`, never from a hand-written list. Never parse a Código to derive territory or permissions.
- **Soft delete only.** Records are given de baja, never destroyed, because Asignación history must keep resolving to real names. Peregrina, Misionero and Usuario each carry `bajaAt`; repositories exclude those rows by default and a caller wanting them passes `incluirBajas`. There is no `delete` on any service. Both bajas are **refused while an Asignación is open** — an image in somebody's house has not left the inventory.
- **Charge changes in exactly one place.** `AsignacionService.asignar`, `entregar`, `devolver` and `corregir`. A Peregrina has at most one open Asignación, enforced in the service *and* by a partial unique index on open rows. Never write `peregrina.misioneroActualId` outside `AsignacionRepository`: it is derived from the open Asignación, in the same transaction.
- **Estado is about the image, not about who has it.** `activa`, `en_reparacion`, `extraviada`, plus the legacy `inactiva`, which is readable and excluded from new entry (`ESTADOS_SELECCIONABLES`). Marking a Peregrina `extraviada` deliberately leaves the open Asignación open — closing it deletes the answer to "who had it".
- **TypeScript:** strict. No `any`. Do not export Drizzle row types from a module's public surface.
- **Indexes:** queries backing dashboard filters must be covered — and covered by *measurement*. `src/modules/tablero/tablero.planes.test.ts` seeds volume and asserts the plan of the SQL the repositories actually emit. Three of the five indexes written for issue 5 were deleted because the planner never chose them; do not add one without a plan that names it (ADR 0007).
- **Lists are paginated, and the page lives in the address too.** `FILAS_POR_PAGINA` and `?pagina=` are declared once in `src/lib/paginacion.ts`; the reads are `listPagina` on each service, and the control is `Paginador`. The total is always an aggregate over the *same* predicate as the rows — never `filas.length` — and a page past the end is clamped in the service, never answered with an empty list. An `order by` that can tie needs a unique tiebreaker before it gets an `offset` (ADR 0008).
- **A form tells somebody as they leave a field, not only on submit.** `useValidacionAlSalir(schema)` validates one field on blur against the same Zod schema the router parses, clears the message when the value changes, and renders through `Campo`'s `error` prop. Never write a second copy of a rule for the client (ADR 0008).
- **Filters are one schema, and it lives in the address.** `filtrosDeInventarioSchema` (Estado, Modalidad, Tipo, tenencia, territorio, Región, Código) is shared by the tablero and every list; its territorial half is in `territorio.types` because the import chain runs one way. A filter naming a territory outside the Actor's scope is **refused**, never intersected away — the intersection would relabel one Diócesis's figures with another's name. An unrecognised enum value is dropped, because that is a typo rather than an escalation.
- **Counts are aggregate queries.** Never fetch rows to count them, and never derive a figure on the client: that is what the previous dashboard did, and it made every number a count of the page size.
- **Errors:** throw typed domain errors from `src/lib/errors.ts`; routers map them with `aResultado`, which is the one translation from error to response. Log every authorization denial with `registrarDenegacion` — and log the *territory*, never a person: Referentes Locales share one login per territory.
- **Tests:** any change to a service's scope filter requires a test proving out-of-territory data stays invisible. This is the one suite that must never be skipped.

## 8. Notes for agents

- If this file and `CONTEXT.md` ever disagree, `CONTEXT.md` wins — and fix this file.
- **A new enum value cannot be used in the transaction that adds it**, and Drizzle wraps each migration file in one. Split the addition and the first use into two files.
- **`drizzle-kit generate` prompts interactively** when a column is added while another is dropped, and there is no `--force`. Split the diff into an additive migration and a dropping one — which is also the order a backfill needs.
- **Transactions work in production now.** `src/db/index.ts` uses `neon-serverless`, not `neon-http`, which throws on `db.transaction` — a bug that would have passed the suite and failed only on deploy (ADR 0004).
- Local `main` and `origin/main` have unrelated histories. Work happens on **`trabajo`**, cut from `origin/main` — that is the baseline. The Prisma prototype survives on `main` and `archivo/prototipo` as a **UI reference only**; its screens are ported across during issue 4. Never merge the two histories.
- **`pnpm`, not `npm`.** `pnpm-lock.yaml` is authoritative; `package-lock.json` was removed.
