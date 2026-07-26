import { db } from "@/db";
import { peregrina } from "./peregrina.schema";
import { eq, desc, and, max, sql, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  PeregrinaRow,
  NewPeregrinaRow,
  PeregrinaEstado,
  Modalidad,
} from "./peregrina.schema";
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
 * A Peregrina is never useful without its territory resolved — Provincia and
 * Región are derived by traversal, so every read joins them in.
 */
export interface PeregrinaConTerritorio {
  peregrina: PeregrinaRow;
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
}

function conTerritorio() {
  return db
    .select({ peregrina, diocesis: diocesisLocalidad, provincia })
    .from(peregrina)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
    )
    .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId));
}

/**
 * The Actor's territorial filter, as SQL. `undefined` for a country-wide Actor,
 * which is how a filter says "no restriction" to Drizzle's `and()`.
 *
 * Note what is *not* here: any decision about who gets which filter. That lives
 * in `derivarAlcance`, once, and arrives already made.
 */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(peregrina.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

function conAlcance(
  alcance: Alcance,
  ...extras: (SQL | undefined)[]
) {
  const filtros = [condicionDeAlcance(alcance), ...extras].filter(
    (f) => f !== undefined
  );
  return filtros.length ? and(...filtros) : undefined;
}

/**
 * PeregrinaRepository
 *
 * Responsibility: raw database access for the `peregrina` table.
 * No business logic. No permission checks.
 *
 * Every read takes an `Alcance` as its first parameter, mirroring the Actor-first
 * rule one layer up. It is required rather than optional on purpose: a new read
 * that forgets to scope itself does not compile, which is user story 20.
 */
export class PeregrinaRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string
  ): Promise<PeregrinaConTerritorio | undefined> {
    const [row] = await conTerritorio()
      .where(conAlcance(alcance, eq(peregrina.id, id)))
      .limit(1);
    return row;
  }

  /**
   * The row regardless of territory, for a mutation that has to tell "does not
   * exist" apart from "not yours" before it refuses.
   *
   * Named so the bypass is visible at the call site. It is a primary-key lookup,
   * so it cannot enumerate anything, and its only callers immediately compare
   * the row's territory against the Actor's scope.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<PeregrinaConTerritorio | undefined> {
    const [row] = await conTerritorio().where(eq(peregrina.id, id)).limit(1);
    return row;
  }

  static async findAll(alcance: Alcance): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByEstado(
    alcance: Alcance,
    estado: PeregrinaEstado
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, eq(peregrina.estado, estado)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByRegion(
    alcance: Alcance,
    region: Region
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, eq(provincia.region, region)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByModalidad(
    alcance: Alcance,
    modalidad: Modalidad
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, eq(peregrina.modalidad, modalidad)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByDiocesisLocalidad(
    alcance: Alcance,
    diocesisLocalidadId: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(
        conAlcance(
          alcance,
          eq(peregrina.diocesisLocalidadId, diocesisLocalidadId)
        )
      )
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByProvincia(
    alcance: Alcance,
    provinciaId: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, eq(provincia.id, provinciaId)))
      .orderBy(asc(peregrina.codigo));
  }

  static async findByCreator(
    alcance: Alcance,
    createdById: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, eq(peregrina.createdById, createdById)))
      .orderBy(desc(peregrina.createdAt));
  }

  /**
   * The next sequential número for a Provincia and Modalidad pair.
   *
   * Keyed on the Provincia reference record rather than on a typed-in name,
   * which is what made the old numbering unreliable: "Córdoba" and "cordoba "
   * each ran their own sequence and produced colliding Códigos.
   *
   * Deliberately not scoped. A Código is globally unique and its sequence runs
   * per Provincia, so narrowing this to the Actor's Diócesis would restart the
   * numbering inside each town and mint duplicates. It reads a max, never a row.
   */
  static async nextCodigoNum(
    provinciaId: string,
    modalidad: Modalidad
  ): Promise<number> {
    const [result] = await db
      .select({ maxNum: max(peregrina.codigoNum) })
      .from(peregrina)
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
      )
      .where(
        and(
          eq(diocesisLocalidad.provinciaId, provinciaId),
          eq(peregrina.modalidad, modalidad)
        )
      );
    return (result?.maxNum ?? 0) + 1;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(data: NewPeregrinaRow): Promise<PeregrinaConTerritorio> {
    const [row] = await db.insert(peregrina).values(data).returning();
    if (!row) throw new Error("Failed to insert peregrina");
    const creada = await PeregrinaRepository.findByIdSinAlcance(row.id);
    if (!creada) throw new Error(`Peregrina not found: ${row.id}`);
    return creada;
  }

  static async update(
    id: string,
    data: Partial<
      Omit<PeregrinaRow, "id" | "codigo" | "codigoNum" | "createdById" | "createdAt">
    >
  ): Promise<PeregrinaConTerritorio> {
    const [row] = await db
      .update(peregrina)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(peregrina.id, id))
      .returning();
    if (!row) throw new Error(`Peregrina not found: ${id}`);
    const actualizada = await PeregrinaRepository.findByIdSinAlcance(row.id);
    if (!actualizada) throw new Error(`Peregrina not found: ${row.id}`);
    return actualizada;
  }

  static async delete(id: string): Promise<void> {
    await db.delete(peregrina).where(eq(peregrina.id, id));
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  static async countByEstado(
    alcance: Alcance
  ): Promise<{ estado: string; count: number }[]> {
    return db
      .select({
        estado: peregrina.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .where(conAlcance(alcance))
      .groupBy(peregrina.estado);
  }

  static async countByRegion(
    alcance: Alcance
  ): Promise<{ region: string; count: number }[]> {
    return db
      .select({
        region: provincia.region,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
      )
      .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
      .where(conAlcance(alcance))
      .groupBy(provincia.region);
  }
}
