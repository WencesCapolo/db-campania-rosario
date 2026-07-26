# An Asignación is a period, and it is scoped through its Peregrina

Charge of a Peregrina used to be a pointer: `misionero.peregrina_id`, overwritten
when the image passed on. The system knew the fourth holder of an image and
nothing about the first three, which is the one question anybody asks when an
image cannot be found.

An Asignación is now a first-class record — one Misionero, one Peregrina, an
opening timestamp, an optional closing one, who registered each end, and a note at
each end. Handing an image on closes one row and opens another, so the chain
accumulates instead of being overwritten. An open Asignación is the tenencia
actual.

## The invariant, enforced twice

**A Peregrina has at most one open Asignación.** Two Misioneros must never be
recorded as holding the same image.

`AsignacionService` checks it and refuses with a sentence naming whoever has the
image, because a refusal that says who has it turns into the next phone call. The
database enforces it independently, with a partial unique index on rows where
`cerrada_at is null`, so two people assigning the same image in the same instant
lose one of the two writes rather than racing to a corrupt state. Both halves are
needed and they are not the same test: a suite that only drives the service proves
the service.

There is deliberately **no** matching constraint on the Misionero side. A Misionero
may hold several Peregrinas at once (settled with the Campaña on 2026-07-25), so if
that ever becomes bounded it will be a service rule, not a schema constraint.

## Scoped through the Peregrina's territory

An Asignación has no territory of its own. A Peregrina is the thing that lives
somewhere, so `condicionDeAlcance` in `asignacion.repository.ts` is the one scope
filter in the codebase that is not a column on the table being read: it lands on
the joined `peregrina` row. Every scoped Asignación read therefore joins Peregrina,
including the ones that only want a count, and `asignacion_peregrina_idx` covers
that join.

Two consequences, taken deliberately rather than discovered later:

**A Peregrina that moves Diócesis takes its history with it.** So a Referente Local
can lose sight of Asignaciones their own territory registered, if an Asesor
Nacional moves the image out. That is the right way round — the chain of custody
belongs to the image — and it is asserted as behaviour in
`asignacion.alcance.test.ts`. The alternative, copying the territory onto each
Asignación when it opens, freezes a fact that changes and is far worse to undo.

**The guards that protect an image are unscoped, and say less because of it.**
`findAbiertasDeMisioneroSinAlcance` ignores territory on purpose: an image can be
moved to another Diócesis while a Misionero still physically holds it, and a scoped
count would report zero and let the person be closed out with the image in their
house. A guard that can be wrong in the permissive direction is not a guard. But
naming a Código from another territory would confirm a record the Actor may not
read, so the refusal names the Código when it was theirs to see anyway and
otherwise says an image from another territory is outstanding and who to ask. User
story 14 needs a next step, not an identifier.

## The denormalised pointer

`peregrina.misionero_actual_id` is a copy of the open Asignación's `misioneroId`,
so that a list of two hundred images costs one join rather than a lookup per row.

It is derived and never written independently. `AsignacionRepository` sets it inside
the same transaction that opens or closes an Asignación, and it is excluded from
`PeregrinaRepository.update`'s type, so a second writer does not compile. The
Asignación table is the source of truth; if the two ever disagree, the pointer is
the one that is wrong.

## The module import direction reversed

`misionero → peregrina` became `peregrina → misionero`. The old direction existed
because a Misionero pointed at their Peregrina; that pointer is gone, and the one
that remains is the denormalised column above. The chain is now
`territorio → misionero → peregrina → asignacion`, and it is still one-way at the
schema level, which is what keeps the Drizzle barrel acyclic.

One rule is now stated rather than implied: **a service may read another module's
repository for a cross-entity guard, but never another module's service.**
`PeregrinaService.darDeBaja` and `MisioneroService.darDeBaja` both read
`AsignacionRepository`, because both refuse while an image is outstanding, and a
guard should consult the source of truth rather than a cache. Reaching for the other
*service* is what would create a cycle.

## Soft delete, and what it costs

Nothing is destroyed. Peregrina, Misionero and Usuario each carry a `baja_at`;
repositories exclude those rows by default and a caller wanting them says so.
Deleting a Misionero would destroy the record of what they were responsible for,
which is the history this decision exists to keep — so a Misionero given de baja
disappears from active lists and keeps resolving by name inside every Asignación
they held.

Both bajas are refused while an Asignación is open. An image physically in
somebody's house has not left the inventory, and a person who still has one has not
been closed out; pretending otherwise is how images stop being anybody's problem
and then stop being findable.

`TerritorioRepository`'s use counts had to change with this. They predate soft
delete and counted every row, so left alone they would have kept counting retired
records and refused to retire a Diócesis forever, citing records nobody can see.

## Estado

`en_reparacion` and `extraviada` join `activa`. `inactiva` is kept and excluded from
new entry rather than rewritten: rewriting it to `activa` would assert something
untrue about an image somebody marked inactive for a reason, and rewriting it to
`extraviada` would invent a claim that images are lost. It stays readable and
unselectable so a Referente corrects each one knowingly.

Estado describes the image's condition and says nothing about who has it. Marking a
Peregrina `extraviada` **leaves the open Asignación open**: the image is still
somebody's responsibility, and closing it would delete the only lead anybody has.
The temptation to close it is the bug, and there is a test named after it.

## The production driver changed

`db.transaction` throws on Drizzle's `neon-http` driver, and handing an image on
needs one: closing one period and opening the next is one fact about the world, and
half of it is worse than none of it. That bug would have passed the suite, which
runs on node-postgres, and failed only in production — the worst shape a bug can
have. `src/db/index.ts` now uses `neon-serverless`, which speaks the real Postgres
protocol over a WebSocket, at the cost of a connection handshake the HTTP driver did
not need. We run on the Node runtime, not the edge, so that cost is a pool's worth
and not a request's.

## Considered options

Closing the existing Asignación silently when a held Peregrina is assigned again was
rejected: a Referente who did not know the image was out needs to be told, not
obeyed. Handing on is a separate operation that says what it is about to do.

Enforcing the invariant only in the service was rejected because two Referentes in
one territory share a login and do use it at the same time. Enforcing it only in the
database was rejected because a constraint violation is not a sentence anybody can
act on.

Deleting the Asignación when correcting a mistake was rejected in favour of an edit
that stamps `corregida_at`. A typo must not become permanent history, and a
correction must not become invisible history.
