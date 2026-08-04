import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { misionero } from "@/modules/misionero/misionero.schema";
import { matrimonio } from "@/modules/misionero/matrimonio.schema";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
// ↑ One-way imports: asignacion → peregrina → misionero → territorio. Nothing
//   imports asignacion back, which is what keeps the schema barrel acyclic.

// ── Table ─────────────────────────────────────────────────────────────────────
//
// An Asignación is a *period*: one Misionero had charge of one Peregrina, from
// `abiertaAt` until `cerradaAt`. An open one — no `cerradaAt` — is the tenencia
// actual.
//
// This replaces the single overwritten `misionero.peregrina_id` pointer, which
// knew the fourth holder of an image and nothing about the first three. Handing
// on closes one row and opens another, so the chain of custody accumulates.
//
// It carries no territory of its own, on purpose. A Peregrina is the thing that
// lives somewhere, so every scoped read joins through `peregrina` — see
// `AsignacionRepository`. The consequence is deliberate: moving a Peregrina to
// another Diócesis takes its whole history with it, because the chain of custody
// belongs to the image and not to whoever happened to file the paperwork.

export const asignacion = pgTable(
  "asignacion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    peregrinaId: text("peregrina_id")
      .notNull()
      .references(() => peregrina.id),

    /**
     * The Tenedor, as two nullable columns with exactly one of them filled —
     * ADR 0010. A period belongs to one Misionero *or* to one Matrimonio.
     *
     * `misioneroId` lost its `not null` here rather than gaining a supertype
     * table above it. At the Campaña's scale the supertype bought no measurable
     * speed, and what it would have bought instead was a denormalised label —
     * a second copy of two people's names, waiting to drift.
     *
     * The price, named so nobody has to rediscover it: a read that joins the
     * misionero leg and forgets the matrimonio leg returns **fewer rows and no
     * error**. A couple's images just vanish from a list. That is why the
     * matrimonio visibility suite exists beside the alcance suites — the failure
     * mode is silence, and silence needs a test rather than a reviewer.
     */
    misioneroId: text("misionero_id").references(() => misionero.id),

    matrimonioId: text("matrimonio_id").references(() => matrimonio.id),

    abiertaAt: timestamp("abierta_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Null means open — this Misionero has the image right now. */
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),

    /**
     * Who registered the period — user story 5.
     *
     * Referentes Locales share one login per territory (settled 2026-07-25), so
     * this resolves to *which territory* registered it, not to a person. No UI
     * copy may imply individual accountability.
     */
    registradaPorId: text("registrada_por_id")
      .notNull()
      .references(() => users.id),

    /** Who registered the return or the hand-on. Null while the period is open. */
    cerradaPorId: text("cerrada_por_id").references(() => users.id),

    // "entregada en la peregrinación diocesana" is the kind of context that is
    // lost otherwise — user story 11. Two notes, because opening and closing are
    // two different moments with two different things worth saying.
    notaApertura: text("nota_apertura"),
    notaCierre: text("nota_cierre"),

    /**
     * A correction is an edit, not a deletion — so the correction is itself
     * visible rather than the record quietly becoming a different record. User
     * story 17.
     */
    corregidaAt: timestamp("corregida_at", { withTimezone: true }),
    corregidaPorId: text("corregida_por_id").references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /**
     * The invariant: a Peregrina has **at most one open Asignación**.
     *
     * `AsignacionService` owns it, and this index means a concurrent
     * double-assignment fails at the storage layer instead of racing. A test
     * that only drives the service proves the service, not the constraint.
     *
     * Partial, on open rows only — a Peregrina accumulates as many closed
     * Asignaciones as it has had holders.
     *
     * Note there is deliberately no matching constraint on the Misionero side: a
     * Misionero may hold several Peregrinas at once (settled 2026-07-25), so that
     * is a service rule if it ever becomes one, not a schema constraint.
     */
    uniqueIndex("asignacion_peregrina_abierta_key")
      .on(t.peregrinaId)
      .where(sql`${t.cerradaAt} is null`),

    // Every scoped read joins peregrina, including the ones that only want a
    // count, so this one is load-bearing rather than speculative.
    index("asignacion_peregrina_idx").on(t.peregrinaId),
    // "Every Peregrina this Misionero has ever had" — user story 7 — and the
    // guard that refuses to give a Misionero de baja while one is open.
    index("asignacion_misionero_idx").on(t.misioneroId),

    /*
     * "Which images have not changed hands in six months" — issue #5's stalled
     * card, which is a range scan over the opening dates of the *open* periods.
     *
     * Partial for the reason the unique index above is: this table grows without
     * a ceiling — one row per pair of hands an image has passed through — while
     * the open rows are a minority of it, and the question is only ever about
     * those. Measured in `tablero.planes.test.ts`, which asserts this index by
     * name against thirty thousand Asignaciones.
     *
     * A matching one on `misionero_id` was written and then removed: the
     * anti-join behind "who has their hands free" is served by
     * `asignacion_peregrina_abierta_key`, which is already partial on open rows,
     * and the planner chose it over the new index every time.
     */
    index("asignacion_abiertas_por_fecha_idx")
      .on(t.abiertaAt)
      .where(sql`${t.cerradaAt} is null`),

    // Every read that resolves a couple's periods, and the guard that refuses to
    // end a Matrimonio while one is open.
    index("asignacion_matrimonio_idx").on(t.matrimonioId),

    /**
     * Exactly one Tenedor. A period with neither is a period nobody had, and a
     * period with both is two answers to "who has it".
     *
     * Note this is **not** the same constraint `peregrina` carries. There, all
     * null is legal and means *libre* — see the note on that table. Writing the
     * two as a matched pair is the mistake to avoid: `= 1` on peregrina would
     * make an unassigned image unstorable.
     */
    check(
      "asignacion_un_solo_tenedor",
      sql`num_nonnulls(${t.misioneroId}, ${t.matrimonioId}) = 1`
    ),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const asignacionRelations = relations(asignacion, ({ one }) => ({
  peregrina: one(peregrina, {
    fields: [asignacion.peregrinaId],
    references: [peregrina.id],
  }),
  misionero: one(misionero, {
    fields: [asignacion.misioneroId],
    references: [misionero.id],
  }),
  registradaPor: one(users, {
    fields: [asignacion.registradaPorId],
    references: [users.id],
    relationName: "asignacionRegistradaPor",
  }),
  cerradaPor: one(users, {
    fields: [asignacion.cerradaPorId],
    references: [users.id],
    relationName: "asignacionCerradaPor",
  }),
  corregidaPor: one(users, {
    fields: [asignacion.corregidaPorId],
    references: [users.id],
    relationName: "asignacionCorregidaPor",
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type AsignacionRow = typeof asignacion.$inferSelect;
export type NewAsignacionRow = typeof asignacion.$inferInsert;
