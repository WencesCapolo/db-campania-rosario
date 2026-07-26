import { db } from "@/db";
import { peregrina } from "./peregrina.schema";
import { eq, desc, and, max, sql, asc, isNull } from "drizzle-orm";
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
import { misionero } from "@/modules/misionero/misionero.schema";
import type { MisioneroRow } from "@/modules/misionero/misionero.schema";
import type { Alcance } from "@/lib/authorization/alcance";

/**
 * A Peregrina is never useful without its territory resolved — Provincia and
 * Región are derived by traversal, so every read joins them in — and a list is
 * not useful without knowing who has each image, so the tenencia actual comes
 * along too.
 *
 * That last join is on the denormalised `misioneroActualId`, which is one join for
 * the whole query rather than a lookup per row. The Asignación table remains the
 * source of truth; this is a cache of its open row, written only by
 * `AsignacionRepository`.
 */
export interface PeregrinaConTerritorio {
  peregrina: PeregrinaRow;
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
  misioneroActual: MisioneroRow | null;
}

/**
 * Whether a read includes records given de baja.
 *
 * Excluded by default, everywhere: "the active inventory" is what a Referente
 * means by a list. A caller that wants a retired record has to say so, which
 * makes every such call visible at the call site.
 */
export interface OpcionesDeLectura {
  incluirBajas?: boolean;
}

function conTerritorio() {
  return db
    .select({ peregrina, diocesis: diocesisLocalidad, provincia, misioneroActual: misionero })
    .from(peregrina)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
    )
    .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
    // Left, and not filtered on the Misionero's own baja: if a Misionero given de
    // baja still shows as holding an image, that is a fact worth seeing, not one
    // worth hiding. `MisioneroService.darDeBaja` refuses precisely that pairing.
    .leftJoin(misionero, eq(misionero.id, peregrina.misioneroActualId));
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
  opts: OpcionesDeLectura,
  ...extras: (SQL | undefined)[]
) {
  const filtros = [
    condicionDeAlcance(alcance),
    opts.incluirBajas ? undefined : isNull(peregrina.bajaAt),
    ...extras,
  ].filter((f) => f !== undefined);
  return filtros.length ? and(...filtros) : undefined;
}

/**
 * PeregrinaRepository
 *
 * Responsibility: raw database access for the `peregrina` table.
 * No business logic. No permission checks. Excludes records given de baja by
 * default.
 *
 * Every read takes an `Alcance` as its first parameter, mirroring the Actor-first
 * rule one layer up. It is required rather than optional on purpose: a new read
 * that forgets to scope itself does not compile, which is user story 20.
 *
 * `misioneroActualId` is deliberately absent from every write signature here. It
 * is derived from the open Asignación and written only by `AsignacionRepository`,
 * inside the transaction that opens or closes one — a second writer is how a
 * denormalised column starts lying.
 */
export class PeregrinaRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio | undefined> {
    const [row] = await conTerritorio()
      .where(conAlcance(alcance, opts, eq(peregrina.id, id)))
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
   *
   * Includes records given de baja, because reactivating one is a mutation too,
   * and "no existe" would be a lie the operator has to debug.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<PeregrinaConTerritorio | undefined> {
    const [row] = await conTerritorio().where(eq(peregrina.id, id)).limit(1);
    return row;
  }

  static async findAll(
    alcance: Alcance,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByEstado(
    alcance: Alcance,
    estado: PeregrinaEstado,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(peregrina.estado, estado)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByRegion(
    alcance: Alcance,
    region: Region,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(provincia.region, region)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByModalidad(
    alcance: Alcance,
    modalidad: Modalidad,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(peregrina.modalidad, modalidad)))
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByDiocesisLocalidad(
    alcance: Alcance,
    diocesisLocalidadId: string,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(
        conAlcance(
          alcance,
          opts,
          eq(peregrina.diocesisLocalidadId, diocesisLocalidadId)
        )
      )
      .orderBy(desc(peregrina.createdAt));
  }

  static async findByProvincia(
    alcance: Alcance,
    provinciaId: string,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(provincia.id, provinciaId)))
      .orderBy(asc(peregrina.codigo));
  }

  static async findByCreator(
    alcance: Alcance,
    createdById: string,
    opts: OpcionesDeLectura = {}
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, opts, eq(peregrina.createdById, createdById)))
      .orderBy(desc(peregrina.createdAt));
  }

  /** Images nobody has right now, for the assignment flow's second step. */
  static async findDisponibles(
    alcance: Alcance
  ): Promise<PeregrinaConTerritorio[]> {
    return conTerritorio()
      .where(conAlcance(alcance, {}, isNull(peregrina.misioneroActualId)))
      .orderBy(asc(peregrina.codigo));
  }

  /**
   * The next sequential número for a Provincia and Modalidad pair.
   *
   * Keyed on the Provincia reference record rather than on a typed-in name,
   * which is what made the old numbering unreliable: "Córdoba" and "cordoba "
   * each ran their own sequence and produced colliding Códigos.
   *
   * Deliberately not scoped, and deliberately counting records given de baja. A
   * Código is globally unique and physically written on an image; skipping a
   * retired one's número would eventually mint a duplicate of something sitting
   * in a cupboard.
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
      Omit<
        PeregrinaRow,
        | "id"
        | "codigo"
        | "codigoNum"
        | "createdById"
        | "createdAt"
        | "misioneroActualId"
        | "bajaAt"
      >
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

  /**
   * Baja lógica — user story 16. There is no `delete`, and that is the point:
   * every Asignación has to keep resolving to a real Código, so a Peregrina that
   * leaves the inventory leaves it as a row.
   *
   * `undefined` means it was already de baja, which the predicate makes a fact
   * rather than a race.
   */
  static async darDeBaja(id: string): Promise<PeregrinaRow | undefined> {
    const [row] = await db
      .update(peregrina)
      .set({ bajaAt: new Date(), updatedAt: new Date() })
      .where(and(eq(peregrina.id, id), isNull(peregrina.bajaAt)))
      .returning();
    return row;
  }

  static async reactivar(id: string): Promise<PeregrinaRow | undefined> {
    const [row] = await db
      .update(peregrina)
      .set({ bajaAt: null, updatedAt: new Date() })
      .where(and(eq(peregrina.id, id), sql`${peregrina.bajaAt} is not null`))
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
        estado: peregrina.estado,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(peregrina)
      .where(conAlcance(alcance, opts))
      .groupBy(peregrina.estado);
  }

  static async countByRegion(
    alcance: Alcance,
    opts: OpcionesDeLectura = {}
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
      .where(conAlcance(alcance, opts))
      .groupBy(provincia.region);
  }
}
