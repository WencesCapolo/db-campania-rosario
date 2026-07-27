import { getCurrentUser } from "@/lib/get-current-user";
import { ROLE_LABELS } from "@/lib/permissions";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * The shell for everything inside the (dashboard) group.
 *
 * There is no sidebar, and its absence is the decision. Inicio is a hub of three
 * buttons, so a permanent list of every destination would be a second, competing
 * navigation that says the same thing worse — and on a phone it would cost the
 * width the content needs. What is left is the smallest thing that keeps
 * somebody oriented: where they are, and one way back.
 *
 * This used to hang eleven classNames off `dashboard.module.css`, which was a
 * zero-byte file. Every one of them resolved to `undefined`, so the shell had
 * rendered completely unstyled since before issue #1. The file is deleted rather
 * than filled in: Tailwind is the only styling system.
 *
 * On the tokens now. The three things that changed are worth naming, because each
 * was a floor the shell was quietly below: the background and type size were
 * hardcoded here (`bg-neutral-100 text-[18px]`) and so said nothing about the
 * rest of the app — they belong to `body` and to `html`, where every page gets
 * them; the focus ring was `ring-amber-400`, which is 1.8:1 against white and was
 * the one indicator on the screen that failed the 3:1 the rest of the system
 * clears; and the secondary text was `text-neutral-700`, a shade that exists
 * nowhere in the token layer.
 *
 * `getCurrentUser()` redirects to sign-in when there is no session, and to
 * /sin-autorizacion when there is a session but no Usuario.
 *
 * Usuarios is reachable from here rather than from Inicio because Inicio is for
 * the three things a Referente does; administering accounts is not one of them,
 * and only some rols may do it at all. The tablero is here for the same reason and
 * is offered to everybody: every rol has figures, they are just their own.
 */

const ENLACE =
  "inline-flex min-h-12 items-center rounded-control px-3 text-base font-semibold text-accion underline";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  const esNacional = user.role === "admin" || user.role === "asesor_nacional";

  const puedeAdministrar = esNacional || user.role === "responsable_diocesano";

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-borde bg-papel">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center gap-2 rounded-control px-2 text-lg font-bold text-tinta"
          >
            <span aria-hidden>◆</span>
            Campaña del Rosario
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {/* El tablero se llega desde acá y no desde Inicio: Inicio son las tres
                cosas que un Referente vino a hacer, y las cifras no son una de
                ellas — pero son la primera cosa que abre un Responsable
                Diocesano o un Asesor Nacional, así que tienen que estar a un
                toque desde cualquier pantalla. */}
            <Link href="/tablero" className={ENLACE}>
              Tablero
            </Link>

            {puedeAdministrar && (
              <Link href="/admin/users" className={ENLACE}>
                Usuarios
              </Link>
            )}

            {/* Territorio is national work — TerritorioService refuses it below
                asesor_nacional — so the link is not offered to a Responsable
                Diocesano who could only be refused by it. */}
            {esNacional && (
              <Link href="/admin/territorio" className={ENLACE}>
                Territorio
              </Link>
            )}

            <span className="text-base leading-tight">
              <span className="block font-semibold text-tinta">
                {user.displayName ?? user.email.split("@")[0]}
              </span>
              <span className="block text-tinta-suave">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
