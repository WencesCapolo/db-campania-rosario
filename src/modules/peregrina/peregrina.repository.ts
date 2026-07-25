import { db } from "@/db";
import { peregrina } from "./peregrina.schema";
import { eq, desc, and, max, sql, asc } from "drizzle-orm";
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
 * PeregrinaRepository
 *
 * Responsibility: raw database access for the `peregrina` table.
 * No business logic. No permission checks.
 */
export class PeregrinaRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<PeregrinaConTerritorio | undefined> {
    const [row] = await conTerritorio().where(eq(peregrina.id, id)).limit(1);
    return row;
  }

  static async getById(id: string): Promise<PeregrinaConTerritorio> {
    const row = await PeregrinaRepository.findById(id);
    if (!row) throw new Error(`Peregrina not found: ${id}`);
    return row;
  }

  static async findAll(): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio().orderBy(desc(peregrina.createdAt));
  }

  static async findByEstado(
    estado: PeregrinaEstado
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(peregrina.estado, estado))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByRegion(region: Region): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(provincia.region, region))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByModalidad(
    modalidad: Modalidad
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(peregrina.modalidad, modalidad))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByDiocesisLocalidad(
    diocesisLocalidadId: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(peregrina.diocesisLocalidadId, diocesisLocalidadId))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByProvincia(
    provinciaId: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(provincia.id, provinciaId))
      .orderBy(asc(peregrina.codigo));
  }

  static async findByCreator(
    createdById: string
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(eq(peregrina.createdById, createdById))
      .orderBy(desc(peregrina.createdAt));
  }

  /**
   * The next sequential número for a Provincia and Modalidad pair.
   *
   * Keyed on the Provincia reference record rather than on a typed-in name,
   * which is what made the old numbering unreliable: "Córdoba" and "cordoba "
   * each ran their own sequence and produced colliding Códigos.
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
    return PeregrinaRepository.getById(row.id);
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
    return PeregrinaRepository.getById(row.id);
  }

  static async delete(id: string): Promise<void> {
    await db.delete(peregrina).where(eq(peregrina.id, id));
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  static async countByEstado(): Promise<{ estado: string; count: number }[]> {
    return db
      .select({
        estado: peregrina.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .groupBy(peregrina.estado);
  }

  static async countByRegion(): Promise<{ region: string; count: number }[]> {
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
      .groupBy(provincia.region);
  }
}
