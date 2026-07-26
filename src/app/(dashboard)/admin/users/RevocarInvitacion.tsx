"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revocarInvitacionAction } from "@/modules/invitacion/invitacion.router";

/**
 * Revoking a pending invitation — user story 14: a mistake must not become an
 * account.
 *
 * No confirmation step, and that is a judgement rather than an omission: nothing
 * is lost by revoking — the same person can be invited again — and an extra
 * dialog on every row is a tax on the common case. What the button does carry is
 * the email in its label, so it is never ambiguous which row is about to change.
 * Plain styling; issue #4 restyles.
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={revocar}
        disabled={pendiente}
        className="min-h-12 rounded-lg border-2 border-neutral-900 px-4 text-lg font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700 disabled:opacity-60"
      >
        {pendiente ? "Revocando…" : `Revocar la invitación de ${email}`}
      </button>

      {error ? (
        <p role="alert" className="text-lg font-semibold text-neutral-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
