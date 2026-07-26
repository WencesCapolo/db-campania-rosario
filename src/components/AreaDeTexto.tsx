"use client";

import { useId } from "react";

/**
 * Área de texto — a labelled `<textarea>`, and the error that belongs to it.
 *
 * `Campo`'s sibling rather than a `multilinea` prop on it, because the two render
 * different elements and a component that switched between `<input>` and
 * `<textarea>` on a boolean would take the union of two attribute sets and accept
 * `type="email"` on a textarea. Everything else is the same on purpose: the same
 * label wiring through `useId`, the same `role="alert"` under the field, the same
 * `aria-invalid` derived from the error rather than passed in.
 *
 * Every use of this is an optional note on an Asignación, so `contador` exists:
 * `maxLength` silently stops accepting characters, and somebody typing a long
 * note on a phone has no way to know why the keyboard went dead. The count is
 * `aria-live="polite"` so it is announced as it approaches the limit rather than
 * on every keystroke.
 */

interface Props
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "aria-invalid" | "aria-describedby"
  > {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  /** Shows "n de maxLength". Requires `maxLength` and `value` to mean anything. */
  contador?: boolean;
}

export default function AreaDeTexto({
  etiqueta,
  ayuda,
  error,
  contador,
  id: idDado,
  ...resto
}: Props) {
  const idGenerado = useId();
  const id = idDado ?? idGenerado;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const idContador = `${id}-contador`;

  const escritos = typeof resto.value === "string" ? resto.value.length : 0;
  const mostrarContador = contador && resto.maxLength !== undefined;

  const descrito = [
    ayuda ? idAyuda : null,
    error ? idError : null,
    mostrarContador ? idContador : null,
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

      <textarea
        {...resto}
        id={id}
        rows={resto.rows ?? 3}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito || undefined}
        className={
          "min-h-24 w-full rounded-control border-2 bg-papel px-3 py-2 text-base text-tinta " +
          (error ? "border-peligro" : "border-borde-fuerte")
        }
      />

      {mostrarContador && (
        <p
          id={idContador}
          aria-live="polite"
          className="text-base text-tinta-suave"
        >
          {escritos} de {resto.maxLength} caracteres
        </p>
      )}

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
