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
 * than filled in: Tailwind is the only styling system (issue #4).
 *
 * `getCurrentUser()` redirects to sign-in when there is no session, and to
 * /sin-autorizacion when there is a session but no Usuario.
 *
 * Usuarios is reachable from here rather than from Inicio because Inicio is for
 * the three things a Referente does; administering accounts is not one of them,
 * and only some rols may do it at all.
 */

const ANILLO =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  const puedeAdministrar =
    user.role === "admin" ||
    user.role === "asesor_nacional" ||
    user.role === "responsable_diocesano";

  return (
    <div className="min-h-screen bg-neutral-100 text-[18px] text-neutral-900">
      <header className="border-b-2 border-neutral-300 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Link
            href="/dashboard"
            className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-2 text-lg font-bold ${ANILLO}`}
          >
            <span aria-hidden>◆</span>
            Campaña del Rosario
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {puedeAdministrar && (
              <Link
                href="/admin/users"
                className={`inline-flex min-h-12 items-center rounded-lg px-3 text-lg font-semibold underline ${ANILLO}`}
              >
                Usuarios
              </Link>
            )}

            <span className="text-base leading-tight">
              <span className="block font-semibold">
                {user.displayName ?? user.email.split("@")[0]}
              </span>
              <span className="block text-neutral-700">
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
