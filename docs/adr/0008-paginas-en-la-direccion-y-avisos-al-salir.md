# Las páginas viven en la dirección, y el aviso llega al salir del campo

Issue #4's last two stories — 23, long lists in manageable pages, and 15, being told
about a problem on leaving a field rather than only on submit. Both are decisions
about *where a piece of state lives*, which is why they are one ADR: the page lives
in the address, like the filters (ADR 0007), and the validation rule lives in the Zod
schema, like everything the router parses.

## The page is a query parameter, and the total is an aggregate

`?pagina=` is read by `paginaDesdeParams`, parsed strictly at the router boundary by
`paginaSchema`, and passed to `PeregrinaService.listPagina` /
`MisioneroService.listPagina`. Nothing holds a page in component state, so a page
survives opening a record and coming back, survives a reload, and can be pasted into
a message — the same three properties the filters were moved to the address for.

Changing a filter deletes the page. A narrower filter has fewer pages, and page four
of a set that now has two comes back empty and reads as "nothing matched".

The total comes from `contarTotal` / `contarFiltrados` — an aggregate over the *same*
predicate the rows come from — and never from `filas.length`. This is the rule of ADR
0007 applied to a place it can silently reappear: a paginated list whose header
counted its own rows would say "20 imágenes" for a Diócesis of two hundred, and a
paginador whose total came from a wider predicate would offer pages that arrive
empty. `MisioneroRepository.contarFiltrados` exists precisely because `contarTotal`
takes only the territorial filters: with a name search on, it counts the wrong set.

**Offset, not a cursor.** A cursor is faster on deep pages and cannot express "página
3 de 7". The Campaña's largest unit is a Diócesis with hundreds of images, and
"página 3" is something a Referente says on the telephone, so the count and the jump
are worth more than the performance of a page nobody will reach.

**The order must not tie.** An `offset` over an `order by` that ties shows one row
twice and another never, and it is invisible on page one. Peregrinas are ordered by
Código, which is unique; Misioneros are ordered by apellido, nombre *and id*, because
a parish full of Gómez is the normal case. Both are asserted by reading every page
and comparing the concatenation against the unpaginated read.

**A page past the end is clamped, not answered empty.** Only the service knows how
many pages the filters leave, so it clamps there. The alternative — an empty list at
page nine — reads as "there is nothing here", which is a lie about the data, and the
address that produced it is usually a bookmark taken before rows were given de baja.

### The one list that is paginated in memory, and why

The Misionero list's "sólo los que no tienen ninguna" filter is the intersection of
two scoped reads. The second, `findMisionerosSinPeregrina`, deliberately ignores the
*image's* territory — somebody holding a Peregrina that has since moved Diócesis is
not free — so it cannot be expressed as a predicate on the listado's query. The
intersection therefore has to exist before it can be cut, and that page is sliced in
the page component by `enMemoria`.

It is bounded by the Actor's territory and it is written down rather than hidden. The
honest fix is an anti-join inside the filtered query, which is a change to
`AsignacionRepository` and not something a page should fake.

## The aviso comes from the schema, at blur

`useValidacionAlSalir(schema)` takes the same Zod object the router parses and
validates **one field** as it is left. Three rules, each about timing:

- **On blur, never on keystroke.** "El nombre es obligatorio" after the first letter
  is an accusation, and by the third letter it is already wrong. Blur is the moment
  the person has declared the field finished.
- **Typing clears a message; it does not create one.** The message is about a value
  that no longer exists. The next blur decides again.
- **The schema is the judge.** What somebody reads on leaving the field is the exact
  sentence the server would have produced, because it is the same sentence. Two
  sources for one rule is how a form accepts what the service then refuses.

The message renders through `Campo`'s existing `error` prop, so it is bound to the
input by `aria-describedby`, announced by `role="alert"`, and carries the glyph — none
of which each form has to remember.

**One deliberate exception, `marcar`.** An Año de consagración is four digits in a
text box and a number in the schema, and `Number("mil")` is `NaN`, which Zod refuses
in English. The *shape of the typing* is therefore checked at the call site, in
Spanish; the domain rule — not before 1900, not in the future — stays in the schema.

This also fixed a message that was about the wrong field: both halves of a person's
name shared one schema, so an empty Apellido was refused with "El nombre es
obligatorio." `.describe("apellido")` looks like it addresses that and does not — it
annotates the schema without changing what Zod says. `nombrePersona` is a factory now.

## What is tested, and where

The pagination is tested at the service seam, in the `node` project: the pages
partition the unpaginated read, the total is the whole matching set, a page past the
end clamps, and — asserted as a negative — a Referente Local paging through their
Diócesis never reaches a row from the next one, in any page or in the total.

The aviso is tested in the `navegador` project, because "nothing is announced until
the field is left" is not observable below a browser. It mounts a stand-in form built
on the real `createMisioneroSchema` — the form itself calls a server action and cannot
be reached from a browser test — and asserts per field via `aria-invalid`, since both
halves of a name refuse in the same shape and a global `role="alert"` query cannot
tell one field's message going from another's arriving.
