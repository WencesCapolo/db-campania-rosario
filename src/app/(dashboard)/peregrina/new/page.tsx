import Link from "next/link";
import { getCurrentUser } from "@/lib/get-current-user";
import CreatePeregrinaForm from "./CreatePeregrinaForm";

export const dynamic = "force-dynamic";

export default async function NuevaPeregrinaPage() {
  await getCurrentUser();

  return (
    <div className="space-y-6 p-6 text-lg">
      <div className="space-y-2">
        <Link
          href="/peregrina"
          className="inline-flex min-h-12 items-center text-lg font-semibold text-neutral-900 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
        >
          ← Volver a Peregrinas
        </Link>
        <h1 className="text-3xl font-bold text-neutral-900">
          Registrar una Peregrina
        </h1>
      </div>

      <CreatePeregrinaForm />
    </div>
  );
}
