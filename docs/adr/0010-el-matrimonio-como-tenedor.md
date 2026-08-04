# Un matrimonio es un tenedor, y no dos personas

A Peregrina can be in the charge of a married couple, and the couple is one answer to
"who has it" rather than two. That sentence is the whole decision; everything below is
what it costs.

## What it replaces

`asignacion.misioneroId` was `not null` and pointed at exactly one Misionero, and
CONTEXT.md defined a Misionero as "a person who takes charge of a Peregrina". Both were
true of the Campaña's individual missionaries and false of its couples, who had been
entered as two separate people with the image arbitrarily filed under one of them.

Three consequences, and the third is the one that made this urgent:

- The `/misionero` listado showed a couple as two rows, and somebody scanning it for a
  surname found the same household twice.
- The image's holder was whichever spouse got typed first, so "who has it" answered with
  half of the truth.
- The other half was invisible: the spouse the image was *not* filed under could be given
  de baja while the image sat in their house, because the guard at
  `AsignacionRepository.hayAbiertaDe` keys on `misionero_id` and never saw them.

## The decision

**A `matrimonio` is its own table, holding two Misionero rows.** It lives in the
`misionero` module rather than in one of its own, because the chain runs one way and
`asignacion.matrimonio_id` needs it upstream. It carries what the couple genuinely shares —
`estado`, `centroTipo`, `centroNombre`, `bajaAt` — and the spouses keep what is theirs:
`nombre`, `apellido`, `anioConsagracion`, `resumenesAnuales`, `telefono`, and their own
`bajaAt`. Two people consecrate in two different years, and a single row could not hold
both.

The teléfono moved across that line after the fact. It began as one household number on
the couple, which is how a household is usually written down on paper — and it is wrong
for the one moment the number is ever used. Somebody is looking for an image and rings;
the second number is the one they need when the first person does not answer. So there are
two, both optional, and a couple with only one recorded is the ordinary case.

**The holder pointer is polymorphic, not a supertype.** `asignacion` and `peregrina` each
carry a nullable `misionero_*` and a nullable `matrimonio_*`, with a check constraint. The
alternative considered and rejected was a `tenedor` supertype table that both kinds point
at, which would have kept every pointer single-column and every index unchanged.

It was rejected on the honest accounting: at the Campaña's scale — under ten thousand
images and couples together — the supertype buys no measurable speed, and ADR 0007's own
rule is that a structure exists because the planner names it, not because it is tidy. What
the supertype *would* have bought is a denormalised label to render, and that is a second
copy of two people's names waiting to drift out of date. The union type `Tenedor` is free;
the table was not.

**The two check constraints are deliberately different**, and writing them as a matched
pair would break the app:

```sql
-- asignacion: a period always has exactly one holder
check (num_nonnulls(misionero_id, matrimonio_id) = 1)

-- peregrina: a libre image has none, so at most one
check (num_nonnulls(misionero_actual_id, matrimonio_actual_id) <= 1)
```

`peregrina`'s all-null case *is* "libre", and it is what the tenencia filter and the
free-images list are reading. A `= 1` there would make an unassigned image unstorable.

`asignacion_peregrina_abierta_key` is untouched. It is partial-unique on the *image*, not
on the holder, so the one-open-Asignación invariant survives the change without knowing
anything about it.

**A married Misionero never holds an image alone.** This is what makes the UI answer
clean: if a spouse were selectable on their own, they would have to appear in the picker,
and appearing in the picker means appearing in the listado, and the couple becomes a third
row beside the two it was supposed to replace. So `AsignacionService` refuses an
individual assignment to somebody in an active marriage, reading `MatrimonioRepository`
for the check — a downstream repository read, which is the cross-entity guard ADR 0004
already permits.

The check runs on **`asignar`, `entregar`, and `corregir` of an open period** — not on
`asignar` alone, which is how this was first written down. All three open a period, and a
rule that guards one of three doors is not a rule; the other two would have been the way
round it. `devolver` is deliberately exempt: it takes no Tenedor at all, because it closes
whatever is open and a Peregrina has at most one open period.

There is deliberately no storage constraint behind that rule. It is a service rule, in the
same way "a Misionero may hold several Peregrinas at once" (settled 2026-07-25) is a
service rule.

## The listado is a union, and so are the figures

`/misionero` shows individuals *who are not in an active marriage*, plus marriages, as one
list. That is a `UNION ALL` in SQL rather than two reads merged in the service, and it has
to be: ADR 0008 requires the total to be an aggregate over the same predicate as the rows,
and a merge in the application can only count what it has already fetched — which is the
bug ADR 0007 was written about, reappearing one layer down.

The marriage leg joins `misionero` twice. Once as spouse A, for the sort key and for the
territory; once as spouse B, so a search for "Benítez" finds "Ana Álvarez y Juan Benítez".
The `id` tiebreaker spans two tables' UUIDs, which is safe in practice and needs saying out
loud, because ADR 0008's rule is that an `order by` which can tie must have a unique
tiebreaker before it gets an `offset`.

**A matrimonio has no territory of its own.** It is scoped by joining spouse A, which is
deterministic because both spouses share a Diócesis by construction — the form enters it
once. The alternative was a third copy of `diocesis_localidad_id` on the couple, and a
three-row invariant to keep it true.

**The tablero counts holders, not people: a couple is one.** CONTEXT.md says every figure
links to the records behind it, so a figure that counted two would say 47, and the list it
links to would show 45. An off-by-a-plausible-amount figure is worse than an obviously
wrong one.

## What this does not do

**Nothing guards the creation of a marriage.** If two people already hold images
individually and are then married, the system does not notice.

This was originally justified by a cycle, and the justification was wrong. A service may
read another module's **repository** across the chain — CLAUDE.md §4 says so, and
`MisioneroService` has imported `AsignacionRepository` for its own baja guard since issue
3. Only the *schema* imports are one-way, and only *service*-to-service is forbidden. So
`MatrimonioService` can hold this rule, and the cost is a repository method rather than an
architecture change.

What remains true is the narrower thing: `MatrimonioService` cannot **change charge**. That
still belongs to the four methods on `AsignacionService` and calling a service from a
service is still banned, so a marriage can refuse to be created but cannot transfer the
images out of the way itself.

The gap is therefore a decision, and it was taken knowingly once the false constraint was
removed: **the guard is not being written.** It would refuse a marriage at the moment two
people are joined, on the strength of paperwork that is usually being caught up on rather
than kept live, and the failure it prevents is already visible — the images show as held by
one spouse until somebody moves them.

The workflow is that a marriage is created as a new record and the stray individuals are
given de baja, which `bajaAt` refuses while an Asignación is open. The operator is told to
return the image first, which is the same conversation the guard would have started, one
screen later.

**A widowed spouse costs four steps, and there is a hole in the middle of them.** Devolver
the couple's image, baja the matrimonio, baja the deceased, re-assign to the survivor.
Between the first and the last, the image reads **libre**: it appears in the "sin entregar"
list and in the free-images picker in `CrearMisioneroForm`, while it is physically in the
survivor's house, and somebody else can be handed it.

The fix considered was a `disolver` operation closing and reopening the periods in one
transaction — which is what `entregar` already does, pointed at a new reason. It was not
taken because it would be a fifth place where charge changes, and CLAUDE.md §7 says there
are exactly four. The gap is recorded here rather than in a comment, and the workaround is
to do the two steps back to back.

**The polymorphic read can fail silently.** A query that joins the `misionero` leg and
forgets the `matrimonio` leg returns fewer rows and no error — a couple's images simply
vanish from a list. This is the price of choosing the pointer over the supertype, it was
chosen knowingly, and the mitigation is a suite that asserts every list read shows a
marriage's images. It sits beside the `*.alcance.test.ts` files under the same discipline
and for the same reason: the failure mode is silence.
