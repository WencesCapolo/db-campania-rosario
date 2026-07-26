"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Diálogo — a modal, on the native `<dialog>` element.
 *
 * Opened with `showModal()`, which is the whole reason this is not a styled
 * `div`. The browser then owns focus trapping, Escape, focus restoration to the
 * trigger, scroll locking, the backdrop, and the `dialog` role a screen reader
 * announces — stories 7, 8 and 9. A hand-rolled modal typically gets several of
 * those wrong and nobody notices, because everything looks fine with a mouse.
 *
 * What this adds is only what the platform leaves out:
 *
 *  - The trigger is rendered here, so a dialog cannot exist with nothing to open
 *    it and `showModal()` is never called on a null ref.
 *  - Escape is a *cancel*. The platform fires one `close` event for Escape and
 *    for `close()` alike, so a caller treating every close as a confirmation
 *    would let Escape confirm a destructive action. Which one it was is carried
 *    in `returnValue` — the platform's own channel for exactly this, set by
 *    `close("confirmado")` and left empty by Escape and by the backdrop. It is
 *    read in the event handler, so there is no ref and no second source of
 *    truth to fall out of step, and `showModal()` clears it on the way in.
 *  - Clicking the backdrop closes it. The platform routes backdrop clicks to the
 *    dialog element itself, so the test is whether the click landed on the
 *    element rather than inside its content.
 *  - `aria-labelledby` points at the title, so what gets announced is the
 *    question being asked and not the word "dialog".
 *
 * Deliberately absent: any focus management of our own. Every line of it would
 * be a worse version of something `showModal()` already did, and the second
 * implementation is the one that breaks.
 */

const CONFIRMADO = "confirmado";

export interface ControlDeDialogo {
  abrir: () => void;
  cerrar: () => void;
}

export default function Dialogo({
  titulo,
  etiquetaDelDisparador,
  disparador,
  children,
  alCerrar,
}: {
  titulo: string;
  /** Used when `disparador` is omitted — renders a plain secondary button. */
  etiquetaDelDisparador?: string;
  /** Full control over the trigger. Receives the handle that opens the dialog. */
  disparador?: (control: ControlDeDialogo) => React.ReactNode;
  children: (control: ControlDeDialogo) => React.ReactNode;
  /** `cancelado` is true when Escape or the backdrop closed it, not `cerrar`. */
  alCerrar?: (cancelado: boolean) => void;
}) {
  const [elemento, setElemento] = useState<HTMLDialogElement | null>(null);

  // No need to clear `returnValue` first: `showModal()` sets it to the empty
  // string as part of its own steps, so a dialog reopened after a confirmation
  // does not start out looking confirmed.
  const abrir = useCallback(() => elemento?.showModal(), [elemento]);

  const cerrar = useCallback(() => elemento?.close(CONFIRMADO), [elemento]);

  useEffect(() => {
    if (!elemento || !alCerrar) return;
    const alCerrarse = () => alCerrar(elemento.returnValue !== CONFIRMADO);
    elemento.addEventListener("close", alCerrarse);
    return () => elemento.removeEventListener("close", alCerrarse);
  }, [elemento, alCerrar]);

  const control: ControlDeDialogo = { abrir, cerrar };
  const idTitulo = `titulo-${titulo.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <>
      {disparador ? (
        disparador(control)
      ) : (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border-2 border-borde-fuerte bg-papel px-5 text-base font-semibold text-tinta hover:bg-fondo"
        >
          {etiquetaDelDisparador ?? titulo}
        </button>
      )}

      <dialog
        ref={setElemento}
        aria-labelledby={idTitulo}
        onClick={(e) => {
          // The backdrop belongs to the dialog element, so a click landing on
          // the element itself rather than on its content came from outside.
          if (e.target === elemento) elemento?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-tarjeta border-2 border-borde-fuerte bg-papel p-6 text-base text-tinta backdrop:bg-tinta/60"
      >
        <h2 id={idTitulo} className="text-xl font-bold">
          {titulo}
        </h2>
        {children(control)}
      </dialog>
    </>
  );
}
