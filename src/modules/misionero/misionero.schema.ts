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
import { diocesisLocalidad } from "@/modules/territorio/territorio.schema";
// The import direction reversed in issue #3, and this file is where it shows.
// Misionero used to point at the Peregrina in its charge; charge is now an
// Asignación, and the only pointer left is Peregrina's denormalised
// `misioneroActualId`. So misionero no longer knows about peregrina at all, and
// the one-way chain is now: territorio → misionero → peregrina → asignacion.

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

    // Centro donde la Peregrina es venerada
    centroTipo: centroTipoEnum("centro_tipo"),
    centroNombre: text("centro_nombre"),

    // Año de consagración
    anioConsagracion: integer("anio_consagracion"),

    // Resúmenes anuales: { "2024": "texto...", "2025": "texto..." }
    // Stored as text/JSONB; parsed in service layer
    resumenesAnuales: text("resumenes_anuales").default("{}"),

    // Baja lógica. A Misionero who leaves the Campaña stops appearing in active
    // lists, and their name keeps resolving inside every Asignación they ever
    // held — which is the whole reason nothing here is ever destroyed. Refused
    // while they still have a Peregrina: the image is physically with them, and
    // closing the person out first is how images get lost.
    bajaAt: timestamp("baja_at", { withTimezone: true }),

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
    // Active lists filter out bajas, which is now every list by default.
    index("misionero_baja_idx").on(t.bajaAt),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const misioneroRelations = relations(misionero, ({ one }) => ({
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
