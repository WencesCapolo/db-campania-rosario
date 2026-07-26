# Base de Datos — Campaña del Rosario

## 1. Project overview

A web-based digital inventory for the Campaña del Rosario. It replaces unorganised spreadsheets by tracking where every pilgrim image is, who has charge of it, and who has had charge of it before.

## 2. Read these first

- **`CONTEXT.md`** (repo root) — the domain glossary. It is authoritative for vocabulary. Use these exact terms in code, UI copy, and commit messages. Do not invent synonyms.
- **`docs/adr/`** — decisions that are hard to reverse. Read before changing authorization or user provisioning.
- **`docs/PRODUCTION-PLAN.md`** — current state, phases, and open questions.

## 3. Tech stack

- **Framework:** Next.js 15.5 (App Router), TypeScript strict. The discarded prototype ran Next 16; upgrading the baseline is a separate task, sequenced with issue 4
- **Database:** Neon Postgres
- **ORM:** Drizzle
- **Auth:** Neon Auth (Managed Better Auth), identity in the `neon_auth` schema
- **Styling:** Tailwind CSS v4, with own primitives — no component library
- **Client data:** TanStack Query over typed wrappers
- **Validation:** Zod
- **Tests:** Vitest against a real Postgres

## 4. Architecture

Router–service–repository, one module per entity under `src/modules/<entity>/`:

- **`*.router.ts`** — Next.js server actions. Resolves the Actor, delegates, revalidates cache. No business logic.
- **`*.service.ts`** — all business rules. Takes an `Actor` as its first parameter, always. Derives its own territorial scope filter.
- **`*.repository.ts`** — Drizzle queries only. No rules, no permission checks. Excludes soft-deleted rows by default.
- **`*.schema.ts`** — Drizzle table and enum definitions.
- **`*.types.ts`** — DTOs and input types. Never leak Drizzle row types past the service.

Shared enums live in the module that owns the independent entity, re-exported by dependents. Imports between modules are one-way, and the chain is `territorio` → `misionero` → `peregrina` → `asignacion`.

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

- **Accessibility:** large typography (18px base), high contrast (4.5:1 minimum), 48px minimum tap targets, visible focus rings that do not rely on colour alone. Never use a subtle hover effect as the only affordance.
- **Simplicity over density:** no nested menus, no dense tables.
- **Stepped flows:** complex actions are paginated — "Paso 1: Elegir Misionero" → "Paso 2: Elegir Imagen" → "Confirmar".
- **Every async surface has three states:** loading, error with a retry, and empty. A silently blank table is a bug.
- **Spanish throughout**, including validation messages.
- **Responsive:** must work one-handed on a phone.
- **Native `<dialog>` and native `<select>`.** The browser gives focus trapping, Escape handling, focus restore, and the OS picker for free.

## 7. Coding rules

- **Styling:** Tailwind utilities only. Tokens in a `@theme` block. No inline `style={{}}`, no bespoke CSS class systems, no CSS modules in new code.
- **Validation:** Zod schemas are the source of truth for input shapes; infer types from them. Parse at the router boundary — invalid input must never reach a service.
- **Códigos are generated, never typed.** Format `[Provincia Modalidad Número]`, sequential per provincia + modalidad pair. Never parse a código to derive territory or permissions.
- **Soft delete only.** Records are given de baja, never destroyed, because Asignación history must keep resolving to real names. Peregrina, Misionero and Usuario each carry `bajaAt`; repositories exclude those rows by default and a caller wanting them passes `incluirBajas`. There is no `delete` on any service. Both bajas are **refused while an Asignación is open** — an image in somebody's house has not left the inventory.
- **Charge changes in exactly one place.** `AsignacionService.asignar`, `entregar`, `devolver` and `corregir`. A Peregrina has at most one open Asignación, enforced in the service *and* by a partial unique index on open rows. Never write `peregrina.misioneroActualId` outside `AsignacionRepository`: it is derived from the open Asignación, in the same transaction.
- **Estado is about the image, not about who has it.** `activa`, `en_reparacion`, `extraviada`, plus the legacy `inactiva`, which is readable and excluded from new entry (`ESTADOS_SELECCIONABLES`). Marking a Peregrina `extraviada` deliberately leaves the open Asignación open — closing it deletes the answer to "who had it".
- **TypeScript:** strict. No `any`. Do not export Drizzle row types from a module's public surface.
- **Indexes:** queries backing dashboard filters must be covered. Filtering is by territory, estado, and modalidad.
- **Errors:** throw typed domain errors from `src/lib/errors.ts`; routers map them with `aResultado`, which is the one translation from error to response. Log every authorization denial with `registrarDenegacion` — and log the *territory*, never a person: Referentes Locales share one login per territory.
- **Tests:** any change to a service's scope filter requires a test proving out-of-territory data stays invisible. This is the one suite that must never be skipped.

## 8. Notes for agents

- `agents.md` previously conflated Modalidad with Tipo and called the territory a "zone". If this file and `CONTEXT.md` ever disagree, `CONTEXT.md` wins — and fix this file.
- **A new enum value cannot be used in the transaction that adds it**, and Drizzle wraps each migration file in one. Split the addition and the first use into two files.
- **`drizzle-kit generate` prompts interactively** when a column is added while another is dropped, and there is no `--force`. Split the diff into an additive migration and a dropping one — which is also the order a backfill needs.
- **Transactions work in production now.** `src/db/index.ts` uses `neon-serverless`, not `neon-http`, which throws on `db.transaction` — a bug that would have passed the suite and failed only on deploy (ADR 0004).
- Local `main` and `origin/main` have unrelated histories. Work happens on **`trabajo`**, cut from `origin/main` — that is the baseline. The Prisma prototype survives on `main` and `archivo/prototipo` as a **UI reference only**; its screens are ported across during issue 4. Never merge the two histories.
- **`pnpm`, not `npm`.** `pnpm-lock.yaml` is authoritative; `package-lock.json` was removed.
