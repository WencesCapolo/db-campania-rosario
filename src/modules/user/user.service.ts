import { UserRepository } from "./user.repository";
import { ROLE_HIERARCHY } from "./user.schema";
import type { UserDTO, CreateUserInput, ActionResult } from "./user.types";
import type { CurrentUser } from "./user.types";
import type { Role } from "./user.schema";

/**
 * UserService
 *
 * Responsibility: business logic for user management.
 *
 * Permission model:
 *  - Only authenticated users with a role HIGHER (lower index) than the target
 *    role may create users for that role.
 *  - Admin can create any role.
 */
export class UserService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Returns true if `actor` outranks `targetRole` in the hierarchy. */
  private static canManageRole(actor: CurrentUser, targetRole: Role): boolean {
    const actorIdx = ROLE_HIERARCHY.indexOf(actor.role);
    const targetIdx = ROLE_HIERARCHY.indexOf(targetRole);
    // Actor must have a strictly higher privilege (lower index)
    return actorIdx !== -1 && targetIdx !== -1 && actorIdx < targetIdx;
  }

  private static toDTO(
    row: Awaited<ReturnType<typeof UserRepository.getById>>,
    email: string,
    displayName: string | null
  ): UserDTO {
    return {
      id: row.id,
      role: row.role,
      email,
      displayName,
      createdById: row.createdById ?? null,
      createdAt: row.createdAt,
    };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Lists all app users.
   * Note: email / displayName comes from Neon Auth's `neon_auth.users_sync`
   * view. For now we return what's in our `users` table and let the UI join
   * with the Stack Auth SDK on the client if extra profile data is needed.
   */
  static async listUsers(): Promise<UserDTO[]> {
    const rows = await UserRepository.findAll();
    return rows.map((r) =>
      UserService.toDTO(r, "—", null) // email resolved via Stack Auth session
    );
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async createUser(
    actor: CurrentUser,
    input: CreateUserInput
  ): Promise<ActionResult<{ id: string }>> {
    if (!input.email.trim()) return { ok: false, error: "El email es obligatorio." };

    if (!UserService.canManageRole(actor, input.role)) {
      return {
        ok: false,
        error: "No tenés permisos para crear un usuario con ese rol.",
      };
    }

    // In practice, the user record in our DB is created after Stack Auth
    // sends the webhook / the user first logs in. Here we pre-create the row
    // with the chosen role — it will be upserted harmlessly on first login.
    // This is intentional: the admin "invites" a user before they register.
    //
    // The `id` must eventually match the Neon Auth user id. For the invitation
    // flow we use a placeholder; replace with the webhook id once integrated.
    const id = crypto.randomUUID(); // TODO: replace with actual Neon Auth id
    await UserRepository.create({
      id,
      role: input.role,
      createdById: actor.id,
    });

    return { ok: true, data: { id } };
  }

  static async updateRole(
    actor: CurrentUser,
    targetId: string,
    newRole: Role
  ): Promise<ActionResult> {
    if (!UserService.canManageRole(actor, newRole)) {
      return {
        ok: false,
        error: "No tenés permisos para asignar ese rol.",
      };
    }

    await UserRepository.updateRole(targetId, newRole);
    return { ok: true, data: undefined };
  }
}
