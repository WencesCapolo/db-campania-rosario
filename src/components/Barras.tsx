import Link from "next/link";

/**
 * Barras — a comparison, read as text first and as a shape second.
 *
 * The chart every rule in this project points at. Each row is a real HTML label
 * and a real number, and the bar underneath is decoration for the number rather
 * than the other way round. That is what "labelled with values directly" means
 * in story 22: nobody estimates a quantity off an axis, and there is no axis to
 * estimate off.
 *
 * **No legend, and no colour encoding at all.** Every bar is the same ink, so
 * story 23 is satisfied by construction rather than by choosing distinguishable
 * hues — a palette of seven colours for seven Regiones is seven things to look up
 * and, for roughly one man in twelve, some of them are the same colour. The
 * category is written where the bar is.
 *
 * Why the bar is an `<svg>` and not a `<div>` with a width: a proportional width
 * is a computed value, and the only ways to apply one are `style={{}}` — which
 * `no-restricted-syntax` fails the build over, correctly — or an arbitrary
 * Tailwind class per value, which mints a class name per number. An SVG `rect`
 * takes its width as a *geometry attribute*, which is neither. `preserveAspectRatio`
 * is off so the 0–100 viewBox stretches to whatever width the row has, and the
 * height comes from a utility class, so the bar scales with the page like
 * everything else.
 *
 * The svg is `aria-hidden`. Its content is already in the row as words and a
 * number, and announcing "graphic" twice per row is noise, not information.
 */

export interface Barra {
  /** The category, in the Campaña's own words. Never a code. */
  etiqueta: string;
  valor: number;
  /** Where the figure leads — story 21. Omit for a category with no list. */
  href?: string;
}

export default function Barras({
  titulo,
  barras,
  unidad,
  vacio = "Todavía no hay nada que contar acá.",
}: {
  /** Rendered as the heading of the group, so the rows have something to be. */
  titulo: string;
  barras: Barra[];
  /** Singular noun for one, e.g. "imagen". Plural gets an "es"/"s" from below. */
  unidad?: { singular: string; plural: string };
  vacio?: string;
}) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  return (
    <section className="rounded-tarjeta border-2 border-borde bg-papel">
      <header className="border-b-2 border-borde px-5 py-4">
        <h2 className="text-xl font-bold text-tinta">{titulo}</h2>
      </header>

      <div className="px-5 py-4">
        {barras.length === 0 ? (
          <p className="text-base text-tinta-suave">{vacio}</p>
        ) : (
          <ul className="space-y-4">
            {barras.map((barra) => (
              <li key={barra.etiqueta} className="space-y-1">
                <Fila barra={barra} unidad={unidad} />

                {/*
                  Proportional to the largest row and not to the total: what these
                  charts are for is comparing categories with each other, and a
                  share-of-total bar makes the two smallest rows indistinguishable
                  from nothing when one category dominates — which one always does,
                  because most images are `activa`.
                */}
                <svg
                  aria-hidden
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  className="h-4 w-full overflow-hidden rounded-control border-2 border-borde bg-fondo"
                >
                  <rect
                    x="0"
                    y="0"
                    height="10"
                    width={(barra.valor / maximo) * 100}
                    className="fill-accion"
                  />
                </svg>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The row's words and its number, on one line at any width.
 *
 * A link when the figure leads somewhere, plain text when it does not, and never
 * a link that goes nowhere — a target that does nothing is worse than no target,
 * particularly for somebody who has to aim carefully.
 */
function Fila({
  barra,
  unidad,
}: {
  barra: Barra;
  unidad?: { singular: string; plural: string };
}) {
  const cifra = unidad
    ? `${barra.valor} ${barra.valor === 1 ? unidad.singular : unidad.plural}`
    : String(barra.valor);

  const contenido = (
    <>
      <span className="text-base font-semibold">{barra.etiqueta}</span>
      <span className="text-xl font-bold tabular-nums">{cifra}</span>
    </>
  );

  if (!barra.href) {
    return (
      <p className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 text-tinta">
        {contenido}
      </p>
    );
  }

  return (
    <Link
      href={barra.href}
      className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 rounded-control text-accion"
    >
      {contenido}
    </Link>
  );
}
