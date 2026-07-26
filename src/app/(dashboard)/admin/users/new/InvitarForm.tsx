"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { invitarAction } from "@/modules/invitacion/invitacion.router";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";

/**
 * Invitar a alguien — user stories 7 through 11.
 *
 * The rol list is the one the Actor may actually hand out, resolved on the
 * server, so the form cannot offer an escalation the service would refuse. The
 * territory picker appears only for the two territorial rols: an Asesor Nacional
 * covers the country and giving them a Diócesis would imply a bound that does not
 * exist.
 *
 * Plain styling on purpose — issue #4 brings the design system and restyles this
 * rather than rebuilding it. What matters here is 48px controls, focus rings that
 * do not depend on colour, and an error that is announced.
 */

const CAMPO =
  "min-h-12 w-full rounded-lg border-2 border-neutral-400 bg-white px-3 text-lg " +
  "text-neutral-900 focus-visible:outline-none focus-visible:ring-4 " +
  "focus-visible:ring-blue-700 focus-visible:border-blue-700";

const ETIQUETA = "block text-lg font-semibold text-neutral-900";

/** The rols that carry a territory. The other two are country-wide. */
const CON_TERRITORIO: readonly Role[] = [
  "responsable_diocesano",
  "referente_local",
];

export default function InvitarForm({
  rolesDisponibles,
}: {
  rolesDisponibles: Role[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Role>(
    rolesDisponibles[rolesDisponibles.length - 1] ?? "referente_local"
  );
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [invitado, setInvitado] = useState<string | null>(null);

  const necesitaTerritorio = CON_TERRITORIO.includes(rol);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setInvitado(null);

    iniciar(async () => {
      const resultado = await invitarAction({
        email,
        rol,
        diocesisLocalidadId: necesitaTerritorio ? diocesisLocalidadId : null,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setInvitado(resultado.data.email);
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="max-w-xl space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className={ETIQUETA}>
          Email de la persona
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CAMPO}
        />
        <p className="text-base text-neutral-700">
          Va a poder entrar con este email. Nadie se registra por su cuenta.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="rol" className={ETIQUETA}>
          Rol
        </label>
        <select
          id="rol"
          name="rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as Role)}
          className={CAMPO}
        >
          {rolesDisponibles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {necesitaTerritorio ? (
        <SelectorDeTerritorio
          value={diocesisLocalidadId}
          onChange={setDiocesisLocalidadId}
          name="diocesisLocalidadId"
        />
      ) : (
        <p className="text-lg text-neutral-700">
          Este rol cubre todo el país, así que no lleva Diócesis/Localidad.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-lg font-semibold text-neutral-900">
          {error}
        </p>
      ) : null}

      {invitado ? (
        <p role="status" className="text-lg font-semibold text-neutral-900">
          Listo: {invitado} ya puede entrar. Va a quedar en «Invitados que
          todavía no entraron» hasta que lo haga.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="min-h-12 w-full rounded-lg border-2 border-neutral-900 bg-neutral-900 px-4 text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700 disabled:opacity-60"
      >
        {enviando ? "Invitando…" : "Invitar"}
      </button>
    </form>
  );
}
