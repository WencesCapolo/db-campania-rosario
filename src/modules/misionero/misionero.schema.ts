import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
// ↑ One-way import: misionero → peregrina. Peregrina does NOT import misionero.
import { diocesisLocalidad } from "@/modules/territorio/territorio.schema";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const misioneroEstadoEnum = pgEnum("misionero_estado", [
  "activo",
  "inactivo",
]);

export const centroTipoEnum = pgEnum("centro_tipo", [
  "santuario",
  "ermita",
  "parroquia",
]);

// ── Table ─────────────────────────────────────────────────────────────────────

export const misionero = pgTable(
  "misionero",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    nombre: text("nombre").notNull(),
    apellido: text("apellido").notNull(),
    telefono: text("telefono"),

    estado: misioneroEstadoEnum("estado").notNull().default("activo"),

    // Territorio: one reference. Provincia and Región derive from it.
    diocesisLocalidadId: text("diocesis_localidad_id")
      .notNull()
      .references(() => diocesisLocalidad.id),

    // La Peregrina que este misionero tiene a cargo (opcional — puede no tener ninguna)
    peregrinaId: text("peregrina_id").references(() => peregrina.id, {
      onDelete: "set null",
    }),

    // Centro donde la Peregrina es venerada
    centroTipo: centroTipoEnum("centro_tipo"),
    centroNombre: text("centro_nombre"),

    // Año de consagración
    anioConsagracion: integer("anio_consagracion"),

    // Resúmenes anuales: { "2024": "texto...", "2025": "texto..." }
    // Stored as text/JSONB; parsed in service layer
    resumenesAnuales: text("resumenes_anuales").default("{}"),

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
  },
  (t) => [
    index("misionero_diocesis_localidad_idx").on(t.diocesisLocalidadId),
    index("misionero_estado_idx").on(t.estado),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const misioneroRelations = relations(misionero, ({ one }) => ({
  peregrina: one(peregrina, {
    fields: [misionero.peregrinaId],
    references: [peregrina.id],
  }),
  createdBy: one(users, {
    fields: [misionero.createdById],
    references: [users.id],
  }),
  diocesisLocalidad: one(diocesisLocalidad, {
    fields: [misionero.diocesisLocalidadId],
    references: [diocesisLocalidad.id],
  }),
}));

// ── Inferred types ─────────────────────────────────────────────────────────────

export type MisioneroRow = typeof misionero.$inferSelect;
export type NewMisioneroRow = typeof misionero.$inferInsert;
export type MisioneroEstado = (typeof misioneroEstadoEnum.enumValues)[number];
export type CentroTipo = (typeof centroTipoEnum.enumValues)[number];
