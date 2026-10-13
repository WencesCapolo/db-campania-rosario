import { getMatrimonioByIdAction } from "@/modules/misionero/matrimonio.router";
import Volver from "@/components/Volver";
import { nombreDeTenedor } from "@/lib/formato";
import EditarMatrimonioForm from "./EditarMatrimonioForm";

/**
 * Corregir los datos de un Matrimonio. La lectura no va en un try: una negativa
 * la agarra `error.tsx`, igual que en la ficha.
 */

export const dynamic = "force-dynamic";

export default async function EditarMatrimonioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matrimonio = await getMatrimonioByIdAction(id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href={`/matrimonio/${matrimonio.id}`}>
          Volver a {nombreDeTenedor({ tipo: "matrimonio", matrimonio })}
        </Volver>
        <h1 className="text-3xl font-bold text-tinta">Editar sus datos</h1>
      </div>

      <EditarMatrimonioForm matrimonio={matrimonio} />
    </main>
  );
}
