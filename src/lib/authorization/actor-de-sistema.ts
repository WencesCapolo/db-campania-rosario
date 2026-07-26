import { UserRepository } from "@/modules/user/user.repository";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * The system Actor — user story 18.
 *
 * Seeds, migrations and scheduled work are genuinely unscoped, and ADR 0001 asks
 * that this be visible at the call site rather than implied by a missing
 * argument. So they pass this, and `seedTerritorio(ACTOR_DE_SISTEMA)` reads as
 * what it is: a deliberate bypass, greppable, one identifier.
 *
 * It is not a back door. There is no session that resolves to this id — the
 * whole flow starts from a Neon Auth identity, and no identity carries this id.
 * It lives in `src/` rather than in the test folder because production code
 * (`pnpm db:seed`) needs it.
 */
export const ID_ACTOR_DE_SISTEMA = "sistema";

export const ACTOR_DE_SISTEMA: CurrentUser = {
  id: ID_ACTOR_DE_SISTEMA,
  role: "admin",
  email: "sistema@campania.local",
  displayName: "Sistema",
  // Country-wide by rol, which is what makes it unscoped. Nothing special-cases
  // this id inside the scope derivation — it is unscoped for the same reason an
  // Asesor Nacional is.
  diocesisLocalidadId: null,
};

/**
 * Creates the `users` row behind the system Actor if it is not there yet.
 *
 * Needed because every entity carries `createdById` as a foreign key, so a seed
 * that writes records needs its Actor to exist as a row. Idempotent.
 */
export async function asegurarActorDeSistema(): Promise<CurrentUser> {
  await UserRepository.upsert({
    id: ID_ACTOR_DE_SISTEMA,
    role: "admin",
    createdById: null,
  });
  return ACTOR_DE_SISTEMA;
}
