import {
    pgTable,
    pgEnum,
    text,
    timestamp,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { diocesisLocalidad } from "@/modules/territorio/territorio.schema";

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
// References neon_auth."user" (managed by Neon Auth).
// We store only app-level data here: role + audit fields.
// -----------------------------------------------
export const users = pgTable(
    "users",
    {
        // Must match the id in neon_auth."user"
        id: text("id").primaryKey(),

        role: roleEnum("role").notNull().default("referente_local"),

        // The territory that bounds what this Usuario may see and change.
        //
        // Nullable, and it stays nullable: an admin and an Asesor Nacional are
        // country-wide and legitimately have none. The invariant is about the
        // *pair* — a responsable_diocesano or referente_local must have one — so
        // it is enforced where the pair is known: in derivarAlcance(), which
        // fails closed, and in UserService whenever a rol or territory is
        // written. A column-level CHECK cannot express "unless the rol is
        // nacional" without hardcoding enum values into SQL.
        //
        // Note that Referentes Locales share one login per territory (confirmed
        // 2026-07-25), so this identifies a place and not a person.
        diocesisLocalidadId: text("diocesis_localidad_id").references(
            () => diocesisLocalidad.id
        ),

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
        // The user-management screen lists by territory and by rol.
        index("users_diocesis_localidad_idx").on(t.diocesisLocalidadId),
        index("users_role_idx").on(t.role),
    ]
);

export const usersRelations = relations(users, ({ one }) => ({
    createdBy: one(users, {
        fields: [users.createdById],
        references: [users.id],
    }),
    diocesisLocalidad: one(diocesisLocalidad, {
        fields: [users.diocesisLocalidadId],
        references: [diocesisLocalidad.id],
    }),
}));

// -----------------------------------------------
// Types
// -----------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;