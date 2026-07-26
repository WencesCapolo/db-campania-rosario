"use client";

import { useId } from "react";

/**
 * Campo — a labelled input, and the error that belongs to it.
 *
 * The label, the input, the hint and the error are one component because
 * wiring them up is the part that gets forgotten. A `<label>` floating beside an
 * input it is not `for`-bound to reads as decoration to a screen reader, and an
 * error rendered in a red paragraph somewhere below is never announced at all.
 * Here `useId` binds all four, so a caller cannot ship the broken version.
 *
 * The error sits under the field that caused it — story 14 — in Spanish, and is
 * announced through `role="alert"` rather than by hoping somebody is looking at
 * the right part of the page.
 *
 * `aria-invalid` is set from the presence of an error rather than passed in, so
 * the visible state and the announced state cannot disagree.
 */

interface Props
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "className" | "aria-invalid" | "aria-describedby"
  > {
  etiqueta: string;
  /** Shown under the label, before anything is typed. */
  ayuda?: string;
  error?: string | null;
}

export default function Campo({
  etiqueta,
  ayuda,
  error,
  id: idDado,
  ...resto
}: Props) {
  // A caller may name the field when it needs to move focus to it — "Guardar y
  // agregar otra" does. Everything derived from the id follows whichever it is,
  // so supplying one cannot half-wire the label or the error.
  const idGenerado = useId();
  const id = idDado ?? idGenerado;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  const descrito = [ayuda ? idAyuda : null, error ? idError : null]
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

      <input
        {...resto}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito || undefined}
        className={
          "min-h-12 w-full rounded-control border-2 bg-papel px-3 text-base text-tinta " +
          (error ? "border-peligro" : "border-borde-fuerte")
        }
      />

      {error && (
        <p
          id={idError}
          role="alert"
          className="flex items-start gap-2 text-base font-semibold text-peligro"
        >
          {/* The glyph carries the same message as the colour, for anyone who
              cannot use the red. */}
          <span aria-hidden>✕</span>
          {error}
        </p>
      )}
    </div>
  );
}
