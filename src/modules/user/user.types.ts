import type { Role } from "./user.schema";

// ── CurrentUser ───────────────────────────────────────────────────────────────
// Shape returned by getCurrentUser() — used throughout all modules.

export interface CurrentUser {
  id: string;
  role: Role;
  email: string;
  displayName?: string | null;

  /**
   * The territory that bounds what this Actor may see and change.
   *
   * Null for admin and asesor_nacional, who are country-wide, and for rows
   * created before territory existed. Issue #1 only reads it, to narrow
   * selection lists; issue #2 makes it the basis of authorization, at which
   * point a null on a lower rol stops being tolerable.
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
  email: string;
  displayName: string | null;
  createdById: string | null;
  createdAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  displayName?: string;
  role: Role;
}

// ── Result pattern ────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
