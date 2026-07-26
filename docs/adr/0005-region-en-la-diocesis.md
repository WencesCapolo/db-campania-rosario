# La Región pertenece a la Diócesis, no a la Provincia

`provincia.region` is gone. Each Diócesis/Localidad carries its own Región, and a
Provincia carries none.

The old shape came from a reasonable assumption — that the Campaña's Regiones are
groupings of Provincias — and the Campaña's own list says otherwise. Santa Fe spans
two: Reconquista is **NEA**, Rosario and Rafaela are **CENTRO**. Buenos Aires spans
two: the conurbano is **BS. AS.**, while San Nicolás, La Plata, Mar del Plata, Bahía
Blanca, Azul, 9 de Julio and Mercedes are **R. PAM.** Two of the twenty-four
Provincias, eight Diócesis between them — exactly the proportion that lets a wrong
model survive a demo and fail on the real data.

With Región on the Provincia those cases were unrepresentable. There was no way to
enter the country as it is, so somebody entering it would have had to pick a Región
per Provincia and be wrong about a third of Buenos Aires — silently, because
nothing in the system would have contradicted them.

## What it changes, and what it does not

Región is now **derived from the Diócesis/Localidad** everywhere: on a Peregrina, on
a Misionero, in the territory picker. It was always shown rather than asked for, so
no form changed shape — the value simply comes from one level down.

It changes nothing about scope. `derivarAlcance` bounds a Referente Local to a
Diócesis and a Responsable Diocesano to a Diócesis; neither is bounded by a Región,
and no read filters on one. Región is a label the Campaña organises itself by, not a
permission.

It changes nothing about Códigos either. The format is `[Provincia Modalidad
Número]`, sequential per Provincia-and-Modalidad pair, and the Provincia is still
the Provincia. **A Código must never be parsed to derive territory**, which is why
moving Región did not have to touch code generation at all.

## The migration is hand-written, and that is the point

`drizzle-kit generate` produced a data-destroying file: it added
`diocesis_localidad.region` and dropped `provincia.region` with nothing in between.
Every Región in the database would have been replaced by a default.

`0005` is written by hand. It adds the column nullable, backfills each Diócesis from
its Provincia's Región — the correct starting point for twenty-two of the
twenty-four, with the two split Provincias then corrected against the Campaña's
list — makes it `not null`, and only then drops the old column. The order is the
whole file.

**Read generated SQL before trusting it.** This is the second migration in the
project that would have been wrong if it had been taken as offered.

## The Modalidades, in the same migration

The enum went from four values to sixteen — the Campaña's real set of apostolates,
as three-letter codes, which is what a Código is built from. `JOV` and `FAM`
survived; `INF` and `ADU` were **removed outright** rather than kept as legacy
values.

That is the opposite of what was done with Peregrina's `inactiva` Estado, and the
difference is whether the value describes something a person chose. `inactiva`
describes a decision somebody made about a real image, so rewriting it would assert
something untrue; it stays readable and excluded from new entry. `INF` and `ADU`
describe an apostolate structure that never existed — placeholders from before
anybody had the Campaña's list.

Postgres cannot remove a value from an enum, so the type is recreated: the column
goes to `text`, the old type is dropped, the sixteen-value type is created, and the
column is cast back. `CREATE TYPE` rather than `ALTER TYPE … ADD VALUE` also
sidesteps the rule that a new enum value cannot be used in the transaction that adds
it — a rule that still applies to everything else, since Drizzle wraps each file in
one transaction.

The migration **refuses to run** if any Peregrina still carries `INF` or `ADU`,
naming how many. It does not reassign them, and that is deliberate: the old Código
is written on the physical image, and silently moving a row to the nearest new
Modalidad would make the database disagree with the object on the shelf. Somebody
who knows which apostolate each image belongs to has to look. In the user's database
there were none, so it did not fire — but the refusal is what makes running it
somewhere else safe.

## Consequences

The user's Neon project holds twenty-four Provincias and sixty-five
Diócesis/Localidades, seeded from their spreadsheet, with `provincia.region` dropped
and the split Provincias verified in the database rather than only in the seed file.

`DIOCESIS_SEED` in `src/modules/territorio/territorio.reference.ts` is now the
committed record of that data. The spreadsheet it came from is deliberately not in
the repository.

One thing the spreadsheet gets wrong and only the Campaña can settle: it files the
six CABA entries under Buenos Aires, so a Devoto image would take a `BA` Código
rather than `CAB`. Correcting it is a few clicks in `/admin/territorio` and it is
their call, not ours — the Código is written on a physical statue.

## Considered options

Keeping Región on the Provincia and adding an override on the Diócesis was
rejected: two sources for one fact, and the override is the one that would be
forgotten.

Putting Región on both, with the Provincia's as a default, was rejected for the same
reason plus a worse one — a Diócesis whose Región disagrees with its Provincia's
would be a legitimate state and an error state at the same time, with no way to tell
which.

Deriving Región from a lookup table keyed by Diócesis name was rejected because the
names are free text a person types, and a mapping keyed on spelling breaks the first
time somebody writes "Sta. Fe".
