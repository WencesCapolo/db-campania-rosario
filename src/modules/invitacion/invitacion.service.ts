import { InvitacionRepository } from "./invitacion.repository";
import type { InvitacionRow } from "./invitacion.schema";
import type {
  Identidad,
  InvitacionDTO,
  InvitarInput,
} from "./invitacion.types";
import { UserRepository } from "@/modules/user/user.repository";
import { UserService } from "@/modules/user/user.service";
import {
  ROLE_HIERARCHY,
  superaEnRango,
  type Role,
} from "@/modules/user/user.schema";
import type { CurrentUser } from "@/modules/user/user.types";
import { registrarDenegacion } from "@/lib/authorization/registro";
import {
  ConflictoError,
  NoAutorizadoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";

/**
 * InvitacionService
 *
 * Responsibility: provisioning. A Usuario exists because a Usuario of higher
 * rank invited them — nobody self-registers, and nothing defaults an
 * authenticated stranger into a rol.
 *
 * Every method takes the Actor first (ADR 0001). The one exception is `aceptarSiHayPendiente`, which by definition runs for someone
 * who has no Actor yet; it takes an identity instead, and is bounded by the
 * invitation rather than by a rol. That asymmetry is the whole design: the
 * privilege to create a Usuario lives in the invitation record, issued earlier
 * by somebody who did have an Actor.
 */
export class InvitacionService {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  private static toDTO(row: InvitacionRow): InvitacionDTO {
    return {
      id: row.id,
      email: row.email,
      rol: row.rol,
      estado: row.estado,
      invitadaPorId: row.invitadaPorId,
      usuarioId: row.usuarioId,
      createdAt: row.createdAt,
      aceptadaAt: row.aceptadaAt,
      revocadaAt: row.revocadaAt,
    };
  }

  /**
   * Whether `actor` may hand out `rol` — user stories 10 and 11.
   *
   * Strictly lower rank, with one exception the user settled on 2026-07-25: an
   * `admin` is a real person, not a technical account, and an admin may invite
   * another admin. Everyone else is bounded by "strictly below me", so nobody
   * can escalate their own rank, and the two rols that load records — the
   * bottom, sharing one rank — invite nobody at all (ADR 0016).
   */
  private static puedeInvitarRol(actorRol: Role, rol: Role): boolean {
    if (actorRol === "admin") return true;

    return superaEnRango(actorRol, rol);
  }

  /** A rol that can invite somebody may also see the pending list. */
  private static exigirPuedeInvitar(actor: CurrentUser, operacion: string): void {
    const alguno = ROLE_HIERARCHY.some((rol) =>
      InvitacionService.puedeInvitarRol(actor.role, rol)
    );
    if (alguno) return;

    registrarDenegacion({
      actor,
      operacion,
      motivo: "el rol no puede invitar a nadie",
    });
    throw new NoAutorizadoError(
      "Tu rol no puede invitar usuarios. Pedíselo a un Asesor Nacional."
    );
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /** User story 13 — who has been invited and has not signed in yet. */
  static async listarPendientes(actor: CurrentUser): Promise<InvitacionDTO[]> {
    InvitacionService.exigirPuedeInvitar(actor, "InvitacionService.listarPendientes");

    const rows = await InvitacionRepository.findPendientes();
    return rows.map(InvitacionService.toDTO);
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Invites somebody by email — user stories 7 through 11.
   *
   * The invited rol must be one this Actor may hand out. Every rol covers the
   * country (ADR 0016), so an invitation carries a rol and nothing else.
   */
  static async invitar(
    actor: CurrentUser,
    input: InvitarInput
  ): Promise<InvitacionDTO> {
    const operacion = "InvitacionService.invitar";
    InvitacionService.exigirPuedeInvitar(actor, operacion);

    // Normalised here and not only in the Zod schema. An invitation is matched
    // to an identity by email and nothing else, so both sides of that comparison
    // have to be the same string — and the rule belongs to the layer that owns
    // the matching, not to one particular boundary that happens to call it.
    const email = normalizarEmail(input.email);
    if (!email) throw new ValidacionError("El email es obligatorio.");

    if (!InvitacionService.puedeInvitarRol(actor.role, input.rol)) {
      registrarDenegacion({
        actor,
        operacion,
        motivo: `intento de invitar al rol ${input.rol}`,
      });
      throw new NoAutorizadoError(
        "No podés invitar a alguien con ese rol: sólo podés invitar por debajo del tuyo."
      );
    }

    // An invitation whose person already has access is not an invitation.
    const existente = await UserRepository.findPorEmail(email);
    if (existente) {
      throw new ConflictoError(`${email} ya tiene un usuario en el sistema.`);
    }

    const pendiente = await InvitacionRepository.findPendientePorEmail(email);
    if (pendiente) {
      throw new ConflictoError(`Ya hay una invitación pendiente para ${email}.`);
    }

    const row = await InvitacionRepository.create({
      email,
      rol: input.rol,
      invitadaPorId: actor.id,
    });

    return InvitacionService.toDTO(row);
  }

  /** User story 14 — a mistake must not be allowed to become an account. */
  static async revocar(actor: CurrentUser, id: string): Promise<InvitacionDTO> {
    const operacion = "InvitacionService.revocar";
    InvitacionService.exigirPuedeInvitar(actor, operacion);

    const actual = await InvitacionRepository.findById(id);
    if (!actual) {
      registrarDenegacion({
        actor,
        operacion,
        motivo: "invitación inexistente",
      });
      throw new NoEncontradoError("No existe esa invitación.");
    }

    if (!InvitacionService.puedeInvitarRol(actor.role, actual.rol)) {
      registrarDenegacion({
        actor,
        operacion,
        motivo: `intento de revocar una invitación al rol ${actual.rol}`,
      });
      throw new NoAutorizadoError(
        "No podés revocar una invitación a un rol que no podés administrar."
      );
    }

    const row = await InvitacionRepository.marcarRevocada(id);
    if (!row) {
      throw new ConflictoError(
        "Esa invitación ya fue aceptada o revocada."
      );
    }

    return InvitacionService.toDTO(row);
  }

  /**
   * Turns a pending invitation into a Usuario, at first sign-in.
   *
   * Returns null when there is nothing pending for that email — which is the
   * normal answer for a stranger, and what makes an unknown identity
   * unauthorized instead of a default rol.
   *
   * Accepting twice produces one Usuario, not two, and neither half of that
   * relies on this method's reasoning:
   *
   *  - The row is created by an upsert keyed on the identity's own id, so a
   *    second attempt writes nothing.
   *  - `marcarAceptada` only updates an invitation that is still `pendiente`, so
   *    a second attempt claims nothing.
   *
   * The order matters and is not interchangeable: `invitacion.usuario_id` is a
   * foreign key into `users`, so the Usuario has to exist before the invitation
   * can point at it.
   */
  static async aceptarSiHayPendiente(
    identidad: Identidad
  ): Promise<CurrentUser | null> {
    const email = normalizarEmail(identidad.email);
    if (!email) return null;

    const pendiente = await InvitacionRepository.findPendientePorEmail(email);
    if (!pendiente) return null;

    await UserRepository.upsert({
      id: identidad.id,
      role: pendiente.rol,
      createdById: pendiente.invitadaPorId,
    });

    await InvitacionRepository.marcarAceptada(pendiente.id, identidad.id);

    return UserService.resolverActorSiExiste(identidad);
  }
}

/**
 * One spelling of an email address.
 *
 * The Neon Auth identity and the invitation are joined on this string and on
 * nothing else — there is no id to fall back on, because the identity does not
 * exist when the invitation is written.
 */
function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}
