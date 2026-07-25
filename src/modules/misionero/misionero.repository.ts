import { db } from "@/db";
import { misionero } from "./misionero.schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
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

/**
 * A Misionero always travels with its territory resolved — Provincia and
 * Región are derived by traversal, so every read joins them in.
 */
export interface MisioneroConTerritorio {
  misionero: MisioneroRow;
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
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

/**
 * MisioneroRepository
 *
 * Responsibility: raw database access for the `misionero` table.
 * No business logic. No permission checks.
 */
export class MisioneroRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<MisioneroConTerritorio | undefined> {
    const [row] = await conTerritorio().where(eq(misionero.id, id)).limit(1);
    return row;
  }

  static async getById(id: string): Promise<MisioneroConTerritorio> {
    const row = await MisioneroRepository.findById(id);
    if (!row) throw new Error(`Misionero not found: ${id}`);
    return row;
  }

  static async findAll(): Promise<MisioneroConTerritorio[]> {
    return conTerritorio().orderBy(desc(misionero.createdAt));
  }

  static async findByEstado(
    estado: MisioneroEstado
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(eq(misionero.estado, estado))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByRegion(region: Region): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(eq(provincia.region, region))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByDiocesisLocalidad(
    diocesisLocalidadId: string
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(eq(misionero.diocesisLocalidadId, diocesisLocalidadId))
      .orderBy(desc(misionero.createdAt));
  }

  /** ilike, not like: someone searching "gomez" means Gómez. */
  static async search(query: string): Promise<MisioneroConTerritorio[]> {
    const term = `%${query}%`;
    return conTerritorio()
      .where(
        or(
          ilike(misionero.nombre, term),
          ilike(misionero.apellido, term),
          ilike(diocesisLocalidad.nombre, term)
        )
      )
      .orderBy(desc(misionero.createdAt));
  }

  static async findByCreator(
    createdById: string
  ): Promise<MisioneroConTerritorio[]> {
    return conTerritorio()
      .where(eq(misionero.createdById, createdById))
      .orderBy(desc(misionero.createdAt));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(data: NewMisioneroRow): Promise<MisioneroConTerritorio> {
    const [row] = await db.insert(misionero).values(data).returning();
    if (!row) throw new Error("Failed to insert misionero");
    return MisioneroRepository.getById(row.id);
  }

  static async update(
    id: string,
    data: Partial<Omit<MisioneroRow, "id" | "createdById" | "createdAt">>
  ): Promise<MisioneroConTerritorio> {
    const [row] = await db
      .update(misionero)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(misionero.id, id))
      .returning();
    if (!row) throw new Error(`Misionero not found: ${id}`);
    return MisioneroRepository.getById(row.id);
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
    return MisioneroRepository.getById(row.id);
  }

  static async delete(id: string): Promise<void> {
    await db.delete(misionero).where(eq(misionero.id, id));
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  static async countByEstado(): Promise<{ estado: string; count: number }[]> {
    return db
      .select({
        estado: misionero.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(misionero)
      .groupBy(misionero.estado);
  }
}
