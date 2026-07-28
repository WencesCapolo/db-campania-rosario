"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { invitarAction } from "@/modules/invitacion/invitacion.router";
import { invitarSchema } from "@/modules/invitacion/invitacion.types";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import { ROLE_LABELS, llevaTerritorio } from "@/lib/permissions";
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
 * `llevaTerritorio` comes from `lib/permissions` now rather than from a
 * `CON_TERRITORIO` array in this file. `EditarUsuario` needs the same question
 * answered, and a rol added to the enum but missed in one of two copies of that
 * list produces a Usuario with no territory — which `derivarAlcance` then refuses
 * on every request. A form that successfully creates an account nobody can use is
 * a worse failure than one that will not submit.
 *
 * On the primitives, and one thing that was wrong is fixed rather than restyled:
 * the failure and the confirmation were both `text-neutral-900` paragraphs, so
 * "ese email ya tiene acceso" and "listo, ya puede entrar" were the same
 * sentence in the same colour in the same place. Only the ARIA role told them
 * apart, which helped precisely the users who were not looking at it.
 */
export default function InvitarForm({
  rolesDisponibles,
}: {
  rolesDisponibles: Role[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Role>(
    rolesDisponibles[rolesDisponibles.length - 1] ?? "referente_local",
  );
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [invitado, setInvitado] = useState<string | null>(null);

  // An email typed wrong is the failure this form is most likely to produce, and
  // "Escribí un email válido" after pressing Invitar is a round trip for a missing
  // dot. Checked as the field is left, against the schema the router parses.
  const validacion = useValidacionAlSalir(invitarSchema);

  const necesitaTerritorio = llevaTerritorio(rol);

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
      validacion.limpiar();
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="max-w-xl space-y-6">
      {invitado && (
        <Mensaje tono="exito">
          <p>
            Listo: <strong>{invitado}</strong> ya puede entrar. Va a quedar en
            «Invitados que todavía no entraron» hasta que lo haga.
          </p>
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <Campo
        etiqueta="Email de la persona"
        ayuda="Va a poder entrar con este email. Nadie se registra por su cuenta."
        type="email"
        autoComplete="email"
        required
        value={email}
        error={validacion.error("email")}
        onChange={(e) => {
          setEmail(e.target.value);
          validacion.alEscribir("email");
        }}
        onBlur={(e) => validacion.alSalir("email", e.target.value)}
      />

      <Eleccion
        etiqueta="Rol"
        value={rol}
        opciones={rolesDisponibles.map((r) => ({
          valor: r,
          etiqueta: ROLE_LABELS[r],
        }))}
        onChange={(e) => setRol(e.target.value as Role)}
      />

      {necesitaTerritorio ? (
        <SelectorDeTerritorio
          value={diocesisLocalidadId}
          onChange={setDiocesisLocalidadId}
        />
      ) : (
        <Mensaje tono="neutro">
          <p>
            Este rol cubre todo el país, así que no lleva Diócesis/Localidad.
          </p>
        </Mensaje>
      )}

      <Boton type="submit" anchoCompleto disabled={enviando}>
        {enviando ? "Invitando…" : "Invitar"}
      </Boton>
    </form>
  );
}
