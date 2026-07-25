import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Región ────────────────────────────────────────────────────────────────────
// The widest territorial level, and the only one that is structure rather than
// reference data: the Campaña's seven pastoral regions are fixed, so they are an
// enum and not a table. Confirmed with the user on 2026-07-25.
//
// This enum lives here because territorio is now the independent entity.
// peregrina and misionero re-export it — one-way imports, territorio ← the rest.

export const regionEnum = pgEnum("region", [
  "NOA",
  "CENTRO",
  "CUYO",
  "NEA",
  "BS. AS",
  "R. PAM",
  "R. PAT",
]);

export type Region = (typeof regionEnum.enumValues)[number];

export const REGIONES: readonly Region[] = regionEnum.enumValues;

// ── Provincia ─────────────────────────────────────────────────────────────────
// An Argentine province, within exactly one Región.
//
// `abreviatura` is the three-letter form that goes into a Peregrina's Código
// ("CBA JOV 0001"). It used to be a hardcoded map in peregrina.service; it lives
// here now so an Asesor Nacional can add a Provincia without a deployment.
// It is unique across the country because Códigos are globally unique — two
// Provincias sharing an abbreviation would generate colliding Códigos.

export const provincia = pgTable(
  "provincia",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    nombre: text("nombre").notNull(),
    abreviatura: text("abreviatura").notNull(),
    region: regionEnum("region").notNull(),

    // Soft delete. A Provincia given de baja stops appearing in selection
    // lists; the records referencing it keep resolving to a real name.
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
    uniqueIndex("provincia_nombre_key").on(t.nombre),
    uniqueIndex("provincia_abreviatura_key").on(t.abreviatura),
    index("provincia_region_idx").on(t.region),
  ]
);

// ── Diócesis/Localidad ────────────────────────────────────────────────────────
// The narrowest territorial level, within exactly one Provincia. This is the
// single value a Usuario picks; Provincia and Región follow from it by
// traversal and are never stored again, so they cannot disagree with it.

export const diocesisLocalidad = pgTable(
  "diocesis_localidad",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    nombre: text("nombre").notNull(),

    provinciaId: text("provincia_id")
      .notNull()
      .references(() => provincia.id),

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
    // Two Diócesis may share a name across Provincias, never within one.
    uniqueIndex("diocesis_localidad_provincia_nombre_key").on(
      t.provinciaId,
      t.nombre
    ),
    index("diocesis_localidad_provincia_idx").on(t.provinciaId),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const provinciaRelations = relations(provincia, ({ many }) => ({
  diocesisLocalidades: many(diocesisLocalidad),
}));

export const diocesisLocalidadRelations = relations(
  diocesisLocalidad,
  ({ one }) => ({
    provincia: one(provincia, {
      fields: [diocesisLocalidad.provinciaId],
      references: [provincia.id],
    }),
  })
);

// ── Inferred types ────────────────────────────────────────────────────────────

export type ProvinciaRow = typeof provincia.$inferSelect;
export type NewProvinciaRow = typeof provincia.$inferInsert;
export type DiocesisLocalidadRow = typeof diocesisLocalidad.$inferSelect;
export type NewDiocesisLocalidadRow = typeof diocesisLocalidad.$inferInsert;
