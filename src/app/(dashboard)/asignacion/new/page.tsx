import { getOpcionesParaAsignarAction } from "@/modules/asignacion/asignacion.router";
import Volver from "@/components/Volver";
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
  const { tenedores, peregrinas } = await getOpcionesParaAsignarAction();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href="/peregrina">Volver a Peregrinas</Volver>
        <h1 className="text-3xl font-bold text-tinta">Entregar una imagen</h1>
        <p className="text-base leading-relaxed text-tinta-suave">
          Registrá que una Peregrina pasó a un Misionero o a un Matrimonio. Si
          ya la tiene otro, se cierra su período y queda en el historial.
        </p>
      </div>

      <FlujoDeAsignacion tenedores={tenedores} peregrinas={peregrinas} />
    </main>
  );
}
