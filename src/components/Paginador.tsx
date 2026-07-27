import Boton, { BotonEnlace } from "./Boton";

/**
 * Paginador — anterior, siguiente, and where you are.
 *
 * Two links and a sentence. No numbered strip: on a 390px phone, nine page
 * numbers are nine 20px targets in a row, which is the opposite of the 48px floor
 * the rest of the interface holds, and a Referente reads "página 3 de 7" faster
 * than they find the emphasised 3 among them.
 *
 * A server component on purpose. The page lives in the address, so moving between
 * pages is navigation and the control is two anchors — which get a new tab on a
 * middle click and a target in the status bar for free. Nothing here is
 * interactive, so nothing here is client-side.
 *
 * The unavailable direction stays on screen as a disabled `Boton` rather than
 * disappearing. Removing it shifts the other one under the thumb that was aiming
 * at it, and "Siguiente" jumping to where "Anterior" was is how somebody ends up
 * two pages from where they meant to be.
 *
 * `href` is a function rather than a base string because the address already
 * carries the filters, and a paginador that rebuilt the query itself would be a
 * second place that has to know the filter keys.
 */

export default function Paginador({
  pagina,
  paginas,
  total,
  porPagina,
  unidad,
  href,
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  /** What is being counted, plural and in the Campaña's own words. */
  unidad: string;
  href: (pagina: number) => string;
}) {
  // One page is not a pagination, and a control that can do nothing is noise on a
  // screen whose users are asked to read every word on it.
  if (paginas <= 1) return null;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col gap-3 border-t-2 border-borde pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      {/*
        The sentence before the controls, because it is the reason to press one.
        Both facts are here: which page, and which rows — "página 2 de 7" alone
        leaves somebody unsure whether they have already seen a Código.
      */}
      <p className="text-base text-tinta">
        Página <strong>{pagina}</strong> de <strong>{paginas}</strong> ·{" "}
        {unidad} {desde}–{hasta} de {total}
      </p>

      <div className="flex gap-3">
        {pagina > 1 ? (
          <BotonEnlace
            tono="secundario"
            href={href(pagina - 1)}
            rel="prev"
            aria-label={`Ir a la página ${pagina - 1}`}
          >
            ← Anterior
          </BotonEnlace>
        ) : (
          <DireccionAgotada>← Anterior</DireccionAgotada>
        )}

        {pagina < paginas ? (
          <BotonEnlace
            tono="secundario"
            href={href(pagina + 1)}
            rel="next"
            aria-label={`Ir a la página ${pagina + 1}`}
          >
            Siguiente →
          </BotonEnlace>
        ) : (
          <DireccionAgotada>Siguiente →</DireccionAgotada>
        )}
      </div>
    </nav>
  );
}

/**
 * The end of the list, as a control that says so.
 *
 * The primitive rather than a styled span: a real `<button disabled>` is
 * announced as an unavailable control, which is the fact, and it already carries
 * the 48px floor and the disabled contrast the suite measures. The arrows are
 * text rather than icons so they survive a font with no glyph for an SVG.
 */
function DireccionAgotada({ children }: { children: React.ReactNode }) {
  return (
    <Boton tono="secundario" disabled>
      {children}
    </Boton>
  );
}
