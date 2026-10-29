import {
    pgTable,
    pgEnum,
    text,
    timestamp,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------------------------------------
// Role enum — ordered from highest to lowest
//
// `dirigente_joven` took the place of `referente_local` in the enum (ADR 0016):
// a rename, so it sits last. Order here is display order; rank is RANGO_DE_ROL.
// -----------------------------------------------
export const roleEnum = pgEnum("role", [
    "admin",
    "asesor_nacional",
    "responsable_diocesano",
    "dirigente_joven",
]);

export type Role = (typeof roleEnum.enumValues)[number];

// The order lists are shown in, highest first.
export const ROLE_HIERARCHY: Role[] = [
    "admin",
    "asesor_nacional",
    "responsable_diocesano",
    "dirigente_joven",
];

// Rank, lower is higher. The two rols that load records share one: neither
// outranks the other, so neither administers the other (ADR 0016).
const RANGO_DE_ROL: Record<Role, number> = {
    admin: 0,
    asesor_nacional: 1,
    responsable_diocesano: 2,
    dirigente_joven: 2,
};

/** Whether `actor` is strictly above `rol` — the one definition of rank. */
export function superaEnRango(actor: Role, rol: Role): boolean {
    return RANGO_DE_ROL[actor] < RANGO_DE_ROL[rol];
}

// -----------------------------------------------
// Users
// References neon_auth."user" (managed by Neon Auth).
// We store only app-level data here: role + audit fields.
// -----------------------------------------------
export const users = pgTable(
    "users",
    {
        // Must match the id in neon_auth."user"
        id: text("id").primaryKey(),

        role: roleEnum("role").notNull(),

        // Who created this user (null = seeded, or the system Actor)
        createdById: text("created_by_id"),

        // Soft delete — a Usuario is given de baja, never destroyed, because
        // every Peregrina and Misionero carries createdById and that
        // attribution has to keep resolving to a real row. Access is revoked by
        // Actor resolution, which refuses a row with a baja.
        bajaAt: timestamp("baja_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        // The user-management screen lists by rol.
        index("users_role_idx").on(t.role),
    ]
);

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