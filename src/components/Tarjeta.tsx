/**
 * Tarjeta — a bounded surface.
 *
 * A visible border rather than a shadow. A shadow is a lighting cue, and on the
 * cheap phone screens this runs on, in a room with one bulb, it is very close to
 * invisible; a 2px edge is a shape, and a shape survives.
 */
export default function Tarjeta({
  titulo,
  children,
  acciones,
}: {
  /** Rendered as a heading. Omit for a card that is not a section of its own. */
  titulo?: string;
  children: React.ReactNode;
  /** Buttons or links, laid alongside the title on a wide screen. */
  acciones?: React.ReactNode;
}) {
  return (
    <section className="rounded-tarjeta border-2 border-borde bg-papel">
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-borde px-5 py-4">
          {titulo && <h2 className="text-xl font-bold text-tinta">{titulo}</h2>}
          {acciones}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
