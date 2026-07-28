import { getCurrentUser } from "@/lib/get-current-user";
import Volver from "@/components/Volver";
import CreatePeregrinaForm from "./CreatePeregrinaForm";

export const dynamic = "force-dynamic";

export default async function NuevaPeregrinaPage() {
  await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href="/peregrina">Volver a Peregrinas</Volver>
        <h1 className="text-3xl font-bold text-tinta">
          Registrar una Peregrina
        </h1>
      </div>

      <CreatePeregrinaForm />
    </main>
  );
}
