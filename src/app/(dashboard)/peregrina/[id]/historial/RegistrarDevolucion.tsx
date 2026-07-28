"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devolverAction } from "@/modules/asignacion/asignacion.router";
import Boton from "@/components/Boton";
import Dialogo from "@/components/Dialogo";
import AreaDeTexto from "@/components/AreaDeTexto";
import Mensaje from "@/components/Mensaje";

/**
 * Registrar que una Peregrina volvió, sin entregarla a nadie más — historia 3.
 *
 * A separate control from the assignment flow because it is a different fact: the
 * image is held centrally now. The previous system could only express this by
 * blanking a pointer, which read as "never had a Misionero".
 *
 * This was the hand-rolled `<dialog>` that `Dialogo` was generalised from, which
 * is why it is rewritten onto it rather than restyled. Two things it could not
 * do:
 *
 *  - It called `close()` for Cancel and got `close()` from Escape, with no way to
 *    tell them apart. Everything that should happen on the way out therefore
 *    happened on neither path or on both.
 *  - It kept the note in state between openings. Open it, type half a note, press
 *    Escape, open it again — and the half a note was still sitting there,
 *    attached to a devolución somebody had already decided not to register.
 *
 * `alCerrar` fires on every way out, and clears.
 *
 * `ConfirmarAccion` was the near miss. It is the right shape — a consequential
 * action behind a dialog that names its subject — but it takes no input, and this
 * one has a note that belongs to the moment of returning ("quedó en la casa
 * diocesana"). Giving `ConfirmarAccion` a slot for one caller would turn the
 * confirmation dialog into a form container for every caller.
 */
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
  const [pendiente, empezar] = useTransition();
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialogo
      titulo="Registrar devolución"
      alCerrar={() => {
        setNota("");
        setError(null);
      }}
      disparador={(control) => (
        <Boton tono="secundario" onClick={control.abrir}>
          Registrar devolución
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            La Peregrina <strong className="font-mono">{codigo}</strong> deja de
            estar a cargo de <strong>{misionero}</strong>. Su período queda en
            el historial.
          </p>

          {error && (
            <div className="mt-4">
              <Mensaje tono="alerta">
                <p>{error}</p>
              </Mensaje>
            </div>
          )}

          <div className="mt-4">
            <AreaDeTexto
              etiqueta="¿Algo que anotar?"
              ayuda="Opcional. Dónde quedó la imagen, o en qué estado volvió."
              value={nota}
              maxLength={500}
              contador
              onChange={(e) => setNota(e.target.value)}
              placeholder="Quedó en la casa diocesana."
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Boton
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const resultado = await devolverAction({
                    peregrinaId,
                    notaCierre: nota.trim() || null,
                  });

                  if (!resultado.ok) {
                    setError(resultado.error);
                    return;
                  }

                  control.cerrar();
                  router.refresh();
                })
              }
            >
              {pendiente ? "Registrando…" : "Registrar la devolución"}
            </Boton>

            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={control.cancelar}
            >
              No, volver
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
