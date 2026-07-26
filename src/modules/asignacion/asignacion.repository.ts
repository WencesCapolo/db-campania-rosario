import { db } from "@/db";
import { and, asc, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { asignacion } from "./asignacion.schema";
import type { AsignacionRow, NewAsignacionRow } from "./asignacion.schema";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import { users } from "@/db/schema/users";
import { diocesisLocalidad } from "@/modules/territorio/territorio.schema";
import type { Alcance } from "@/lib/authorization/alcance";

/**
 * An Asignación is never useful on its own: a row of three foreign keys answers
 * nobody's question. Every read resolves the Código, the Misionero's name, and
 * the territory of each login that touched the record.
 */
export interface AsignacionCompleta {
  asignacion: AsignacionRow;
  peregrinaCodigo: string;
  peregrinaBajaAt: Date | null;
  /** The Peregrina's territory — what this Asignación is scoped through. */
  peregrinaDiocesisLocalidadId: string;
  misioneroNombre: string;
  misioneroApellido: string;
  misioneroBajaAt: Date | null;
  registradaPorDiocesis: string | null;
  cerradaPorDiocesis: string | null;
  corregidaPorDiocesis: string | null;
}

// Three different logins can touch one Asignación — the one that opened it, the
// one that closed it, and the one that corrected it — so `users` and
// `diocesis_localidad` are joined once per role. Left joins throughout: a
// nacional rol has no territory, and a period that is still open has no closer.
const registrante = alias(users, "registrante");
const diocesisRegistrante = alias(diocesisLocalidad, "diocesis_registrante");
const cerrador = alias(users, "cerrador");
const diocesisCerrador = alias(diocesisLocalidad, "diocesis_cerrador");
const corrector = alias(users, "corrector");
const diocesisCorrector = alias(diocesisLocalidad, "diocesis_corrector");

function completa() {
  return db
    .select({
      asignacion,
      peregrinaCodigo: peregrina.codigo,
      peregrinaBajaAt: peregrina.bajaAt,
      peregrinaDiocesisLocalidadId: peregrina.diocesisLocalidadId,
      misioneroNombre: misionero.nombre,
      misioneroApellido: misionero.apellido,
      misioneroBajaAt: misionero.bajaAt,
      registradaPorDiocesis: diocesisRegistrante.nombre,
      cerradaPorDiocesis: diocesisCerrador.nombre,
      corregidaPorDiocesis: diocesisCorrector.nombre,
    })
    .from(asignacion)
    // Inner joins, and deliberately not filtered on `baja_at`: a Misionero given
    // de baja must still resolve by name inside historical Asignaciones (user
    // story 15), and a Peregrina given de baja keeps its chain of custody. Soft
    // delete hides rows from *active lists*, not from history.
    .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
    .innerJoin(misionero, eq(misionero.id, asignacion.misioneroId))
    .leftJoin(registrante, eq(registrante.id, asignacion.registradaPorId))
    .leftJoin(
      diocesisRegistrante,
      eq(diocesisRegistrante.id, registrante.diocesisLocalidadId)
    )
    .leftJoin(cerrador, eq(cerrador.id, asignacion.cerradaPorId))
    .leftJoin(
      diocesisCerrador,
      eq(diocesisCerrador.id, cerrador.diocesisLocalidadId)
    )
    .leftJoin(corrector, eq(corrector.id, asignacion.corregidaPorId))
    .leftJoin(
      diocesisCorrector,
      eq(diocesisCorrector.id, corrector.diocesisLocalidadId)
    );
}

/**
 * The Actor's territorial filter, as SQL.
 *
 * The one place in the codebase where the filter is not a column on the table
 * being read. An Asignación has no territory of its own — a Peregrina is the
 * thing that lives somewhere — so the predicate lands on the joined `peregrina`
 * row, and every scoped read therefore joins it. `asignacion_peregrina_idx`
 * covers that join.
 *
 * The consequence is worth stating rather than discovering: a Peregrina that
 * moves Diócesis takes its whole history with it, so a Referente Local can lose
 * sight of Asignaciones their own territory registered, if an Asesor Nacional
 * moves the image out. That is the right way round — the chain of custody belongs
 * to the image — and the alternative, copying the territory onto each Asignación
 * when it opens, would freeze a fact that changes and is far worse to undo.
 */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(peregrina.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

function conAlcance(alcance: Alcance, ...extras: (SQL | undefined)[]) {
  const filtros = [condicionDeAlcance(alcance), ...extras].filter(
    (f) => f !== undefined
  );
  return filtros.length ? and(...filtros) : undefined;
}

/** An open period: no closing timestamp. This is the tenencia actual. */
const abierta = isNull(asignacion.cerradaAt);

/**
 * True when the database refused a second open Asignación for the same Peregrina.
 *
 * The partial unique index is the storage-layer half of the invariant, and this
 * is how the service recognises it and reports a conflict rather than an
 * unexpected failure. Kept here because the repository is the only layer that
 * should know a constraint's name.
 */
export function esSegundaAsignacionAbierta(error: unknown): boolean {
  // Drizzle wraps a driver error in one of its own, so the Postgres detail — the
  // `23505` and the constraint name — is a link or two down the `cause` chain and
  // not in the top-level message. Both drivers put it there; walking the chain is
  // what makes this work the same in the suite and in production.
  for (let actual: unknown = error; actual instanceof Error; actual = actual.cause) {
    const codigo = (actual as { code?: unknown }).code;
    const restriccion = (actual as { constraint?: unknown }).constraint;

    if (codigo === "23505" && restriccion === CLAVE_ASIGNACION_ABIERTA) {
      return true;
    }
    if (actual.message.includes(CLAVE_ASIGNACION_ABIERTA)) return true;
  }
  return false;
}

const CLAVE_ASIGNACION_ABIERTA = "asignacion_peregrina_abierta_key";

/**
 * AsignacionRepository
 *
 * Responsibility: raw database access for the `asignacion` table, plus the
 * denormalised `peregrina.misionero_actual_id` pointer that is derived from it —
 * the pointer is never written anywhere else, so the two cannot drift.
 *
 * No business logic. No permission checks. Every read takes an `Alcance` as its
 * first parameter, required, so a read added later cannot quietly omit the scope.
 */
export class AsignacionRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string
  ): Promise<AsignacionCompleta | undefined> {
    const [row] = await completa()
      .where(conAlcance(alcance, eq(asignacion.id, id)))
      .limit(1);
    return row;
  }

  /**
   * The row regardless of territory, so a mutation can tell "does not exist"
   * apart from "not yours" before refusing. A primary-key lookup, named to make
   * the bypass visible; its callers compare the territory immediately.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<AsignacionCompleta | undefined> {
    const [row] = await completa().where(eq(asignacion.id, id)).limit(1);
    return row;
  }

  /** The tenencia actual, if anybody has this image. */
  static async findAbiertaDePeregrina(
    alcance: Alcance,
    peregrinaId: string
  ): Promise<AsignacionCompleta | undefined> {
    const [row] = await completa()
      .where(conAlcance(alcance, eq(asignacion.peregrinaId, peregrinaId), abierta))
      .limit(1);
    return row;
  }

  /**
   * The whole chain of custody, oldest first — user stories 4, 5 and 6.
   *
   * Chronological rather than newest-first: the question this answers is "where
   * has this image been", and a chain reads forwards. An Extraviada Peregrina's
   * last holder is the open row, which sorts last and stays open on purpose.
   */
  static async findHistorialDePeregrina(
    alcance: Alcance,
    peregrinaId: string
  ): Promise<AsignacionCompleta[]> {
    return completa()
      .where(conAlcance(alcance, eq(asignacion.peregrinaId, peregrinaId)))
      .orderBy(asc(asignacion.abiertaAt), asc(asignacion.createdAt));
  }

  /** Every Peregrina this Misionero has ever had, most recent first — story 7. */
  static async findHistorialDeMisionero(
    alcance: Alcance,
    misioneroId: string
  ): Promise<AsignacionCompleta[]> {
    return completa()
      .where(conAlcance(alcance, eq(asignacion.misioneroId, misioneroId)))
      .orderBy(desc(asignacion.abiertaAt), desc(asignacion.createdAt));
  }

  /**
   * Every image this Misionero still has, **ignoring territory** — the guard
   * behind stories 13 and 14.
   *
   * Unscoped on purpose, and this is the one place where that is not a
   * convenience. A Peregrina can be moved to another Diócesis while a Misionero
   * still physically holds it, so a scoped count would report zero and let the
   * person be closed out with the image in their house. A guard that can be
   * wrong in the permissive direction is not a guard.
   *
   * The caller is responsible for not leaking what it learns: `MisioneroService`
   * names the Código only when the Actor could have seen it anyway, and otherwise
   * says that an image from another territory is outstanding.
   */
  static async findAbiertasDeMisioneroSinAlcance(
    misioneroId: string
  ): Promise<AsignacionCompleta[]> {
    return completa()
      .where(and(eq(asignacion.misioneroId, misioneroId), abierta))
      .orderBy(asc(peregrina.codigo));
  }

  /**
   * Every image this Peregrina's own record still has open, ignoring territory —
   * the guard behind story 16, for the same reason as above.
   */
  static async findAbiertaDePeregrinaSinAlcance(
    peregrinaId: string
  ): Promise<AsignacionCompleta | undefined> {
    const [row] = await completa()
      .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
      .limit(1);
    return row;
  }

  /**
   * Peregrinas that have never been in anybody's charge — user story 19.
   *
   * A left join with no matching Asignación, rather than a count of zero, so an
   * image that was held once and returned is *not* here: "never assigned" and
   * "not assigned right now" are different questions and the second one is
   * `misionero_actual_id is null`.
   */
  static async findPeregrinasNuncaAsignadas(
    alcance: Alcance
  ): Promise<{ id: string; codigo: string }[]> {
    return db
      .select({ id: peregrina.id, codigo: peregrina.codigo })
      .from(peregrina)
      .leftJoin(asignacion, eq(asignacion.peregrinaId, peregrina.id))
      .where(
        conAlcance(
          alcance,
          isNull(asignacion.id),
          // Retired images are not idle capacity.
          isNull(peregrina.bajaAt)
        )
      )
      .orderBy(asc(peregrina.codigo));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────
  //
  // The three write paths each hold the Asignación table and the denormalised
  // pointer in step, in one transaction, because "this image changed hands" is
  // one fact about the world and half of it is worse than none of it.

  /** Opens a period for a Peregrina nobody currently has. */
  static async abrir(data: NewAsignacionRow): Promise<AsignacionCompleta> {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(asignacion).values(data).returning();
      if (!row) throw new Error("Failed to insert asignacion");

      await tx
        .update(peregrina)
        .set({ misioneroActualId: data.misioneroId, updatedAt: new Date() })
        .where(eq(peregrina.id, data.peregrinaId));

      return row.id;
    });

    return AsignacionRepository.exigirRecienEscrita(id);
  }

  /**
   * Closes the open period and leaves the Peregrina with nobody — user story 3.
   *
   * `undefined` means there was nothing open to close: either it never was, or
   * somebody else registered the return first. The `cerrada_at is null` predicate
   * is the concurrency control, the same trick `InvitacionRepository.marcarAceptada`
   * uses — no lock, and the loser finds out instead of overwriting.
   */
  static async cerrar(
    peregrinaId: string,
    cierre: { cerradaAt: Date; cerradaPorId: string; notaCierre: string | null }
  ): Promise<AsignacionCompleta | undefined> {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(asignacion)
        .set({
          cerradaAt: cierre.cerradaAt,
          cerradaPorId: cierre.cerradaPorId,
          notaCierre: cierre.notaCierre,
          updatedAt: new Date(),
        })
        .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
        .returning();
      if (!row) return undefined;

      await tx
        .update(peregrina)
        .set({ misioneroActualId: null, updatedAt: new Date() })
        .where(eq(peregrina.id, peregrinaId));

      return row.id;
    });

    return id ? AsignacionRepository.exigirRecienEscrita(id) : undefined;
  }

  /**
   * Hands the image on: closes one period and opens the next, atomically —
   * user stories 1 and 2.
   *
   * Returns both rows, because the caller has something to say about each: the
   * period that ended and the period that began. `undefined` again means somebody
   * else moved first.
   */
  static async cerrarYAbrir(
    peregrinaId: string,
    cierre: { cerradaAt: Date; cerradaPorId: string; notaCierre: string | null },
    apertura: NewAsignacionRow
  ): Promise<{ cerrada: string; abierta: string } | undefined> {
    return db.transaction(async (tx) => {
      const [cerrada] = await tx
        .update(asignacion)
        .set({
          cerradaAt: cierre.cerradaAt,
          cerradaPorId: cierre.cerradaPorId,
          notaCierre: cierre.notaCierre,
          updatedAt: new Date(),
        })
        .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
        .returning();
      if (!cerrada) return undefined;

      const [nueva] = await tx.insert(asignacion).values(apertura).returning();
      if (!nueva) throw new Error("Failed to insert asignacion");

      await tx
        .update(peregrina)
        .set({ misioneroActualId: apertura.misioneroId, updatedAt: new Date() })
        .where(eq(peregrina.id, peregrinaId));

      return { cerrada: cerrada.id, abierta: nueva.id };
    });
  }

  /**
   * Corrects a record — user story 17.
   *
   * `corregidaAt` and `corregidaPorId` are set here rather than by the caller, so
   * that no correction can be applied without leaving a mark. The pointer is
   * refreshed too: correcting which Misionero held an open period changes who has
   * the image right now.
   */
  static async corregir(
    id: string,
    data: Partial<
      Pick<
        AsignacionRow,
        "misioneroId" | "abiertaAt" | "cerradaAt" | "notaApertura" | "notaCierre"
      >
    >,
    correccion: { corregidaAt: Date; corregidaPorId: string }
  ): Promise<AsignacionCompleta> {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(asignacion)
        .set({
          ...data,
          corregidaAt: correccion.corregidaAt,
          corregidaPorId: correccion.corregidaPorId,
          updatedAt: new Date(),
        })
        .where(eq(asignacion.id, id))
        .returning();
      if (!row) throw new Error(`Asignacion not found: ${id}`);

      await tx
        .update(peregrina)
        .set({
          misioneroActualId: row.cerradaAt === null ? row.misioneroId : null,
          updatedAt: new Date(),
        })
        .where(eq(peregrina.id, row.peregrinaId));
    });

    return AsignacionRepository.exigirRecienEscrita(id);
  }

  /** Reads back a row this repository has just written, resolved for the caller. */
  static async exigirRecienEscrita(id: string): Promise<AsignacionCompleta> {
    const row = await AsignacionRepository.findByIdSinAlcance(id);
    if (!row) throw new Error(`Asignacion not found: ${id}`);
    return row;
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  /** Open, closed and never-assigned counts for the dashboard, scoped. */
  static async contarPorTenencia(
    alcance: Alcance
  ): Promise<{ abiertas: number; cerradas: number }> {
    const [row] = await db
      .select({
        abiertas: sql<number>`cast(count(*) filter (where ${abierta}) as int)`,
        cerradas: sql<number>`cast(count(*) filter (where ${isNotNull(
          asignacion.cerradaAt
        )}) as int)`,
      })
      .from(asignacion)
      .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
      .where(conAlcance(alcance));

    return { abiertas: row?.abiertas ?? 0, cerradas: row?.cerradas ?? 0 };
  }
}
