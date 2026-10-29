import { z } from "zod";
import { roleEnum } from "@/db/schema/users";
import type { Role } from "./user.schema";

export type { ActionResult } from "@/lib/action-result";

// ── CurrentUser ───────────────────────────────────────────────────────────────
// The Actor. Every service method takes one as its first parameter — ADR 0001.

export interface CurrentUser {
  id: string;
  role: Role;
  email: string;
  displayName?: string | null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  role: Role;
  /** From `neon_auth."user"`. Empty when the identity is gone — see below. */
  email: string;
  displayName: string | null;
  deBaja: boolean;
  /**
   * There is an application row but no identity in the auth provider. ADR 0002
   * declines a foreign key into `neon_auth` because Neon migrates that schema
   * beneath us, so deleting somebody in the Neon console leaves this behind and
   * the management screen has to say so.
   */
  sinIdentidad: boolean;
  createdById: string | null;
  createdAt: Date;
}

/** An identity the provider knows about that has no Usuario — user story 17. */
export interface IdentidadHuerfanaDTO {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: Date | null;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// There is no "create Usuario" input. Usuarios are created by accepting an
// invitation — see the invitacion module — because nobody self-registers and
// nobody is conjured with a placeholder id that no session will ever match.

export const actualizarUsuarioSchema = z.object({
  rol: z.enum(roleEnum.enumValues, { message: "Elegí un rol válido." }),
});

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
