import type { CurrentUser } from "@/modules/user/user.types";

/**
 * Logs an authorization refusal — user story 19.
 *
 * What is recorded is a *place*, not a person. Referentes Locales share one
 * login per territory (confirmed with the user on 2026-07-25), so the usuario id
 * identifies the territory that holds the credentials and nothing narrower.
 * Nothing in this log, and nothing written about it, may claim to identify who
 * was sitting at the keyboard.
 *
 * Nothing about the requested record is logged beyond its territory: the whole
 * point of the refusal is that this Actor may not see that record's contents,
 * and a log line is not an exemption.
 */
export function registrarDenegacion(datos: {
  actor: Pick<CurrentUser, "id" | "role" | "diocesisLocalidadId">;
  /** The service method that refused, e.g. `PeregrinaService.update`. */
  operacion: string;
  /** The territory the Actor tried to reach, when the refusal was territorial. */
  territorioSolicitado?: string | null;
  motivo: string;
}): void {
  console.warn(
    "[autorizacion-denegada]",
    JSON.stringify({
      operacion: datos.operacion,
      motivo: datos.motivo,
      rol: datos.actor.role,
      // Territorio del login, no de una persona.
      territorioDelActor: datos.actor.diocesisLocalidadId,
      territorioSolicitado: datos.territorioSolicitado ?? null,
      usuarioId: datos.actor.id,
    })
  );
}
