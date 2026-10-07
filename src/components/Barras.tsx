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
  /**
   * Una palabra al lado, más chica: el código de la Modalidad, la Provincia de
   * una Diócesis. Lo que distingue dos filas que se leen parecido.
   */
  detalle?: string;
  valor: number;
  /** Where the figure leads — story 21. Omit for a category with no list. */
  href?: string;
}

export default function Barras({
  titulo,
  barras,
  unidad,
  vacio = "Todavía no hay nada que contar acá.",
  visibles,
  nota,
  total,
}: {
  /** Rendered as the heading of the group, so the rows have something to be. */
  titulo: string;
  barras: Barra[];
  /** Singular noun for one, e.g. "imagen". Plural gets an "es"/"s" from below. */
  unidad?: { singular: string; plural: string };
  vacio?: string;
  /**
   * Cuántas filas se ven de entrada. El resto queda detrás de un `<details>`
   * que dice cuántas son en total: una lista cortada sin decirlo se lee como la
   * respuesta entera. Sin JavaScript, y la barra más larga sigue siendo la de
   * todas, así que abrirlo no cambia la escala de lo que ya se veía.
   */
  visibles?: number;
  /** Una línea debajo del título, para decir qué se está contando. */
  nota?: string;
  /**
   * El total contra el que cada fila dice su porcentaje. Viene de afuera y no
   * es la suma de las filas: el total es una cifra del servidor, y una suma
   * hecha acá sería una segunda manera de contar.
   */
  total?: number;
}) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);
  const primeras = visibles ? barras.slice(0, visibles) : barras;
  const resto = visibles ? barras.slice(visibles) : [];
  const lista = { maximo, unidad, total };

  return (
    <Panel titulo={titulo} nota={nota}>
      {barras.length === 0 ? (
        <p className="text-base text-tinta-suave">{vacio}</p>
      ) : (
        <>
          <Lista barras={primeras} {...lista} />
          {resto.length > 0 && (
            <details className="group mt-3">
              <summary className="inline-flex min-h-12 cursor-pointer list-none items-center rounded-control border-2 border-borde-fuerte bg-papel px-4 text-base text-tinta [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">
                  Ver las {barras.length} (mostrando {primeras.length})
                </span>
                <span className="hidden group-open:inline">
                  Mostrar sólo {primeras.length}
                </span>
              </summary>
              <div className="mt-3">
                <Lista barras={resto} {...lista} />
              </div>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}

/**
 * La tarjeta del tablero: título en azul, una nota debajo, y el contenido.
 *
 * Sin la regla bajo el encabezado que lleva `Tarjeta`: acá cada tarjeta es una
 * sola cifra o un solo gráfico, y la regla partía en dos algo que es uno.
 */
export function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-tarjeta border-2 border-borde bg-papel px-5 py-4">
      <h2 className="text-xl font-bold text-azul">{titulo}</h2>
      {nota && <p className="mt-1 text-base text-tinta-suave">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Lista({
  barras,
  maximo,
  unidad,
  total,
}: {
  barras: Barra[];
  maximo: number;
  unidad?: { singular: string; plural: string };
  total?: number;
}) {
  return (
    <ul className="space-y-2">
      {barras.map((barra) => (
        <li key={barra.etiqueta}>
          <Fila barra={barra} unidad={unidad} total={total} />

          {/*
            Proportional to the largest row and not to the total: what these
            charts are for is comparing categories with each other, and a
            share-of-total bar makes the two smallest rows indistinguishable
            from nothing when one category dominates — which one always does.
            The share is written in the row instead, as a number.
          */}
          <svg
            aria-hidden
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="h-2.5 w-full overflow-hidden rounded-marco bg-neutro-fondo"
          >
            <rect
              x="0"
              y="0"
              height="10"
              width={(barra.valor / maximo) * 100}
              className="fill-azul"
            />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/**
 * The row's words and its number, on one line at any width.
 *
 * A link when the figure leads somewhere, plain text when it does not, and never
 * a link that goes nowhere — a target that does nothing is worse than no target,
 * particularly for somebody who has to aim carefully. A link is underlined, so
 * telling the two apart does not depend on the colour.
 */
function Fila({
  barra,
  unidad,
  total,
}: {
  barra: Barra;
  unidad?: { singular: string; plural: string };
  total?: number;
}) {
  const numero = barra.valor.toLocaleString("es-AR");
  const cifra = unidad
    ? `${numero} ${barra.valor === 1 ? unidad.singular : unidad.plural}`
    : numero;

  const contenido = (
    <>
      <span className="text-base">
        <span className={barra.href ? "text-azul underline" : "text-tinta"}>
          {barra.etiqueta}
        </span>
        {barra.detalle && (
          <span className="ml-2 text-sm text-tinta-suave">{barra.detalle}</span>
        )}
      </span>
      <span className="whitespace-nowrap">
        <span className="text-lg font-bold tabular-nums text-tinta">
          {cifra}
        </span>
        {total ? (
          <span className="ml-2 text-sm tabular-nums text-tinta-suave">
            {Math.round((barra.valor * 100) / total)} %
          </span>
        ) : null}
      </span>
    </>
  );

  const clases =
    "flex min-h-12 flex-wrap items-center justify-between gap-x-4 rounded-control";

  if (!barra.href) {
    return <p className={clases}>{contenido}</p>;
  }

  return (
    <Link href={barra.href} className={clases}>
      {contenido}
    </Link>
  );
}
