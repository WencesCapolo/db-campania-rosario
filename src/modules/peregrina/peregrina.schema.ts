import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

// ── Enums ─────────────────────────────────────────────────────────────────────
// These live here because peregrina is the independent entity.
// misionero.schema imports them from here — no circular dependency.

export const peregrinaEstadoEnum = pgEnum("peregrina_estado", [
  "activa",
  "inactiva",
]);

export const peregrinaTipoEnum = pgEnum("peregrina_tipo", [
  "peregrina",
  "auxiliar",
]);

export const regionEnum = pgEnum("region", [
  "NOA",
  "CENTRO",
  "CUYO",
  "NEA",
  "BS. AS",
  "R. PAM",
  "R. PAT",
]);

export const modalidadEnum = pgEnum("modalidad", [
  "JOV", // Jóvenes
  "FAM", // Familias
  "INF", // Infancia
  "ADU", // Adultos
]);

// ── Table ─────────────────────────────────────────────────────────────────────
// Peregrina is fully independent — it has NO FK to misionero.
// A misionero references the peregrina they are responsible for, not the other way around.

export const peregrina = pgTable("peregrina", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Código compuesto: [Provincia Modalidad AutoIncNum] — e.g. "CBA JOV 0001"
  codigo: text("codigo").notNull().unique(),
  codigoNum: integer("codigo_num").notNull(),

  tipo: peregrinaTipoEnum("tipo").notNull().default("peregrina"),
  estado: peregrinaEstadoEnum("estado").notNull().default("activa"),

  region: regionEnum("region").notNull(),
  provincia: text("provincia").notNull(),
  diocesisLocalidad: text("diocesis_localidad").notNull(),
  modalidad: modalidadEnum("modalidad").notNull(),

  // Auditoría
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ── Relations ─────────────────────────────────────────────────────────────────
// The misionero → peregrina relation is declared in misionero.schema to avoid
// a circular import. Here we only know about users.

export const peregrinaRelations = relations(peregrina, ({ one }) => ({
  createdBy: one(users, {
    fields: [peregrina.createdById],
    references: [users.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type PeregrinaRow = typeof peregrina.$inferSelect;
export type NewPeregrinaRow = typeof peregrina.$inferInsert;
export type PeregrinaEstado = (typeof peregrinaEstadoEnum.enumValues)[number];
export type PeregrinaTipo = (typeof peregrinaTipoEnum.enumValues)[number];
export type Region = (typeof regionEnum.enumValues)[number];
export type Modalidad = (typeof modalidadEnum.enumValues)[number];
