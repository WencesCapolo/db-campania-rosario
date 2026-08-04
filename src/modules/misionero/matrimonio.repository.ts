import { db } from "@/db";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { matrimonio } from "./matrimonio.schema";
import type { MatrimonioRow, NewMatrimonioRow } from "./matrimonio.schema";
import { misionero } from "./misionero.schema";
import type { NewMisioneroRow } from "./misionero.schema";
import {
  diocesisLocalidad,
  provincia,
} from "@/modules/territorio/territorio.schema";
import type { Alcance } from "@/lib/authorization/alcance";
import type { FiltrosTerritoriales } from "@/modules/territorio/territorio.types";
import type {
  MisioneroConTerritorio,
  OpcionesDeLectura,
} from "./misionero.repository";
// ↑ Types only, and deliberately so. `misionero.repository` imports *this* file
//   for a value — the roster's marriage leg hydrates through it — so a value
//   import back would close a runtime cycle. A type import is erased.

/**
 * A Matrimonio always travels with both spouses resolved, and each spouse with
 * their own territory.
 *
 * Spouse B's Diócesis is joined rather than copied from spouse A's, even though
 * the two are guaranteed equal by `MatrimonioService.create`. A read that
 * assumes the invariant would render the wrong Región the day the invariant
 * breaks, and would do it silently; a read that joins says what is stored.
 */
export interface MatrimonioConEsposos {
  matrimonio: MatrimonioRow;
  esposoA: MisioneroConTerritorio;
  esposoB: MisioneroConTerritorio;
}

/** Everything one submit of the Matrimonio form has to write. */
export interface NuevoMatrimonio {
  esposoA: NewMisioneroRow;
  esposoB: NewMisioneroRow;
  matrimonio: Omit<NewMatrimonioRow, "misioneroAId" | "misioneroBId">;
}

// ── Aliases ───────────────────────────────────────────────────────────────────
//
// `misionero` appears twice in every read here, so both occurrences need a name
// of their own. Spouse A is not a rank: it is the pair the form asked for first,
// and it carries the couple's sort key and the couple's territory, because this
// table deliberately has neither.

const esposoA = alias(misionero, "esposo_a");
const esposoB = alias(misionero, "esposo_b");
const diocesisA = alias(diocesisLocalidad, "diocesis_a");
const provinciaA = alias(provincia, "provincia_a");
const diocesisB = alias(diocesisLocalidad, "diocesis_b");
const provinciaB = alias(provincia, "provincia_b");

function conEsposos() {
  return db
    .select({
      matrimonio,
      esposoA,
      diocesisA,
      provinciaA,
      esposoB,
      diocesisB,
      provinciaB,
    })
    .from(matrimonio)
    .innerJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
    .innerJoin(diocesisA, eq(diocesisA.id, esposoA.diocesisLocalidadId))
    .innerJoin(provinciaA, eq(provinciaA.id, diocesisA.provinciaId))
    .innerJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
    .innerJoin(diocesisB, eq(diocesisB.id, esposoB.diocesisLocalidadId))
    .innerJoin(provinciaB, eq(provinciaB.id, diocesisB.provinciaId));
}

function armar(fila: {
  matrimonio: MatrimonioRow;
  esposoA: typeof misionero.$inferSelect;
  diocesisA: typeof diocesisLocalidad.$inferSelect;
  provinciaA: typeof provincia.$inferSelect;
  esposoB: typeof misionero.$inferSelect;
  diocesisB: typeof diocesisLocalidad.$inferSelect;
  provinciaB: typeof provincia.$inferSelect;
}): MatrimonioConEsposos {
  return {
    matrimonio: fila.matrimonio,
    esposoA: {
      misionero: fila.esposoA,
      diocesis: fila.diocesisA,
      provincia: fila.provinciaA,
    },
    esposoB: {
      misionero: fila.esposoB,
      diocesis: fila.diocesisB,
      provincia: fila.provinciaB,
    },
  };
}

/**
 * The Actor's territorial filter, as SQL.
 *
 * A Matrimonio has no `diocesis_localidad_id` of its own — ADR 0010 — so the
 * scope lands on spouse A, who supplies the couple's territory. That is well
 * defined only because both spouses share a Diócesis by construction: the form
 * enters it once, and `MatrimonioService.create` writes it to both rows in the
 * same transaction.
 */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(esposoA.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

function conAlcance(
  alcance: Alcance,
  opts: OpcionesDeLectura,
  ...extras: (SQL | undefined)[]
) {
  const filtros = [
    condicionDeAlcance(alcance),
    opts.incluirBajas ? undefined : isNull(matrimonio.bajaAt),
    ...extras,
  ].filter((f) => f !== undefined);
  return filtros.length ? and(...filtros) : undefined;
}

function condicionDeFiltros(
  filtros: FiltrosTerritoriales
): (SQL | undefined)[] {
  return [
    filtros.diocesisLocalidadId
      ? eq(esposoA.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region ? eq(diocesisA.region, filtros.region) : undefined,
  ];
}

/**
 * The couple's whole predicate: Alcance, territory, and a search that has to hit
 * **either** spouse.
 *
 * Searching only spouse A would mean "Benítez" never finds "Ana Álvarez y Juan
 * Benítez", and the person typing has no way to know which half of the household
 * was entered first — which is the confusion this whole feature exists to end.
 */
function condicionDeListado(
  alcance: Alcance,
  filtros: FiltrosTerritoriales & { q?: string },
  opts: OpcionesDeLectura
) {
  const termino = filtros.q?.trim();
  return conAlcance(
    alcance,
    opts,
    ...condicionDeFiltros(filtros),
    termino
      ? or(
          ilike(esposoA.nombre, `%${termino}%`),
          ilike(esposoA.apellido, `%${termino}%`),
          ilike(esposoB.nombre, `%${termino}%`),
          ilike(esposoB.apellido, `%${termino}%`),
          ilike(diocesisA.nombre, `%${termino}%`)
        )
      : undefined
  );
}

/** Counts, never rows. `count(*)` comes back as `bigint`, hence the cast. */
const TOTAL = sql<number>`cast(count(*) as int)`;

/**
 * MatrimonioRepository
 *
 * Responsibility: raw database access for the `matrimonio` table.
 * No business logic. No permission checks. Excludes couples given de baja by
 * default.
 *
 * Every read takes an `Alcance` first, required, so a read added later cannot
 * quietly omit the scope — it fails to compile instead.
 */
export class MatrimonioRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string,
    opts: OpcionesDeLectura = {}
  ): Promise<MatrimonioConEsposos | undefined> {
    const [row] = await conEsposos()
      .where(conAlcance(alcance, opts, eq(matrimonio.id, id)))
      .limit(1);
    return row ? armar(row) : undefined;
  }

  /**
   * The row regardless of territory, so a mutation can tell "does not exist"
   * apart from "not yours" before refusing. A primary-key lookup, named to make
   * the bypass visible; its callers compare the territory immediately.
   *
   * Includes couples given de baja — a Matrimonio that has ended is still a row
   * a write may have just touched.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<MatrimonioConEsposos | undefined> {
    const [row] = await conEsposos().where(eq(matrimonio.id, id)).limit(1);
    return row ? armar(row) : undefined;
  }

  /**
   * The **active** Matrimonio this person is half of, or null.
   *
   * This is the read behind "a married Misionero never holds an image alone" —
   * ADR 0010. `AsignacionService.asignar` calls it before an individual
   * assignment, which is a downstream service reading an upstream repository:
   * the cross-entity guard shape ADR 0004 already permits, and the reason this
   * signature is the one thing here that other modules may depend on.
   *
   * Either spouse matches. Keying on `misionero_a_id` alone is the bug the
   * feature was written to kill: the spouse the image was not filed under was
   * invisible to every guard.
   *
   * Couples given de baja never match. A marriage that has ended hands the two
   * spouses back their individual lives, and that is exactly what "active" means
   * here — no code has to do it on purpose.
   */
  static async deMisionero(
    alcance: Alcance,
    misioneroId: string
  ): Promise<MatrimonioRow | null> {
    const [row] = await db
      .select({ matrimonio })
      .from(matrimonio)
      .innerJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .where(
        conAlcance(
          alcance,
          {},
          or(
            eq(matrimonio.misioneroAId, misioneroId),
            eq(matrimonio.misioneroBId, misioneroId)
          )
        )
      )
      .limit(1);
    return row?.matrimonio ?? null;
  }

  /**
   * Hydration for the roster's marriage leg — the ids come from a union that has
   * already applied the Alcance, and the order comes from there too, so this
   * read neither scopes nor sorts on its own account. The Alcance is still taken
   * and still applied: a read that could be called with an unscoped intent is a
   * read somebody will call that way.
   */
  static async findByIds(
    alcance: Alcance,
    ids: string[],
    opts: OpcionesDeLectura = {}
  ): Promise<MatrimonioConEsposos[]> {
    if (ids.length === 0) return [];
    const filas = await conEsposos().where(
      conAlcance(alcance, opts, inArray(matrimonio.id, ids))
    );
    return filas.map(armar);
  }

  static async findFiltrados(
    alcance: Alcance,
    filtros: FiltrosTerritoriales & { q?: string },
    opts: OpcionesDeLectura = {},
    paginacion?: { limit: number; offset: number }
  ): Promise<MatrimonioConEsposos[]> {
    const consulta = conEsposos()
      .where(condicionDeListado(alcance, filtros, opts))
      .orderBy(asc(esposoA.apellido), asc(esposoA.nombre), asc(matrimonio.id));

    const filas = await (paginacion
      ? consulta.limit(paginacion.limit).offset(paginacion.offset)
      : consulta);

    return filas.map(armar);
  }

  /** The same predicate as `findFiltrados`, counted in the database. */
  static async contarFiltrados(
    alcance: Alcance,
    filtros: FiltrosTerritoriales & { q?: string },
    opts: OpcionesDeLectura = {}
  ): Promise<number> {
    const [row] = await db
      .select({ total: TOTAL })
      .from(matrimonio)
      .innerJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .innerJoin(diocesisA, eq(diocesisA.id, esposoA.diocesisLocalidadId))
      .innerJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
      .where(condicionDeListado(alcance, filtros, opts));
    return row?.total ?? 0;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Two Misioneros and one Matrimonio, or none of them.
   *
   * The transaction is here rather than in the service for the reason
   * `AsignacionRepository.entregar`'s is: a transaction is a property of the
   * three statements, and the service has no business holding a database handle
   * to keep them together. What it buys is the invariant the whole feature rests
   * on — half a marriage is not a thing, and a crash between the second insert
   * and the third would leave two individuals nobody meant to enter, each of
   * them selectable on their own in every picker.
   *
   * `db.transaction` works in production: `src/db/index.ts` is the
   * `neon-serverless` driver, not `neon-http`, which throws (ADR 0004).
   */
  static async crear(datos: NuevoMatrimonio): Promise<string> {
    return db.transaction(async (tx) => {
      const [a] = await tx
        .insert(misionero)
        .values(datos.esposoA)
        .returning({ id: misionero.id });
      if (!a) throw new Error("Failed to insert esposo A");

      const [b] = await tx
        .insert(misionero)
        .values(datos.esposoB)
        .returning({ id: misionero.id });
      if (!b) throw new Error("Failed to insert esposo B");

      const [fila] = await tx
        .insert(matrimonio)
        .values({ ...datos.matrimonio, misioneroAId: a.id, misioneroBId: b.id })
        .returning({ id: matrimonio.id });
      if (!fila) throw new Error("Failed to insert matrimonio");

      return fila.id;
    });
  }

  /**
   * What the couple shares, and each spouse's own name and año, in one
   * transaction — for the same reason `crear` is one. An edit that renamed one
   * spouse and failed on the other would leave the listado reading a household
   * that never existed.
   */
  static async actualizar(
    id: string,
    datos: {
      matrimonio?: Partial<
        Omit<MatrimonioRow, "id" | "createdById" | "createdAt" | "bajaAt">
      >;
      esposoA?: { id: string; cambios: Partial<NewMisioneroRow> };
      esposoB?: { id: string; cambios: Partial<NewMisioneroRow> };
    }
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (const esposo of [datos.esposoA, datos.esposoB]) {
        if (!esposo || Object.keys(esposo.cambios).length === 0) continue;
        await tx
          .update(misionero)
          .set({ ...esposo.cambios, updatedAt: new Date() })
          .where(eq(misionero.id, esposo.id));
      }

      const [fila] = await tx
        .update(matrimonio)
        .set({ ...datos.matrimonio, updatedAt: new Date() })
        .where(eq(matrimonio.id, id))
        .returning({ id: matrimonio.id });
      if (!fila) throw new Error(`Matrimonio not found: ${id}`);
    });
  }

  /**
   * Baja lógica — the marriage ended, a separation or a death.
   *
   * There is no `delete`, for the reason there is none on `misionero`: every
   * Asignación the couple held has to keep resolving to the couple, because what
   * the historial says about a period is what was true then.
   *
   * `undefined` means it was already de baja.
   */
  static async darDeBaja(id: string): Promise<MatrimonioRow | undefined> {
    const [row] = await db
      .update(matrimonio)
      .set({ bajaAt: new Date(), updatedAt: new Date() })
      .where(and(eq(matrimonio.id, id), isNull(matrimonio.bajaAt)))
      .returning();
    return row;
  }
}
