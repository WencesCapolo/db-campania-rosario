import { pgSchema, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Neon Auth's identity table, declared read-only so we can join emails onto our
 * own `users` rows.
 *
 * The table is `neon_auth."user"`, and the spelling of every column matters:
 * Managed Better Auth creates them camelCase and quoted, so the strings below
 * are the exact identifiers Neon wrote.
 *
 * This file used to describe `neon_auth.users_sync` — the older Neon Auth
 * (Stack) shape, which does not exist in a Managed Better Auth project. Every
 * query joining it threw, so `UserRepository.findById` threw, so
 * `getCurrentUser` threw, so every authenticated page did. The suite passed
 * throughout, because the harness built its stand-in from *this file* rather
 * than from Neon: the seam agreed with itself and with nothing else. Same shape
 * of bug as the `neon-http` transaction one in ADR 0004 — green locally, broken
 * on deploy.
 *
 * Deliberately absent from both schema barrels. `src/db/schema.ts` is what
 * drizzle-kit reads, and a table listed there is a table drizzle-kit will try to
 * create and migrate — this one belongs to Neon, which owns and migrates it
 * beneath us (ADR 0002). Queries import it directly instead.
 *
 * Nothing here is ever written to. The columns are the subset we read; Neon's
 * table has more (`image`, `role`, `banned`, `banReason`, `banExpires`).
 *
 * Note there is no `deleted_at`. Better Auth deletes an identity outright, so
 * "the identity is gone" is the absence of a row, not a flag on one.
 */
const neonAuth = pgSchema("neon_auth");

export const identidades = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: boolean("emailVerified"),
  createdAt: timestamp("createdAt", { withTimezone: true }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }),
});

/**
 * The identity id, cast to text, for joining against `users.id`.
 *
 * Neon stores it as `uuid`; our `users.id` is `text` and holds the same value
 * spelled out. Postgres has no implicit `uuid = text`, so a plain join across
 * the boundary fails with `operator does not exist: uuid = text` — at runtime,
 * in a query the type checker was perfectly happy with. The cast lives here so
 * that every join is written the one way that works, rather than each call site
 * discovering the error separately.
 */
export const identidadIdComoTexto = sql<string>`${identidades.id}::text`;

export type IdentidadAuth = typeof identidades.$inferSelect;
