import { getPeregrinaByIdAction } from "@/modules/peregrina/peregrina.router";
import Volver from "@/components/Volver";
import EditarPeregrinaForm from "./EditarPeregrinaForm";

/**
 * Corregir los datos de una Peregrina. La lectura no va en un try: una negativa
 * la agarra `error.tsx`, igual que en la ficha.
 */

export const dynamic = "force-dynamic";

export default async function EditarPeregrinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const peregrina = await getPeregrinaByIdAction(id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href={`/peregrina/${peregrina.id}`}>
          Volver a <span className="font-mono">{peregrina.identificacion}</span>
        </Volver>
        <h1 className="text-3xl font-bold text-tinta">Editar sus datos</h1>
      </div>

      <EditarPeregrinaForm peregrina={peregrina} />
    </main>
  );
}
