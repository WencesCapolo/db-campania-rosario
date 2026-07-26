"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devolverAction } from "@/modules/asignacion/asignacion.router";

/**
 * Registrar que una Peregrina volvió, sin entregarla a nadie más — historia 3.
 *
 * A separate control from the assignment flow because it is a different fact: the
 * image is held centrally now. The previous system could only express this by
 * blanking a pointer, which read as "never had a Misionero".
 *
 * Native `<dialog>`: the browser gives focus trapping, Escape and focus restore for
 * free, and a hand-rolled modal gets at most two of the three right.
 */

const BOTON =
  "min-h-12 rounded-lg px-5 text-lg font-semibold focus-visible:outline-none " +
  "focus-visible:ring-4 focus-visible:ring-blue-700 disabled:opacity-60";

export default function RegistrarDevolucion({
  peregrinaId,
  codigo,
  misionero,
}: {
  peregrinaId: string;
  codigo: string;
  misionero: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<HTMLDialogElement | null>(null);

  function registrar() {
    setError(null);
    startTransition(async () => {
      const resultado = await devolverAction({
        peregrinaId,
        notaCierre: nota.trim() || null,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      dialogo?.close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={`${BOTON} border-2 border-neutral-900 text-neutral-900`}
        onClick={() => dialogo?.showModal()}
      >
        Registrar devolución
      </button>

      <dialog
        ref={setDialogo}
        className="max-w-lg rounded-lg border-2 border-neutral-900 bg-white p-6 text-lg text-neutral-900 backdrop:bg-neutral-900/50"
      >
        <h2 className="text-2xl font-bold">Registrar devolución</h2>
        <p className="mt-2">
          La Peregrina <strong>{codigo}</strong> deja de estar a cargo de{" "}
          <strong>{misionero}</strong>. Su período queda en el historial.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border-2 border-red-800 bg-red-50 p-4 text-red-900"
          >
            {error}
          </p>
        )}

        <label className="mt-4 block font-semibold" htmlFor="nota-devolucion">
          ¿Algo que anotar? (opcional)
        </label>
        <textarea
          id="nota-devolucion"
          className="mt-2 min-h-24 w-full rounded-lg border-2 border-neutral-400 px-3 py-2 focus-visible:border-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
          value={nota}
          maxLength={500}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Quedó en la casa diocesana."
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={`${BOTON} bg-neutral-900 text-white`}
            disabled={pendiente}
            onClick={registrar}
          >
            {pendiente ? "Registrando…" : "Registrar"}
          </button>
          <button
            type="button"
            className={`${BOTON} border-2 border-neutral-900 text-neutral-900`}
            disabled={pendiente}
            onClick={() => dialogo?.close()}
          >
            Cancelar
          </button>
        </div>
      </dialog>
    </>
  );
}
