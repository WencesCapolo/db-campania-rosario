import {
  getMatrimonioActivoDeMisioneroAction,
  getMisioneroByIdAction,
} from "@/modules/misionero/misionero.router";
import Volver from "@/components/Volver";
import { nombreCompleto } from "@/lib/formato";
import EditarMisioneroForm from "./EditarMisioneroForm";

/**
 * Corregir los datos de un Misionero.
 *
 * Las lecturas no van en un try: una negativa la agarra `error.tsx`, igual que
 * en la ficha. Quién puede cambiar qué lo decide `MisioneroService.update` cuando
 * el formulario manda.
 */

export const dynamic = "force-dynamic";

export default async function EditarMisioneroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [misionero, matrimonioId] = await Promise.all([
    getMisioneroByIdAction(id),
    getMatrimonioActivoDeMisioneroAction(id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href={`/misionero/${misionero.id}`}>
          Volver a {nombreCompleto(misionero)}
        </Volver>
        <h1 className="text-3xl font-bold text-tinta">Editar sus datos</h1>
      </div>

      <EditarMisioneroForm misionero={misionero} casado={matrimonioId !== null} />
    </main>
  );
}
