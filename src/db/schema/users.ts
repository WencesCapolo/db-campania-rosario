import {
    pgTable,
    pgEnum,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------------------------------------
// Role enum — ordered from highest to lowest
// -----------------------------------------------
export const roleEnum = pgEnum("role", [
    "admin",
    "asesor_nacional",
    "responsable_diocesano",
    "referente_local",
]);

export type Role = (typeof roleEnum.enumValues)[number];

// Role hierarchy — used for permission checks
// Lower index = higher privilege
export const ROLE_HIERARCHY: Role[] = [
    "admin",
    "asesor_nacional",
    "responsable_diocesano",
    "referente_local",
];

// -----------------------------------------------
// Users
// References neon_auth.users_sync (managed by Neon Auth / Stack Auth).
// We store only app-level data here: role + audit fields.
// -----------------------------------------------
export const users = pgTable("users", {
    // Must match the id in neon_auth.users_sync
    id: text("id").primaryKey(),

    role: roleEnum("role").notNull().default("referente_local"),

    // Who created this user (null = self-registered or seeded admin)
    createdById: text("created_by_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ one }) => ({
    createdBy: one(users, {
        fields: [users.createdById],
        references: [users.id],
    }),
}));

// -----------------------------------------------
// Types
// -----------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;