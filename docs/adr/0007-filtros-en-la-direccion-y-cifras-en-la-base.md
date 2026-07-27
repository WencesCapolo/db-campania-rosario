# Las cifras se agregan en la base, y los filtros viven en la dirección

Issue #5's two decisions are one decision seen from two sides: there is exactly one
definition of "what is being asked", it lives in a Zod schema, and both the count and
the list are produced from it — the count by aggregating in Postgres, the list by
querying with the same predicate.

## What it replaces

The previous dashboard fetched records and counted them in the browser. Each of the
three services also carried a `dashboardStats` of its own, returning a differently
shaped pair of counts with no filters at all. Filtering existed on one list, was held
in component state, and was discarded by any navigation.

Three consequences, and all three were live:

- A count was a count of whatever had been fetched. It was correct only while every
  record fit in one read, which is a property of an empty database.
- The tablero and the listado could not be made to agree, because neither knew what
  the other had asked.
- Opening a record from a filtered list and pressing back lost the filter, so the
  filters were reapplied by hand all day.

## The decision

**Filters are a schema, and the schema's home is the query string.**
`filtrosDeInventarioSchema` — Estado, Modalidad, Tipo, tenencia,
Diócesis/Localidad, Región, Código — is parsed at the router boundary and nowhere
else. The controls write the address; the pages read it. Nothing holds filter state,
so there is no state to lose, no cross-page store, and a filtered view is a link
somebody can send (stories 19, 20 and 21).

The territorial half lives in `territorio.types`, upstream of both Misionero and
Peregrina, because the import chain runs one way: a Peregrina-owned definition would
be unreachable from Misionero, and a copy on each side is how "my Diócesis" comes to
mean two things.

**Every figure is an aggregate query in the repository that owns the table.** The
counts sit next to the filters that repository's list read uses, which is what makes
divergence impossible rather than merely discouraged.

**The tablero is a module with no table.** `TableroService` composes three
repositories, owns no schema and no repository of its own, and nothing imports it — so
it sits at the end of the chain `territorio → misionero → peregrina → asignacion` and
cannot be part of a cycle. It reads *repositories* and never another module's service,
which is the rule ADR 0004 already needed for the cross-entity guards.

## An out-of-scope territory is refused, not intersected

A crafted `?diocesisLocalidadId=` is the one thing a query string can attempt that
scoping forbids, and it is the reason `exigirTerritorioDentroDelAlcance` exists.

The tempting alternative is to intersect it with the Actor's `Alcance` and let it
narrow to nothing. That is *safe* — no data leaks — and it is wrong: the screen would
then show the Actor's own figures under somebody else's Diócesis name. A wrong answer
where a refusal was available is worse than the refusal, so the read throws and the
denial is logged with the territory (never with a person: Referentes Locales share one
login per territory).

A Región is deliberately not treated the same way. It is not a unit of scope — a
Diócesis belongs to exactly one — so a scoped Actor asking for another Región gets an
honest zero out of the intersection and there is nothing to disclose.

An unrecognised *enum* value is dropped rather than refused. `?estado=activva` is a
typo or a stale link, and refusing the whole screen over one would be a worse answer
than ignoring it. The territory is the exception because dropping it silently is the
failure described above.

## What each rol sees is derived, not chosen

`vista` comes from the rol. National figures break down by Región and by Diócesis and
carry a growth series; diocesan figures break down by Estado, Modalidad and Tipo, and
their `porRegion` is `null` rather than a single row with the Actor's own name in it —
which is not a breakdown.

The same code serves all four rols, so there is no second screen to keep in step, and
no rol can be given a wider question by being given a different page.

## Indexes are a measurement, not a habit

`agents.md` asks that the aggregations be covered by indexes, and issue #5 treats that
as a requirement because these queries run on every load. What it does *not* do is add
indexes by reasoning about them: `tablero.planes.test.ts` seeds twelve thousand images
and thirty thousand Asignaciones, ANALYZEs, and explains the SQL the repositories
actually emit — captured off the client rather than rewritten by hand, because an
EXPLAIN over a copied query only proves the copy uses the index.

Five candidates were written. Two survived:

| Index | What it serves |
|---|---|
| `peregrina_activas_por_territorio_idx` on `(diócesis, estado, modalidad, tipo) where baja_at is null` | Every grouped count a scoped Actor loads |
| `asignacion_abiertas_por_fecha_idx` on `(abierta_at) where cerrada_at is null` | Both cross-entity cards — being partial makes it the *set* of open periods, not merely an order over them |

Three were deleted: a partial index on the images nobody has, one on the Misioneros of
a territory by surname, and one on open periods by Misionero. The planner chose the
existing single-column indexes and a sort over all three, so each was cost on every
write and chosen on no read. The tests now assert what was measured — including that
the ordered reads sort, and that the national Región breakdown reads the whole table,
which is the correct plan for counting a country.

## What this costs

Filters in the address are visible, and one of them is an internal id: a shared link
carries `diocesisLocalidadId=` rather than a name. That is ugly and it is not a leak —
the id is refused for anybody it does not belong to.

Aggregating in the database means the figures are as fresh as the request and there is
no caching layer to invalidate. That is deliberate (`agents.md` puts caching out of
scope) and it is revisitable with evidence: the plans above are the evidence that would
have to change first.

The growth series is derived from `created_at`, so it is growth *of the current
inventory* — an image given de baja leaves the series it was in. Storing periodic
snapshots would fix that and would need something to write them; there is nothing, and
inventing a table to hold a metric is exactly what the PRD put out of scope. The screen
says what the number means instead.
