import { getCurrentUser } from "@/lib/get-current-user";
import Volver from "@/components/Volver";
import CrearMisioneroForm from "./CrearMisioneroForm";

/**
 * Cargar un Misionero.
 *
 * `getCurrentUser()` is awaited and its result unused on purpose: it is what
 * turns an anonymous request into a redirect to sign-in, and an authenticated
 * request with no Usuario into /sin-autorizacion. Whether this particular Actor
 * may create a Misionero is `MisioneroService.create`'s question, asked again
 * when the form posts — the page does not answer it a second time and worse.
 */

export const dynamic = "force-dynamic";

export default async function NuevoMisioneroPage() {
  await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href="/misionero">Volver a Misioneros</Volver>
        <h1 className="text-3xl font-bold text-tinta">Cargar un Misionero</h1>
        <p className="text-base leading-relaxed text-tinta-suave">
          Una persona de la Campaña. No entra al sistema ni tiene contraseña: es
          quien puede tener una imagen a cargo.
        </p>
      </div>

      <CrearMisioneroForm />
    </main>
  );
}
