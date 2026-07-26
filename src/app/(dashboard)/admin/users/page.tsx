import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  getIdentidadesSinUsuarioAction,
  getUsersAction,
} from "@/modules/user/user.router";
import { getInvitacionesPendientesAction } from "@/modules/invitacion/invitacion.router";
import { ROLE_LABELS, creatableRoles } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";
import RevocarInvitacion from "./RevocarInvitacion";

/**
 * Usuarios e invitaciones.
 *
 * Deliberately plain Tailwind. Issue #4 owns the design system and will restyle
 * this; building it beautifully now means paying for it twice. What is
 * load-bearing here is that the screen tells the truth: who has access, who was
 * invited and has not arrived yet, and which identities exist in the auth
 * provider with no Usuario behind them (user story 17, and the orphan ADR 0002
 * names).
 */

export const dynamic = "force-dynamic";

const CELDA = "px-3 py-3 text-left align-top text-lg text-neutral-900";
const ENCABEZADO = "px-3 py-3 text-left text-base font-bold text-neutral-700";

export default async function UsuariosPage() {
  const actor = await getCurrentUser();

  // Whoever cannot manage a single rol has no business here.
  if (creatableRoles(actor.role).length === 0 && actor.role !== "admin") {
    notFound();
  }

  const [usuarios, pendientes, huerfanas] = await Promise.all([
    getUsersAction({ incluirBajas: true }),
    getInvitacionesPendientesAction(),
    esNacional(actor.role)
      ? getIdentidadesSinUsuarioAction()
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10 p-6 text-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Usuarios</h1>
          <p className="text-lg text-neutral-700">
            {usuarios.length === 1 ? "1 usuario" : `${usuarios.length} usuarios`}{" "}
            en tu territorio
          </p>
        </div>

        <Link
          href="/admin/users/new"
          className="inline-flex min-h-12 items-center rounded-lg border-2 border-neutral-900 bg-neutral-900 px-4 text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
        >
          Invitar a alguien
        </Link>
      </div>

      {/* ── Usuarios ── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-neutral-900">Con acceso</h2>

        {usuarios.length === 0 ? (
          <p className="rounded-lg border-2 border-neutral-400 p-4 text-lg text-neutral-700">
            Todavía no hay usuarios en tu territorio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-neutral-400">
                  <th className={ENCABEZADO}>Email</th>
                  <th className={ENCABEZADO}>Rol</th>
                  <th className={ENCABEZADO}>Diócesis/Localidad</th>
                  <th className={ENCABEZADO}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-neutral-300">
                    <td className={CELDA}>
                      {u.email || "— sin identidad —"}
                      {u.displayName ? (
                        <span className="block text-base text-neutral-700">
                          {u.displayName}
                        </span>
                      ) : null}
                    </td>
                    <td className={CELDA}>{ROLE_LABELS[u.role]}</td>
                    <td className={CELDA}>
                      {u.diocesisLocalidad
                        ? `${u.diocesisLocalidad.nombre} (${u.diocesisLocalidad.provincia.nombre})`
                        : "Todo el país"}
                    </td>
                    <td className={CELDA}>
                      {u.deBaja ? "Dado de baja" : "Activo"}
                      {u.sinIdentidad ? (
                        <span className="block text-base font-semibold text-neutral-900">
                          Sin identidad en el proveedor
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Invitaciones pendientes — historia 13 ── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-neutral-900">
          Invitados que todavía no entraron
        </h2>

        {pendientes.length === 0 ? (
          <p className="rounded-lg border-2 border-neutral-400 p-4 text-lg text-neutral-700">
            No hay invitaciones pendientes.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendientes.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-neutral-400 p-4"
              >
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {i.email}
                  </p>
                  <p className="text-base text-neutral-700">
                    {ROLE_LABELS[i.rol]}
                    {i.diocesisLocalidad
                      ? ` — ${i.diocesisLocalidad.nombre}`
                      : " — todo el país"}
                  </p>
                </div>

                <RevocarInvitacion id={i.id} email={i.email} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Identidades sin Usuario — historia 17 ── */}
      {huerfanas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-neutral-900">
            Identidades sin usuario
          </h2>
          <p className="text-lg text-neutral-700">
            Estas personas pueden iniciar sesión en el proveedor pero no tienen
            acceso al sistema. Suele ser un aprovisionamiento a medias.
          </p>
          <ul className="space-y-2">
            {huerfanas.map((i) => (
              <li
                key={i.id}
                className="rounded-lg border-2 border-neutral-400 p-4 text-lg text-neutral-900"
              >
                {i.email ?? i.id}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function esNacional(rol: Role): boolean {
  return rol === "admin" || rol === "asesor_nacional";
}
