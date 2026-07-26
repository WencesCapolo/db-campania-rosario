# Pruebas

Vitest against a real Postgres. There is one seam — the service — and one command:

```bash
pnpm test:db:up   # once per machine; starts a throwaway Postgres on :55432
pnpm test
```

`pnpm test:db:down` removes the container. `pnpm test:watch` reruns on change.

## Why a real database, and only one seam

Every rule worth testing in this project is a rule about what a given Actor can
see. A mock cannot be wrong about that in an interesting way — it can only agree
with whatever the test author already believed. So the suite calls
`Service.method(actor, input)` against real Postgres and asserts on what comes
back.

That means: no repository tests, no component tests, no asserting on query
builders or row shapes. A test that reaches past the service is testing the
plumbing rather than the rule. (Issue 4 adds browser-level accessibility checks
and says so explicitly — that is the one exception.)

**A scope filter change requires a test proving out-of-territory data stays
invisible.** The negative half is the test: asserting that a Responsable
Diocesano sees their own Diócesis passes just as well when they see everybody's.

## How the harness works

| File | What it does |
|---|---|
| `src/test/connection.ts` | The one place the test database URL is decided. Override with `TEST_DATABASE_URL` in CI |
| `src/test/global-setup.ts` | Once per run: drops `public` and replays every migration onto it |
| `src/test/setup.ts` | Before each test: truncates every table |
| `src/test/factories.ts` | Fabricates an Actor for a rol and territory, and seeds fixtures |

`global-setup.ts` also creates a stand-in for `neon_auth.users_sync`. Neon owns
and migrates that schema (ADR 0002), so it is deliberately absent from our
migrations — which would otherwise leave the suite unable to exercise the join
that puts emails on the user-management screen, or the warning about an identity
with no Usuario. The stand-in is kept in step with `src/db/schema/neon-auth.ts`
by hand; if a query fails there for a missing column, that is the file to
compare against.

Migrations are **replayed**, not pushed. The tests exercise the same SQL
production will, so a migration that is wrong fails here instead of on deploy.

`src/db/index.ts` picks its driver from the connection string: Neon's HTTP driver
for a `.neon.tech` URL, node-postgres for anything else. Nothing downstream
knows which one it got.

Files run serially (`fileParallelism: false`) because they share one database
and truncate between tests.

## Fabricating an Actor

```ts
const territorio = await crearTerritorioDePrueba();

const referente = await crearActor({
  rol: "referente_local",
  diocesisLocalidadId: territorio.villaMaria.id,
});
```

`crearActor` inserts a real `users` row, because every entity carries
`createdById` as a foreign key. `crearActorDeSistema()` is the explicit stand-in
for genuinely unscoped work — seeds, migrations, cron — per ADR 0001.

`crearTerritorioDePrueba()` builds two Provincias in different Regiones, each
with two Diócesis. Deliberately a country and not a single territory: a scoping
test with only one Provincia in the database cannot prove the other one stays
invisible. And two Diócesis *within* one Provincia, because data is scoped to the
Diócesis while selection lists reach the whole Provincia — a suite that only ever
looked at the other Provincia would pass on a provincial scope.

`crearActor` also inserts the identity Neon Auth would hold, so emails resolve.
Pass `sinIdentidad` to build the orphan ADR 0002 describes, and `crearIdentidad`
for the opposite case: somebody the provider knows and the Campaña does not.

A lower rol with no `diocesisLocalidadId` is buildable on purpose. That pairing is
what authorization has to fail closed on, and a factory that refused to construct
it would make the rule untestable.

## The scoping matrix

`peregrina.alcance.test.ts` and `misionero.alcance.test.ts` are the suite issue #2
exists for: every rol, against every read and every write, asserting both halves.
They must never be skipped. If a scope filter changes and these still pass
unchanged, suspect the test rather than the change.

## The migration suite

`src/db/migrations/migracion-territorio.test.ts` is the one suite that does not
go through a service, because the thing under test *is* a SQL file: it runs once,
against production data, and there is no second chance. Each case creates a
throwaway database, applies `0000`, seeds the messy free-text values a
spreadsheet-era database contains, applies `0001` and asserts on the result —
including that a contradictory row aborts the migration with a message naming it,
rather than being quietly resolved by guesswork.

## Environment

Tests never touch `.env`. `DATABASE_URL` is set for the suite by
`vitest.config.ts` from `src/test/connection.ts`, so a live Neon URL in your
shell cannot leak into a test run.
