import { db } from "@/db";
import { misionero } from "./misionero.schema";
import { eq, desc, like, or, sql } from "drizzle-orm";
import type { MisioneroRow, NewMisioneroRow, MisioneroEstado } from "./misionero.schema";
import type { Region } from "@/modules/peregrina/peregrina.schema";

/**
 * MisioneroRepository
 *
 * Responsibility: raw database access for the `misionero` table.
 * No business logic. No permission checks.
 */
export class MisioneroRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<MisioneroRow | undefined> {
    const [row] = await db
      .select()
      .from(misionero)
      .where(eq(misionero.id, id))
      .limit(1);
    return row;
  }

  static async getById(id: string): Promise<MisioneroRow> {
    const row = await MisioneroRepository.findById(id);
    if (!row) throw new Error(`Misionero not found: ${id}`);
    return row;
  }

  static async findAll(): Promise<MisioneroRow[]> {
    return db.select().from(misionero).orderBy(desc(misionero.createdAt));
  }

  static async findByEstado(estado: MisioneroEstado): Promise<MisioneroRow[]> {
    return db
      .select()
      .from(misionero)
      .where(eq(misionero.estado, estado))
      .orderBy(desc(misionero.createdAt));
  }

  static async findByRegion(region: Region): Promise<MisioneroRow[]> {
    return db
      .select()
      .from(misionero)
      .where(eq(misionero.region, region))
      .orderBy(desc(misionero.createdAt));
  }

  static async search(query: string): Promise<MisioneroRow[]> {
    const term = `%${query}%`;
    return db
      .select()
      .from(misionero)
      .where(
        or(
          like(misionero.nombre, term),
          like(misionero.apellido, term),
          like(misionero.diocesisLocalidad, term)
        )
      )
      .orderBy(desc(misionero.createdAt));
  }

  static async findByCreator(createdById: string): Promise<MisioneroRow[]> {
    return db
      .select()
      .from(misionero)
      .where(eq(misionero.createdById, createdById))
      .orderBy(desc(misionero.createdAt));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(data: NewMisioneroRow): Promise<MisioneroRow> {
    const [row] = await db.insert(misionero).values(data).returning();
    if (!row) throw new Error("Failed to insert misionero");
    return row;
  }

  static async update(
    id: string,
    data: Partial<Omit<MisioneroRow, "id" | "createdById" | "createdAt">>
  ): Promise<MisioneroRow> {
    const [row] = await db
      .update(misionero)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(misionero.id, id))
      .returning();
    if (!row) throw new Error(`Misionero not found: ${id}`);
    return row;
  }

  /**
   * Merges a single year's resumen into the existing JSON object.
   * Uses Postgres jsonb concatenation to avoid a read-modify-write race.
   */
  static async upsertResumenAnual(
    id: string,
    year: number,
    resumen: string
  ): Promise<MisioneroRow> {
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
    return row;
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
