import { db } from "@/db";
import { peregrina } from "./peregrina.schema";
import {
  eq,
  desc,
  and,
  max,
  sql,
  asc,
  isNull,
  isNotNull,
  ilike,
  or,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type {
  PeregrinaRow,
  NewPeregrinaRow,
  PeregrinaEstado,
  PeregrinaTipo,
  Modalidad,
} from "./peregrina.schema";
import type { FiltrosDeInventario } from "./peregrina.types";
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
import { matrimonio } from "@/modules/misionero/matrimonio.schema";
import { alias } from "drizzle-orm/pg-core";
import type { Alcance } from "@/lib/authorization/alcance";
import { coincideAlgunNombre } from "@/lib/busqueda";
import type { TenedorResueltoDTO } from "@/lib/tenedor";

/**
 * A Peregrina is never useful without its territory resolved — Provincia and
 * Región are derived by traversal, so every read joins them in — and a list is
 * not useful without knowing who has each image, so the tenencia actual comes
 * along too.
 *
 * That last one is joined off the denormalised pointer, which is one join for
 * the whole query rather than a lookup per row. The Asignación table remains the
 * source of truth; this is a cache of its open row, written only by
 * `AsignacionRepository`.
 *
 * `tenedorActual` is **one** field over two nullable columns — ADR 0010. It was
 * `misioneroActual: MisioneroRow | null`, and leaving it that way while adding
 * `matrimonioActual` beside it would have let every caller keep compiling while
 * quietly answering "nadie" for every image a couple has.
 */
export interface PeregrinaConTerritorio {
  peregrina: PeregrinaRow;
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
  tenedorActual: TenedorResueltoDTO | null;
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

/**
 * Los dos cónyuges del Matrimonio que tiene la imagen, para que la columna
 * «¿Quién la tiene?» pueda decir «Ana y Juan Pérez» — ADR 0010.
 */
const esposoA = alias(misionero, "esposo_a");
const esposoB = alias(misionero, "esposo_b");

/**
 * Las tablas que resuelven al Tenedor actual, en un solo `from`.
 *
 * Las dos patas del puntero polimórfico se juntan acá y en `agregando()`, y en
 * ningún otro lado. Olvidar una devuelve **menos filas y ningún error** — el
 * modo de falla que ADR 0010 eligió a sabiendas y por el que existe la suite de
 * visibilidad.
 *
 * Ninguna está filtrada por su propia baja: si un Misionero dado de baja aparece
 * teniendo una imagen, eso es un hecho que hay que ver y no uno que haya que
 * esconder. `MisioneroService.darDeBaja` rechaza justamente ese par.
 */
function conTerritorio() {
  return db
    .select({
      peregrina,
      diocesis: diocesisLocalidad,
      provincia,
      misioneroActual: misionero,
      matrimonioActual: matrimonio,
      esposoA,
      esposoB,
    })
    .from(peregrina)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId),
    )
    .innerJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId))
    .leftJoin(misionero, eq(misionero.id, peregrina.misioneroActualId))
    .leftJoin(matrimonio, eq(matrimonio.id, peregrina.matrimonioActualId))
    .leftJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
    .leftJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId));
}

/** One row of `conTerritorio()`, inferred rather than restated. */
type FilaConTerritorio = Awaited<ReturnType<typeof conTerritorio>>[number];

function aPeregrinaConTerritorio(
  fila: FilaConTerritorio,
): PeregrinaConTerritorio {
  return {
    peregrina: fila.peregrina,
    diocesis: fila.diocesis,
    provincia: fila.provincia,
    tenedorActual: tenedorDeFila(fila),
  };
}

/**
 * Las dos columnas denormalizadas, vueltas una respuesta — o `null`, que es
 * *libre* y es un estado normal.
 *
 * A diferencia de la de `asignacion`, esta no puede exigir que haya una: el
 * check de `peregrina` es `<= 1` justamente porque una imagen que no tiene nadie
 * tiene que poder existir.
 */
function tenedorDeFila(fila: FilaConTerritorio): TenedorResueltoDTO | null {
  const m = fila.misioneroActual;
  if (m) {
    return {
      tipo: "persona",
      id: m.id,
      deBaja: m.bajaAt !== null,
      persona: {
        id: m.id,
        nombre: m.nombre,
        apellido: m.apellido,
        deBaja: m.bajaAt !== null,
      },
    };
  }

  const par = fila.matrimonioActual;
  const a = fila.esposoA;
  const b = fila.esposoB;
  if (par && a && b) {
    return {
      tipo: "matrimonio",
      id: par.id,
      deBaja: par.bajaAt !== null,
      matrimonio: {
        misioneroA: {
          id: a.id,
          nombre: a.nombre,
          apellido: a.apellido,
          deBaja: a.bajaAt !== null,
        },
        misioneroB: {
          id: b.id,
          nombre: b.nombre,
          apellido: b.apellido,
          deBaja: b.bajaAt !== null,
        },
      },
    };
  }

  return null;
}

async function leerVarias(
  consulta: PromiseLike<FilaConTerritorio[]>,
): Promise<PeregrinaConTerritorio[]> {
  return (await consulta).map(aPeregrinaConTerritorio);
}

async function leerUna(
  consulta: PromiseLike<FilaConTerritorio[]>,
): Promise<PeregrinaConTerritorio | undefined> {
  const [fila] = await consulta;
  return fila ? aPeregrinaConTerritorio(fila) : undefined;
}

/**
 * *Libre* es que no la tenga **nadie**, y eso son las dos columnas en null.
 *
 * Escrito una vez y leído en los dos sentidos, como `misionerosPorTenencia`:
 * `libre` y `asignada` son las dos opciones de un mismo select, y dos
 * predicados escritos a mano son dos lugares donde discrepar sobre las parejas.
 */
const SIN_TENEDOR = and(
  isNull(peregrina.misioneroActualId),
  isNull(peregrina.matrimonioActualId),
);

const CON_TENEDOR = or(
  isNotNull(peregrina.misioneroActualId),
  isNotNull(peregrina.matrimonioActualId),
);

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
 * The shared filters, as SQL — the other half of `FiltrosDeInventario`.
 *
 * One translation, used by the filtered list and by every aggregate, which is
 * what stops the tablero's figures and the listado's rows disagreeing about what
 * "Modalidad Jóvenes, en reparación" means.
 *
 * Territory arrives as an id and is applied on top of the Actor's `Alcance`, so
 * the two compose as an intersection: a filter can only ever narrow. The service
 * has already refused an id outside the scope by the time this runs — the
 * narrowing here is not the guard, it is the query.
 */
function condicionDeFiltros(filtros: FiltrosDeInventario): (SQL | undefined)[] {
  return [
    filtros.estado ? eq(peregrina.estado, filtros.estado) : undefined,
    filtros.modalidad ? eq(peregrina.modalidad, filtros.modalidad) : undefined,
    filtros.tipo ? eq(peregrina.tipo, filtros.tipo) : undefined,
    filtros.diocesisLocalidadId
      ? eq(peregrina.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region ? eq(diocesisLocalidad.region, filtros.region) : undefined,
    // ilike, not like: somebody typing "cba jov" means "CBA JOV".
    filtros.codigo
      ? ilike(peregrina.codigo, `%${filtros.codigo.replace(/\s+/g, " ")}%`)
      : undefined,
    filtros.tenencia === "libre"
      ? SIN_TENEDOR
      : filtros.tenencia === "asignada"
        ? CON_TENEDOR
        : undefined,
    condicionDeTenedor(filtros.misionero),
  ];
}

/**
 * Quién la tiene, por nombre — el filtro que se tipea en lugar de elegirse.
 *
 * Tres personas y no una: el Misionero de la pata individual, y los dos cónyuges
 * de la del Matrimonio. Buscar «Benítez» tiene que encontrar la imagen de «Ana
 * Álvarez y Juan Benítez», que es la mitad del punto de ADR 0010 — antes esa
 * imagen estaba a nombre de quien se hubiera tipeado primero.
 *
 * El cómo vive en `coincideAlgunNombre`, compartido con el buscador del listado
 * de Misioneros: es la misma pregunta, y una segunda copia escrita a mano es un
 * segundo lugar donde discrepar.
 */
function condicionDeTenedor(termino: string | undefined): SQL | undefined {
  return coincideAlgunNombre(termino, misionero, esposoA, esposoB);
}

/** Counts, never rows. `count(*)` comes back as `bigint`, hence the cast. */
const TOTAL = sql<number>`cast(count(*) as int)`;

/** What an aggregate may group by: a column, or an expression over one. */
type CamposAgregados = Record<string, PgColumn | SQL<string> | SQL<number>>;

/**
 * The aggregate `from`, with the territory and the tenencia actual joined in.
 *
 * Every join is unconditional even when nothing filters on it, because Región is
 * one of the breakdowns and the Tenedor's name is one of the filters, and the
 * alternative is two query builders that have to agree with each other. Each is a
 * foreign key with an index on both ends, and the holder ones are `left` on
 * unique keys, so none of them drops a row or multiplies one — an aggregate
 * cannot change its answer by joining them. When no filter mentions the Tenedor,
 * Postgres removes the joins outright: nothing selects from them.
 *
 * The three holder joins mirror `conTerritorio()` exactly, and they have to: a
 * figure whose `from` reaches one leg while the list's reaches two is a figure
 * that disagrees with the rows it links to, which is what ADR 0007 exists about.
 */
function agregando<T extends CamposAgregados>(campos: T) {
  return db
    .select({ ...campos, total: TOTAL })
    .from(peregrina)
    .innerJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId),
    )
    .leftJoin(misionero, eq(misionero.id, peregrina.misioneroActualId))
    .leftJoin(matrimonio, eq(matrimonio.id, peregrina.matrimonioActualId))
    .leftJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
    .leftJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId));
}

/** Alcance and filters together — the `where` every aggregate shares. */
function condiciones(
  alcance: Alcance,
  filtros: FiltrosDeInventario,
  opts: OpcionesDeLectura = {},
) {
  return conAlcance(alcance, opts, ...condicionDeFiltros(filtros));
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
 * `misioneroActualId` **and** `matrimonioActualId` are deliberately absent from
 * every write signature here. Both are derived from the open Asignación and
 * written only by `AsignacionRepository`, inside the transaction that opens or
 * closes one — a second writer is how a denormalised column starts lying, and
 * with two of them a second writer can also break the `<= 1` check.
 */
export class PeregrinaRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio | undefined> {
    return leerUna(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(peregrina.id, id)))
        .limit(1),
    );
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
    id: string,
  ): Promise<PeregrinaConTerritorio | undefined> {
    return leerUna(conTerritorio().where(eq(peregrina.id, id)).limit(1));
  }

  static async findAll(
    alcance: Alcance,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts))
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  static async findByEstado(
    alcance: Alcance,
    estado: PeregrinaEstado,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(peregrina.estado, estado)))
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  static async findByRegion(
    alcance: Alcance,
    region: Region,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(diocesisLocalidad.region, region)))
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  static async findByModalidad(
    alcance: Alcance,
    modalidad: Modalidad,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(peregrina.modalidad, modalidad)))
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  static async findByDiocesisLocalidad(
    alcance: Alcance,
    diocesisLocalidadId: string,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(
          conAlcance(
            alcance,
            opts,
            eq(peregrina.diocesisLocalidadId, diocesisLocalidadId),
          ),
        )
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  static async findByProvincia(
    alcance: Alcance,
    provinciaId: string,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(provincia.id, provinciaId)))
        .orderBy(asc(peregrina.codigo)),
    );
  }

  static async findByCreator(
    alcance: Alcance,
    createdById: string,
    opts: OpcionesDeLectura = {},
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, opts, eq(peregrina.createdById, createdById)))
        .orderBy(desc(peregrina.createdAt)),
    );
  }

  /**
   * Images nobody has right now, for the assignment flow's second step.
   *
   * *Libre* son las **dos** columnas en null (ADR 0010): mirando sólo la del
   * Misionero, cada imagen que tiene un Matrimonio aparecería en el picker de
   * las libres y alguien la entregaría dos veces.
   */
  static async findDisponibles(
    alcance: Alcance,
  ): Promise<PeregrinaConTerritorio[]> {
    return leerVarias(
      conTerritorio()
        .where(conAlcance(alcance, {}, SIN_TENEDOR))
        .orderBy(asc(peregrina.codigo)),
    );
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
    modalidad: Modalidad,
  ): Promise<number> {
    const [result] = await db
      .select({ maxNum: max(peregrina.codigoNum) })
      .from(peregrina)
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId),
      )
      .where(
        and(
          eq(diocesisLocalidad.provinciaId, provinciaId),
          eq(peregrina.modalidad, modalidad),
        ),
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
        | "matrimonioActualId"
        | "bajaAt"
      >
    >,
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

  // ── Agregaciones ───────────────────────────────────────────────────────────
  //
  // Counted in the database, never by fetching rows and counting them. That is
  // what the previous dashboard did, and it is why its figures were neither
  // authoritative nor able to survive the Campaña growing: a count of what
  // happened to be fetched is a count of the page size.
  //
  // Every one of these takes the Alcance first and the shared filters second, so
  // there is no aggregate that can be asked a wider question than the list on
  // the same screen.

  /** One number: how many images match, at all. */
  static async contarTotal(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<number> {
    const [row] = await agregando({}).where(
      condiciones(alcance, filtros, opts),
    );
    return row?.total ?? 0;
  }

  static async contarPorEstado(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<{ estado: PeregrinaEstado; total: number }[]> {
    return agregando({ estado: peregrina.estado })
      .where(condiciones(alcance, filtros, opts))
      .groupBy(peregrina.estado);
  }

  static async contarPorModalidad(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<{ modalidad: Modalidad; total: number }[]> {
    return agregando({ modalidad: peregrina.modalidad })
      .where(condiciones(alcance, filtros, opts))
      .groupBy(peregrina.modalidad);
  }

  static async contarPorTipo(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<{ tipo: PeregrinaTipo; total: number }[]> {
    return agregando({ tipo: peregrina.tipo })
      .where(condiciones(alcance, filtros, opts))
      .groupBy(peregrina.tipo);
  }

  /** The national breakdown — story 10, and the comparison story 11 asks for. */
  static async contarPorRegion(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<{ region: Region; total: number }[]> {
    return agregando({ region: diocesisLocalidad.region })
      .where(condiciones(alcance, filtros, opts))
      .groupBy(diocesisLocalidad.region);
  }

  /** A Diócesis-level breakdown, for a Región that needs opening up. */
  static async contarPorDiocesisLocalidad(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
  ): Promise<{ diocesisLocalidadId: string; nombre: string; total: number }[]> {
    return agregando({
      diocesisLocalidadId: diocesisLocalidad.id,
      nombre: diocesisLocalidad.nombre,
    })
      .where(condiciones(alcance, filtros, opts))
      .groupBy(diocesisLocalidad.id, diocesisLocalidad.nombre)
      .orderBy(desc(TOTAL));
  }

  /**
   * How many images nobody has right now — story 4, as a number.
   *
   * Los dos punteros en null — *libre* —, que es "no está afuera ahora mismo" y
   * no "nunca estuvo": la segunda pregunta es un anti-join contra Asignación y
   * vive en `AsignacionRepository`. Confundirlas contaría una imagen entregada y
   * devuelta como capacidad ociosa que nunca se usó.
   */
  static async contarSinTenencia(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
  ): Promise<number> {
    return PeregrinaRepository.contarTotal(alcance, {
      ...filtros,
      tenencia: "libre",
    });
  }

  /**
   * Registrations per month, oldest first — story 12.
   *
   * From `created_at`, not from stored periodic totals: a snapshot table would
   * have to be written by something, and there is nothing to write it. The cost
   * is that growth is growth *of the current inventory* — an image given de baja
   * leaves the series it was in, which is the honest reading of "how many
   * Peregrinas do we have" and worth saying out loud on the screen.
   */
  static async contarPorMes(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
  ): Promise<{ mes: string; total: number }[]> {
    const mes = sql<string>`to_char(date_trunc('month', ${peregrina.createdAt}), 'YYYY-MM')`;
    return agregando({ mes })
      .where(condiciones(alcance, filtros))
      .groupBy(mes)
      .orderBy(asc(mes));
  }

  /**
   * The filtered listado — one query, all six dimensions, indexed.
   *
   * Replaces asking for the narrowest indexed question and narrowing the rest in
   * memory. That worked while there were two filters and a Diócesis's worth of
   * rows, and it is exactly the pattern that makes a screen slower as the
   * Campaña grows — which the tablero is not allowed to be.
   *
   * `paginacion` cuts the rows in the database rather than in the page. Absent
   * means every matching row, which is what a picker and the tests want; the
   * screen always passes one. The order is the Código, which is unique, so a row
   * cannot sit on two pages or fall between them — an `order by` that ties is how
   * an offset silently skips records.
   */
  static async findFiltradas(
    alcance: Alcance,
    filtros: FiltrosDeInventario,
    opts: OpcionesDeLectura = {},
    paginacion?: { limit: number; offset: number },
  ): Promise<PeregrinaConTerritorio[]> {
    const consulta = conTerritorio()
      .where(conAlcance(alcance, opts, ...condicionDeFiltros(filtros)))
      .orderBy(asc(peregrina.codigo));

    return leerVarias(
      paginacion
        ? consulta.limit(paginacion.limit).offset(paginacion.offset)
        : consulta,
    );
  }
}
