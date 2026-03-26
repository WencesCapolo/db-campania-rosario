import { db } from "@/db";
import { peregrina } from "./peregrina.schema";
import { eq, desc, and, max, sql } from "drizzle-orm";
import type {
  PeregrinaRow,
  NewPeregrinaRow,
  PeregrinaEstado,
  Region,
  Modalidad,
} from "./peregrina.schema";

/**
 * PeregrinaRepository
 *
 * Responsibility: raw database access for the `peregrina` table.
 * No business logic. No permission checks.
 */
export class PeregrinaRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<PeregrinaRow | undefined> {
    const [row] = await db
      .select()
      .from(peregrina)
      .where(eq(peregrina.id, id))
      .limit(1);
    return row;
  }

  static async getById(id: string): Promise<PeregrinaRow> {
    const row = await PeregrinaRepository.findById(id);
    if (!row) throw new Error(`Peregrina not found: ${id}`);
    return row;
  }

  static async findAll(): Promise<PeregrinaRow[]> {
    return db.select().from(peregrina).orderBy(desc(peregrina.createdAt));
  }

  static async findByEstado(estado: PeregrinaEstado): Promise<PeregrinaRow[]> {
    return db
      .select()
      .from(peregrina)
      .where(eq(peregrina.estado, estado))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByRegion(region: Region): Promise<PeregrinaRow[]> {
    return db
      .select()
      .from(peregrina)
      .where(eq(peregrina.region, region))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByModalidad(modalidad: Modalidad): Promise<PeregrinaRow[]> {
    return db
      .select()
      .from(peregrina)
      .where(eq(peregrina.modalidad, modalidad))
      .orderBy(desc(peregrina.createdAt));
  }

  // NOTE: Peregrinas are now queried by misionero from the misionero repository.
  // The misionero table holds the FK (misionero.peregrinaId → peregrina.id).

  static async findByCreator(createdById: string): Promise<PeregrinaRow[]> {
    return db
      .select()
      .from(peregrina)
      .where(eq(peregrina.createdById, createdById))
      .orderBy(desc(peregrina.createdAt));
  }

  /**
   * Returns the next sequential number for a given provincia + modalidad pair.
   * Used to auto-generate the `codigo` field.
   */
  static async nextCodigoNum(
    provincia: string,
    modalidad: Modalidad
  ): Promise<number> {
    const [result] = await db
      .select({ maxNum: max(peregrina.codigoNum) })
      .from(peregrina)
      .where(
        and(
          eq(peregrina.provincia, provincia),
          eq(peregrina.modalidad, modalidad)
        )
      );
    return (result?.maxNum ?? 0) + 1;
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(data: NewPeregrinaRow): Promise<PeregrinaRow> {
    const [row] = await db.insert(peregrina).values(data).returning();
    if (!row) throw new Error("Failed to insert peregrina");
    return row;
  }

  static async update(
    id: string,
    data: Partial<
      Omit<PeregrinaRow, "id" | "codigo" | "codigoNum" | "createdById" | "createdAt">
    >
  ): Promise<PeregrinaRow> {
    const [row] = await db
      .update(peregrina)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(peregrina.id, id))
      .returning();
    if (!row) throw new Error(`Peregrina not found: ${id}`);
    return row;
  }

  static async delete(id: string): Promise<void> {
    await db.delete(peregrina).where(eq(peregrina.id, id));
  }

  // ── Stats helpers ──────────────────────────────────────────────────────────

  static async countByEstado(): Promise<{ estado: string; count: number }[]> {
    const rows = await db
      .select({
        estado: peregrina.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .groupBy(peregrina.estado);
    return rows;
  }

  static async countByRegion(): Promise<{ region: string; count: number }[]> {
    const rows = await db
      .select({
        region: peregrina.region,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .groupBy(peregrina.region);
    return rows;
  }
}