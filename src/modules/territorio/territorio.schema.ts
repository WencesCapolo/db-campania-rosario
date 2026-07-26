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
// An Argentine province. It has no Región: see the Diócesis/Localidad table.
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
  ]
);

// ── Diócesis/Localidad ────────────────────────────────────────────────────────
// The narrowest territorial level, within exactly one Provincia. This is the
// single value a Usuario picks; the Provincia follows from it by traversal and
// is never stored again, so the two cannot disagree.
//
// Región lives here, not on Provincia, because the Campaña's pastoral regions do
// not follow provincial borders. Santa Fe spans two: Reconquista is NEA while
// Rosario, Venado Tuerto, Santa Fe and Rafaela are CENTRO. Buenos Aires spans
// two as well: the conurbano dioceses are BS. AS while San Nicolás, La Plata,
// Mar del Plata, Bahía Blanca, Azul, 9 de Julio and Mercedes are R. PAM.
//
// It used to be a column on Provincia, which forced one answer per province and
// therefore filed eight real Diócesis under the wrong Región. That was a guess
// made before anybody had the Campaña's own list; the list arrived, and it
// disagrees.

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

    region: regionEnum("region").notNull(),

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
    // Listing by Región is a dashboard filter, so it is covered.
    index("diocesis_localidad_region_idx").on(t.region),
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
