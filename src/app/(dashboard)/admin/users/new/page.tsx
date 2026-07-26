import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import { creatableRoles } from "@/lib/permissions";
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
    <div className="space-y-6 p-6 text-lg">
      <div className="space-y-2">
        <Link
          href="/admin/users"
          className="inline-flex min-h-12 items-center text-lg font-semibold text-neutral-900 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
        >
          ← Volver a Usuarios
        </Link>
        <h1 className="text-3xl font-bold text-neutral-900">
          Invitar a alguien
        </h1>
      </div>

      <InvitarForm rolesDisponibles={[...roles]} />
    </div>
  );
}
