# Dos rotulaciones: el Código, y la Numeración anterior

Many images were labelled before the Campaña settled on `[Provincia Modalidad Número]`,
and they were labelled in several ways — "Peregrina 7", "Rosario-12", a number alone.
What is written on them is how their Misioneros and Referentes know them. Registering
those images meant either inventing a Código nobody had written on the statue, or
letting the system hold a second kind of label.

## The decision

**A Peregrina carries a Código, a Numeración anterior, or both.** `codigo` and
`codigo_num` became nullable, and `numeracion_anterior` is a new free-text column. Two
checks hold the shape: at least one of the two labels is present
(`peregrina_tiene_identificacion`), and a Código never exists without the número it
was minted from (`peregrina_codigo_con_numero`) — otherwise `nextCodigoNum` would skip
it and mint the same Código twice.

**The Identificación is the Código if there is one, the Numeración anterior if not.**
It is computed, never stored: `IDENTIFICACION` in `peregrina.repository` for SQL and
`identificacionDe` in `peregrina.types` for a row in hand. Every screen and every
message names an image by it, and every list orders by it with the id behind it, because
a Numeración anterior repeats and an `order by` that ties is how an `offset` skips rows
(ADR 0008).

**An old image can later be given a Código, and the Numeración anterior stays.**
`PeregrinaService.generarCodigo` takes the next número for the image's Provincia and
Modalidad *as they are now*, and from then on the Código is what identifies it. The old
label is kept because somebody holding a paper list still searches by it, and the
Identificación filter matches either column.

## What it costs, and what was not done

- **The Numeración anterior is typed, the one exception to "Códigos are never typed".**
  It has no format, so it is never parsed, and nothing validates its shape beyond
  1–40 characters.
- **It is not unique, and nothing checks for repeats.** It repeats between Diócesis by
  nature, and the Campaña asked for no control within one. Two images with the same
  Numeración anterior are told apart by their territory and, eventually, by their Código.
- **No guard against an old label shaped like a Código.** The Campaña confirmed none
  exists. If one did, it could not collide in the database — the unique index is on
  `codigo` alone — but a search would return both images.
- **No número is spent on an old image at registration.** A Código nobody wrote on the
  statue identifies nothing; the número is spent when `generarCodigo` runs, which is
  when somebody is about to write it.
- **The filter's address key changed from `?codigo=` to `?identificacion=`.** A link
  saved with the old key loses that filter and shows the unfiltered list, which is what
  `filtrosDesdeParams` does with any key it does not recognise.
