# Every service method takes an Actor as its first parameter

The role hierarchy means a Responsable Diocesano must never read or mutate data outside their Diócesis/Localidad, and a Referente Local must never leave theirs. Rather than checking this in route handlers, every service method's first parameter is the authenticated `Actor`, and the service derives its own Drizzle scope filter from that Actor's rol. Route handlers only resolve the Neon Auth session and pass the Actor through.

The Actor carries the rol and one territory: `diocesisLocalidadId`. Provincia and Región are **not** on it — they are derived by traversing from the Diócesis/Localidad, so they cannot disagree with it. The scope table is:

```
admin, asesor_nacional  → no territorial restriction
responsable_diocesano   → restricted to their Diócesis/Localidad
referente_local         → restricted to their Diócesis/Localidad
```

The two lower rols scope to the same level. They stay distinct because they differ in what they may *do* — invite Usuarios, edit the territory list — not in what they may see.

Derivation happens in exactly one place, `derivarAlcance` in `src/lib/authorization/alcance.ts`. Services compose the `Alcance` it returns into their repository calls rather than writing filters of their own, and every repository read takes the `Alcance` as its own first parameter, required. A read added later that forgets to scope itself therefore does not compile.

`diocesisLocalidadId` is nullable, because the two nacional rols legitimately have no territory. A **lower** rol with no territory fails closed: it is refused, not treated as unscoped. Null there means "nobody knows what this Usuario may see", and the safe reading of that is "nothing".

## Consequences

There is no service signature that permits an unscoped query, so a forgotten authorization check cannot silently expose data — the failure mode becomes a type error instead of a leak. Services also stay testable by passing fabricated Actors, with no HTTP or session involved.

The cost is verbosity: `Actor` threads through every call, including internal ones. Where a genuinely unscoped query is required — seeding, migrations, cron jobs — use `ACTOR_DE_SISTEMA` from `src/lib/authorization/actor-de-sistema.ts` so the intent is visible at the call site rather than implied by an absent argument.

Authorization refusals are typed domain errors (`NoAutorizadoError`), logged with the rol, the operation and both territories, and mapped to responses in one place (`aResultado`). The log identifies a *territory*, never a person: Referentes Locales share one login per territory.

One divergence is deliberate and recorded here so it is not read as an inconsistency. Peregrina and Misionero **data** is scoped to the Diócesis/Localidad, per the table above. Territory **selection lists** are scoped one level wider, to the Actor's Provincia, because a picker containing exactly one entry is not a picker and a Referente Local naming the next town needs it in the list. Seeing a Diócesis in a picker is not permission to read its records; `derivarAlcance` decides that separately.

## Considered options

Middleware plus per-route guards was rejected because the scope filter would live at the edge, leaving nothing to catch a missed check in a newly added route. Postgres row-level security was rejected for now as disproportionate complexity for this data volume, though it remains available later as defence-in-depth without changing service signatures.

A `CHECK` constraint pairing rol with territory was considered instead of failing closed in code. It cannot express "unless the rol is nacional" without hardcoding enum values into SQL, and it would have blocked the migration on pre-existing rows that predate the column. The invariant is enforced twice in code instead: at Actor resolution, so a bad row cannot leak data, and on every write, so a bad row cannot be created.
