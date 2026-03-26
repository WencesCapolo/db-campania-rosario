import type { Role } from "./user.schema";

// ── CurrentUser ───────────────────────────────────────────────────────────────
// Shape returned by getCurrentUser() — used throughout all modules.

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
