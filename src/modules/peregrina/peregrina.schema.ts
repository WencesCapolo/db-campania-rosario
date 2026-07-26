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
import { misionero } from "@/modules/misionero/misionero.schema";
// ↑ One-way imports: peregrina → territorio, peregrina → misionero.
//
// That second one reversed in issue #3. Misionero used to point at the Peregrina
// in its charge; charge is now an Asignación, and the pointer that remains is
// the denormalised `misioneroActualId` below. The chain is now
// territorio → misionero → peregrina → asignacion, and misionero.schema no
// longer imports this file.

// ── Enums ─────────────────────────────────────────────────────────────────────
// These live here because peregrina owns them.

/**
 * The condition of the image, and nothing about who has it.
 *
 * `en_reparacion` and `extraviada` are the two states anyone actually acts on,
 * and until issue #3 they were indistinguishable from an image simply not in
 * use. `inactiva` is kept because records already carry it: rewriting it to
 * `activa` would assert something untrue about an image somebody marked inactive
 * for a reason, and rewriting it to `extraviada` would invent a claim that
 * images are lost. It stays readable and is excluded from new entry — see
 * `ESTADOS_SELECCIONABLES` in peregrina.types — so a Referente corrects each one
 * knowingly.
 *
 * Estado is independent of whether an Asignación is open. Marking a Peregrina
 * `extraviada` deliberately leaves the open Asignación open: the image is still
 * somebody's responsibility, and that is precisely the information needed.
 */
export const peregrinaEstadoEnum = pgEnum("peregrina_estado", [
  "activa",
  "inactiva",
  "en_reparacion",
  "extraviada",
]);

export const peregrinaTipoEnum = pgEnum("peregrina_tipo", [
  "peregrina",
  "auxiliar",
]);

// Región is territory, not peregrina's to define. Import it from
// @/modules/territorio/territorio.schema — it is deliberately not re-exported
// here, so `export *` in the schema barrel cannot make the name ambiguous.

/**
 * The Campaña's Modalidades — the apostolate a Peregrina belongs to.
 *
 * These values are not internal identifiers. Each one is the middle segment of
 * every Código that Modalidad ever generates ("CBA JOV 0001"), and a Código is
 * physically written on the image, so a value here is a mark on an object in
 * somebody's house. They are three letters for that reason, and changing one
 * desynchronises the system from a shelf full of statues. Do not edit them.
 *
 * `INF` and `ADU` are gone. They were placeholders from before the Campaña's own
 * list arrived, and that list does not contain them — unlike the legacy
 * `inactiva` Estado, which is kept because real records carry it. Migration 0006
 * refuses to run if any Peregrina still holds either, rather than quietly
 * reassigning an image to an apostolate nobody chose for it.
 */
export const modalidadEnum = pgEnum("modalidad", [
  "MIS", // Misioneritos
  "FAM", // Familias
  "MAT", // Matrimonios
  "TRA", // Trabajo
  "RIE", // Niños y Bebés en riesgo
  "DUL", // Dulce Espera (niños por nacer)
  "JOV", // Jóvenes
  "NVI", // No Videntes
  "SAL", // De la Salud
  "SER", // Serenidad y Confianza
  "TAX", // Taxistas
  "HPR", // Hijo Pródigo
  "CEN", // Cenáculo
  "SOR", // Sordos
  "SAC", // María Madre y Reina de los Sacerdotes
  "VOC", // Vocaciones
]);

// ── Table ─────────────────────────────────────────────────────────────────────

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

    /**
     * The Misionero who has this image right now — a *denormalised* copy of the
     * open Asignación's `misioneroId`, so that a list of two hundred Peregrinas
     * does not need a join per row.
     *
     * Derived, never written independently: every write goes through
     * `AsignacionService`, which sets it in the same transaction that opens or
     * closes an Asignación. The Asignación table is the source of truth; if the
     * two ever disagree, this column is the one that is wrong.
     */
    misioneroActualId: text("misionero_actual_id").references(
      () => misionero.id
    ),

    /**
     * Baja lógica — user story 16. A Peregrina permanently out of service leaves
     * the active inventory without erasing its history, because every Asignación
     * has to keep resolving to a real Código and a real name. Refused while an
     * Asignación is still open: an image that is physically with somebody has not
     * left the inventory, whatever the paperwork says.
     */
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
    // Dashboard filters are by territory, estado and modalidad — cover them.
    index("peregrina_diocesis_localidad_idx").on(t.diocesisLocalidadId),
    index("peregrina_estado_idx").on(t.estado),
    index("peregrina_modalidad_idx").on(t.modalidad),
    // Active inventory excludes bajas, which is every list by default.
    index("peregrina_baja_idx").on(t.bajaAt),
    // "Who has this one" on a list screen reads straight off this column.
    index("peregrina_misionero_actual_idx").on(t.misioneroActualId),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const peregrinaRelations = relations(peregrina, ({ one }) => ({
  createdBy: one(users, {
    fields: [peregrina.createdById],
    references: [users.id],
  }),
  diocesisLocalidad: one(diocesisLocalidad, {
    fields: [peregrina.diocesisLocalidadId],
    references: [diocesisLocalidad.id],
  }),
  misioneroActual: one(misionero, {
    fields: [peregrina.misioneroActualId],
    references: [misionero.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type PeregrinaRow = typeof peregrina.$inferSelect;
export type NewPeregrinaRow = typeof peregrina.$inferInsert;
export type PeregrinaEstado = (typeof peregrinaEstadoEnum.enumValues)[number];
export type PeregrinaTipo = (typeof peregrinaTipoEnum.enumValues)[number];
export type Modalidad = (typeof modalidadEnum.enumValues)[number];
