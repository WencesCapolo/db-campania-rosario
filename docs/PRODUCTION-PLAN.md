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
| History | Asignación as an event log; one open row per Peregrina |
| Deletion | Soft delete only. Blocked while an Asignación is open |
| Styling | Tailwind only, own primitives. Native `<dialog>` and `<select>` |
| Client data | Typed query layer with caching and invalidation |
| Validation | Zod as source of truth, parsed at the router boundary |
| Data entry | Manual only. No importer |
| Tests | Vitest against real Postgres. **One seam: the service.** Actor fabricated per test |

## What the grilling corrected in the baseline

The baseline's geography and vocabulary are better researched than `agents.md` was, and were adopted. Four gaps were found that it does not cover:

1. **No territorial scoping.** Reads are open to every authenticated Usuario; a service comment documents this as intentional. Country-wide data is readable by anyone with a session.
2. **Self-provisioning.** An authenticated identity with no application record is defaulted into `referente_local`. Authentication is therefore sufficient for authorization.
3. **No history.** Charge of a Peregrina is a single overwritten pointer, so a lost image cannot be traced to its last holder.
4. **Physical deletion**, which would destroy that history once it exists.

Plus: territory below Región is free text, so it cannot be counted or scoped on reliably; and Estado is binary, so "under repair" and "lost" are indistinguishable.

## Work remaining

Specced as PRDs on the issue tracker, in dependency order:

| # | Issue | Depends on |
|---|---|---|
| 1 | [Territorio como datos de referencia](../../issues/1) | — · **data layer and tests done; admin screens folded into 4** |
| 2 | [Autorización territorial y aprovisionamiento por invitación](../../issues/2) | 1 |
| 3 | [Historial de Asignaciones, baja lógica y estados](../../issues/3) | 2 |
| 4 | [Sistema de diseño accesible y reconstrucción de pantallas](../../issues/4) | — (do before rebuilding screens) |
| 5 | [Tablero con agregaciones y filtros](../../issues/5) | 1, 2, partly 3 |

Issue 2 is the priority. Until it ships there is no meaningful access control over Campaña data. Issue 4 is independent and can run in parallel — but must land before the remaining screens are rebuilt, or they get styled twice.

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

- What is the threshold for a Peregrina having "not changed hands recently"? Only affects one issue 5 card.
- Does the `admin` rol have a real-world holder distinct from Asesor Nacional, or is it purely technical? Affects issue 2's invitation rules.
