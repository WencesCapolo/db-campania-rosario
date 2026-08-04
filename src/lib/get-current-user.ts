import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { UserService } from "@/modules/user/user.service";
import { InvitacionService } from "@/modules/invitacion/invitacion.service";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * getCurrentUser()
 *
 * Resolves the Actor for the current request, or sends the person somewhere that
 * explains why there isn't one.
 *
 * Flow:
 *  1. Ask Neon Auth for the authenticated session. No session → sign-in.
 *  2. Resolve the application-level Usuario. This is where the rol and the
 *     territory come from — never from the auth provider (ADR 0002).
 *  3. No Usuario yet? Look for a pending invitation for that email and accept
 *     it. This is the *only* way a Usuario comes into existence: somebody with
 *     authority issued the invitation earlier, so the privilege is theirs and
 *     not the stranger's.
 *  4. Still nothing → `/sin-autorizacion`. Not a rol, not a default, not
 *     "referente_local so the app is never broken". An authenticated identity
 *     with no application record is unauthorized, which is user story 12 and the
 *     security-relevant half of issue #2.
 *
 * This function is composition, not policy: steps 2 and 3 are service calls, and
 * every rule they enforce is tested through them rather than through here.
 *
 * Usage (server component or server action):
 *   const actor = await getCurrentUser();
 *   const actor = await getCurrentUser({ optional: true }); // null, no redirect
 */
export async function getCurrentUser(): Promise<CurrentUser>;
export async function getCurrentUser(opts: {
  optional: true;
}): Promise<CurrentUser | null>;
export async function getCurrentUser(opts?: {
  optional?: boolean;
}): Promise<CurrentUser | null> {
  // ── 1. Neon Auth session ──────────────────────────────────────────────────
  const { data: session } = await auth.getSession();
  const authUser = session?.user;

  if (!authUser) {
    if (opts?.optional) return null;
    redirect("/auth/sign-in");
  }

  const identidad = {
    id: authUser.id,
    email: authUser.email ?? "",
    displayName: authUser.name ?? null,
  };

  // ── 2. The application-level Usuario ──────────────────────────────────────
  const existente = await UserService.resolverActorSiExiste(identidad);
  if (existente) return existente;

  // ── 3. A pending invitation, accepted on first sign-in ────────────────────
  const invitado = await InvitacionService.aceptarSiHayPendiente(identidad);
  if (invitado) return invitado;

  // ── 4. Refused, with the reason ────────────────────────────────────────────
  if (opts?.optional) return null;

  // Which refusal it is — no application row, given de baja, or a territorial
  // rol with no territory. The three send somebody to three different people, so
  // the page is told which one rather than saying "no anduvo".
  const motivo =
    (await UserService.motivoDeRefusa(identidad.id)) ?? "sin-usuario";

  console.warn(
    "[autorizacion-denegada]",
    JSON.stringify({
      operacion: "getCurrentUser",
      motivo,
      identidadId: identidad.id,
    })
  );

  redirect(`/sin-autorizacion?motivo=${motivo}`);
}
