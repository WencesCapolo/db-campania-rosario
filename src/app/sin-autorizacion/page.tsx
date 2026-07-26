import Link from "next/link";
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
 * and a page about not having an Actor cannot require one.
 *
 * Styled plainly. Issue #4 owns the design system; what matters here is 18px
 * type, contrast, a 48px target and a message that names the next step.
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
    <main className="mx-auto max-w-xl space-y-6 p-6 text-lg">
      <h1 className="text-3xl font-bold text-neutral-900">
        Todavía no tenés acceso
      </h1>

      <p className="text-lg leading-relaxed text-neutral-900">{mensaje}</p>

      <p className="text-lg leading-relaxed text-neutral-700">
        Esto no es un error del sistema: los accesos se dan de uno en uno, a
        propósito, para que la información de la Campaña quede con quien tiene
        que estar.
      </p>

      <Link
        href="/handler/sign-out"
        className="inline-flex min-h-12 items-center rounded-lg border-2 border-neutral-900 px-4 text-lg font-semibold text-neutral-900 underline focus-visible:border-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
      >
        Cerrar sesión
      </Link>
    </main>
  );
}
