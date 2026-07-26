"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton, { type TonoDeBoton } from "./Boton";
import Dialogo from "./Dialogo";
import type { ActionResult } from "@/lib/action-result";

/**
 * A consequential action, behind a confirmation that names what it will affect.
 *
 * Story 17 asks for two things and the second is the one usually skipped: the
 * dialog must say *what* is about to change, not just ask "are you sure?". So
 * `sujeto` is required: the Peregrina's Código, the Misionero's name, or — on the
 * account screens, and only there — the email an access belongs to.
 *
 * The distinction is worth keeping straight, because Referentes Locales share one
 * login per territory. A sentence that names an account while *attributing* an
 * action names a place and appears to name a person; that is why `registro()`
 * exists and why `RegistroDTO` has no name in it. Administering the account is
 * the one case where the account genuinely is the subject, and the copy there
 * says "el acceso de …" rather than treating the email as somebody's name.
 *
 * The action is passed in rather than chosen here. Whether this Actor may give
 * this record de baja, and whether an open Asignación blocks it, are service
 * questions and are already answered there — a component that re-asked them
 * would be a second, weaker copy of a rule. What comes back is an
 * `ActionResult`, and a refusal is shown in the dialog rather than swallowed,
 * because the most useful refusal here is "no se puede: la imagen está en la
 * casa de alguien", which is a fact the person needs.
 *
 * Escape is a cancel, not a confirm: `Dialogo` distinguishes the two, and this
 * is the screen where getting that wrong would give somebody de baja by
 * keystroke.
 */

export default function ConfirmarAccion({
  etiqueta,
  titulo,
  sujeto,
  consecuencia,
  etiquetaDeConfirmacion,
  tono = "peligro",
  accion,
}: {
  /** The trigger's text — the verb, e.g. "Dar de baja". */
  etiqueta: string;
  /** The dialog's heading, phrased as the question being asked. */
  titulo: string;
  /** What is affected. A Código or a person's name. Never an account. */
  sujeto: string;
  /** What will actually happen, in a sentence. */
  consecuencia: string;
  etiquetaDeConfirmacion?: string;
  tono?: TonoDeBoton;
  accion: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialogo
      titulo={titulo}
      alCerrar={() => setError(null)}
      disparador={(control) => (
        <Boton tono={tono} onClick={control.abrir}>
          {etiqueta}
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            <strong>{sujeto}</strong>. {consecuencia}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-control border-2 border-peligro bg-alerta-fondo p-4 text-base font-semibold text-alerta-tinta"
            >
              <span aria-hidden>✕</span>
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Boton
              tono={tono}
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const resultado = await accion();
                  if (!resultado.ok) {
                    setError(resultado.error);
                    return;
                  }
                  control.cerrar();
                  router.refresh();
                })
              }
            >
              {pendiente
                ? "Guardando…"
                : (etiquetaDeConfirmacion ?? etiqueta)}
            </Boton>

            {/* `cancelar`, not `cerrar`: pressing this means the same thing as
                pressing Escape, and `alCerrar` should hear the same event from
                both. */}
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
