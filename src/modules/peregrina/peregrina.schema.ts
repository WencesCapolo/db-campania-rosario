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
// ↑ One-way import: peregrina → territorio. Territorio depends on nothing.

// ── Enums ─────────────────────────────────────────────────────────────────────
// These live here because peregrina owns them.
// misionero.schema imports them from here — no circular dependency.

export const peregrinaEstadoEnum = pgEnum("peregrina_estado", [
  "activa",
  "inactiva",
]);

export const peregrinaTipoEnum = pgEnum("peregrina_tipo", [
  "peregrina",
  "auxiliar",
]);

// Región is territory, not peregrina's to define. Import it from
// @/modules/territorio/territorio.schema — it is deliberately not re-exported
// here, so `export *` in the schema barrel cannot make the name ambiguous.

export const modalidadEnum = pgEnum("modalidad", [
  "JOV", // Jóvenes
  "FAM", // Familias
  "INF", // Infancia
  "ADU", // Adultos
]);

// ── Table ─────────────────────────────────────────────────────────────────────
// Peregrina is fully independent — it has NO FK to misionero.
// A misionero references the peregrina they are responsible for, not the other way around.

export const peregrina = pgTable(
  "peregrina",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Código compuesto: [Provincia Modalidad AutoIncNum] — e.g. "CBA JOV 0001"
    codigo: text("codigo").notNull().unique(),
    codigoNum: integer("codigo_num").notNull(),

    tipo: peregrinaTipoEnum("tipo").notNull().default("peregrina"),
    estado: peregrinaEstadoEnum("estado").notNull().default("activa"),

    // Territorio: one reference, not three fields. Provincia and Región are
    // derived by traversing to the Diócesis/Localidad, never stored here, so a
    // Peregrina in provincia "Neuquén" but región "NOA" is unrepresentable.
    diocesisLocalidadId: text("diocesis_localidad_id")
      .notNull()
      .references(() => diocesisLocalidad.id),

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
  },
  (t) => [
    // Dashboard filters are by territory, estado and modalidad — cover them.
    index("peregrina_diocesis_localidad_idx").on(t.diocesisLocalidadId),
    index("peregrina_estado_idx").on(t.estado),
    index("peregrina_modalidad_idx").on(t.modalidad),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────
// The misionero → peregrina relation is declared in misionero.schema to avoid
// a circular import. Here we only know about users and territorio.

export const peregrinaRelations = relations(peregrina, ({ one }) => ({
  createdBy: one(users, {
    fields: [peregrina.createdById],
    references: [users.id],
  }),
  diocesisLocalidad: one(diocesisLocalidad, {
    fields: [peregrina.diocesisLocalidadId],
    references: [diocesisLocalidad.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type PeregrinaRow = typeof peregrina.$inferSelect;
export type NewPeregrinaRow = typeof peregrina.$inferInsert;
export type PeregrinaEstado = (typeof peregrinaEstadoEnum.enumValues)[number];
export type PeregrinaTipo = (typeof peregrinaTipoEnum.enumValues)[number];
export type Modalidad = (typeof modalidadEnum.enumValues)[number];
