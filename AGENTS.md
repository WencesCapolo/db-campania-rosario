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

Shared enums live in the module that owns the independent entity, re-exported by dependents. Imports between modules are one-way: `misionero` → `peregrina`, never the reverse.

## 5. Access control

The hierarchy has four ranked roles: `admin`, `asesor_nacional`, `responsable_diocesano`, `referente_local`. A Usuario may only create or manage Usuarios of a strictly lower rank.

Two rules that are currently violated in the codebase and must hold everywhere (see ADR 0001):

- **Every service method takes an `Actor` first.** There is no signature that permits an unscoped query. Where a genuinely unscoped operation is needed — seeds, migrations, cron — pass an explicit system actor so the intent is visible.
- **A Usuario with no application-level record is unauthorized.** Never default an unknown authenticated user into a role. Provisioning is invitation-only and hierarchy-respecting; nobody self-registers.

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
- **Soft delete only.** Records are given de baja, never destroyed, because Asignación history must keep resolving to real names.
- **TypeScript:** strict. No `any`. Do not export Drizzle row types from a module's public surface.
- **Indexes:** queries backing dashboard filters must be covered. Filtering is by territory, estado, and modalidad.
- **Errors:** throw typed domain errors; map them to responses in one place. Log every authorization denial.
- **Tests:** any change to a service's scope filter requires a test proving out-of-territory data stays invisible. This is the one suite that must never be skipped.

## 8. Notes for agents

- `agents.md` previously conflated Modalidad with Tipo and called the territory a "zone". If this file and `CONTEXT.md` ever disagree, `CONTEXT.md` wins — and fix this file.
- Local `main` and `origin/main` have unrelated histories. Work happens on **`trabajo`**, cut from `origin/main` — that is the baseline. The Prisma prototype survives on `main` and `archivo/prototipo` as a **UI reference only**; its screens are ported across during issue 4. Never merge the two histories.
- **`pnpm`, not `npm`.** `pnpm-lock.yaml` is authoritative; `package-lock.json` was removed.
