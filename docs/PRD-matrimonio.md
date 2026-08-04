# PRD — El Matrimonio como Tenedor

Derived from a grilling session, 2026-08-03. Vocabulary is `CONTEXT.md`; the decisions and
the paths not taken are ADR 0010. This document is the buildable version of both.

## The problem

A Peregrina is often in the charge of a married couple. The system has no word for that, so
the couple gets entered as two Misioneros and the image is filed under whichever of them was
typed first.

Three things follow, and they are live today:

1. `/misionero` shows the household twice. Somebody scanning for a surname finds two rows
   and has to know they are one family.
2. "Who has this image" answers with one spouse. That is the answer a Referente reads out
   on the phone when an image has to be found.
3. The other spouse can be given de baja with the image in their house. The guard that
   refuses a baja while an Asignación is open keys on `misionero_id`, and that spouse is
   not on the row.

## What we are building

A `Matrimonio` is a first-class Tenedor: two Misionero rows, one holder. Anywhere the app
answers *who has this image*, a couple renders as one name. Anywhere the app lists people
who can take charge, a couple occupies one row and its spouses occupy none.

### Out of scope, deliberately

- **Guarding the creation of a marriage.** Two people who already hold images individually
  can still be married; the system will not notice. This is a choice, not a limitation —
  the guard *is* writable, as a repository read in `MatrimonioService`, and was declined:
  it would refuse a marriage over paperwork that is usually being caught up on, and the
  state it prevents is already visible on screen. The workflow is to create the marriage
  and give the strays de baja, which is refused until their images come back.
- **A one-step widowhood.** Four manual steps, with a documented window where the image
  reads libre. ADR 0010, "What this does not do".
- **Reusing existing Misionero rows when creating a couple.** The form types both people
  fresh. A retrofit is baja plus re-entry.
- **More than two people.** A Matrimonio is exactly two.

## Data model

New table, `src/modules/misionero/matrimonio.schema.ts` — inside the `misionero` module,
because `asignacion.matrimonio_id` needs it upstream in the one-way chain.

| column | notes |
|---|---|
| `id` | uuid text, as everywhere |
| `misioneroAId` | FK, not null. Spouse A also supplies the sort key and the territory |
| `misioneroBId` | FK, not null |
| `estado` | reuses the existing `misionero_estado` enum — no new enum, no split migration |
| `centroTipo` / `centroNombre` | the couple's, nullable |
| `bajaAt` | ends the marriage; mirrors `misionero.bajaAt` exactly |
| `createdById`, `createdAt`, `updatedAt` | as everywhere |

**No `diocesisLocalidadId`.** A marriage is scoped by joining spouse A, which is
deterministic because the form enters the territory once and both spouses carry it.

**Per-spouse:** `nombre`, `apellido`, `anioConsagracion`, `resumenesAnuales`, `bajaAt`,
and `telefono` — two numbers, both optional. This started as one shared household number
on the couple; it is per spouse because the second number is exactly the one somebody
reaches for when the first person does not answer, which is the only reason the Campaña
records a phone at all.

### Polymorphic holder

```
asignacion.misionero_id          -> becomes nullable
asignacion.matrimonio_id         -> new, nullable
  check (num_nonnulls(misionero_id, matrimonio_id) = 1)

peregrina.misionero_actual_id    -> unchanged, nullable
peregrina.matrimonio_actual_id   -> new, nullable
  check (num_nonnulls(misionero_actual_id, matrimonio_actual_id) <= 1)
```

The two checks differ on purpose: `peregrina`'s all-null case is **libre**, and it is what
`peregrina.repository.ts:141` and `:341` read. Writing `= 1` there makes an unassigned image
unstorable.

`asignacion_peregrina_abierta_key` needs no change — it is partial-unique on the image, not
the holder. **No new index.**

### Migrations

**One file — `0007_matrimonio.sql`.** No backfill, no production data.

This was planned as two, on the assumption that `drizzle-kit generate` would hit the
interactive prompt CLAUDE.md §8 warns about. It did not: nothing is *dropped* here, only
added and relaxed (`asignacion.misionero_id` loses its `not null`), so the diff was
unambiguous and generated clean. With no production data there is nothing to backfill
between the two halves, so splitting would have bought a second file and no safety.

The file creates `matrimonio`, adds both pointer columns with their FKs and indexes, drops
the `not null`, and adds both check constraints.

**`0008_telefono_por_esposo.sql`** followed, and is one line: it drops `matrimonio.telefono`.
The couple began with a single shared number and now has one per spouse — see the note on
per-spouse columns above. A separate file rather than an amendment to `0007`, because a
migration that has been replayed is history even when nothing has been deployed.

## The `Tenedor` type

One discriminated union, in `misionero.types.ts`, replacing the bare `misioneroId` on every
charge-changing method:

```ts
type Tenedor =
  | { tipo: "persona";    id: string }
  | { tipo: "matrimonio"; id: string }
```

Zod `discriminatedUnion("tipo", …)`, parsed at the router boundary. `asignar`, `entregar`,
`devolver` and `corregir` take it; `AsignacionRepository` is the only place that fans it out
to the two columns, the same containment `misioneroActualId` already has.

It is also the `<select>` value. A native `<select>` holds one string, the roster is one
list of both kinds, so an option is `"persona:abc"` / `"matrimonio:def"` — parsed once,
handed to the action. Built from `(id, tipo)`, which the roster union already projects.

There is **no `tenedor` table**. The union type is free; the table was not (ADR 0010).

## Reads

### The collapsed roster

`/misionero` is a `UNION ALL`:

- **individuals** `where not exists (an active matrimonio containing me)`
- **marriages**, joining `misionero` as spouse A for the sort key and the territory, and
  again as spouse B for the search

Order `apellidoA, nombreA, id`. The `id` tiebreaker spans two tables' UUIDs — safe, and
commented, because ADR 0008 requires a unique tiebreaker before an `offset`.

The search `q` must match **either** spouse: "Benítez" finds "Ana Álvarez y Juan Benítez".

**One shared predicate.** `findFiltrados`, `contarFiltrados`, `contarTotal`,
`contarPorEstado` and `contarPorRegion` all build from it, the way `condicionDeListado`
already binds the first two. ADR 0008: the total is an aggregate over the same predicate as
the rows, never `filas.length`.

### The tablero

**A couple counts as one.** The figure counts holders, so it equals the number of rows the
list behind its link shows. `contarPorRegion` reaches Región through spouse A;
`contarPorEstado` reads `matrimonio.estado`, which is what that column is for.

### The holder search

`peregrina.repository.ts:171` ORs `nombre || ' ' || apellido` against the reverse. For a
marriage it ORs across both spouses — four concatenations — and it is built from the **same
helper** as the roster's `q`, not a second hand-written copy.

## Rules

- **A married Misionero never holds alone.** `AsignacionService.asignar` refuses an
  individual assignment to somebody in an active Matrimonio, reading `MatrimonioRepository`
  — a downstream repository read, the cross-entity guard shape ADR 0004 already permits. No
  storage constraint behind it, like the "several Peregrinas at once" rule of 2026-07-25.
- **`matrimonio.bajaAt` mirrors `misionero.bajaAt`.** Refused while an Asignación is open.
  Once set, both spouses reappear as individual holders with no code change — the roster's
  `not exists (active marriage)` clause simply stops matching them.
- **History keeps reading as the couple.** Closed Asignaciones still point at the matrimonio
  row after the baja. What was true then is what the historial says.

## UI

### `CrearMisioneroForm`

A `¿Es un matrimonio?` choice at the top. Choosing it reveals a second Nombre/Apellido pair
and a second Año de consagración. Territory and Centro are entered once — a household has one of each, and asking twice
invites two answers that disagree. Teléfono is per spouse, both optional. The first
name pair **is** spouse A, so the person typing controls how the couple files.

One submit creates two Misionero rows and one matrimonio row **inside a real
`db.transaction`** — unlike the existing person → peregrina → asignar sequence, this one
must be atomic, because half a marriage is not a thing. The transaction works in production;
`src/db/index.ts` is `neon-serverless` (ADR 0004).

`createMisioneroSchema` becomes a discriminated union on `tipo`. `useValidacionAlSalir` keeps
working against it unchanged — one schema, no second copy of any rule for the client
(ADR 0008).

The optional image fieldset then assigns to the **matrimonio**, and its partial-failure
message names the couple rather than one spouse.

### Rendering

Two functions in `lib/formato.ts` over `Tenedor`, branching on whether the surnames match:

| | same surname | different surnames |
|---|---|---|
| prose | `Ana y Juan Pérez` | `Ana Álvarez y Juan Benítez` |
| list, picker | `Pérez, Ana y Juan` | `Álvarez, Ana y Benítez, Juan` |

The collapse is a string comparison with nothing downstream — the sort key is spouse A's
surname either way, so the heuristic can never move a row. It exists because
`Pérez, Ana y Pérez, Juan` reads like the system entered the couple twice, which is the
confusion this feature is for.

An `Insignia` reading **Matrimonio** on the `/misionero` row and in the holder slot: the "y"
alone is easy to miss on a phone. `Insignia` already carries a glyph and a word, so the rule
about status never living in colour is satisfied for free — though this is a *kind*, not a
status.

### Sites that change

| file | change |
|---|---|
| `misionero/CrearMisioneroForm.tsx` | the couple branch; assign to the matrimonio |
| `misionero/page.tsx` | collapsed roster; Insignia |
| `misionero/FiltrosDeMisionero.tsx` | search hits either spouse |
| `asignacion/new/FlujoDeAsignacion.tsx:160` | one option list, `Tenedor` values |
| `peregrina/[id]/historial/CorregirAsignacion.tsx:91,98` | same |
| `lib/formato.ts:48` | `nombreCompleto` gains the `Tenedor` pair |
| `peregrina.repository.ts:171` | holder search across both spouses |

## Done means

1. A couple is entered on one screen, in one transaction, and takes an image in the same
   submit.
2. `/misionero` shows that couple as **one** row and neither spouse separately.
3. The peregrina detail, the `/peregrina` holder column, the historial and the tablero cards
   all name the couple.
4. A search for **either** surname finds the couple, from both the roster and the holder
   search.
5. The tablero figure equals the rows in the list it links to.
6. A marriage's images are visible in **every** list read — asserted by a suite beside the
   `*.alcance.test.ts` files. This is the mitigation for choosing the polymorphic pointer:
   a read that forgets the `matrimonio` leg returns fewer rows and no error, and silence is
   the failure mode that needs a test rather than a reviewer.
7. `tablero.planes.test.ts` passes with assertions **re-derived from what the planner
   actually chooses** over the union. Not hand-edited to stay green — ADR 0007's rule is
   that the measurement decides.
8. Territorial scoping still holds across the union: a marriage outside the Actor's
   Diócesis is invisible from both legs. The `*.alcance.test.ts` suites gain the couple
   case; CLAUDE.md §7 calls this the one suite that must never be skipped.
9. `pnpm lint` and both Vitest projects pass, and the collapsed roster has been looked at
   **in the running app** — CLAUDE.md §8: a change to what lands on the page is not proven
   by the `navegador` project alone.
