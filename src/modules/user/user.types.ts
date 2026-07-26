import { z } from "zod";
import { roleEnum } from "@/db/schema/users";
import type { Role } from "./user.schema";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

export type { ActionResult } from "@/lib/action-result";

// ── CurrentUser ───────────────────────────────────────────────────────────────
// The Actor. Every service method takes one as its first parameter — ADR 0001.

export interface CurrentUser {
  id: string;
  role: Role;
  email: string;
  displayName?: string | null;

  /**
   * The territory that bounds what this Actor may see and change.
   *
   * Null for admin and asesor_nacional, who are country-wide. Null on either of
   * the two lower rols means nobody knows what that Usuario may see, and
   * `derivarAlcance` refuses them rather than treating it as "everything" —
   * `UserService` will not write that pairing in the first place.
   *
   * Referentes Locales share one login per territory, so this identifies a
   * place and not a person.
   */
  diocesisLocalidadId: string | null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  role: Role;
  /** From `neon_auth."user"`. Empty when the identity is gone — see below. */
  email: string;
  displayName: string | null;
  diocesisLocalidad: DiocesisLocalidadDTO | null;
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

export const actualizarUsuarioSchema = z
  .object({
    rol: z.enum(roleEnum.enumValues, { message: "Elegí un rol válido." }).optional(),
    // Explicit null means "country-wide", for a rol that is country-wide.
    diocesisLocalidadId: z.string().min(1).nullish(),
  })
  .refine((v) => v.rol !== undefined || v.diocesisLocalidadId !== undefined, {
    message: "No hay nada que cambiar.",
  });

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
