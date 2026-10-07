import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  getIdentidadesSinUsuarioAction,
  getUsersAction,
} from "@/modules/user/user.router";
import { getInvitacionesPendientesAction } from "@/modules/invitacion/invitacion.router";
import { ROLE_LABELS, canManageRole, creatableRoles } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";
import type { UserDTO } from "@/modules/user/user.types";
import type { InvitacionDTO } from "@/modules/invitacion/invitacion.types";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import Campo from "@/components/Campo";
import Boton, { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import RevocarInvitacion from "./RevocarInvitacion";
import CopiarEnlaceDeInvitacion from "./CopiarEnlaceDeInvitacion";
import EditarUsuario from "./EditarUsuario";
import BajaDeUsuario from "./BajaDeUsuario";

/**
 * Usuarios e invitaciones.
 *
 * One table of everybody this Actor answers for: who has access, who lost it,
 * and who was invited and has not arrived yet — with a filter between them and
 * a search over Buzón, name and territory. It was cards for a while, and the
 * table came back because the screen is read far more than it is changed: the
 * question is nearly always "is X in, and where", and a column answers that at a
 * glance where a stack of cards makes somebody read every one.
 *
 * What sent it to cards the first time was the phone: four columns needed
 * `overflow-x-auto`, which put the estado off-screen on the device most of these
 * people use, and there was nowhere to put a control. So the table gives up
 * columns rather than scrolling. Below `xl` the buttons sit under the name;
 * below `md` the rol and territory do too; below `sm` the estado. Each one is
 * therefore rendered twice and shown once — a cell's content cannot move to
 * another cell, and a table that scrolls sideways is the bug this replaced.
 * Measured: nothing overflows at 390, 800, 1024 or 1280 px.
 *
 * The name is the large line and the Buzón the small one, because a person is
 * recognised by name. A Usuario with no name on record is their Buzón, large.
 *
 * Filter and search live in the address, like every list's filters, so a
 * filtered view survives a reload and can be sent to somebody. They narrow rows
 * this page already holds: both reads are already scoped by their services, and
 * the counts beside each filter are over those same rows.
 *
 * Whether a row carries controls is decided here, on the server, from the
 * hierarchy — `canManageRole` is strictly-lower, so nobody is offered a button
 * that would only refuse them. The services ask again. What is deliberately not
 * offered is a baja on your own row: `UserService` refuses that, the rule lives
 * there and is not re-implemented here, but there is no reason to render a button
 * whose only possible outcome is that sentence.
 *
 * Identities in the auth provider with no Usuario behind them (user story 17,
 * and the orphan ADR 0002 names) stay a separate card: they are not people this
 * Actor can manage, and a row would suggest otherwise.
 */

export const dynamic = "force-dynamic";

const MOSTRAR = ["todos", "con", "invitados", "sin"] as const;
type Mostrar = (typeof MOSTRAR)[number];

const ETIQUETAS_DE_MOSTRAR: Record<Mostrar, string> = {
  todos: "Todos",
  con: "Con acceso",
  invitados: "Invitados",
  sin: "Sin acceso",
};

// An unrecognised value is a typo in an address, not a request: it falls back
// to everybody rather than to an empty table.
const paramsSchema = z.object({
  mostrar: z.enum(MOSTRAR).catch("todos"),
  buscar: z.string().trim().max(200).catch(""),
});

type Fila =
  | { tipo: "usuario"; usuario: UserDTO }
  | { tipo: "invitacion"; invitacion: InvitacionDTO };

const CELDA = "px-3 py-3 align-top text-base";
const ENCABEZADO = "px-3 py-3 text-left text-base font-bold text-tinta";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentUser();

  // Whoever cannot manage a single rol has no business here.
  if (creatableRoles(actor.role).length === 0 && actor.role !== "admin") {
    notFound();
  }

  const params = await searchParams;
  const { mostrar, buscar } = paramsSchema.parse({
    mostrar: primero(params.mostrar) ?? "todos",
    buscar: primero(params.buscar) ?? "",
  });

  const [usuarios, pendientes, huerfanas] = await Promise.all([
    getUsersAction({ incluirBajas: true }),
    getInvitacionesPendientesAction(),
    esNacional(actor.role)
      ? getIdentidadesSinUsuarioAction()
      : Promise.resolve([]),
  ]);

  const asignables = creatableRoles(actor.role);

  const todas: Fila[] = [
    ...usuarios.map((usuario) => ({ tipo: "usuario" as const, usuario })),
    ...pendientes.map((invitacion) => ({
      tipo: "invitacion" as const,
      invitacion,
    })),
  ].sort(porTerritorioYRango);

  const buscadas = buscar
    ? todas.filter((f) =>
        normalizar(textoBuscable(f)).includes(normalizar(buscar)),
      )
    : todas;
  const filas = buscadas.filter(
    (f) => grupoDe(f) === mostrar || mostrar === "todos",
  );

  const cuenta = (m: Mostrar) =>
    m === "todos"
      ? buscadas.length
      : buscadas.filter((f) => grupoDe(f) === m).length;

  const hrefDe = (m: Mostrar, b: string = buscar) => {
    const query = new URLSearchParams();
    if (m !== "todos") query.set("mostrar", m);
    if (b) query.set("buscar", b);
    const qs = query.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  const acciones = (f: Fila) => {
    if (f.tipo === "invitacion") {
      return (
        <div className="flex flex-nowrap items-start gap-2">
          <CopiarEnlaceDeInvitacion buzon={f.invitacion.email} compacto />
          <RevocarInvitacion id={f.invitacion.id} email={f.invitacion.email} />
        </div>
      );
    }

    const u = f.usuario;
    if (!canManageRole(actor.role, u.role)) return null;

    return (
      <div className="flex flex-nowrap gap-2">
        <EditarUsuario
          id={u.id}
          email={u.email}
          rolActual={u.role}
          diocesisLocalidadIdActual={u.diocesisLocalidad?.id ?? null}
          rolesDisponibles={asignables}
        />

        {u.id !== actor.id && (
          <BajaDeUsuario id={u.id} email={u.email} deBaja={u.deBaja} />
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Usuarios</h1>
          <p className="mt-1 text-base text-tinta-suave">
            {usuarios.length === 1
              ? "1 usuario"
              : `${usuarios.length} usuarios`}{" "}
            en tu territorio
          </p>
        </div>

        <BotonEnlace href="/admin/users/new">Invitar a alguien</BotonEnlace>
      </div>

      {todas.length === 0 ? (
        <Vacio
          titulo="Todavía no hay usuarios en tu territorio"
          mensaje="Los accesos se dan de uno en uno, por invitación. Nadie se registra por su cuenta."
          accion={
            <BotonEnlace href="/admin/users/new">Invitar a alguien</BotonEnlace>
          }
        />
      ) : (
        <section
          aria-labelledby="titulo-personas"
          className="overflow-hidden rounded-tarjeta border-2 border-borde bg-papel"
        >
          <h2 id="titulo-personas" className="sr-only">
            Personas
          </h2>

          <div className="space-y-4 border-b-2 border-borde px-5 py-4">
            {/* Links and not radios: each one is an address, so it works with
                no script, and the one showing says so in a word and a glyph as
                well as in its fill. */}
            <nav aria-label="Mostrar" className="flex flex-wrap gap-2">
              {MOSTRAR.map((m) => {
                const elegido = m === mostrar;
                return (
                  <Link
                    key={m}
                    href={hrefDe(m)}
                    aria-current={elegido ? "true" : undefined}
                    className={
                      "inline-flex min-h-12 items-center gap-2 rounded-control border-2 border-borde-fuerte px-4 text-base font-semibold no-underline " +
                      (elegido
                        ? "bg-tinta text-papel"
                        : "bg-papel text-tinta hover:bg-fondo")
                    }
                  >
                    {elegido && <span aria-hidden>✓</span>}
                    {ETIQUETAS_DE_MOSTRAR[m]}
                    <span
                      className={elegido ? "text-papel" : "text-tinta-suave"}
                    >
                      ({cuenta(m)})
                    </span>
                  </Link>
                );
              })}
            </nav>

            <form
              method="get"
              action="/admin/users"
              role="search"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              {mostrar !== "todos" && (
                <input type="hidden" name="mostrar" value={mostrar} />
              )}
              <div className="flex-1">
                <Campo
                  etiqueta="Buscar por Buzón, nombre o territorio"
                  name="buscar"
                  type="search"
                  defaultValue={buscar}
                />
              </div>
              <Boton type="submit" tono="secundario">
                Buscar
              </Boton>
              {buscar && (
                <BotonEnlace tono="secundario" href={hrefDe(mostrar, "")}>
                  Borrar la búsqueda
                </BotonEnlace>
              )}
            </form>

            {pendientes.length > 0 && (
              // Historia 26, dicha una vez y no en cada fila.
              <p className="text-base leading-relaxed text-tinta-suave">
                El enlace de un invitado es la pantalla de entrar con su Buzón
                ya escrito. Mandáselo por donde le hablás: no da acceso por sí
                solo.
              </p>
            )}
          </div>

          <p className="px-5 pt-3 text-base text-tinta-suave">
            {filas.length === 1 ? "1 persona" : `${filas.length} personas`}
          </p>

          {filas.length === 0 ? (
            <div className="space-y-3 px-5 py-6">
              <p className="text-base text-tinta-suave">
                {buscar
                  ? `Nadie coincide con «${buscar}».`
                  : `No hay nadie en «${ETIQUETAS_DE_MOSTRAR[mostrar]}».`}
              </p>
              <BotonEnlace tono="secundario" href="/admin/users">
                Ver a todos
              </BotonEnlace>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="border-b-2 border-borde-fuerte">
                <tr>
                  <th scope="col" className={ENCABEZADO}>
                    Persona
                  </th>
                  <th scope="col" className={`${ENCABEZADO} max-md:hidden`}>
                    Rol y territorio
                  </th>
                  <th scope="col" className={`${ENCABEZADO} max-sm:hidden`}>
                    Estado
                  </th>
                  <th scope="col" className={`${ENCABEZADO} max-xl:hidden`}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const rol =
                    f.tipo === "usuario" ? f.usuario.role : f.invitacion.rol;
                  const lugar = territorio(
                    f.tipo === "usuario"
                      ? f.usuario.diocesisLocalidad
                      : f.invitacion.diocesisLocalidad,
                  );
                  const botones = acciones(f);

                  return (
                    <tr
                      key={`${f.tipo}-${f.tipo === "usuario" ? f.usuario.id : f.invitacion.id}`}
                      className={
                        "border-t-2 border-borde " +
                        (grupoDe(f) === "sin"
                          ? "text-tinta-suave"
                          : "text-tinta")
                      }
                    >
                      {/* A row header, so a screen reader names the person on
                          every button in the row — the buttons' words are short
                          on purpose. */}
                      <th
                        scope="row"
                        className={`${CELDA} text-left font-normal`}
                      >
                        <Persona fila={f} />
                        <span className="mt-1 block text-tinta-suave md:hidden">
                          {ROLE_LABELS[rol]} · {lugar}
                        </span>
                        <span className="mt-2 block sm:hidden">
                          <Estado fila={f} />
                        </span>
                        {botones && (
                          <div className="mt-3 xl:hidden">{botones}</div>
                        )}
                      </th>
                      <td className={`${CELDA} max-md:hidden`}>
                        <span className="block">{ROLE_LABELS[rol]}</span>
                        <span className="block text-tinta-suave">{lugar}</span>
                      </td>
                      <td className={`${CELDA} max-sm:hidden`}>
                        <Estado fila={f} />
                      </td>
                      <td className={`${CELDA} max-xl:hidden`}>{botones}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ── Identidades sin Usuario — historia 17 ── */}
      {huerfanas.length > 0 && (
        <Tarjeta titulo="Identidades sin usuario">
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              Estas personas pueden iniciar sesión en el proveedor pero no
              tienen acceso al sistema. Suele ser un aprovisionamiento a medias:
              o les falta la invitación, o entraron antes de tenerla.
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

function Persona({ fila }: { fila: Fila }) {
  if (fila.tipo === "invitacion") {
    return <Buzon email={fila.invitacion.email} grande />;
  }

  const u = fila.usuario;
  if (u.sinIdentidad) {
    // ADR 0002 declines a foreign key into neon_auth, because Neon migrates that
    // schema beneath us. So somebody deleted from the Neon console leaves this
    // row behind, and the screen has to say so rather than listing an account
    // that cannot be signed into as though it were fine.
    return (
      <>
        <span className="block text-lg font-bold">
          Sin identidad en el proveedor
        </span>
        <span className="block text-tinta-suave">
          No existe en el proveedor de identidad, así que no puede entrar. Suele
          ser alguien borrado desde la consola de Neon.
        </span>
      </>
    );
  }

  if (!u.displayName) return <Buzon email={u.email} grande />;

  return (
    <>
      <span className="block text-lg font-bold">{u.displayName}</span>
      <Buzon email={u.email} />
    </>
  );
}

/** A Buzón may break after its `@`, and nowhere else unless it must. */
function Buzon({ email, grande }: { email: string; grande?: boolean }) {
  const arroba = email.indexOf("@");
  const partes =
    arroba < 0
      ? [email]
      : [email.slice(0, arroba + 1), email.slice(arroba + 1)];

  return (
    <span
      className={
        "block break-words " +
        (grande ? "text-lg font-bold" : "text-tinta-suave")
      }
    >
      {partes[0]}
      {partes[1] !== undefined && (
        <>
          <wbr />
          {partes[1]}
        </>
      )}
    </span>
  );
}

function Estado({ fila }: { fila: Fila }) {
  if (fila.tipo === "invitacion") {
    return <Insignia tono="aviso">Invitado, no entró</Insignia>;
  }
  if (fila.usuario.sinIdentidad) {
    return <Insignia tono="aviso">No puede entrar</Insignia>;
  }
  if (fila.usuario.deBaja) {
    return <Insignia tono="neutro">Sin acceso</Insignia>;
  }
  return <Insignia tono="exito">Con acceso</Insignia>;
}

function grupoDe(f: Fila): Exclude<Mostrar, "todos"> {
  if (f.tipo === "invitacion") return "invitados";
  return f.usuario.deBaja || f.usuario.sinIdentidad ? "sin" : "con";
}

function territorio(d: DiocesisLocalidadDTO | null): string {
  return d ? `${d.nombre}, ${d.provincia.nombre}` : "Todo el país";
}

const RANGO: Record<Role, number> = {
  admin: 0,
  asesor_nacional: 1,
  responsable_diocesano: 2,
  referente_local: 3,
};

// Country-wide first, then by place, then by rank inside a place. The email is
// the last word so the order never depends on how the rows arrived.
function porTerritorioYRango(a: Fila, b: Fila): number {
  const lugar = (f: Fila) =>
    f.tipo === "usuario"
      ? f.usuario.diocesisLocalidad
      : f.invitacion.diocesisLocalidad;
  const rol = (f: Fila) =>
    f.tipo === "usuario" ? f.usuario.role : f.invitacion.rol;
  const email = (f: Fila) =>
    f.tipo === "usuario" ? f.usuario.email : f.invitacion.email;

  const la = lugar(a),
    lb = lugar(b);
  if (!la !== !lb) return la ? 1 : -1;
  return (
    (la && lb ? territorio(la).localeCompare(territorio(lb), "es") : 0) ||
    RANGO[rol(a)] - RANGO[rol(b)] ||
    email(a).localeCompare(email(b), "es")
  );
}

function textoBuscable(f: Fila): string {
  if (f.tipo === "invitacion") {
    return `${f.invitacion.email} ${territorio(f.invitacion.diocesisLocalidad)}`;
  }
  const u = f.usuario;
  return `${u.email} ${u.displayName ?? ""} ${territorio(u.diocesisLocalidad)}`;
}

/** «Río Cuarto» is found by «rio cuarto»: nobody types the accent on a phone. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function esNacional(rol: Role): boolean {
  return rol === "admin" || rol === "asesor_nacional";
}
