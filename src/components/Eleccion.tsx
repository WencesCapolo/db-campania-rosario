"use client";

import { useId } from "react";

/**
 * Elección — a labelled native `<select>`.
 *
 * Native, and that is the decision rather than the fallback. On a phone the
 * browser hands back the OS picker: full-height, scrollable with a thumb,
 * already familiar, already accessible, already translated. Nothing we built
 * would be better, and every custom listbox in existence has had to reimplement
 * type-ahead, Home/End, and screen-reader announcement badly.
 *
 * `appearance-none` is deliberately absent. Stripping the chevron to draw our
 * own is how a select stops looking like a select — story 6 again.
 *
 * The options are passed as data rather than as children so a caller cannot
 * build the list from the wrong source. That matters for one list in
 * particular: a Peregrina's Estado picker must be built from
 * `ESTADOS_SELECCIONABLES` and never from `peregrinaEstadoEnum.enumValues`,
 * which would quietly put the legacy `inactiva` back on offer.
 */

export interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "className" | "id" | "children" | "aria-invalid" | "aria-describedby"
  > {
  etiqueta: string;
  opciones: Opcion[];
  /** Rendered first, with an empty value. For "Todas", not for a real choice. */
  vacia?: string;
  ayuda?: string;
  error?: string | null;
  /**
   * What follows from the choice, rendered under the select and announced as
   * part of its description.
   *
   * `ayuda` cannot do this job: it is what to know *before* choosing, and it
   * renders above the control. Derived facts are output, they belong after it,
   * and they still have to be announced — the territory picker shows the
   * Provincia and Región that follow from a Diócesis, and a sighted user reads
   * them without being told to look while a screen-reader user would never
   * reach them.
   */
  derivado?: React.ReactNode;
}

export default function Eleccion({
  etiqueta,
  opciones,
  vacia,
  ayuda,
  error,
  derivado,
  ...resto
}: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const idDerivado = `${id}-derivado`;

  const descrito = [
    ayuda ? idAyuda : null,
    error ? idError : null,
    derivado ? idDerivado : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-base font-semibold text-tinta">
        {etiqueta}
      </label>

      {ayuda && (
        <p id={idAyuda} className="text-base text-tinta-suave">
          {ayuda}
        </p>
      )}

      <select
        {...resto}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito || undefined}
        className={
          "min-h-12 w-full rounded-control border-2 bg-papel px-3 text-base text-tinta " +
          (error ? "border-peligro" : "border-borde-fuerte")
        }
      >
        {vacia !== undefined && <option value="">{vacia}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>

      {derivado && <div id={idDerivado}>{derivado}</div>}

      {error && (
        <p
          id={idError}
          role="alert"
          className="flex items-start gap-2 text-base font-semibold text-peligro"
        >
          <span aria-hidden>✕</span>
          {error}
        </p>
      )}
    </div>
  );
}
