import Link from "next/link";
import { getOpcionesParaAsignarAction } from "@/modules/asignacion/asignacion.router";
import FlujoDeAsignacion from "./FlujoDeAsignacion";

/**
 * Entregar una Peregrina — historias 21 y 22.
 *
 * The read is not wrapped in a try: a refusal belongs to the (dashboard) error
 * boundary, not to an empty picker. A flow that offered nothing because the Actor
 * was unauthorized would look like a territory with no Misioneros in it.
 */

export const dynamic = "force-dynamic";

export default async function NuevaAsignacionPage() {
  const { misioneros, peregrinas } = await getOpcionesParaAsignarAction();

  return (
    <div className="space-y-6 p-6 text-lg">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">
          Entregar una imagen
        </h1>
        <p className="text-lg text-neutral-700">
          Registrá que una Peregrina pasó a un Misionero. Si ya la tiene otra
          persona, se cierra su período y queda en el historial.
        </p>
      </div>

      <FlujoDeAsignacion misioneros={misioneros} peregrinas={peregrinas} />

      <Link
        href="/peregrina"
        className="inline-flex min-h-12 items-center text-lg font-semibold text-neutral-900 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
      >
        Volver a Peregrinas
      </Link>
    </div>
  );
}
