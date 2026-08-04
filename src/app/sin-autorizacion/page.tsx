import Link from "next/link";
import Mensaje from "@/components/Mensaje";
import { auth } from "@/lib/auth/server";
import {
  CUENTA_DADA_DE_BAJA,
  SIN_AUTORIZACION,
  SIN_TERRITORIO_ASIGNADO,
} from "@/lib/errors";

/**
 * Where an authenticated person lands when they have no Usuario.
 *
 * This page exists because the alternative was worse: the baseline used to
 * create a `referente_local` row for anybody Neon Auth would issue a session
 * for, so authentication was enough to be authorized. Now they get told, in
 * Spanish, that provisioning is deliberate and who to ask.
 *
 * Outside the (dashboard) group on purpose — that layout calls getCurrentUser(),
 * and a page about not having an Actor cannot require one. That also means it
 * gets no shell, so it carries its own `<main>` and its own width.
 *
 * `aviso` rather than `alerta`: nothing is broken, and the second paragraph is
 * the whole point of the screen — an account that does not exist yet is the
 * system working. Red on arrival would say otherwise.
 *
 * ─── Con qué dirección entraste ──────────────────────────────────────────────
 *
 * La pantalla dice la dirección de la sesión, y eso no es un adorno: es lo que
 * vuelve diagnosticables los dos modos de falla que ADR 0011 aceptó a ojos
 * abiertos. Entrar es un enlace al Buzón y una Invitación se empareja por email y
 * nada más, así que una dirección que no es la invitada llega hasta acá con todo
 * en orden y sin nada que leer. Los dos casos son cotidianos: el Gmail equivocado
 * de un teléfono con tres cuentas encima (historia 37), y el punto de más que
 * alguien escribió a mano (historia 38). Ver la dirección propia resuelve los dos
 * sin una llamada por teléfono.
 *
 * La sesión se lee directo del proveedor y no por `getCurrentUser`, que es la
 * misma razón por la que esta página vive afuera del grupo `(dashboard)`: una
 * pantalla sobre no tener Actor no puede pedir uno.
 */

const MENSAJES: Record<string, string> = {
  "sin-usuario": SIN_AUTORIZACION,
  "dado-de-baja": CUENTA_DADA_DE_BAJA,
  "sin-territorio": SIN_TERRITORIO_ASIGNADO,
};

export const dynamic = "force-dynamic";

export default async function SinAutorizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const mensaje = MENSAJES[motivo ?? ""] ?? SIN_AUTORIZACION;

  const { data: sesion } = await auth.getSession();
  const direccion = sesion?.user?.email ?? null;

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 py-6">
      <h1 className="text-3xl font-bold text-tinta">Todavía no tenés acceso</h1>

      <Mensaje tono="aviso">
        <p>{mensaje}</p>
      </Mensaje>

      {direccion && (
        <div className="space-y-2 rounded-control border-2 border-borde bg-fondo p-4">
          <p className="text-base text-tinta-suave">Entraste con</p>
          {/* La dirección, entera y sin cortar. `break-all` porque un correo
              largo en un teléfono de 390 px se sale de la tarjeta, y la mitad de
              una dirección no sirve para darse cuenta de nada. */}
          <p className="text-base font-bold break-all text-tinta">
            {direccion}
          </p>
          <p className="text-base leading-relaxed text-tinta-suave">
            Si no es la dirección que te invitaron, cerrá la sesión y volvé a
            entrar con esa. La invitación queda esperando: no se pierde.
          </p>
        </div>
      )}

      <p className="text-base leading-relaxed text-tinta-suave">
        Esto no es un error del sistema: los accesos se dan de uno en uno, a
        propósito, para que la información de la Campaña quede con quien tiene
        que estar.
      </p>

      <p>
        <Link
          href="/auth/sign-out"
          className="inline-flex min-h-12 items-center text-base font-semibold text-accion underline"
        >
          Cerrar sesión
        </Link>
      </p>
    </main>
  );
}
