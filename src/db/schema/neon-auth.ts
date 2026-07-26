import { pgSchema, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Neon Auth's synced identity table, declared read-only so we can join emails
 * onto our own `users` rows.
 *
 * Deliberately absent from both schema barrels. `src/db/schema.ts` is what
 * drizzle-kit reads, and a table listed there is a table drizzle-kit will try to
 * create and migrate — this one belongs to Neon, which owns and migrates it
 * beneath us (ADR 0002). Queries import it directly instead.
 *
 * Nothing here is ever written to. The columns are the subset we read; Neon's
 * table has more.
 */
const neonAuth = pgSchema("neon_auth");

export const usersSync = neonAuth.table("users_sync", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  /** Set by Neon when an identity is deleted in the console. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  rawJson: jsonb("raw_json"),
});

export type IdentidadSync = typeof usersSync.$inferSelect;
