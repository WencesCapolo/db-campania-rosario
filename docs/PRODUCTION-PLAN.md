# Camino a producción

Derived from a grilling session, then corrected against the real baseline. See `CONTEXT.md` for vocabulary and `docs/adr/` for the two decisions worth justifying.

## Repository state — read this first

Local `main` and `origin/main` have **unrelated histories** (no common ancestor).

- **`origin/main` is the baseline.** Drizzle with applied migrations, Neon Auth wired, and router–service–repository modules for peregrina, misionero and user.
- **Local `main` is a UI prototype only.** Prisma schema with no migrations, an in-memory client-side store, no auth. Its value is the interface work; its data layer is discarded.

The decision was to adopt the baseline and port the prototype's UI onto it.

## Decisions locked

| Area | Decision |
|---|---|
| Baseline | `origin/main`. Drizzle, not Prisma |
| Architecture | Router–service–repository per entity module. Router = server actions |
| Auth | Neon Auth (Managed Better Auth); Rol in our own users table — ADR 0002 |
| Authorization | Actor first parameter on every service method; scope derived, never optional — ADR 0001 |
| Territory | Región (7 pastorales, fixed) → Provincia → Diócesis/Localidad. The lower two become reference tables |
| Modalidad | `JOV` / `FAM` / `INF` / `ADU`. Distinct from Tipo (`peregrina` / `auxiliar`) |
| Código | System-generated `[Provincia Modalidad Número]`, sequential per provincia + modalidad. Never hand-typed |
| Estado | Activa / En reparación / Extraviada. Legacy `inactiva` retained, not offered for new entry |
| History | Asignación as a period; one open row per Peregrina, enforced in the service and by a partial unique index — ADR 0004 |
| Deletion | Soft delete only. Blocked while an Asignación is open |
| Asignación scope | Through the Peregrina's territory, so a Peregrina that moves takes its history with it — ADR 0004 |
| Driver | `neon-serverless` in production, not `neon-http`: the latter throws on `db.transaction` |
| Styling | Tailwind only, own primitives. Native `<dialog>` and `<select>` |
| Client data | Typed query layer with caching and invalidation |
| Validation | Zod as source of truth, parsed at the router boundary |
| Data entry | Manual only. No importer |
| Tests | Vitest against real Postgres. **One seam: the service.** Actor fabricated per test |

## What the grilling corrected in the baseline

The baseline's geography and vocabulary are better researched than `agents.md` was, and were adopted. Four gaps were found that it does not cover:

1. ~~**No territorial scoping.**~~ Closed by issue 2: every service takes the Actor first, every repository read takes the derived `Alcance` first, and both lower rols are bounded by their Diócesis/Localidad.
2. ~~**Self-provisioning.**~~ Closed by issue 2: an identity with no application record is refused, and Usuarios come into existence only by accepting an invitation — ADR 0003.
3. ~~**No history.**~~ Closed by issue 3: an Asignación is a period, the chain of custody accumulates, and a Peregrina has at most one open Asignación — in the service and in the database (ADR 0004).
4. ~~**Physical deletion.**~~ Closed by issue 3: soft delete on Peregrina, Misionero and Usuario, refused while an Asignación is open.

Plus: territory below Región was free text, closed by issue 1; and Estado was binary, closed by issue 3 — `en_reparacion` and `extraviada` are now distinct, and the legacy `inactiva` is readable and unselectable rather than rewritten.

## Work remaining

Specced as PRDs on the issue tracker, in dependency order:

| # | Issue | Depends on |
|---|---|---|
| 1 | [Territorio como datos de referencia](../../issues/1) | — · **data layer and tests done; admin screens folded into 4** |
| 2 | [Autorización territorial y aprovisionamiento por invitación](../../issues/2) | 1 · **done: scoping, invitations, typed errors; screens plain, restyled by 4** |
| 3 | [Historial de Asignaciones, baja lógica y estados](../../issues/3) | 2 · **done: Asignación module, soft delete, estados, backfill; two screens plain, restyled by 4** |
| 4 | [Sistema de diseño accesible y reconstrucción de pantallas](../../issues/4) | — (do before rebuilding screens) |
| 5 | [Tablero con agregaciones y filtros](../../issues/5) | 1, 2, partly 3 |

Issue 4 is next, and issue 5 depends on the aggregates it will style. Issue 4 must land before the remaining screens are rebuilt, or they get styled twice.

### What issue 1 left for issue 4

The baseline's screens turned out to be stubs — `export default function Page() { return null }` — and the one real screen is styled by an empty CSS module. There was no existing form to convert, so issue 1 shipped its data layer, service, migration and tests, plus the two surfaces without which none of it is reachable:

- `SelectorDeTerritorio` — the picker. One choice, with Provincia and Región shown derived and read-only. Native `<select>`, loading/error-with-retry/empty states, 48px targets.
- `/peregrina/new` — a working create form, including "Guardar y agregar otra".

Both are plain Tailwind and meant to be **restyled, not rebuilt**. What issue 4 still owns from issue 1's PRD is the **admin territory management screens** — user stories 5 through 12: add, rename and give de baja a Provincia or Diócesis/Localidad, and show the reference count before a change. Every one of those is already implemented and tested in `TerritorioService`, with server actions in `territorio.router.ts`. They need a screen, not logic.

## Not yet specced

- **Production readiness proper:** environment variables per environment, migrations applied in the build rather than pushed, error tracking, structured logging of authorization denials, and confirmation that Neon's point-in-time recovery window matches what losing this data would cost.

  One piece of this is already blocking locally: `.env` holds only `DATABASE_URL`, so `pnpm build` fails while collecting page data for `/api/auth/[...path]` — Neon Auth needs `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`. The build is otherwise clean. See `.env.example`.
- **A real accessibility pass** with one actual Referente completing a real task unaided on their own phone. No automated check substitutes for it.

## Questions answered — 2026-07-25

| Question | Answer | Consequence |
|---|---|---|
| How are the two histories reconciled? | Branch `trabajo` from `origin/main`. The prototype stays on `main` and `archivo/prototipo` (`4838bcb`) and is ported file by file during issue 4 | No unrelated-histories merge. `app/` and `src/app/` never coexist |
| Are the seven Regiones the Campaña's real structure? | Yes | The `region` enum is seedable as-is. Issue 1's reference data is unblocked |
| Can a Misionero hold more than one Peregrina at once? | Yes, several | Issue 3 constrains only the Peregrina side: one open Asignación per Peregrina. No one-at-a-time rule on the Misionero |
| One login per Referente Local, or one per territory? | Shared, one per territory | **The audit trail identifies a place, not a person.** Issue 3's history is still worth building — it answers "which territory registered this" — but no UI copy may imply individual accountability |

## Open questions

- What is the threshold for a Peregrina having "not changed hands recently"? Only affects one issue 5 card. Issue 3 shipped the data without the threshold: `AsignacionDTO.diasEnCargo` returns the interval and the screen decides where the line is.
- When a Peregrina and the Misionero holding it are in different Diócesis, whose territory should the assignment flow offer? Issue 3 checks both ends and refuses the mismatch for a scoped Actor, which is the safe reading, but nobody has said whether an inter-diocesan hand-off is a real thing the Campaña does.

### What issue 3 left for issue 4

Two working surfaces, plain Tailwind, to be **restyled not rebuilt**:

- `/asignacion/new` — the stepped flow: "Paso 1: Elegir Misionero", "Paso 2: Elegir Imagen", "Confirmar", one decision per screen and one thumb (user stories 21 and 22). It picks between `asignar` and `entregar` itself, so nobody has to know there are two operations.
- `/peregrina/[id]/historial` — the chain of custody, oldest first, with the tenencia actual, the duration of each period, the territory that registered each end, and a native `<dialog>` for registering a return.

Still owed by a screen rather than by logic, all implemented, tested and exposed as server actions: **correcting an Asignación** (`corregirAsignacionAction`, user story 17), **giving a Peregrina or Misionero de baja and reactivating them** (user stories 12 and 16), **a Misionero's own history** (`getHistorialDeMisioneroAction`, user story 7), and **Peregrinas never assigned** (`getPeregrinasNuncaAsignadasAction`, user story 19 — and an issue 5 card).

The Estado picker needs care rather than logic: `ESTADOS_SELECCIONABLES` excludes `inactiva`, so a record already carrying it must keep *displaying* it (`ESTADO_LABELS` has the copy) while the control offers only the three real states.

### What issue 2 left for issue 4

The invitation and user-management surfaces exist and work, in plain Tailwind, to be **restyled not rebuilt**: `/admin/users` (who has access, who was invited and has not arrived, identities with no Usuario), `/admin/users/new` (the invitation form), and `/sin-autorizacion` (the refusal, outside the dashboard group because a page about not having an Actor cannot require one).

Still owed by a screen rather than by logic: changing a Usuario's rol or territory, and giving one de baja or reactivating them. `UserService.actualizar`, `darDeBaja` and `reactivar` are implemented, tested and exposed as server actions — user stories 15 and 16 need a control, not a rule.

There is a plain `(dashboard)/error.tsx` boundary, because reads now *throw* an authorization refusal instead of returning an empty list — a blank table where a refusal belongs is a lie. Its copy is generic on purpose: Next replaces a server error's message with a digest in production, so a boundary cannot honestly restate the specific refusal. Issue 4 restyles it; making it say more than it knows would be a regression, not an improvement.

## Questions answered — 2026-07-25 (continued)

| Question | Answer | Consequence |
|---|---|---|
| Is the `admin` rol a real person distinct from Asesor Nacional, or purely technical? | A real person, **and** an admin may invite another admin | The one exception to strictly-lower rank. `admin` appears in the invitation rol list for an admin. Recorded in ADR 0003 |
