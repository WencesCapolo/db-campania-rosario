import { UserRepository, type UsuarioConIdentidad } from "./user.repository";
import { ROLE_HIERARCHY } from "./user.schema";
import type { Role } from "./user.schema";
import type {
  ActualizarUsuarioInput,
  CurrentUser,
  IdentidadHuerfanaDTO,
  UserDTO,
} from "./user.types";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { mapearDiocesisLocalidad } from "@/modules/territorio/territorio.reference";
import {
  derivarAlcance,
  esNacional,
  exigirDentroDelAlcance,
} from "@/lib/authorization/alcance";
import { registrarDenegacion } from "@/lib/authorization/registro";
import {
  CUENTA_DADA_DE_BAJA,
  ConflictoError,
  NoAutorizadoError,
  NoEncontradoError,
  SIN_AUTORIZACION,
  SIN_TERRITORIO_ASIGNADO,
  ValidacionError,
} from "@/lib/errors";

/** Why an authenticated identity has no Actor. Rendered by /sin-autorizacion. */
export type MotivoDeRefusa = "sin-usuario" | "dado-de-baja" | "sin-territorio";

const MENSAJE_POR_MOTIVO: Record<MotivoDeRefusa, string> = {
  "sin-usuario": SIN_AUTORIZACION,
  "dado-de-baja": CUENTA_DADA_DE_BAJA,
  "sin-territorio": SIN_TERRITORIO_ASIGNADO,
};

/**
 * UserService
 *
 * Responsibility: who exists, what rol they hold, and which territory bounds
 * them.
 *
 * Two rules run through everything here:
 *
 *  - A Usuario may only manage a Usuario of strictly lower rank. The one
 *    exception, settled with the user on 2026-07-25, is that an `admin` is a
 *    real person and may manage another admin.
 *  - An authenticated identity with no application row is unauthorized. It is
 *    never defaulted into a rol. This service will not create a Usuario at all —
 *    that is the invitacion module's job, and it happens because somebody with
 *    authority issued an invitation earlier.
 */
export class UserService {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Whether `actor` outranks `rol` enough to manage it. */
  private static puedeAdministrarRol(actorRol: Role, rol: Role): boolean {
    if (actorRol === "admin") return true;

    const actorIdx = ROLE_HIERARCHY.indexOf(actorRol);
    const rolIdx = ROLE_HIERARCHY.indexOf(rol);
    return actorIdx !== -1 && rolIdx !== -1 && actorIdx < rolIdx;
  }

  private static exigirPuedeAdministrar(
    actor: CurrentUser,
    rol: Role,
    operacion: string
  ): void {
    if (UserService.puedeAdministrarRol(actor.role, rol)) return;

    registrarDenegacion({
      actor,
      operacion,
      motivo: `intento de administrar el rol ${rol}`,
    });
    throw new NoAutorizadoError(
      "Sólo podés administrar usuarios de un rango menor al tuyo."
    );
  }

  /** Listing and managing Usuarios is for anyone who outranks somebody. */
  private static exigirPuedeAdministrarAlguien(
    actor: CurrentUser,
    operacion: string
  ): void {
    const alguno = ROLE_HIERARCHY.some((rol) =>
      UserService.puedeAdministrarRol(actor.role, rol)
    );
    if (alguno) return;

    registrarDenegacion({
      actor,
      operacion,
      motivo: "el rol no administra usuarios",
    });
    throw new NoAutorizadoError("Tu rol no administra usuarios.");
  }

  private static toDTO(row: UsuarioConIdentidad): UserDTO {
    return {
      id: row.usuario.id,
      role: row.usuario.role,
      email: row.identidad?.email ?? "",
      displayName: row.identidad?.name ?? null,
      diocesisLocalidad:
        row.diocesis && row.provincia
          ? mapearDiocesisLocalidad({
              diocesis: row.diocesis,
              provincia: row.provincia,
            })
          : null,
      deBaja: row.usuario.bajaAt !== null,
      sinIdentidad: row.identidad === null,
      createdById: row.usuario.createdById ?? null,
      createdAt: row.usuario.createdAt,
    };
  }

  // ── Resolución del Actor ────────────────────────────────────────────────────

  /**
   * Resolves an authenticated identity onto an Actor, or returns null.
   *
   * Null means exactly one thing: this identity has no usable application row.
   * It does **not** mean "create one" — the row that used to be conjured here
   * with a `referente_local` default is the defect issue #2 exists to close, and
   * it made authentication sufficient for authorization.
   *
   * Null covers three cases, all of them "no usable Actor": no row at all, a row
   * given de baja, and a lower rol whose territory is missing. A Usuario given
   * de baja loses access while every Peregrina and Misionero they registered
   * keeps pointing at their row, so past work stays attributable (user story 15).
   *
   * `resolverActor` distinguishes the three, because the person on the other end
   * needs to know which one they are. This variant does not, because its callers
   * only need to know whether to keep going.
   */
  static async resolverActorSiExiste(identidad: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<CurrentUser | null> {
    const row = await UserRepository.findById(identidad.id);
    if (!row) return null;
    if (row.bajaAt !== null) return null;
    if (!esNacional(row.role) && !row.diocesisLocalidadId) return null;

    return {
      id: row.id,
      role: row.role,
      email: identidad.email,
      displayName: identidad.displayName ?? null,
      diocesisLocalidadId: row.diocesisLocalidadId ?? null,
    };
  }

  /**
   * Why this identity has no Actor, or null because it does.
   *
   * Three refusals, kept apart because they send somebody to three different
   * people: a stranger needs an invitation, a Usuario given de baja needs an
   * Asesor Nacional, and a lower rol with no territory needs one assigned. "No
   * anduvo" would send all three to the wrong place.
   *
   * A code rather than a message, because the sign-in screen renders it and UI
   * copy gets reworded while a contract should not.
   */
  static async motivoDeRefusa(
    identidadId: string
  ): Promise<MotivoDeRefusa | null> {
    const row = await UserRepository.findById(identidadId);

    if (!row) return "sin-usuario";
    if (row.bajaAt !== null) return "dado-de-baja";
    if (!esNacional(row.role) && !row.diocesisLocalidadId) {
      return "sin-territorio";
    }
    return null;
  }

  /**
   * The same resolution as `resolverActorSiExiste`, refusing instead of
   * returning null — user story 12. Every refusal is logged.
   */
  static async resolverActor(identidad: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<CurrentUser> {
    const actor = await UserService.resolverActorSiExiste(identidad);
    if (actor) return actor;

    const motivo = (await UserService.motivoDeRefusa(identidad.id)) ?? "sin-usuario";

    console.warn(
      "[autorizacion-denegada]",
      JSON.stringify({
        operacion: "UserService.resolverActor",
        motivo,
        identidadId: identidad.id,
      })
    );

    throw new NoAutorizadoError(MENSAJE_POR_MOTIVO[motivo]);
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /**
   * The Usuarios this Actor administers.
   *
   * Scoped like everything else: an Asesor Nacional sees the country, a
   * Responsable Diocesano sees their own Diócesis. Emails come from
   * `neon_auth."user"` — they used to be a hardcoded "—" for everybody,
   * which made the screen unusable for its actual purpose.
   */
  static async listarUsuarios(
    actor: CurrentUser,
    opts: { incluirBajas?: boolean } = {}
  ): Promise<UserDTO[]> {
    const operacion = "UserService.listarUsuarios";
    UserService.exigirPuedeAdministrarAlguien(actor, operacion);
    const alcance = derivarAlcance(actor, operacion);

    const rows = await UserRepository.findAllConIdentidad(alcance, opts);
    return rows.map(UserService.toDTO);
  }

  /**
   * Identities the auth provider knows about that have no Usuario — user story
   * 17: a half-finished provisioning, or somebody who signed in and was refused.
   *
   * Country-wide only. A Responsable Diocesano cannot act on these — an identity
   * with no application row has no territory to compare theirs against, so there
   * is no honest way to decide which of them are "theirs".
   */
  static async listarIdentidadesSinUsuario(
    actor: CurrentUser
  ): Promise<IdentidadHuerfanaDTO[]> {
    const operacion = "UserService.listarIdentidadesSinUsuario";

    if (!esNacional(actor.role)) {
      registrarDenegacion({
        actor,
        operacion,
        motivo: "sólo un rol nacional puede ver identidades sin usuario",
      });
      throw new NoAutorizadoError(
        "Sólo un Asesor Nacional puede ver las identidades sin usuario."
      );
    }

    const rows = await UserRepository.findIdentidadesSinUsuario();
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.name,
      createdAt: r.createdAt,
    }));
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Changes a Usuario's rol or territory — user story 16, a real-world
   * reassignment.
   *
   * Both ranks are checked, and both territories. The Actor must outrank the
   * Usuario as they are *and* as they are about to become, otherwise a
   * Responsable Diocesano could promote a Referente to Asesor Nacional and
   * inherit the country by proxy. And a scoped Actor may neither reach into
   * another Diócesis nor push somebody out of their own.
   */
  static async actualizar(
    actor: CurrentUser,
    targetId: string,
    input: ActualizarUsuarioInput
  ): Promise<UserDTO> {
    const operacion = "UserService.actualizar";
    UserService.exigirPuedeAdministrarAlguien(actor, operacion);
    const alcance = derivarAlcance(actor, operacion);

    const actual = await UserService.exigirVisible(actor, alcance, targetId, operacion);

    UserService.exigirPuedeAdministrar(actor, actual.role, operacion);

    const rol = input.rol ?? actual.role;
    if (input.rol !== undefined) {
      UserService.exigirPuedeAdministrar(actor, input.rol, operacion);
    }

    const territorio = await UserService.resolverTerritorio(
      actor,
      alcance,
      rol,
      input.diocesisLocalidadId === undefined
        ? actual.diocesisLocalidadId
        : input.diocesisLocalidadId,
      operacion
    );

    const row = await UserRepository.update(targetId, {
      role: rol,
      diocesisLocalidadId: territorio,
    });
    if (!row) throw new NoEncontradoError("No existe ese usuario.");

    return UserService.leerUno(alcance, targetId);
  }

  /**
   * Gives a Usuario de baja — user story 15.
   *
   * Their access stops at the next request, because Actor resolution refuses a
   * row with a baja. Their name stays on everything they registered: the row is
   * never destroyed, so `createdById` keeps resolving.
   */
  static async darDeBaja(
    actor: CurrentUser,
    targetId: string
  ): Promise<UserDTO> {
    const operacion = "UserService.darDeBaja";
    UserService.exigirPuedeAdministrarAlguien(actor, operacion);
    const alcance = derivarAlcance(actor, operacion);

    if (targetId === actor.id) {
      throw new ValidacionError("No podés darte de baja a vos mismo.");
    }

    // Includes bajas, so somebody already dado de baja is reported as such
    // rather than as missing — "no existe" would be a lie the operator has to
    // debug.
    const actual = await UserService.exigirVisible(
      actor,
      alcance,
      targetId,
      operacion,
      { incluirBajas: true }
    );
    UserService.exigirPuedeAdministrar(actor, actual.role, operacion);

    const row = await UserRepository.darDeBaja(targetId);
    if (!row) throw new ConflictoError("Ese usuario ya estaba dado de baja.");

    return UserService.leerUno(alcance, targetId, { incluirBajas: true });
  }

  static async reactivar(
    actor: CurrentUser,
    targetId: string
  ): Promise<UserDTO> {
    const operacion = "UserService.reactivar";
    UserService.exigirPuedeAdministrarAlguien(actor, operacion);
    const alcance = derivarAlcance(actor, operacion);

    const actual = await UserService.exigirVisible(actor, alcance, targetId, operacion, {
      incluirBajas: true,
    });
    UserService.exigirPuedeAdministrar(actor, actual.role, operacion);

    const row = await UserRepository.reactivar(targetId);
    if (!row) throw new ConflictoError("Ese usuario no estaba dado de baja.");

    return UserService.leerUno(alcance, targetId);
  }

  // ── Helpers privados de alcance ─────────────────────────────────────────────

  /**
   * The target row, if this Actor may see it at all.
   *
   * A target outside the Actor's territory is reported as not existing rather
   * than as forbidden: "that Usuario is in another Diócesis" is itself a fact
   * about another Diócesis. The denial is logged, so the difference is visible
   * to an operator and not to the caller.
   */
  private static async exigirVisible(
    actor: CurrentUser,
    alcance: ReturnType<typeof derivarAlcance>,
    targetId: string,
    operacion: string,
    opts: { incluirBajas?: boolean } = {}
  ) {
    const encontrado = await UserRepository.findConIdentidadById(
      alcance,
      targetId,
      opts
    );

    if (!encontrado) {
      registrarDenegacion({
        actor,
        operacion,
        motivo: "usuario inexistente o fuera del territorio del Actor",
      });
      throw new NoEncontradoError("No existe ese usuario.");
    }

    return encontrado.usuario;
  }

  private static async leerUno(
    alcance: ReturnType<typeof derivarAlcance>,
    id: string,
    opts: { incluirBajas?: boolean } = {}
  ): Promise<UserDTO> {
    const row = await UserRepository.findConIdentidadById(alcance, id, opts);
    if (!row) throw new NoEncontradoError("No existe ese usuario.");
    return UserService.toDTO(row);
  }

  /**
   * Checks the rol/territory pairing on a write, and that the destination is
   * inside the Actor's scope.
   *
   * The pairing is the same invariant `derivarAlcance` fails closed on. Enforcing
   * it here as well is deliberate: failing closed at login keeps a bad row from
   * leaking data, and refusing it here keeps the bad row from being written.
   */
  private static async resolverTerritorio(
    actor: CurrentUser,
    alcance: ReturnType<typeof derivarAlcance>,
    rol: Role,
    diocesisLocalidadId: string | null | undefined,
    operacion: string
  ): Promise<string | null> {
    if (esNacional(rol)) {
      if (diocesisLocalidadId) {
        throw new ValidacionError(
          "Un Asesor Nacional y un Administrador cubren todo el país, así que no se les asigna una Diócesis/Localidad."
        );
      }
      return null;
    }

    if (!diocesisLocalidadId) {
      throw new ValidacionError(
        "Elegí la Diócesis/Localidad que va a tener a cargo."
      );
    }

    const territorio = await TerritorioRepository.findDiocesisLocalidadById(
      diocesisLocalidadId
    );
    if (!territorio) {
      throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
    }

    exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);

    return territorio.diocesis.id;
  }
}
