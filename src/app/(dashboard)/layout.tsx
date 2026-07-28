import { getCurrentUser } from "@/lib/get-current-user";
import { ROLE_LABELS } from "@/lib/permissions";
import { Barra } from "./barra";

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  const esNacional = user.role === "admin" || user.role === "asesor_nacional";

  const puedeAdministrar = esNacional || user.role === "responsable_diocesano";

  return (
    /* Columna de altura completa: la barra mide lo que mide y el contenido se queda
       con el resto exacto. Es lo que le permite a Inicio centrarse en lo que sobra
       sin restarle a mano la altura de la barra, que además cambia cuando los
       destinos se van a un segundo renglón en un teléfono. */
    <div className="flex min-h-screen flex-col">
      {/* La barra vive en un componente cliente porque marca la ruta actual con
          `usePathname`. El Usuario se resuelve acá, en el servidor, y baja por
          props: la barra no toma ninguna decisión de permisos. */}
      <Barra
        nombre={user.displayName ?? user.email.split("@")[0]}
        rol={ROLE_LABELS[user.role]}
        puedeAdministrar={puedeAdministrar}
        esNacional={esNacional}
      />

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
