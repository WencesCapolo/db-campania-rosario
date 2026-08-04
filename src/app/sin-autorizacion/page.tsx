import Link from "next/link";
import Mensaje from "@/components/Mensaje";
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

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 py-6">
      <h1 className="text-3xl font-bold text-tinta">Todavía no tenés acceso</h1>

      <Mensaje tono="aviso">
        <p>{mensaje}</p>
      </Mensaje>

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
