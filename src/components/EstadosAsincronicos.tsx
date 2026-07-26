import Boton from "./Boton";

/**
 * The three states every asynchronous surface owes: cargando, error, vacío.
 *
 * They are three components rather than one wrapper with a `estado` prop
 * because the *distinction they enforce* is the point, and a single prop makes
 * it easy to pass the wrong value. In particular:
 *
 *   **A refusal is an error, never an empty list.**
 *
 * That is the sharpest collision between this work and issue #2. Reads throw
 * rather than returning `[]`, so a `NoAutorizadoError` arrives on the error
 * path. Rendering it as "no hay Peregrinas" would be two lies at once: it tells
 * somebody whose Actor was refused that their territory is empty, and it
 * confirms to somebody probing another territory that the territory exists and
 * has nothing in it — which issue #2 deliberately declined to confirm.
 *
 * The trap is not this file, it is the call site. A `try/catch` around a server
 * component read that falls back to `[]` collapses the distinction before these
 * components ever see it. None of the pages do that. None should start.
 */

/**
 * Cargando — an honest placeholder while data is on its way, so a slow
 * connection does not look like a broken screen (story 10).
 *
 * Grey blocks roughly the shape of the rows that are coming, rather than a
 * spinner: a spinner says "something is happening", a skeleton says "a list is
 * about to appear here", and the second is the one that stops somebody
 * reloading. `aria-busy` with a live region carries the same message to a screen
 * reader, which cannot see either.
 */
export function Cargando({
  filas = 3,
  etiqueta = "Cargando…",
}: {
  filas?: number;
  etiqueta?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      <span className="sr-only">{etiqueta}</span>
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-20 animate-pulse rounded-tarjeta border-2 border-borde bg-neutro-fondo"
        />
      ))}
    </div>
  );
}

/**
 * PanelDeError — something failed, and there is a way out of it (story 11).
 *
 * The retry is the point. A dropped connection in a parish office is the common
 * case, and without a retry the recovery is "start the whole task again".
 *
 * The wording stays general on purpose. This renders authorization refusals as
 * well as genuine failures, and it cannot reliably tell them apart — Next
 * replaces a server error's message with a digest in production. Copy that
 * guessed would be wrong as often as right, and a wrong guess here is the
 * disclosure issue #2 refused to make.
 */
export function PanelDeError({
  titulo = "No se pudo mostrar",
  mensaje = "Puede ser que eso pertenezca a otro territorio, o que algo haya fallado al buscarlo. Si es de tu Diócesis/Localidad y sigue sin aparecer, avisale a un Asesor Nacional.",
  alReintentar,
  referencia,
}: {
  titulo?: string;
  mensaje?: string;
  alReintentar?: () => void;
  /** Next's error digest, when there is one. Something to quote in a report. */
  referencia?: string;
}) {
  return (
    <div
      role="alert"
      className="space-y-4 rounded-tarjeta border-2 border-peligro bg-alerta-fondo p-5"
    >
      <h2 className="flex items-center gap-2 text-xl font-bold text-alerta-tinta">
        <span aria-hidden>✕</span>
        {titulo}
      </h2>

      <p className="text-base leading-relaxed text-alerta-tinta">{mensaje}</p>

      {alReintentar && (
        <Boton tono="secundario" onClick={alReintentar}>
          Probar de nuevo
        </Boton>
      )}

      {referencia && (
        <p className="text-base text-alerta-tinta">
          Si tenés que reportarlo, este es el número: {referencia}
        </p>
      )}
    </div>
  );
}

/**
 * Vacío — the query succeeded and there is nothing (story 12).
 *
 * Only ever for that. It says so plainly and says what to do next, because an
 * empty screen with no instruction is indistinguishable from a broken one to
 * somebody who does not know the system is working.
 */
export function Vacio({
  titulo,
  mensaje,
  accion,
}: {
  titulo: string;
  mensaje: string;
  /** The one thing to do from here — usually "register the first one". */
  accion?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-tarjeta border-2 border-dashed border-borde-fuerte bg-papel p-6 text-center">
      <h2 className="text-xl font-bold text-tinta">{titulo}</h2>
      <p className="text-base leading-relaxed text-tinta-suave">{mensaje}</p>
      {accion}
    </div>
  );
}
