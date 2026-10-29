# Pruebas

Two Vitest projects, one command:

```bash
pnpm test:db:up                            # once per machine; throwaway Postgres on :55432
pnpm exec playwright install chromium      # once per machine; ~115 MB
pnpm test
```

| Project | What it is | Where it runs |
|---|---|---|
| `node` | The services, against a real Postgres. One seam, and the rules of the project live behind it | Node |
| `navegador` | The accessibility suite. Components mounted with the real stylesheet, plus axe-core | Chromium, through Playwright, at 390×844 |

`pnpm test` runs both, and that is the default on purpose — an accessibility suite you
have to remember to run is not run. `pnpm test:node` and `pnpm test:navegador` exist
for when you want one of them. `pnpm test:db:down` removes the container.
`pnpm test:watch` reruns on change.

## Why a real database, and only one seam

Every rule worth testing in this project is a rule about what a given Actor can
see. A mock cannot be wrong about that in an interesting way — it can only agree
with whatever the test author already believed. So the suite calls
`Service.method(actor, input)` against real Postgres and asserts on what comes
back.

That means: no repository tests, no asserting on query builders or row shapes. A test
that reaches past the service is testing the plumbing rather than the rule.

The `navegador` project is the one stated exception, and it is a different kind of
question — see below and ADR 0006.

**A change to what a rol may write requires a test proving the write outside it
is refused and leaves the record intact** — `src/lib/authorization/capacidades.test.ts`.
The negative half is the test: asserting that a Dirigente Joven can load a `JOV`
image passes just as well when they can load every Modalidad. There is no
territorial scope to test any more: every rol reads the country (ADR 0016).

## How the harness works

| File | What it does |
|---|---|
| `src/test/connection.ts` | The one place the test database URL is decided. Override with `TEST_DATABASE_URL` in CI |
| `src/test/global-setup.ts` | Once per run: drops `public` and replays every migration onto it |
| `src/test/setup.ts` | Before each test: truncates every table |
| `src/test/factories.ts` | Fabricates an Actor for a rol and territory, and seeds fixtures |
| `src/test/setup-navegador.ts` | The browser project's setup: imports the real stylesheet, unmounts between tests |
| `src/test/accesibilidad.ts` | Contrast, target size, focus order and axe, measured from computed values |

`global-setup.ts` also creates a stand-in for the identity table. Neon owns and
migrates that schema (ADR 0002), so it is deliberately absent from our migrations —
which would otherwise leave the suite unable to exercise the join that puts emails on
the user-management screen, or the warning about an identity with no Usuario.

**The stand-in is the one place in this suite that can agree with itself and with
nothing else,** and it did. This is a Managed Better Auth project, so the table is
`neon_auth."user"` and not `neon_auth.users_sync`, and its `id` is `uuid` while
`users.id` is `text`. The harness built its stand-in from our own schema file, so
both mismatches were invisible here and every authenticated page threw in
production. If you touch `src/db/schema/neon-auth.ts` or anything in
`src/modules/user/`, the thing to compare against is the live database, not this
file — a green suite is not evidence about a table we do not own.

Migrations are **replayed**, not pushed. The tests exercise the same SQL
production will, so a migration that is wrong fails here instead of on deploy.

`src/db/index.ts` picks its driver from the connection string: Neon's WebSocket
pool for a `.neon.tech` URL, node-postgres for anything else. Nothing downstream
knows which one it got.

It used to be Neon's *HTTP* driver, which throws on `db.transaction` — so the
transaction that closes one Asignación and opens the next would have passed here,
on node-postgres, and failed only in production. Both drivers now support
transactions, which is what makes this suite's word worth anything about them
(ADR 0004).

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
for work with no Usuario behind it — seeds, migrations, cron — per ADR 0001.

`crearTerritorioDePrueba()` builds two Provincias in different Regiones, each
with two Diócesis. Deliberately a country and not a single territory: a territory
filter tested with only one Provincia in the database cannot prove it narrows
anything.

`crearActor` also inserts the identity Neon Auth would hold, so emails resolve.
Pass `sinIdentidad` to build the orphan ADR 0002 describes, and `crearIdentidad`
for the opposite case: somebody the provider knows and the Campaña does not.

## The capacidades matrix

`src/lib/authorization/capacidades.test.ts` is the suite that must never be
skipped: every rol, against every write a Modalidad bounds and every piece of
configuration, asserting both halves — the write that is allowed, and the one that
is refused *and leaves the record intact*. If a rule there changes and the file
still passes unchanged, suspect the test rather than the change. It replaced the
three `*.alcance.test.ts` files when ADR 0016 made every rol country-wide.

`asignacion.matrimonio.test.ts` keeps the other negative that matters: every read
that resolves a Tenedor reaches a Matrimonio's images, because a query that joins
the Misionero leg and forgets the couple's returns fewer rows and no error.

`peregrina.paginacion.test.ts` and `misionero.paginacion.test.ts` are about the ways a
paginated list lies — a row on two pages or on none (the pages are compared against
the unpaginated read), a total that is really the page size, and a page past the end
answered with an empty list instead of the last one.

## The invariant

`asignacion.service.test.ts` is where "a Peregrina has at most one open Asignación"
is proved, and it is proved twice on purpose. The service half drives `asignar`,
`entregar` and `devolver` and asserts the count of open rows stays at one. The
storage half fires two concurrent `asignar` calls that both read "nobody has it"
before either writes, so only the partial unique index can settle it — a test that
only drives the service proves the service, not the constraint.

The baja suites (`misionero.baja.test.ts`, `peregrina.baja.test.ts`) assert both
halves of soft delete every time: gone from the active lists **and** still resolving
by name inside the history. Either one alone is the wrong half.

## La suite de planes

`src/modules/tablero/tablero.planes.test.ts` is the second declared exception to "one
seam", and for the same kind of reason as the browser project: what is under test is a
**query plan**, and a service does not have one.

It seeds twelve thousand Peregrinas and thirty thousand Asignaciones, runs `analyze`,
and explains the SQL the repositories actually emit — captured by wrapping the client,
never rewritten by hand. An `EXPLAIN` over a query copied into a test file proves that
the copy uses the index.

Two things it deliberately does:

- **Seeds in `beforeEach`, not `beforeAll`.** `setup.ts` truncates every table between
  tests, so a fixture built once would give plans over an empty table — where a full
  scan *is* the right plan and the measurement says nothing. That is also why the tests
  are grouped: four cases with `expect.soft` rather than a dozen, because each one pays
  for the seed.
- **Asserts the honest result.** Three of the five indexes written for issue #5 were
  deleted because the planner never chose them, and the tests say so where the
  assertion would otherwise have gone. The national Región breakdown is asserted to be
  an aggregate over the whole table, because counting a country is exactly that.

## The migration suite

`src/db/migrations/migracion-territorio.test.ts` and `migracion-asignacion.test.ts`
are the two suites that do not go through a service, because the thing under test
*is* a SQL file: it runs once, against production data, and there is no second
chance.

Each case creates a throwaway database, applies the migrations up to the one before,
seeds the messy shape a real installation has, applies the file under test and
asserts on the result. The territory one seeds the free-text spellings a
spreadsheet-era database contains and checks, among other things, that a
contradictory row aborts the migration with a message naming it rather than being
quietly resolved by guesswork.

The Asignación one does the same for the backfill: every existing
Misionero→Peregrina link becomes exactly one Asignación, attributed to the record's
creator and dated from its creation timestamp, and a Peregrina that the old schema
let two Misioneros claim at once keeps both links while ending with one open period.

Two things that will otherwise cost a day. A new enum value **cannot be used in the
transaction that adds it**, and Drizzle wraps each file in one — so adding
`en_reparacion` and using it are two files. And `drizzle-kit generate` stops to ask
whether a column added alongside a column dropped is a rename, with no `--force`, so
the additive migration and the dropping one are separate — which is also the order a
backfill needs, since it reads the column that is about to go.

## The accessibility suite

`src/test/setup-navegador.ts`, `src/test/accesibilidad.ts`, and seven test files:
`Dialogo`, `ConfirmarAccion`, the primitives together, `Barras`, `Paginador`,
`validacion-al-salir` and `FlujoDeAsignacion`. Named
`*.test.tsx` — the `node` project takes `*.test.ts` only, so a component test cannot
be collected there and fail for want of a DOM.

Every assertion reads a **computed** value: `getComputedStyle` for contrast,
`getBoundingClientRect` for target size, `Element.checkVisibility` for what the
keyboard can actually reach. That is what the setup file's stylesheet import is for.
`min-h-12` is a class name and not a height until Tailwind has turned it into one, so
a suite run against unstyled markup would pass while asserting nothing — which is not
hypothetical: the dashboard shell rendered completely unstyled for three issues
because eleven classNames came from a zero-byte CSS module.

Two files, two halves of the same promise. `src/app/contraste.test.ts` runs in the
**node** project and verifies the token *values* against each other, pairing by
pairing. The `navegador` project verifies that the components use them. A perfect
palette applied to nothing passes the first and fails the second, so neither is
sufficient and neither replaces the other.

axe-core runs with the WCAG 2.0/2.1/2.2 A and AA tags — wider than its default, since
target size and focus appearance are 2.2 additions. Only `violations` are asserted
on; `incomplete` means "axe cannot tell", and treating that as a failure would make
the suite noisy in exactly the cases a person has to look at anyway. axe is the floor.
It cannot tell whether a confirmation names what it is about to change, or whether
Escape means cancel, so the interesting tests are hand-written.

`validacion-al-salir.test.tsx` is here for the same reason: "nothing is announced until
the field is left" is a fact about timing in a browser, and it is asserted per field
through `aria-invalid` rather than through `role="alert"` — both halves of a name refuse
in the same shape, so a global query cannot tell one field's message going from
another's arriving. It mounts a stand-in form on the real `createMisioneroSchema`,
because the form itself calls a server action.

**What only this suite can catch.** Escape must not confirm: the platform fires one
`close` event for the Escape key and for `close()`, so a component treating every
close as a confirmation would give records de baja by keystroke — and would look
entirely correct to anybody testing with a mouse. And `FlujoDeAsignacion` chooses
between `asignar` and `entregar` depending on whether the image is already out; both
services are tested, and which one the screen calls is a UI fact.

The two mocks are deliberate and minimal. `next/navigation` is spread from the real
module and only `useRouter` replaced, and `"use server"` routers are replaced by
spies — importing one in a browser would pull in the service, the repository and
`src/db`. Whether the Actor may do the thing is the node project's question.

Failure screenshots land in `__screenshots__/` and are git-ignored: artefacts of a
run, never of the repository.

## Environment

Tests never touch `.env`. `DATABASE_URL` is set for the suite by
`vitest.config.ts` from `src/test/connection.ts`, so a live Neon URL in your
shell cannot leak into a test run.
