# Camino a producción

Derived from a grilling session, then corrected against the real baseline. See `CONTEXT.md` for vocabulary and `docs/adr/` for the six decisions worth justifying.

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
| Territory | Provincia → Diócesis/Localidad as reference tables. Región is a property **of the Diócesis** (7 pastorales, fixed): the Campaña's regions cross provincial borders, and two Provincias span two each — ADR 0005 |
| Modalidad | The Campaña's **sixteen** apostolates, as three-letter codes. `INF` and `ADU` removed outright — ADR 0005. Distinct from Tipo (`peregrina` / `auxiliar`) |
| Código | System-generated `[Provincia Modalidad Número]`, sequential per provincia + modalidad. Never hand-typed |
| Estado | Activa / En reparación / Extraviada. Legacy `inactiva` retained, not offered for new entry |
| History | Asignación as a period; one open row per Peregrina, enforced in the service and by a partial unique index — ADR 0004 |
| Tenedor | A Peregrina is in the charge of one Misionero **or** one Matrimonio. Polymorphic pointer with a check constraint, not a supertype table; a married person never holds alone; the listado and the figures are a union — ADR 0010 |
| Deletion | Soft delete only. Blocked while an Asignación is open |
| Asignación scope | Through the Peregrina's territory, so a Peregrina that moves takes its history with it — ADR 0004 |
| Driver | `neon-serverless` in production, not `neon-http`: the latter throws on `db.transaction` |
| Styling | Tailwind only, own primitives. Native `<dialog>` and `<select>` |
| Client data | Server components and server actions. TanStack Query when a screen needs client fetching — nothing does yet, so it is not installed |
| Validation | Zod as source of truth, parsed at the router boundary |
| Data entry | Manual only. No importer |
| Tests | Two Vitest projects. `node`: the services against real Postgres, **one seam**, Actor fabricated per test. `navegador`: accessibility in Chromium via Playwright with axe-core — ADR 0006 |
| Tablero | Aggregates in Postgres, scoped by Actor. One filter schema, and it lives in the query string — ADR 0007 |
| Indexes | Added only when a query plan names them. `tablero.planes.test.ts` measures; three of five candidates were deleted — ADR 0007 |
| Style guard | An ESLint rule, not a CI step: `no-restricted-syntax` fails on `style={{}}`, a `.module.css` import, or any `.css` import that is not `globals.css`. It fires in the editor rather than after a push |

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
| 4 | [Sistema de diseño accesible y reconstrucción de pantallas](../../issues/4) | — · **done, including pagination and blur-time validation (ADR 0008); except the one thing no automated check can do — see below** |
| 5 | [Tablero con agregaciones y filtros](../../issues/5) | 1, 2, partly 3 · **done — ADR 0007** |

All five PRDs are implemented. What is left is production readiness proper, and the
one thing no automated check can do: a real Referente completing a real task on their
own phone.

### What issue 1 left for issue 4 — closed

The baseline's screens turned out to be stubs — `export default function Page() { return null }` — and the one real screen is styled by an empty CSS module. There was no existing form to convert, so issue 1 shipped its data layer, service, migration and tests, plus the two surfaces without which none of it is reachable:

- `SelectorDeTerritorio` — the picker. One choice, with Provincia and Región shown derived and read-only. Native `<select>`, loading/error-with-retry/empty states, 48px targets.
- `/peregrina/new` — a working create form, including "Guardar y agregar otra".

Both are plain Tailwind and meant to be **restyled, not rebuilt**. What issue 4 still owns from issue 1's PRD is the **admin territory management screens** — user stories 5 through 12: add, rename and give de baja a Provincia or Diócesis/Localidad, and show the reference count before a change. Every one of those is already implemented and tested in `TerritorioService`, with server actions in `territorio.router.ts`. They need a screen, not logic.

**Closed.** `/admin/territorio` ships those screens, and both surfaces above are on the primitives. The picker gained more than a coat of paint: `Eleccion` binds the label, help text, error and derived facts to one control, where the hand-written version bound only the label.

## Not yet specced

- **Production readiness proper:** environment variables per environment, migrations applied in the build rather than pushed, error tracking, structured logging of authorization denials, and confirmation that Neon's point-in-time recovery window matches what losing this data would cost.

  One piece of this is already blocking locally: `.env` holds only `DATABASE_URL`, so `pnpm build` fails while collecting page data for `/api/auth/[...path]` — Neon Auth needs `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`. The build is otherwise clean. See `.env.example`.

## Questions answered — 2026-07-25

| Question | Answer | Consequence |
|---|---|---|
| How are the two histories reconciled? | Branch `trabajo` from `origin/main`. The prototype stays on `main` and `archivo/prototipo` (`4838bcb`) and is ported file by file during issue 4 | No unrelated-histories merge. `app/` and `src/app/` never coexist |
| Are the seven Regiones the Campaña's real structure? | Yes | The `region` enum is seedable as-is. Issue 1's reference data is unblocked |
| Can a Misionero hold more than one Peregrina at once? | Yes, several | Issue 3 constrains only the Peregrina side: one open Asignación per Peregrina. No one-at-a-time rule on the Misionero |
| One login per Referente Local, or one per territory? | Shared, one per territory | **The audit trail identifies a place, not a person.** Issue 3's history is still worth building — it answers "which territory registered this" — but no UI copy may imply individual accountability |

## Open questions

- What is the threshold for a Peregrina having "not changed hands recently"? Still unanswered, and now it has a **default of 180 days** rather than no answer: `umbralDeDiasEstancada()` in `tablero.types`, overridable with `TABLERO_DIAS_ESTANCADA` so the Campaña's answer is an environment variable and not a deployment. The card names the number on screen, so nobody has to guess what "hace mucho" meant.
- When a Peregrina and the Misionero holding it are in different Diócesis, whose territory should the assignment flow offer? Issue 3 checks both ends and refuses the mismatch for a scoped Actor, which is the safe reading, but nobody has said whether an inter-diocesan hand-off is a real thing the Campaña does.

### What issue 3 left for issue 4 — closed

Two working surfaces, plain Tailwind, to be **restyled not rebuilt**:

- `/asignacion/new` — the stepped flow: "Paso 1: Elegir Misionero", "Paso 2: Elegir Imagen", "Confirmar", one decision per screen and one thumb (user stories 21 and 22). It picks between `asignar` and `entregar` itself, so nobody has to know there are two operations.
- `/peregrina/[id]/historial` — the chain of custody, oldest first, with the tenencia actual, the duration of each period, the territory that registered each end, and a native `<dialog>` for registering a return.

Still owed by a screen rather than by logic, all implemented, tested and exposed as server actions: **correcting an Asignación** (`corregirAsignacionAction`, user story 17), **giving a Peregrina or Misionero de baja and reactivating them** (user stories 12 and 16), **a Misionero's own history** (`getHistorialDeMisioneroAction`, user story 7), and **Peregrinas never assigned** (`getPeregrinasNuncaAsignadasAction`, user story 19 — and an issue 5 card).

The Estado picker needs care rather than logic: `ESTADOS_SELECCIONABLES` excludes `inactiva`, so a record already carrying it must keep *displaying* it (`ESTADO_LABELS` has the copy) while the control offers only the three real states.

**Closed, with two exceptions carried to issue 5.** Both screens are on the primitives; the hand-rolled `<dialog>` is a `Dialogo`, which is what gave it a cancel that Escape and "No, volver" both reach. Correcting an Asignación has a screen (`CorregirAsignacion`, on the historial page, sending only what changed). Bajas and reactivations have controls on both detail pages. A Misionero's own history is `/misionero/[id]`. Left for issue 5, because both are cards on the tablero rather than screens: `getPeregrinasNuncaAsignadasAction` (story 19) and `MisioneroService.search`.

### What issue 2 left for issue 4 — closed

The invitation and user-management surfaces exist and work, in plain Tailwind, to be **restyled not rebuilt**: `/admin/users` (who has access, who was invited and has not arrived, identities with no Usuario), `/admin/users/new` (the invitation form), and `/sin-autorizacion` (the refusal, outside the dashboard group because a page about not having an Actor cannot require one).

Still owed by a screen rather than by logic: changing a Usuario's rol or territory, and giving one de baja or reactivating them. `UserService.actualizar`, `darDeBaja` and `reactivar` are implemented, tested and exposed as server actions — user stories 15 and 16 need a control, not a rule.

There is a plain `(dashboard)/error.tsx` boundary, because reads now *throw* an authorization refusal instead of returning an empty list — a blank table where a refusal belongs is a lie. Its copy is generic on purpose: Next replaces a server error's message with a digest in production, so a boundary cannot honestly restate the specific refusal. Issue 4 restyles it; making it say more than it knows would be a regression, not an improvement.

**Closed.** All three surfaces are on the primitives, and `/admin/users` is cards rather than the four-column table it was — that table needed `overflow-x-auto` to fit a phone, so the estado column was off-screen on the device most of these people use, and it had nowhere to put a control. Changing a rol or territory (`EditarUsuario`) and ending or returning an access (`BajaDeUsuario`) both exist. `error.tsx` renders `PanelDeError` instead of repeating its copy word for word, which is what stops the two drifting into two accounts of what a refusal looks like.

## Questions answered — 2026-07-25 (continued)

| Question | Answer | Consequence |
|---|---|---|
| Is the `admin` rol a real person distinct from Asesor Nacional, or purely technical? | A real person, **and** an admin may invite another admin | The one exception to strictly-lower rank. `admin` appears in the invitation rol list for an admin. Recorded in ADR 0003 |

### What issue 4 leaves for issue 5

The visual language is settled, so issue 5 styles nothing new: tokens in `globals.css`, primitives in `src/components/`, and two test files that fail when either drifts. What it inherits, and what it still owes.

**Inherited.** Eleven routes plus `/misionero/new`, all on the primitives. `Boton`/`BotonEnlace`, `Campo`, `AreaDeTexto`, `Eleccion`, `Tarjeta`, `Insignia`, `Mensaje`, `Volver`, `Dialogo`, `ConfirmarAccion` and the three `EstadosAsincronicos`. Inicio is three buttons and stays that way — the tablero is a destination, not the home screen. Counts, charts and filtering would push the three things a Referente came for below the fold on a phone.

~~**Two cards, already implemented and tested, with no UI:**~~ Closed by issue 5. `getPeregrinasNuncaAsignadasAction` is the "Nunca entregadas" card, and `MisioneroService.search` is the search box on `/misionero`, beside a "sólo los que no tienen ninguna" filter that the tablero's idle-capacity card links into.

~~**Indexes are covered but unmeasured.**~~ Closed by issue 5, and the answer was not the expected one: `tablero.planes.test.ts` seeds twelve thousand images and thirty thousand Asignaciones and explains the real queries, and **three of the five indexes written for the tablero were deleted** because the planner chose the existing single-column indexes and a sort over each of them. Two survive — a partial composite on `(diócesis, estado, modalidad, tipo)` and a partial one on the open Asignaciones by date, which turned out to serve both cross-entity cards. The measurement is a test rather than a note, so a regression that turns a dashboard load into a full scan fails the suite.

This is still volume the suite invented. Nobody has looked at a plan against the Campaña's own data, because there is none — the project holds zero Peregrinas and zero Misioneros.

**Two stories closed after issue 5, in the same shape as the rest.** Story 23 — long lists in manageable pages — is `?pagina=` in the address beside the filters, `listPagina` on both services, and the `Paginador` primitive; the total is an aggregate over the same predicate the rows come from, so a paginated header cannot become a count of the page size. Story 15 — being told about a problem on leaving a field — is `useValidacionAlSalir`, which validates one field on blur against the Zod schema the router already parses, and is wired into the four forms somebody types text into. Both are recorded in ADR 0008. It also fixed a message about the wrong field: an empty Apellido was refused with "El nombre es obligatorio.", because both halves of a name shared one schema.

**Two things issue 4 deliberately did not do.** Dark mode is out of scope: it doubles the contrast verification, and the block that used to sit in `globals.css` flipped the body to near-black while every colour on every screen was hardcoded light — so a phone set to dark rendered white text on white, and no 4.5:1 claim was honest while it was live. And there is still no CI; the style guard is an ESLint rule for that reason, and the accessibility suite needs a cached Chromium the day CI arrives.

### What issue 5 leaves

**Nothing owed by another issue.** The tablero, the shared filters, both listados and
the two cards issue 4 carried here are all shipped, and ADR 0007 records the decisions.

What it deliberately did not do, and why:

- **No export to spreadsheet or PDF, and no emailed reports.** Out of scope in the PRD.
  It is the most likely first request from whoever the figures get reported to, and the
  reason the DTO carries keys rather than labels is that an exporter would need the same
  numbers with different words around them.
- **No caching.** Correct indexes are supposed to make these queries fast enough, and
  the plans in `tablero.planes.test.ts` are the evidence that would have to change
  before adding a layer to invalidate.
- **No stored snapshots of the figures.** Growth over time is derived from `created_at`,
  so it is growth *of the current inventory* — an image given de baja leaves the series
  it was in. Storing periodic totals would need something to write them, and there is
  nothing.
- **`?diocesisLocalidadId=` in a shared link is an id, not a name.** Ugly, and not a
  leak: it is refused for anybody it does not belong to.

**And the same gap issue 4 had, one layer down:** the plans were measured against volume
this suite invented. Nobody has looked at a plan, or at the tablero, with the Campaña's
own records in it.

### Still owed, and only the Campaña can do it

Issue 4's definition of done includes **one real Referente completing a real task unaided, on their own phone.** No automated check substitutes for it, and it is the only real validation of the audience requirement — the whole design rests on assumptions about older adults on cheap phones in poorly lit parish offices, and every one of those assumptions is currently ours rather than theirs.

Nothing has been entered through the app yet, so no screen has been seen with real records in it.

One smaller thing in the same category: the spreadsheet files the six CABA entries under Buenos Aires, so a Devoto image will take a `BA` Código rather than `CAB`. Correcting it is a few clicks in `/admin/territorio`, and it is their call — the Código gets written on a physical statue.
