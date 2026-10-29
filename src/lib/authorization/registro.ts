import type { CurrentUser } from "@/modules/user/user.types";

/**
 * Logs an authorization refusal — user story 19.
 *
 * What is recorded is a *login*, not a person. A Buzón is shared by everybody
 * who does one function (ADR 0016), so the usuario id identifies that function's
 * login and nothing narrower. Nothing in this log, and nothing written about
 * it, may claim to identify who was sitting at the keyboard.
 *
 * Nothing about the requested record is logged: a log line is not an exemption
 * from what the Actor may not see.
 */
export function registrarDenegacion(datos: {
  actor: Pick<CurrentUser, "id" | "role">;
  /** The service method that refused, e.g. `PeregrinaService.update`. */
  operacion: string;
  motivo: string;
}): void {
  console.warn(
    "[autorizacion-denegada]",
    JSON.stringify({
      operacion: datos.operacion,
      motivo: datos.motivo,
      rol: datos.actor.role,
      usuarioId: datos.actor.id,
    })
  );
}
