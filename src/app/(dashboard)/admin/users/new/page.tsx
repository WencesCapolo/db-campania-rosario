import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { creatableRoles } from "@/lib/permissions";
import Volver from "@/components/Volver";
import InvitarForm from "./InvitarForm";

/**
 * Invitar a un Usuario.
 *
 * The rol list is resolved here, on the server, from the Actor's own rank — plus
 * `admin`, which an admin may hand out to another admin (settled with the user on
 * 2026-07-25). The service checks the same rule again; this only keeps the form
 * from offering what would be refused.
 */

export const dynamic = "force-dynamic";

export default async function InvitarPage() {
  const actor = await getCurrentUser();

  const disponibles = creatableRoles(actor.role);
  const roles =
    actor.role === "admin" ? (["admin", ...disponibles] as const) : disponibles;

  if (roles.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href="/admin/users">Volver a Usuarios</Volver>
        <h1 className="text-3xl font-bold text-tinta">Invitar a alguien</h1>
        <p className="text-base leading-relaxed text-tinta-suave">
          La invitación no se envía por correo: quedás vos avisándole. Cuando
          entre con ese email, el acceso ya va a estar esperándola.
        </p>
      </div>

      <InvitarForm rolesDisponibles={[...roles]} />
    </main>
  );
}
