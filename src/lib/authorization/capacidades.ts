import { NoAutorizadoError } from "@/lib/errors";
import { registrarDenegacion } from "./registro";
import type { Role } from "@/modules/user/user.schema";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad } from "@/modules/peregrina/peregrina.schema";

/**
 * What a rol may *do*, as opposed to what it may see — ADR 0016.
 *
 * Every rol sees the whole country. They differ in two things only:
 *
 *   admin, asesor_nacional  → configure: Usuarios, Invitaciones, Territorio
 *   responsable_diocesano   → load records of every Modalidad
 *   dirigente_joven         → load records of the JOV Modalidad
 *
 * The Modalidad bound is a bound on *writes*. A Dirigente Joven reads every
 * Peregrina, figure and Misionero like anybody else — a Misionero has no
 * Modalidad, and hiding the other images would leave holes in every history
 * without protecting anything from people the Campaña trusts.
 */

const ROLES_QUE_CONFIGURAN: readonly Role[] = ["admin", "asesor_nacional"];

/** Usuarios, Invitaciones and the territory list. Loading records is not this. */
export function configura(rol: Role): boolean {
  return ROLES_QUE_CONFIGURAN.includes(rol);
}

/** The one Modalidad a rol is bound to, or null when it loads all of them. */
export function modalidadPropia(rol: Role): Modalidad | null {
  return rol === "dirigente_joven" ? "JOV" : null;
}

/**
 * The query string an Actor's lists open with: their own Modalidad, or nothing.
 * A starting point and not a bound — clearing it shows everything, because
 * reads are not restricted.
 */
export function filtroPropio(rol: Role): string {
  const propia = modalidadPropia(rol);
  return propia ? `?modalidad=${propia}` : "";
}

export function cargaLaModalidad(rol: Role, modalidad: Modalidad): boolean {
  const propia = modalidadPropia(rol);
  return propia === null || propia === modalidad;
}

/**
 * Refuses a write on a Peregrina outside the Actor's Modalidad.
 *
 * Called with every Modalidad the write touches — on an edit, the one the image
 * has *and* the one it is being given, or a Dirigente Joven could move a JOV
 * image to FAM and lose it, or pull a FAM image into JOV.
 */
export function exigirModalidad(
  actor: CurrentUser,
  modalidad: Modalidad,
  operacion: string
): void {
  if (cargaLaModalidad(actor.role, modalidad)) return;

  registrarDenegacion({
    actor,
    operacion,
    motivo: `Peregrina de la Modalidad ${modalidad}, fuera de la del rol`,
  });
  throw new NoAutorizadoError(
    "Tu usuario carga sólo Peregrinas de la Modalidad Jóvenes."
  );
}
