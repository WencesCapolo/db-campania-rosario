import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { UserRepository } from "@/modules/user/user.repository";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * getCurrentUser()
 *
 * Resolves the fully-typed CurrentUser for the current request.
 *
 * Flow:
 *  1. Ask Stack Auth for the authenticated session user.
 *     If there is no session → redirect to /handler/sign-in.
 *  2. Look up the user's app-level row in our `users` table
 *     (which holds the RBAC role).
 *  3. If the user exists in Stack Auth but not yet in our DB
 *     (e.g. first login before the webhook fires), upsert them
 *     as a `referente_local` so the app is never broken.
 *  4. Return a plain CurrentUser object — no Drizzle internals exposed.
 *
 * Usage (server component or server action):
 *   const user = await getCurrentUser();        // throws/redirects if not authed
 *   const user = await getCurrentUser({ optional: true }); // returns null
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
    redirect("/handler/sign-in");
  }

  // ── 2. App-level DB row ────────────────────────────────────────────────────
  let dbUser = await UserRepository.findById(authUser.id);

  // ── 3. First-login upsert (race-safe — onConflictDoNothing) ───────────────
  if (!dbUser) {
    dbUser = await UserRepository.upsert({
      id: authUser.id,
      role: "referente_local", // safe default; admin can promote later
      createdById: null,
    });
  }

  // ── 4. Build and return CurrentUser ────────────────────────────────────────
  return {
    id: dbUser.id,
    role: dbUser.role,
    email: authUser.email ?? "",
    displayName: authUser.name ?? null,
  };
}
