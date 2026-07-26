import { db } from "@/db";
import { misionero } from "./misionero.schema";
import { eq, desc, ilike, or, and, sql, isNull, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { MisioneroRow, NewMisioneroRow, MisioneroEstado } from "./misionero.schema";
import {
  diocesisLocalidad,
  provincia,
} from "@/modules/territorio/territorio.schema";
import type {
  DiocesisLocalidadRow,
  ProvinciaRow,
  Region,
} from "@/modules/territorio/territorio.schema";
import type { Alcance } from "@/lib/authorization/alcance";

/**
 * A Misionero always travels with its territory resolved — Provincia and
 * Región are derived by traversal, so every read joins them in.
 */
export interface MisioneroConTerritorio {
  misionero: MisioneroRow;
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
}

/**
 * Whether a read includes Misioneros given de baja.
 *
 * Excluded by default: user story 12 is precisely "they stop appearing in my
 * active lists". History is the exception, and it does not come through this
 * repository — `AsignacionRepository` joins `misionero` without the filter, so a
 * Misionero who has left the Campaña keeps resolving by name inside every period
 * they held (user story 15).
 */
export interface OpcionesDeLectura {
  incluirBajas?: boolean;
}

function conTerritorio() {
  return db
    .select({ misionero, diocesis: diocesisLocalidad, provincia })
    .from(misionero)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, misionero.diocesisLocalidadId)
    )
    .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId));
}

/** The Actor's territorial filter, as SQL. Derived elsewhere; applied here. */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(misionero.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

function conAlcance(
  alcance: Alcance,
  opts: OpcionesDeLectura,
  ...extras: (SQL | undefined)[]
) {
  const filtros = [
    condicionDeAlcance(alcance),
    opts.incluirBajas ? undefined : isNull(misionero.bajaAt),
    ...extras,
  ].filter((f) => f !== undefined);
  return filtros.length ? and(...filtros) : undefined;
}

/**
 * MisioneroRepository
 *
 * Responsibility: raw database access for the `misionero` table.
 * No business logic. No permission checks. Excludes records given de baja by
 * default.
 *
 * Every read takes an `Alcance` first, required, so a read added later cannot
 * quietly omit the scope — it fails to compile instead (user story 20).
 */
export class MisioneroRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio | undefined> {
    const [row] = await conTerritorio()
      .where(conAlcance(alcance, opts, eq(misionero.id, id)))
      .limit(1);
    return row;
  }

  /**
   * The row regardless of territory, so a mutation can tell "does not exist"
   * apart from "not yours" before refusing. A primary-key lookup, named to make
   * the bypass visible; its callers compare the territory immediately.
   *
   * Includes records given de baja — reactivating one is a mutation too.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<MisioneroConTerritorio | undefined> {
    const [row] = await conTerritorio().where(eq(misionero.id, id)).limit(1);
    return row;
  }

  static async findAll(
    alcance: Alcance,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByEstado(
    alcance: Alcance,
    estado: MisioneroEstado,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(misionero.estado, estado)))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByRegion(
    alcance: Alcance,
    region: Region,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(provincia.region, region)))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByDiocesisLocalidad(
    alcance: Alcance,
    diocesisLocalidadId: string,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(
        conAlcance(
          alcance,
          opts,
          eq(misionero.diocesisLocalidadId, diocesisLocalidadId)
        )
      )
      .orderBy(desc(misionero.createdAt));
  }

  /** ilike, not like: someone searching "gomez" means Gómez. */
  static async search(
    alcance: Alcance,
    query: string,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    const term = `%${query}%`;
    return conTerritorio()
      .where(
        conAlcance(
          alcance,
          opts,
          or(
            ilike(misionero.nombre, term),
            ilike(misionero.apellido, term),
            ilike(diocesisLocalidad.nombre, term)
          )
        )
      )
      .orderBy(desc(misionero.createdAt));
  }

  static async findByCreator(
    alcance: Alcance,
    createdById: string,
    opts: OpcionesDeLectura = {}
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(misionero.createdById, createdById)))
      .orderBy(desc(misionero.createdAt));
  }

  /** Alphabetical, for the first step of the assignment flow. */
  static async findParaElegir(
    alcance: Alcance
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, {}))
      .orderBy(asc(misionero.apellido), asc(misionero.nombre));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(data: NewMisioneroRow): Promise<MisioneroConTerritorio> {
    const [row] = await db.insert(misionero).values(data).returning();
    if (!row) throw new Error("Failed to insert misionero");
    const creado = await MisioneroRepository.findByIdSinAlcance(row.id);
    if (!creado) throw new Error(`Misionero not found: ${row.id}`);
    return creado;
  }

  static async update(
    id: string,
    data: Partial<
      Omit<MisioneroRow, "id" | "createdById" | "createdAt" | "bajaAt">
    >
  ): Promise<MisioneroConTerritorio> {
    const [row] = await db
      .update(misionero)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(misionero.id, id))
      .returning();
    if (!row) throw new Error(`Misionero not found: ${id}`);
    const actualizado = await MisioneroRepository.findByIdSinAlcance(row.id);
    if (!actualizado) throw new Error(`Misionero not found: ${row.id}`);
    return actualizado;
  }

  /**
   * Merges a single year's resumen into the existing JSON object.
   * Uses Postgres jsonb concatenation to avoid a read-modify-write race.
   */
  static async upsertResumenAnual(
    id: string,
    year: number,
    resumen: string
  ): Promise<MisioneroConTerritorio> {
    const patch = JSON.stringify({ [year]: resumen });
    const [row] = await db
      .update(misionero)
      .set({
        resumenesAnuales: sql`coalesce(${misionero.resumenesAnuales}::jsonb, '{}'::jsonb) || ${patch}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(misionero.id, id))
      .returning();
    if (!row) throw new Error(`Misionero not found: ${id}`);
    const actualizado = await MisioneroRepository.findByIdSinAlcance(row.id);
    if (!actualizado) throw new Error(`Misionero not found: ${row.id}`);
    return actualizado;
  }

  /**
   * Baja lógica — user stories 12 and 15. There is no `delete`: destroying a
   * Misionero would destroy the record of what they were responsible for, which is
   * exactly the history this issue exists to keep.
   *
   * `undefined` means they were already de baja.
   */
  static async darDeBaja(id: string): Promise<MisioneroRow | undefined> {
    const [row] = await db
      .update(misionero)
      .set({ bajaAt: new Date(), updatedAt: new Date() })
      .where(and(eq(misionero.id, id), isNull(misionero.bajaAt)))
      .returning();
    return row;
  }

  static async reactivar(id: string): Promise<MisioneroRow | undefined> {
    const [row] = await db
      .update(misionero)
      .set({ bajaAt: null, updatedAt: new Date() })
      .where(and(eq(misionero.id, id), sql`${misionero.bajaAt} is not null`))
      .returning();
    return row;
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  static async countByEstado(
    alcance: Alcance,
    opts: OpcionesDeLectura = {}
  ): Promise<{ estado: string; count: number }[]> {
    return db
      .select({
        estado: misionero.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(misionero)
      .where(conAlcance(alcance, opts))
      .groupBy(misionero.estado);
  }
}
