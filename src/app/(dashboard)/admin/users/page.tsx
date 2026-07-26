import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  getIdentidadesSinUsuarioAction,
  getUsersAction,
} from "@/modules/user/user.router";
import { getInvitacionesPendientesAction } from "@/modules/invitacion/invitacion.router";
import { ROLE_LABELS, canManageRole, creatableRoles } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import Mensaje from "@/components/Mensaje";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import RevocarInvitacion from "./RevocarInvitacion";
import EditarUsuario from "./EditarUsuario";
import BajaDeUsuario from "./BajaDeUsuario";

/**
 * Usuarios e invitaciones.
 *
 * The screen tells the truth about three different things, which is why it is
 * three sections and not one list: who has access, who was invited and has not
 * arrived yet, and which identities exist in the auth provider with no Usuario
 * behind them (user story 17, and the orphan ADR 0002 names).
 *
 * Cards, not the table this was. Four columns of email, rol, territory and estado
 * is exactly the dense table the audience requirement rules out — it needed
 * `overflow-x-auto` to fit a phone, which means the estado column was off-screen
 * on the device most of these people use. It also had nowhere to put a control:
 * the two things this screen could not do, ending an access and reassigning one,
 * would each have arrived as a fifth and sixth column.
 *
 * Whether a row carries those controls is decided here, on the server, from the
 * hierarchy — `canManageRole` is strictly-lower, so nobody is offered a button
 * that would only refuse them. The services ask again. What is deliberately not
 * offered is a baja on your own row: `UserService` refuses that, the rule lives
 * there and is not re-implemented here, but there is no reason to render a button
 * whose only possible outcome is that sentence.
 */

export const dynamic = "force-dynamic";

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

  const asignables = creatableRoles(actor.role);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Usuarios</h1>
          <p className="mt-1 text-base text-tinta-suave">
            {usuarios.length === 1 ? "1 usuario" : `${usuarios.length} usuarios`}{" "}
            en tu territorio
          </p>
        </div>

        <BotonEnlace href="/admin/users/new">Invitar a alguien</BotonEnlace>
      </div>

      {/* ── Usuarios ── */}
      <Tarjeta titulo="Con acceso">
        {usuarios.length === 0 ? (
          <Vacio
            titulo="Todavía no hay usuarios en tu territorio"
            mensaje="Los accesos se dan de uno en uno, por invitación. Nadie se registra por su cuenta."
            accion={
              <BotonEnlace href="/admin/users/new">
                Invitar a alguien
              </BotonEnlace>
            }
          />
        ) : (
          <ul className="space-y-5">
            {usuarios.map((u) => {
              const administrable = canManageRole(actor.role, u.role);

              return (
                <li
                  key={u.id}
                  className="space-y-3 border-b-2 border-borde pb-5 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-base font-bold text-tinta">
                      {u.email || "Sin identidad en el proveedor"}
                    </p>
                    {u.displayName && (
                      <p className="text-base text-tinta-suave">
                        {u.displayName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Insignia tono={u.deBaja ? "neutro" : "exito"}>
                      {u.deBaja ? "Sin acceso" : "Con acceso"}
                    </Insignia>
                    <Insignia tono="neutro">{ROLE_LABELS[u.role]}</Insignia>
                  </div>

                  <p className="text-base text-tinta-suave">
                    {u.diocesisLocalidad
                      ? `${u.diocesisLocalidad.nombre}, ${u.diocesisLocalidad.provincia.nombre}`
                      : "Todo el país"}
                  </p>

                  {u.sinIdentidad && (
                    // ADR 0002 declines a foreign key into neon_auth, because
                    // Neon migrates that schema beneath us. So somebody deleted
                    // from the Neon console leaves this row behind, and the
                    // screen has to say so rather than listing an account that
                    // cannot be signed into as though it were fine.
                    <Mensaje tono="aviso">
                      <p>
                        Este usuario no existe en el proveedor de identidad, así
                        que no puede entrar. Suele ser alguien borrado desde la
                        consola de Neon.
                      </p>
                    </Mensaje>
                  )}

                  {administrable && (
                    <div className="flex flex-wrap gap-3">
                      <EditarUsuario
                        id={u.id}
                        email={u.email}
                        rolActual={u.role}
                        diocesisLocalidadIdActual={
                          u.diocesisLocalidad?.id ?? null
                        }
                        rolesDisponibles={asignables}
                      />

                      {u.id !== actor.id && (
                        <BajaDeUsuario
                          id={u.id}
                          email={u.email}
                          deBaja={u.deBaja}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      {/* ── Invitaciones pendientes — historia 13 ── */}
      <Tarjeta titulo="Invitados que todavía no entraron">
        {pendientes.length === 0 ? (
          <p className="text-base leading-relaxed text-tinta-suave">
            No hay invitaciones pendientes.
          </p>
        ) : (
          <ul className="space-y-5">
            {pendientes.map((i) => (
              <li
                key={i.id}
                className="space-y-3 border-b-2 border-borde pb-5 last:border-b-0 last:pb-0"
              >
                <p className="text-base font-bold text-tinta">{i.email}</p>
                <p className="text-base text-tinta-suave">
                  {ROLE_LABELS[i.rol]}
                  {i.diocesisLocalidad
                    ? ` — ${i.diocesisLocalidad.nombre}`
                    : " — todo el país"}
                </p>

                <RevocarInvitacion id={i.id} email={i.email} />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* ── Identidades sin Usuario — historia 17 ── */}
      {huerfanas.length > 0 && (
        <Tarjeta titulo="Identidades sin usuario">
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              Estas personas pueden iniciar sesión en el proveedor pero no tienen
              acceso al sistema. Suele ser un aprovisionamiento a medias: o les
              falta la invitación, o entraron antes de tenerla.
            </p>

            <ul className="space-y-2">
              {huerfanas.map((i) => (
                <li key={i.id} className="text-base text-tinta">
                  {i.email ?? i.id}
                </li>
              ))}
            </ul>
          </div>
        </Tarjeta>
      )}
    </main>
  );
}

function esNacional(rol: Role): boolean {
  return rol === "admin" || rol === "asesor_nacional";
}
