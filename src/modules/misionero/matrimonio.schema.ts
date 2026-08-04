import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";
import {
  misionero,
  misioneroEstadoEnum,
  centroTipoEnum,
} from "./misionero.schema";

// ── Table ─────────────────────────────────────────────────────────────────────
//
// A Matrimonio is **one Tenedor made of two Misioneros** — ADR 0010.
//
// It lives in the `misionero` module rather than in one of its own, and that is
// forced rather than chosen: `asignacion.matrimonio_id` and
// `peregrina.matrimonio_actual_id` both point here, so this table has to sit
// upstream of them in the one-way chain `territorio → misionero → peregrina →
// asignacion`. A `matrimonio` module of its own would have had to go between
// misionero and peregrina anyway, for one table and no separate lifecycle.
//
// What is here is what the couple shares; what is on `misionero` stays there
// because it belongs to a person. Two people are consecrated in two different
// years, and write their own resumen anual, so `anioConsagracion` and
// `resumenesAnuales` could not have been folded up into a single row here.

export const matrimonio = pgTable(
  "matrimonio",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /**
     * Spouse A is not a rank. It is the pair the form asked for first, and it is
     * load-bearing in exactly two places: it supplies the couple's sort key in
     * the listado (`apellido, nombre`), and it supplies the couple's territory,
     * because this table deliberately has none of its own.
     *
     * Both of those are only well defined because the two spouses are guaranteed
     * to share a Diócesis/Localidad — the form enters the territory once, and
     * `MatrimonioService` holds that invariant. If that ever stops being true,
     * "the couple's Región" becomes a coin flip and the tablero starts filing
     * households under whichever spouse got typed first.
     */
    misioneroAId: text("misionero_a_id")
      .notNull()
      .references(() => misionero.id),

    misioneroBId: text("misionero_b_id")
      .notNull()
      .references(() => misionero.id),

    // The existing enum, not a new one. A new enum value cannot be used in the
    // transaction that creates it and drizzle wraps each migration file in one,
    // so minting `matrimonio_estado` with the same two values would have cost a
    // third migration file to buy nothing.
    estado: misioneroEstadoEnum("estado").notNull().default("activo"),

    // No `telefono` here, deliberately. It was a single household number at
    // first; a couple turns out to have two, and the second one is how somebody
    // gets hold of the household when the first person does not answer — which
    // is the entire reason the Campaña records a phone at all. So each spouse
    // keeps their own `misionero.telefono`, both optional, and this table holds
    // none. What is shared is what a household genuinely shares: the territory
    // and the Centro.
    centroTipo: centroTipoEnum("centro_tipo"),
    centroNombre: text("centro_nombre"),

    /**
     * The marriage ended — a separation, or a death. Soft, like every other baja
     * here, because the Asignaciones the couple held must keep resolving to the
     * couple: what the historial says about a period is what was true *then*.
     *
     * Refused while an Asignación is open, for the reason `misionero.bajaAt` is:
     * the image is in that house whatever the paperwork says.
     *
     * Setting it also hands the two spouses back their individual lives, with no
     * code anywhere doing that on purpose — the listado's union excludes a person
     * who is in an *active* marriage, so they simply start matching again.
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
    // The listado's union asks "is this person in an active marriage" once per
    // individual leg, against both columns.
    index("matrimonio_misionero_a_idx").on(t.misioneroAId),
    index("matrimonio_misionero_b_idx").on(t.misioneroBId),
    // Active lists exclude bajas, which is every list by default.
    index("matrimonio_baja_idx").on(t.bajaAt),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const matrimonioRelations = relations(matrimonio, ({ one }) => ({
  misioneroA: one(misionero, {
    fields: [matrimonio.misioneroAId],
    references: [misionero.id],
    relationName: "matrimonioMisioneroA",
  }),
  misioneroB: one(misionero, {
    fields: [matrimonio.misioneroBId],
    references: [misionero.id],
    relationName: "matrimonioMisioneroB",
  }),
  createdBy: one(users, {
    fields: [matrimonio.createdById],
    references: [users.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type MatrimonioRow = typeof matrimonio.$inferSelect;
export type NewMatrimonioRow = typeof matrimonio.$inferInsert;
