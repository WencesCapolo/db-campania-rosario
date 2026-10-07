"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revocarInvitacionAction } from "@/modules/invitacion/invitacion.router";
import Boton from "@/components/Boton";
import Mensaje from "@/components/Mensaje";

/**
 * Revoking a pending invitation — user story 14: a mistake must not become an
 * account.
 *
 * No confirmation step, and that is a judgement rather than an omission: nothing
 * is lost by revoking — the same person can be invited again — and an extra
 * dialog on every row is a tax on the common case. It is the one destructive-
 * looking control in the app without a `ConfirmarAccion` behind it, which is
 * exactly why it is worth saying why.
 *
 * What the button does carry is the email in its accessible name, so it is never
 * ambiguous which row is about to change. The visible word is only «Revocar»,
 * because it sits in a row of the Usuarios table whose first cell is that same
 * Buzón, beside «Copiar enlace», and both must fit on one line.
 */
export default function RevocarInvitacion({
  id,
  email,
}: {
  id: string;
  email: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function revocar() {
    setError(null);
    iniciar(async () => {
      const resultado = await revocarInvitacionAction(id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Boton
        tono="peligro"
        compacto
        aria-label={`Revocar la invitación de ${email}`}
        onClick={revocar}
        disabled={pendiente}
      >
        {pendiente ? "Revocando…" : "Revocar"}
      </Boton>

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}
    </div>
  );
}
