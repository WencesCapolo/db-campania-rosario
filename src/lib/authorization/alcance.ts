import {
  FUERA_DE_TERRITORIO,
  NoAutorizadoError,
  SIN_TERRITORIO_ASIGNADO,
} from "@/lib/errors";
import { registrarDenegacion } from "./registro";
import type { Role } from "@/modules/user/user.schema";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * The one place a rol becomes a territorial filter — issue #2's decision table:
 *
 *   admin, asesor_nacional  → no territorial restriction
 *   responsable_diocesano   → restricted to their Diócesis/Localidad
 *   referente_local         → restricted to their Diócesis/Localidad
 *
 * The two lower rols scope to the same level. They stay distinct because they
 * differ in what they may *do* — invite Usuarios, edit the territory list — not
 * in what they may see. Collapsing them would have to be undone the first time
 * the Campaña wants a narrower local scope.
 *
 * Services derive an `Alcance` here and hand it to their repository. They do not
 * write filters of their own, so there is no second definition of "my
 * territory" to drift out of step with this one.
 */

export type Alcance =
  | { readonly tipo: "nacional" }
  | { readonly tipo: "diocesis"; readonly diocesisLocalidadId: string };

/**
 * Reserved for genuinely unscoped work — seeds, migrations, cron — and for the
 * two country-wide rols. Not exported as a convenience: a service that wants it
 * gets it by asking `derivarAlcance` about an Actor who actually has it.
 */
const NACIONAL: Alcance = { tipo: "nacional" };

/** The rols that are country-wide, and therefore carry no territory. */
const ROLES_NACIONALES: readonly Role[] = ["admin", "asesor_nacional"];

export function esNacional(rol: Role): boolean {
  return ROLES_NACIONALES.includes(rol);
}

/**
 * The territorial filter this Actor's reads and writes are bounded by.
 *
 * Fails closed. A `responsable_diocesano` or `referente_local` whose row has no
 * Diócesis/Localidad is refused rather than treated as country-wide: null on a
 * lower rol means "we do not know what they may see", and the safe reading of
 * that is "nothing". `users.diocesis_localidad_id` stays nullable in the schema
 * because the two nacional rols legitimately have none — the invariant is about
 * the pairing of rol and territory, so it is enforced here, where the pair is
 * known, and again in `UserService` whenever a rol or territory is written.
 */
export function derivarAlcance(actor: CurrentUser, operacion: string): Alcance {
  if (esNacional(actor.role)) return NACIONAL;

  if (!actor.diocesisLocalidadId) {
    registrarDenegacion({
      actor,
      operacion,
      motivo: "rol territorial sin Diócesis/Localidad asignada",
    });
    throw new NoAutorizadoError(SIN_TERRITORIO_ASIGNADO);
  }

  return { tipo: "diocesis", diocesisLocalidadId: actor.diocesisLocalidadId };
}

export function dentroDelAlcance(
  alcance: Alcance,
  diocesisLocalidadId: string
): boolean {
  return (
    alcance.tipo === "nacional" ||
    alcance.diocesisLocalidadId === diocesisLocalidadId
  );
}

/**
 * Refuses, loudly, when a record or a destination is outside the Actor's scope.
 *
 * Used by every mutation before it applies anything, so scoping protects writes
 * and not only reads. Both ends are checked on a move: the record being changed
 * and the territory it is being moved to, otherwise a Referente Local could push
 * a record out of their own territory and lose sight of it.
 */
export function exigirDentroDelAlcance(
  actor: CurrentUser,
  alcance: Alcance,
  diocesisLocalidadId: string,
  operacion: string
): void {
  if (dentroDelAlcance(alcance, diocesisLocalidadId)) return;

  registrarDenegacion({
    actor,
    operacion,
    territorioSolicitado: diocesisLocalidadId,
    motivo: "registro fuera del territorio del Actor",
  });
  throw new NoAutorizadoError(FUERA_DE_TERRITORIO);
}
