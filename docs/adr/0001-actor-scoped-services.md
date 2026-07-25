# Every service method takes an Actor as its first parameter

The role hierarchy means a Responsable Diocesano must never read or mutate data outside their Diócesis, and a Referente Local must never leave their Región. Rather than checking this in route handlers, every service method's first parameter is the authenticated `Actor` (role, `diocesisId`, `regionId`), and the service derives its Prisma scope filter from that Actor. Route handlers only resolve the Neon Auth session and pass the Actor through.

## Consequences

There is no service signature that permits an unscoped query, so a forgotten authorization check cannot silently expose data — the failure mode becomes a type error instead of a leak. Services also stay unit-testable by passing fabricated Actors, with no HTTP or session involved.

The cost is verbosity: `Actor` threads through every call, including internal ones. Where a genuinely unscoped query is required — seeding, migrations, cron jobs — use an explicit `systemActor` so the intent is visible at the call site rather than implied by an absent argument.

## Considered options

Middleware plus per-route guards was rejected because the scope filter would live at the edge, leaving nothing to catch a missed check in a newly added route. Postgres row-level security was rejected for now as disproportionate complexity for this data volume, though it remains available later as defence-in-depth without changing service signatures.
