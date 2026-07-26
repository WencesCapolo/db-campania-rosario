import { db } from "@/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { diocesisLocalidad, provincia } from "./territorio.schema";
import type {
  DiocesisLocalidadRow,
  NewDiocesisLocalidadRow,
  NewProvinciaRow,
  ProvinciaRow,
  Region,
} from "./territorio.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import { peregrina } from "@/modules/peregrina/peregrina.schema";

/**
 * A Diócesis/Localidad never travels without its Provincia — the Provincia and
 * Región are derived by traversal, so a row on its own is only half a territory.
 */
export interface DiocesisLocalidadConProvincia {
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
}

/**
 * TerritorioRepository
 *
 * Responsibility: raw database access for the territory reference tables.
 * No business logic. No permission checks. Excludes rows given de baja unless
 * asked otherwise.
 */
export class TerritorioRepository {
  // ── Provincia ───────────────────────────────────────────────────────────────

  /**
   * Provincias, optionally those that reach into a given Región.
   *
   * "In a Región" is no longer a column on this table — Región belongs to the
   * Diócesis/Localidad, because the Campaña's regions cut across provincial
   * borders. So a Provincia is in a Región when at least one of its
   * Diócesis is, which makes Santa Fe answer to both NEA and CENTRO. That is
   * the right answer and the reason the column moved.
   *
   * The join is only added when filtering. Without it this is the plain list,
   * and joining unconditionally would duplicate a Provincia once per Diócesis.
   */
  static async findProvincias(
    opts: { incluirBajas?: boolean; region?: Region } = {}
  ): Promise<ProvinciaRow[]> {
    const vivas = opts.incluirBajas ? undefined : isNull(provincia.bajaAt);

    if (!opts.region) {
      return db
        .select()
        .from(provincia)
        .where(vivas)
        .orderBy(asc(provincia.nombre));
    }

    const filtros = [vivas, eq(diocesisLocalidad.region, opts.region)].filter(
      (f) => f !== undefined
    );

    return db
      .selectDistinct({
        id: provincia.id,
        nombre: provincia.nombre,
        abreviatura: provincia.abreviatura,
        bajaAt: provincia.bajaAt,
        createdAt: provincia.createdAt,
        updatedAt: provincia.updatedAt,
      })
      .from(provincia)
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.provinciaId, provincia.id)
      )
      .where(and(...filtros))
      .orderBy(asc(provincia.nombre));
  }

  static async findProvinciaById(id: string): Promise<ProvinciaRow | undefined> {
    const [row] = await db
      .select()
      .from(provincia)
      .where(eq(provincia.id, id))
      .limit(1);
    return row;
  }

  static async findProvinciaByNombre(
    nombreNormalizado: string
  ): Promise<ProvinciaRow | undefined> {
    const [row] = await db
      .select()
      .from(provincia)
      .where(sql`territorio_normalizar(${provincia.nombre}) = ${nombreNormalizado}`)
      .limit(1);
    return row;
  }

  static async createProvincia(data: NewProvinciaRow): Promise<ProvinciaRow> {
    const [row] = await db.insert(provincia).values(data).returning();
    if (!row) throw new Error("Failed to insert provincia");
    return row;
  }

  static async updateProvincia(
    id: string,
    data: Partial<Pick<ProvinciaRow, "nombre" | "abreviatura" | "bajaAt">>
  ): Promise<ProvinciaRow | undefined> {
    const [row] = await db
      .update(provincia)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(provincia.id, id))
      .returning();
    return row;
  }

  // ── Diócesis/Localidad ──────────────────────────────────────────────────────

  static async findDiocesisLocalidades(
    opts: {
      incluirBajas?: boolean;
      provinciaId?: string;
      region?: Region;
    } = {}
  ): Promise<DiocesisLocalidadConProvincia[]> {
    const filtros = [
      opts.incluirBajas ? undefined : isNull(diocesisLocalidad.bajaAt),
      opts.incluirBajas ? undefined : isNull(provincia.bajaAt),
      opts.provinciaId
        ? eq(diocesisLocalidad.provinciaId, opts.provinciaId)
        : undefined,
      opts.region ? eq(diocesisLocalidad.region, opts.region) : undefined,
    ].filter((f) => f !== undefined);

    const rows = await db
      .select({ diocesis: diocesisLocalidad, provincia })
      .from(diocesisLocalidad)
      .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(asc(provincia.nombre), asc(diocesisLocalidad.nombre));

    return rows;
  }

  static async findDiocesisLocalidadById(
    id: string
  ): Promise<DiocesisLocalidadConProvincia | undefined> {
    const [row] = await db
      .select({ diocesis: diocesisLocalidad, provincia })
      .from(diocesisLocalidad)
      .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
      .where(eq(diocesisLocalidad.id, id))
      .limit(1);
    return row;
  }

  /** Case-, accent- and whitespace-insensitive lookup within one Provincia. */
  static async findDiocesisLocalidadByNombre(
    provinciaId: string,
    nombreNormalizado: string
  ): Promise<DiocesisLocalidadConProvincia | undefined> {
    const [row] = await db
      .select({ diocesis: diocesisLocalidad, provincia })
      .from(diocesisLocalidad)
      .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
      .where(
        and(
          eq(diocesisLocalidad.provinciaId, provinciaId),
          sql`territorio_normalizar(${diocesisLocalidad.nombre}) = ${nombreNormalizado}`
        )
      )
      .limit(1);
    return row;
  }

  static async createDiocesisLocalidad(
    data: NewDiocesisLocalidadRow
  ): Promise<DiocesisLocalidadRow> {
    const [row] = await db.insert(diocesisLocalidad).values(data).returning();
    if (!row) throw new Error("Failed to insert diocesis_localidad");
    return row;
  }

  static async updateDiocesisLocalidad(
    id: string,
    data: Partial<Pick<DiocesisLocalidadRow, "nombre" | "bajaAt">>
  ): Promise<DiocesisLocalidadRow | undefined> {
    const [row] = await db
      .update(diocesisLocalidad)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(diocesisLocalidad.id, id))
      .returning();
    return row;
  }

  // ── Uso ─────────────────────────────────────────────────────────────────────
  // How many live records point at a territory. Drives both the "are you sure"
  // count and the guard that refuses to give a referenced territory de baja.
  //
  // "Live" gained a meaning in issue #3. Before soft delete existed these counted
  // every row, and left alone they would have kept counting records given de baja
  // — so a Diócesis whose whole inventory had been retired could never be retired
  // itself, and the guard would refuse forever with a count of things nobody can
  // see. A retired record is not a reference worth protecting; its Asignaciones
  // still resolve either way, because nothing is ever destroyed.

  static async countUsoDiocesisLocalidad(
    id: string
  ): Promise<{ peregrinas: number; misioneros: number }> {
    const [[per], [mis]] = await Promise.all([
      db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(peregrina)
        .where(
          and(eq(peregrina.diocesisLocalidadId, id), isNull(peregrina.bajaAt))
        ),
      db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(misionero)
        .where(
          and(eq(misionero.diocesisLocalidadId, id), isNull(misionero.bajaAt))
        ),
    ]);

    return { peregrinas: per?.n ?? 0, misioneros: mis?.n ?? 0 };
  }

  static async countUsoProvincia(
    id: string
  ): Promise<{ peregrinas: number; misioneros: number }> {
    const hijas = db
      .select({ id: diocesisLocalidad.id })
      .from(diocesisLocalidad)
      .where(eq(diocesisLocalidad.provinciaId, id));

    const [[per], [mis]] = await Promise.all([
      db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(peregrina)
        .where(
          and(
            sql`${peregrina.diocesisLocalidadId} in ${hijas}`,
            isNull(peregrina.bajaAt)
          )
        ),
      db
        .select({ n: sql<number>`cast(count(*) as int)` })
        .from(misionero)
        .where(
          and(
            sql`${misionero.diocesisLocalidadId} in ${hijas}`,
            isNull(misionero.bajaAt)
          )
        ),
    ]);

    return { peregrinas: per?.n ?? 0, misioneros: mis?.n ?? 0 };
  }
}
