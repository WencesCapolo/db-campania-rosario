import { db } from "@/db";
import { misionero } from "./misionero.schema";
import { matrimonio } from "./matrimonio.schema";
import {
  eq,
  desc,
  ilike,
  or,
  and,
  sql,
  isNull,
  asc,
  inArray,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias, unionAll } from "drizzle-orm/pg-core";
import type { PgColumn } from "drizzle-orm/pg-core";
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
import type { FiltrosTerritoriales } from "@/modules/territorio/territorio.types";
import {
  MatrimonioRepository,
  type MatrimonioConEsposos,
} from "./matrimonio.repository";
import type { TipoDeTenedor } from "./matrimonio.types";

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

/**
 * One row of the collapsed listado: a person, or a household.
 *
 * The discriminator is the row's own, not something a screen infers from which
 * field happens to be filled. Both kinds arrive fully hydrated, because a caller
 * that has to fetch the other half is a caller that will forget to.
 */
export type FilaDeRoster =
  | { tipo: "persona"; persona: MisioneroConTerritorio }
  | { tipo: "matrimonio"; matrimonio: MatrimonioConEsposos };

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

/** The territorial filters, as SQL. Composed with the Alcance, never instead. */
function condicionDeFiltros(
  filtros: FiltrosTerritoriales
): (SQL | undefined)[] {
  return [
    filtros.diocesisLocalidadId
      ? eq(misionero.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region ? eq(diocesisLocalidad.region, filtros.region) : undefined,
  ];
}

/**
 * "Does this person's name match what was typed?" — one definition.
 *
 * Exported because three reads ask it: the roster's individual leg, the roster's
 * marriage leg (twice, once per spouse), and the holder search on the Peregrina
 * list. A second hand-written copy is how "gomez" comes to find Gómez on one
 * screen and nothing on the next.
 *
 * `ilike`, not `like`: somebody searching "gomez" means Gómez.
 */
export function coincideElNombre(
  columnas: { nombre: PgColumn; apellido: PgColumn },
  termino: string
): SQL | undefined {
  const patron = `%${termino}%`;
  return or(
    ilike(columnas.nombre, patron),
    ilike(columnas.apellido, patron)
  );
}

/** Counts, never rows. `count(*)` comes back as `bigint`, hence the cast. */
const TOTAL = sql<number>`cast(count(*) as int)`;

// ── El listado colapsado ──────────────────────────────────────────────────────
//
// `/misionero` lists **individuals who are not in an active Matrimonio, plus
// Matrimonios** — one ordered list of two kinds of Tenedor (ADR 0010).
//
// It is a `UNION ALL` in SQL and not two reads merged in the service, and that
// is forced rather than tidy: ADR 0008 requires the paginador's total to be an
// aggregate over the same predicate as the rows, and a merge in the application
// can only count what it has already fetched — which is the bug ADR 0007 was
// written about, reappearing one layer down.
//
// The two legs share one predicate builder, `condicionDeRoster`, for the same
// reason `condicionDeListado` used to bind the rows and their count: a total
// from a wider predicate offers pages that come back empty, and the person
// reading it concludes the records disappeared.

const conyugeA = alias(misionero, "conyuge_a");
const conyugeB = alias(misionero, "conyuge_b");
const diocesisDelMatrimonio = alias(diocesisLocalidad, "diocesis_matrimonio");

/**
 * "This person is nobody's spouse right now."
 *
 * The individual leg's whole reason to exist. A Misionero in an active
 * Matrimonio is never a holder on their own, so they must not appear here: if
 * they did, the couple would become a third row beside the two it replaces, and
 * they would be selectable alone in every picker built from this list.
 *
 * Given de baja does not match. A marriage that has ended hands the two spouses
 * back their individual lives with no code doing it on purpose — this clause
 * simply stops excluding them.
 *
 * Exported for the same reason `coincideElNombre` is: `AsignacionRepository`
 * needs the *same* clause for the tenencia lists behind `?imagen=con|sin`, and a
 * second hand-written copy is how a filter comes to offer a row the listado does
 * not show.
 */
export function sinMatrimonioActivo(persona: PgColumn): SQL {
  return sql`not exists (
    select 1 from ${matrimonio} as m
    where m.baja_at is null
      and (m.misionero_a_id = ${persona} or m.misionero_b_id = ${persona})
  )`;
}

/**
 * One predicate, two shapes — because the two legs read two different tables and
 * the same question has to be asked of both.
 *
 * A filter that reached one leg and not the other would silently return fewer
 * rows and no error, which is the failure mode ADR 0010 names as the price of
 * the polymorphic pointer.
 */
function condicionDeRoster(
  alcance: Alcance,
  filtros: FiltrosTerritoriales & { q?: string },
  opts: OpcionesDeLectura
): { personas: SQL | undefined; matrimonios: SQL | undefined } {
  const termino = filtros.q?.trim();

  const personas = [
    condicionDeAlcance(alcance),
    opts.incluirBajas ? undefined : isNull(misionero.bajaAt),
    ...condicionDeFiltros(filtros),
    termino
      ? or(
          coincideElNombre(misionero, termino),
          ilike(diocesisLocalidad.nombre, `%${termino}%`)
        )
      : undefined,
    sinMatrimonioActivo(misionero.id),
  ].filter((f) => f !== undefined);

  // The couple's Alcance, territory and Región all land on spouse A, who
  // supplies them because the table has none of its own. The search is the one
  // thing that reaches spouse B: "Benítez" has to find "Ana Álvarez y Juan
  // Benítez", and nobody typing a surname knows which half was entered first.
  const matrimonios = [
    alcance.tipo === "nacional"
      ? undefined
      : eq(conyugeA.diocesisLocalidadId, alcance.diocesisLocalidadId),
    opts.incluirBajas ? undefined : isNull(matrimonio.bajaAt),
    filtros.diocesisLocalidadId
      ? eq(conyugeA.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region ? eq(diocesisDelMatrimonio.region, filtros.region) : undefined,
    termino
      ? or(
          coincideElNombre(conyugeA, termino),
          coincideElNombre(conyugeB, termino),
          ilike(diocesisDelMatrimonio.nombre, `%${termino}%`)
        )
      : undefined,
  ].filter((f) => f !== undefined);

  return {
    personas: personas.length ? and(...personas) : undefined,
    matrimonios: matrimonios.length ? and(...matrimonios) : undefined,
  };
}

/**
 * The union itself, projecting only what the list is ordered and grouped by.
 *
 * Deliberately narrow. Both legs have to project the *same* columns for the
 * union to typecheck at all, and a Misionero and a Matrimonio have almost
 * nothing in common beyond a name and a place — filling the difference with
 * nulls would make every consumer branch on the discriminator anyway. The rows
 * are hydrated afterwards, by primary key, in `findFiltrados`.
 */
function roster(
  alcance: Alcance,
  filtros: FiltrosTerritoriales & { q?: string },
  opts: OpcionesDeLectura
) {
  const condicion = condicionDeRoster(alcance, filtros, opts);

  const individuos = db
    .select({
      tipo: sql<TipoDeTenedor>`'persona'`.as("tipo"),
      id: misionero.id,
      apellido: misionero.apellido,
      nombre: misionero.nombre,
      estado: misionero.estado,
      region: diocesisLocalidad.region,
    })
    .from(misionero)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, misionero.diocesisLocalidadId)
    )
    .where(condicion.personas);

  const parejas = db
    .select({
      tipo: sql<TipoDeTenedor>`'matrimonio'`.as("tipo"),
      id: matrimonio.id,
      apellido: conyugeA.apellido,
      nombre: conyugeA.nombre,
      // The couple's own Estado, not a spouse's. That is what the column on
      // `matrimonio` is for, and a household can be inactive while neither
      // person has left the Campaña.
      estado: matrimonio.estado,
      region: diocesisDelMatrimonio.region,
    })
    .from(matrimonio)
    .innerJoin(conyugeA, eq(conyugeA.id, matrimonio.misioneroAId))
    // Spouse B is joined for the search and for nothing else. Dropping this join
    // would not fail: it would quietly stop half the households being findable.
    .innerJoin(conyugeB, eq(conyugeB.id, matrimonio.misioneroBId))
    .innerJoin(
      diocesisDelMatrimonio,
      eq(diocesisDelMatrimonio.id, conyugeA.diocesisLocalidadId)
    )
    .where(condicion.matrimonios);

  return unionAll(individuos, parejas);
}

/**
 * `apellido, nombre, id` — and the `id` is the part that needs saying out loud.
 *
 * ADR 0008: an `order by` that can tie needs a unique tiebreaker before it gets
 * an `offset`, or a row appears on two pages and another on none. Neither
 * apellido nor nombre is unique, so `id` is appended — and here that `id` spans
 * two tables' primary keys, a Misionero's and a Matrimonio's.
 *
 * That is safe because both are `crypto.randomUUID()` v4 values in one text
 * column: a collision across the two tables is the same collision a single table
 * already tolerates, and the tiebreaker only needs to be *stable*, never
 * meaningful. Ordering by it says nothing about which row is older.
 *
 * Bare identifiers, not `misionero.apellido`: in a set operation the `order by`
 * names the union's output columns, which belong to neither leg's table.
 */
const ORDEN_DEL_ROSTER = sql`apellido asc, nombre asc, id asc`;

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
      .where(conAlcance(alcance, opts, eq(diocesisLocalidad.region, region)))
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

  // ── Agregaciones ───────────────────────────────────────────────────────────
  //
  // Counted in the database, and filtered by territory only. Estado, Modalidad
  // and Tipo are properties of an *image*; a Misionero has none of them, and a
  // "Misioneros de Modalidad Jóvenes" figure would be an invention. The tablero
  // says so on the card rather than silently ignoring the filter.
  //
  // Every one of them counts **Tenedores, and a couple is one**. CONTEXT.md says
  // every figure links to the records behind it, so a figure that counted two
  // people per household would say 47 and the list it links to would show 45 —
  // and an off-by-a-plausible-amount figure is worse than an obviously wrong one.
  // That is why they aggregate over the same union the rows come from, rather
  // than over `misionero` directly.

  static async contarTotal(
    alcance: Alcance,
    filtros: FiltrosTerritoriales,
    opts: OpcionesDeLectura = {}
  ): Promise<number> {
    const tenedores = roster(alcance, filtros, opts).as("tenedores");
    const [row] = await db.select({ total: TOTAL }).from(tenedores);
    return row?.total ?? 0;
  }

  static async contarPorEstado(
    alcance: Alcance,
    filtros: FiltrosTerritoriales,
    opts: OpcionesDeLectura = {}
  ): Promise<{ estado: MisioneroEstado; total: number }[]> {
    const tenedores = roster(alcance, filtros, opts).as("tenedores");
    return db
      .select({ estado: tenedores.estado, total: TOTAL })
      .from(tenedores)
      .groupBy(tenedores.estado);
  }

  static async contarPorRegion(
    alcance: Alcance,
    filtros: FiltrosTerritoriales,
    opts: OpcionesDeLectura = {}
  ): Promise<{ region: Region; total: number }[]> {
    const tenedores = roster(alcance, filtros, opts).as("tenedores");
    return db
      .select({ region: tenedores.region, total: TOTAL })
      .from(tenedores)
      .groupBy(tenedores.region);
  }

  /**
   * The collapsed listado: individuals who are nobody's spouse, plus households,
   * in one order and one page.
   *
   * Two steps rather than one, on purpose. The union decides *which* Tenedores
   * and in what order — that is where the Alcance, the filters, the search and
   * the `offset` all live. The second step fetches the twenty rows it named, by
   * primary key. Widening the union to carry every column of both kinds would
   * have meant padding each leg with the other's nulls, and a Misionero and a
   * Matrimonio have almost nothing in common to unify.
   *
   * The hydration reads are not scoped again, and do not need to be: an id only
   * reaches them by coming out of a union that already applied the Alcance.
   */
  static async findFiltrados(
    alcance: Alcance,
    filtros: FiltrosTerritoriales & { q?: string },
    opts: OpcionesDeLectura = {},
    paginacion?: { limit: number; offset: number }
  ): Promise<FilaDeRoster[]> {
    const consulta = roster(alcance, filtros, opts).orderBy(ORDEN_DEL_ROSTER);

    const claves = await (paginacion
      ? consulta.limit(paginacion.limit).offset(paginacion.offset)
      : consulta);

    const idsDePersonas = claves
      .filter((c) => c.tipo === "persona")
      .map((c) => c.id);
    const idsDeMatrimonios = claves
      .filter((c) => c.tipo === "matrimonio")
      .map((c) => c.id);

    const [personas, matrimonios] = await Promise.all([
      idsDePersonas.length
        ? conTerritorio().where(inArray(misionero.id, idsDePersonas))
        : Promise.resolve([] as MisioneroConTerritorio[]),
      MatrimonioRepository.findByIds(alcance, idsDeMatrimonios, {
        incluirBajas: true,
      }),
    ]);

    const porPersona = new Map(personas.map((p) => [p.misionero.id, p]));
    const porMatrimonio = new Map(matrimonios.map((m) => [m.matrimonio.id, m]));

    return claves.flatMap((clave): FilaDeRoster[] => {
      if (clave.tipo === "persona") {
        const persona = porPersona.get(clave.id);
        return persona ? [{ tipo: "persona", persona }] : [];
      }
      const encontrado = porMatrimonio.get(clave.id);
      return encontrado ? [{ tipo: "matrimonio", matrimonio: encontrado }] : [];
    });
  }

  /**
   * How many the listado has, for the paginador — the same predicate as
   * `findFiltrados`, which is why both build it from `roster`.
   *
   * `contarTotal` above cannot answer this: it takes the territorial filters
   * only, so with a name search on it would count everybody and the control would
   * offer pages that do not exist.
   */
  static async contarFiltrados(
    alcance: Alcance,
    filtros: FiltrosTerritoriales & { q?: string },
    opts: OpcionesDeLectura = {}
  ): Promise<number> {
    const tenedores = roster(alcance, filtros, opts).as("tenedores");
    const [row] = await db.select({ total: TOTAL }).from(tenedores);
    return row?.total ?? 0;
  }
}
