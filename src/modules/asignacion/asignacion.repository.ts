import { db } from "@/db";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  isNotNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { asignacion } from "./asignacion.schema";
import type { AsignacionRow, NewAsignacionRow } from "./asignacion.schema";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import { matrimonio } from "@/modules/misionero/matrimonio.schema";
// Un predicado del roster, importado y no reescrito — la misma razón por la que
// `peregrina.repository` importa `coincideElNombre` de acá: dos copias a mano de
// «esta persona no es cónyuge de nadie» es cómo una lista ofrece una fila que la
// otra no muestra.
import { sinMatrimonioActivo } from "@/modules/misionero/misionero.repository";
import { users } from "@/db/schema/users";
import { diocesisLocalidad } from "@/modules/territorio/territorio.schema";
import type { Alcance } from "@/lib/authorization/alcance";
import type { FiltrosTerritoriales } from "@/modules/territorio/territorio.types";
import type { Tenedor } from "@/modules/misionero/matrimonio.types";
import type {
  PersonaDeTenedorDTO,
  TenedorResueltoDTO,
} from "@/lib/tenedor";

/**
 * An Asignación is never useful on its own: a row of three foreign keys answers
 * nobody's question. Every read resolves the Código, the Tenedor's name, and
 * the territory of each login that touched the record.
 *
 * `tenedor` is one field and not two half-filled ones, which is the whole shape
 * of ADR 0010 at this layer: the period belongs to a Misionero *or* to a
 * Matrimonio, and a caller that has to check which one is null before it can
 * render a name is a caller that will eventually forget.
 */
export interface AsignacionCompleta {
  asignacion: AsignacionRow;
  peregrinaCodigo: string;
  peregrinaBajaAt: Date | null;
  /** The Peregrina's territory — what this Asignación is scoped through. */
  peregrinaDiocesisLocalidadId: string;
  tenedor: TenedorResueltoDTO;
  registradaPorDiocesis: string | null;
  cerradaPorDiocesis: string | null;
  corregidaPorDiocesis: string | null;
}

/**
 * A Tenedor with its territory, for the guard every mutation runs before it
 * writes.
 *
 * A Matrimonio has no territory column of its own — it is spouse A's, which is
 * well defined only because both spouses share a Diócesis by construction
 * (ADR 0010). Flattened here so no caller has to know that.
 */
export interface TenedorConTerritorio {
  tenedor: TenedorResueltoDTO;
  diocesisLocalidadId: string;
}

/**
 * Una imagen abierta, vista desde el **Tenedor** que la tiene.
 *
 * Mucho menos que `AsignacionCompleta` a propósito: es lo que necesita una celda
 * de una tabla — el Código, a dónde linkea, y el territorio de la imagen para
 * saber si se puede nombrar.
 *
 * `tenedor` y no `misioneroId`: la fila del listado que hace la pregunta puede
 * ser una pareja, y su id es de otra tabla (ADR 0010).
 */
export interface TenenciaDeTenedor {
  tenedor: Tenedor;
  peregrinaId: string;
  peregrinaCodigo: string;
  peregrinaDiocesisLocalidadId: string;
}

/**
 * Una imagen que hace demasiado que no cambia de manos — la tarjeta de la
 * story 8.
 *
 * Lleva el Tenedor entero y no un nombre y un apellido sueltos, porque las manos
 * en las que está pueden ser dos: la tarjeta dice a quién llamar, y «Ana
 * Álvarez» cuando la tienen Ana y Juan es media respuesta.
 */
export interface PeregrinaEstancada {
  peregrinaId: string;
  codigo: string;
  abiertaAt: Date;
  dias: number;
  tenedor: TenedorResueltoDTO;
}

// Three different logins can touch one Asignación — the one that opened it, the
// one that closed it, and the one that corrected it — so `users` and
// `diocesis_localidad` are joined once per role. Left joins throughout: a
// nacional rol has no territory, and a period that is still open has no closer.
const registrante = alias(users, "registrante");
const diocesisRegistrante = alias(diocesisLocalidad, "diocesis_registrante");
const cerrador = alias(users, "cerrador");
const diocesisCerrador = alias(diocesisLocalidad, "diocesis_cerrador");
const corrector = alias(users, "corrector");
const diocesisCorrector = alias(diocesisLocalidad, "diocesis_corrector");

/**
 * The two spouses, joined through the Matrimonio rather than through the
 * Asignación — the couple is the holder, and the people are the couple's.
 *
 * `misionero` itself stays for the individual leg, so a single query resolves
 * either kind of period without a union: three left joins where two of them are
 * always null.
 */
const esposoA = alias(misionero, "esposo_a");
const esposoB = alias(misionero, "esposo_b");

/**
 * La Diócesis/Localidad de una pareja, que es la del cónyuge A — la tabla no
 * tiene columna propia (ADR 0010). Aliaseada porque `diocesis_localidad` ya entra
 * en las mismas consultas por el lado de la Peregrina.
 */
const diocesisDelMatrimonio = alias(diocesisLocalidad, "diocesis_matrimonio");

function completa() {
  return db
    .select({
      asignacion,
      peregrinaCodigo: peregrina.codigo,
      peregrinaBajaAt: peregrina.bajaAt,
      peregrinaDiocesisLocalidadId: peregrina.diocesisLocalidadId,
      misioneroId: misionero.id,
      misioneroNombre: misionero.nombre,
      misioneroApellido: misionero.apellido,
      misioneroBajaAt: misionero.bajaAt,
      matrimonioId: matrimonio.id,
      matrimonioBajaAt: matrimonio.bajaAt,
      esposoAId: esposoA.id,
      esposoANombre: esposoA.nombre,
      esposoAApellido: esposoA.apellido,
      esposoABajaAt: esposoA.bajaAt,
      esposoBId: esposoB.id,
      esposoBNombre: esposoB.nombre,
      esposoBApellido: esposoB.apellido,
      esposoBBajaAt: esposoB.bajaAt,
      registradaPorDiocesis: diocesisRegistrante.nombre,
      cerradaPorDiocesis: diocesisCerrador.nombre,
      corregidaPorDiocesis: diocesisCorrector.nombre,
    })
    .from(asignacion)
    // Peregrina is inner and deliberately not filtered on `baja_at`: a Peregrina
    // given de baja keeps its chain of custody. Soft delete hides rows from
    // *active lists*, not from history.
    .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
    /*
     * The holder joins are **left**, and that is the change ADR 0010 costs.
     *
     * `misionero` used to be inner, which was correct while `misionero_id` was
     * `not null` and is now the exact failure the ADR names: an inner join on
     * one leg of a polymorphic pointer drops every row that took the other leg,
     * with no error and no warning. A couple's images would simply stop
     * appearing in the historial.
     *
     * Neither leg is filtered on `baja_at` either — a Misionero who left the
     * Campaña, and a Matrimonio that ended, both still resolve by name inside
     * the periods they held (user story 15, and CONTEXT.md on Matrimonio: the
     * historial says what was true *then*).
     */
    .leftJoin(misionero, eq(misionero.id, asignacion.misioneroId))
    .leftJoin(matrimonio, eq(matrimonio.id, asignacion.matrimonioId))
    .leftJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
    .leftJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
    .leftJoin(registrante, eq(registrante.id, asignacion.registradaPorId))
    .leftJoin(
      diocesisRegistrante,
      eq(diocesisRegistrante.id, registrante.diocesisLocalidadId)
    )
    .leftJoin(cerrador, eq(cerrador.id, asignacion.cerradaPorId))
    .leftJoin(
      diocesisCerrador,
      eq(diocesisCerrador.id, cerrador.diocesisLocalidadId)
    )
    .leftJoin(corrector, eq(corrector.id, asignacion.corregidaPorId))
    .leftJoin(
      diocesisCorrector,
      eq(diocesisCorrector.id, corrector.diocesisLocalidadId)
    );
}

/** One row of `completa()`, inferred rather than restated. */
type FilaCompleta = Awaited<ReturnType<typeof completa>>[number];

function persona(
  id: string,
  nombre: string,
  apellido: string,
  bajaAt: Date | null
): PersonaDeTenedorDTO {
  return { id, nombre, apellido, deBaja: bajaAt !== null };
}

/**
 * The shape of a row that joined both legs — whichever query produced it.
 *
 * Structural rather than tied to `completa()`, because the estancadas card
 * resolves the same Tenedor from its own narrower select, and two hand-written
 * copies of "which of these two is filled" is precisely the drift ADR 0010 warns
 * about.
 */
interface ColumnasDeTenedor {
  misioneroId: string | null;
  misioneroNombre: string | null;
  misioneroApellido: string | null;
  misioneroBajaAt: Date | null;
  matrimonioId: string | null;
  matrimonioBajaAt: Date | null;
  esposoAId: string | null;
  esposoANombre: string | null;
  esposoAApellido: string | null;
  esposoABajaAt: Date | null;
  esposoBId: string | null;
  esposoBNombre: string | null;
  esposoBApellido: string | null;
  esposoBBajaAt: Date | null;
}

/**
 * The two nullable columns, back to one answer.
 *
 * It throws rather than returning null when neither leg resolved, and that is
 * the point of it being here: `asignacion_un_solo_tenedor` guarantees exactly
 * one, so reaching the throw means a join was dropped or a constraint was
 * removed. ADR 0010 says the failure mode of the polymorphic pointer is
 * silence; this is where the silence becomes a noise.
 */
function tenedorDeColumnasResueltas(
  fila: ColumnasDeTenedor,
  contexto: string
): TenedorResueltoDTO {
  if (fila.misioneroId !== null) {
    return {
      tipo: "persona",
      id: fila.misioneroId,
      deBaja: fila.misioneroBajaAt !== null,
      persona: persona(
        fila.misioneroId,
        fila.misioneroNombre ?? "",
        fila.misioneroApellido ?? "",
        fila.misioneroBajaAt
      ),
    };
  }

  if (fila.matrimonioId !== null && fila.esposoAId && fila.esposoBId) {
    return {
      tipo: "matrimonio",
      id: fila.matrimonioId,
      deBaja: fila.matrimonioBajaAt !== null,
      matrimonio: {
        misioneroA: persona(
          fila.esposoAId,
          fila.esposoANombre ?? "",
          fila.esposoAApellido ?? "",
          fila.esposoABajaAt
        ),
        misioneroB: persona(
          fila.esposoBId,
          fila.esposoBNombre ?? "",
          fila.esposoBApellido ?? "",
          fila.esposoBBajaAt
        ),
      },
    };
  }

  throw new Error(
    `Sin Tenedor resuelto (${contexto}): ni Misionero ni Matrimonio. ` +
      "Falta una de las dos patas del join."
  );
}

function aCompleta(fila: FilaCompleta): AsignacionCompleta {
  return {
    asignacion: fila.asignacion,
    peregrinaCodigo: fila.peregrinaCodigo,
    peregrinaBajaAt: fila.peregrinaBajaAt,
    peregrinaDiocesisLocalidadId: fila.peregrinaDiocesisLocalidadId,
    tenedor: tenedorDeColumnasResueltas(fila, fila.asignacion.id),
    registradaPorDiocesis: fila.registradaPorDiocesis,
    cerradaPorDiocesis: fila.cerradaPorDiocesis,
    corregidaPorDiocesis: fila.corregidaPorDiocesis,
  };
}

async function leerVarias(
  consulta: PromiseLike<FilaCompleta[]>
): Promise<AsignacionCompleta[]> {
  return (await consulta).map(aCompleta);
}

async function leerUna(
  consulta: PromiseLike<FilaCompleta[]>
): Promise<AsignacionCompleta | undefined> {
  const [fila] = await consulta;
  return fila ? aCompleta(fila) : undefined;
}

/**
 * The Tenedor's two columns, from the one value the services pass around.
 *
 * This function and `punteroDeTenedor` below are the **only** places a `Tenedor`
 * becomes a pair of columns — the same containment `misioneroActualId` already
 * had (CLAUDE.md §7). Anywhere else, a mistake here is two writers disagreeing
 * about which leg an image took.
 */
function columnasDeTenedor(t: Tenedor): {
  misioneroId: string | null;
  matrimonioId: string | null;
} {
  return t.tipo === "persona"
    ? { misioneroId: t.id, matrimonioId: null }
    : { misioneroId: null, matrimonioId: t.id };
}

/** The denormalised pointer on Peregrina. Null on both columns means *libre*. */
function punteroDeTenedor(t: Tenedor | null): {
  misioneroActualId: string | null;
  matrimonioActualId: string | null;
} {
  if (!t) return { misioneroActualId: null, matrimonioActualId: null };
  return t.tipo === "persona"
    ? { misioneroActualId: t.id, matrimonioActualId: null }
    : { misioneroActualId: null, matrimonioActualId: t.id };
}

/**
 * What opening a period needs: the row, minus the two holder columns, plus the
 * one value they are derived from.
 *
 * The columns are deliberately unreachable from the outside. A caller that could
 * pass `misioneroId` directly could pass both, or neither, and find out from a
 * check-constraint violation — which ADR 0004 already rejected as a sentence
 * nobody can act on.
 */
export type AperturaDeAsignacion = Omit<
  NewAsignacionRow,
  "misioneroId" | "matrimonioId"
> & { tenedor: Tenedor };

/** The Tenedor a written row ended up naming, for the pointer it derives. */
function tenedorDeColumnas(fila: {
  misioneroId: string | null;
  matrimonioId: string | null;
}): Tenedor | null {
  if (fila.misioneroId) return { tipo: "persona", id: fila.misioneroId };
  if (fila.matrimonioId) return { tipo: "matrimonio", id: fila.matrimonioId };
  return null;
}

/**
 * The Actor's territorial filter, as SQL.
 *
 * The one place in the codebase where the filter is not a column on the table
 * being read. An Asignación has no territory of its own — a Peregrina is the
 * thing that lives somewhere — so the predicate lands on the joined `peregrina`
 * row, and every scoped read therefore joins it. `asignacion_peregrina_idx`
 * covers that join.
 *
 * The consequence is worth stating rather than discovering: a Peregrina that
 * moves Diócesis takes its whole history with it, so a Referente Local can lose
 * sight of Asignaciones their own territory registered, if an Asesor Nacional
 * moves the image out. That is the right way round — the chain of custody belongs
 * to the image — and the alternative, copying the territory onto each Asignación
 * when it opens, would freeze a fact that changes and is far worse to undo.
 */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(peregrina.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

function conAlcance(alcance: Alcance, ...extras: (SQL | undefined)[]) {
  const filtros = [condicionDeAlcance(alcance), ...extras].filter(
    (f) => f !== undefined
  );
  return filtros.length ? and(...filtros) : undefined;
}

/** An open period: no closing timestamp. This is the tenencia actual. */
const abierta = isNull(asignacion.cerradaAt);

/**
 * "This person had it" — as an individual, or as half of the Matrimonio that
 * had it. Only valid inside `completa()`, which is where `matrimonio` is joined.
 *
 * No filter on `matrimonio.baja_at`, deliberately, and it is the opposite choice
 * from the one `misionerosPorTenencia` makes two functions up. That one asks
 * "whose hands are free *now*", so a marriage that ended stops speaking for
 * them. This one is history and it is also the baja guard: a period the couple
 * opened is a period this person was part of, whatever happened to the marriage
 * afterwards, and an open one means the image may still be in their house. A
 * guard that can be wrong in the permissive direction is not a guard.
 */
function tenidaPor(misioneroId: string) {
  return or(
    eq(asignacion.misioneroId, misioneroId),
    eq(matrimonio.misioneroAId, misioneroId),
    eq(matrimonio.misioneroBId, misioneroId)
  );
}

/**
 * True when the database refused a second open Asignación for the same Peregrina.
 *
 * The partial unique index is the storage-layer half of the invariant, and this
 * is how the service recognises it and reports a conflict rather than an
 * unexpected failure. Kept here because the repository is the only layer that
 * should know a constraint's name.
 */
export function esSegundaAsignacionAbierta(error: unknown): boolean {
  // Drizzle wraps a driver error in one of its own, so the Postgres detail — the
  // `23505` and the constraint name — is a link or two down the `cause` chain and
  // not in the top-level message. Both drivers put it there; walking the chain is
  // what makes this work the same in the suite and in production.
  for (let actual: unknown = error; actual instanceof Error; actual = actual.cause) {
    const codigo = (actual as { code?: unknown }).code;
    const restriccion = (actual as { constraint?: unknown }).constraint;

    if (codigo === "23505" && restriccion === CLAVE_ASIGNACION_ABIERTA) {
      return true;
    }
    if (actual.message.includes(CLAVE_ASIGNACION_ABIERTA)) return true;
  }
  return false;
}

const CLAVE_ASIGNACION_ABIERTA = "asignacion_peregrina_abierta_key";

/**
 * Los **Tenedores** de un territorio, partidos por si tienen algo a cargo.
 *
 * Dos patas y no una, porque la pregunta es sobre las filas del listado y esas
 * filas son Tenedores: individuos que no están en un Matrimonio activo, más
 * Matrimonios (ADR 0010). Una pareja cuenta **una vez** — CONTEXT.md pide que
 * cada cifra linkee a los registros que hay detrás, y una casa contada dos veces
 * es una lista más corta que su propio número.
 *
 * Un solo predicado leído en los dos sentidos — `notExists` y `exists` sobre la
 * misma subconsulta — porque son las dos opciones de un mismo select y una
 * segunda consulta escrita a mano sería un segundo lugar donde discrepar.
 *
 * Scopeado por el territorio de la **persona** —el del cónyuge A para la pareja,
 * que no tiene columna propia— y no por el de la imagen, que es lo que la
 * pregunta quiere decir: la Diócesis de alguien está en su propia fila, y una
 * Peregrina que se movió mientras estaba en una casa sigue estando en esa casa.
 * Quien la tiene no está libre, y contarlo como libre es la mentira cómoda.
 *
 * **Acá el filtro por baja sí corresponde**, y es la asimetría deliberada frente
 * a `tenidaPor`: esto contesta «¿quién tiene las manos libres *ahora*?», así que
 * un Matrimonio terminado no habla por nadie y quien se fue de la Campaña no es
 * ni capacidad libre ni alguien a quien pedirle una imagen. `tenidaPor` contesta
 * otra cosa —es historia, y es la guarda de la baja— y por eso no filtra: una
 * guarda que puede equivocarse para el lado permisivo no es una guarda.
 *
 * Se resuelve con dos consultas y no con un `union all`: las dos patas proyectan
 * formas distintas —una persona tiene un nombre, una pareja tiene dos— y acá no
 * hay ninguna cifra colgando del mismo predicado, que es lo que obliga a la unión
 * en el roster (ADR 0008). Nadie pagina esta lista; es el conjunto de pertenencia
 * de un filtro.
 */
async function tenedoresPorTenencia(
  alcance: Alcance,
  filtros: FiltrosTerritoriales,
  tenencia: "con" | "sin"
): Promise<TenedorResueltoDTO[]> {
  const abiertaDeLaPersona = db
    .select({ uno: sql`1` })
    .from(asignacion)
    .where(and(abierta, eq(asignacion.misioneroId, misionero.id)));

  const abiertaDeLaPareja = db
    .select({ uno: sql`1` })
    .from(asignacion)
    .where(and(abierta, eq(asignacion.matrimonioId, matrimonio.id)));

  const segunTenencia = (sub: typeof abiertaDeLaPersona) =>
    tenencia === "sin" ? notExists(sub) : exists(sub);

  const dePersonas = [
    alcance.tipo === "nacional"
      ? undefined
      : eq(misionero.diocesisLocalidadId, alcance.diocesisLocalidadId),
    filtros.diocesisLocalidadId
      ? eq(misionero.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region ? eq(diocesisLocalidad.region, filtros.region) : undefined,
    isNull(misionero.bajaAt),
    // La misma cláusula que la pata individual del roster, importada y no
    // reescrita: si esta lista incluyera a un cónyuge, el filtro de tenencia
    // ofrecería una fila que el listado no muestra.
    sinMatrimonioActivo(misionero.id),
    segunTenencia(abiertaDeLaPersona),
  ].filter((f) => f !== undefined);

  const deParejas = [
    alcance.tipo === "nacional"
      ? undefined
      : eq(esposoA.diocesisLocalidadId, alcance.diocesisLocalidadId),
    filtros.diocesisLocalidadId
      ? eq(esposoA.diocesisLocalidadId, filtros.diocesisLocalidadId)
      : undefined,
    filtros.region
      ? eq(diocesisDelMatrimonio.region, filtros.region)
      : undefined,
    isNull(matrimonio.bajaAt),
    segunTenencia(abiertaDeLaPareja),
  ].filter((f) => f !== undefined);

  const [personas, parejas] = await Promise.all([
    db
      .select({
        id: misionero.id,
        nombre: misionero.nombre,
        apellido: misionero.apellido,
        bajaAt: misionero.bajaAt,
      })
      .from(misionero)
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, misionero.diocesisLocalidadId)
      )
      .where(and(...dePersonas)),

    db
      .select({
        id: matrimonio.id,
        bajaAt: matrimonio.bajaAt,
        aId: esposoA.id,
        aNombre: esposoA.nombre,
        aApellido: esposoA.apellido,
        aBajaAt: esposoA.bajaAt,
        bId: esposoB.id,
        bNombre: esposoB.nombre,
        bApellido: esposoB.apellido,
        bBajaAt: esposoB.bajaAt,
      })
      .from(matrimonio)
      // Inner en las dos: las columnas de los cónyuges son `not null` con clave
      // foránea, así que un Matrimonio sin dos Misioneros es irrepresentable.
      .innerJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .innerJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
      .innerJoin(
        diocesisDelMatrimonio,
        eq(diocesisDelMatrimonio.id, esposoA.diocesisLocalidadId)
      )
      .where(and(...deParejas)),
  ]);

  const filas: TenedorResueltoDTO[] = [
    ...personas.map(
      (p): TenedorResueltoDTO => ({
        tipo: "persona",
        id: p.id,
        deBaja: p.bajaAt !== null,
        persona: persona(p.id, p.nombre, p.apellido, p.bajaAt),
      })
    ),
    ...parejas.map(
      (m): TenedorResueltoDTO => ({
        tipo: "matrimonio",
        id: m.id,
        deBaja: m.bajaAt !== null,
        matrimonio: {
          misioneroA: persona(m.aId, m.aNombre, m.aApellido, m.aBajaAt),
          misioneroB: persona(m.bId, m.bNombre, m.bApellido, m.bBajaAt),
        },
      })
    ),
  ];

  // `apellido, nombre, id`, el mismo orden del roster y por la misma razón: la
  // clave de una pareja es la del cónyuge A, que es quien la archiva.
  return filas.sort((a, b) => {
    const ka = claveDeOrden(a);
    const kb = claveDeOrden(b);
    return (
      ka.apellido.localeCompare(kb.apellido, "es") ||
      ka.nombre.localeCompare(kb.nombre, "es") ||
      ka.id.localeCompare(kb.id)
    );
  });
}

/** El cónyuge A archiva a la pareja, igual que en el roster. */
function claveDeOrden(t: TenedorResueltoDTO): {
  apellido: string;
  nombre: string;
  id: string;
} {
  const p = t.tipo === "persona" ? t.persona : t.matrimonio.misioneroA;
  return { apellido: p.apellido, nombre: p.nombre, id: t.id };
}

/**
 * AsignacionRepository
 *
 * Responsibility: raw database access for the `asignacion` table, plus the
 * denormalised `peregrina.misionero_actual_id` pointer that is derived from it —
 * the pointer is never written anywhere else, so the two cannot drift.
 *
 * No business logic. No permission checks. Every read takes an `Alcance` as its
 * first parameter, required, so a read added later cannot quietly omit the scope.
 */
export class AsignacionRepository {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async findById(
    alcance: Alcance,
    id: string
  ): Promise<AsignacionCompleta | undefined> {
    return leerUna(
      completa().where(conAlcance(alcance, eq(asignacion.id, id))).limit(1)
    );
  }

  /**
   * A Tenedor with its territory and its names, before a mutation writes it.
   *
   * One method for both kinds, because every caller wants the same three things
   * — does it exist, is it mine, and what is it called — and a caller that has
   * to branch on `tipo` to ask them is a caller that will branch differently
   * somewhere else.
   *
   * Unscoped by design, like every other `SinAlcance` read here: the caller
   * compares the territory immediately, so that "no existe" and "es de otro
   * territorio" stay different answers in the log and the same answer to the
   * Actor. A Matrimonio's territory is spouse A's — it has no column of its own
   * (ADR 0010) — and both spouses share a Diócesis by construction.
   */
  static async findTenedorSinAlcance(
    t: Tenedor
  ): Promise<TenedorConTerritorio | undefined> {
    if (t.tipo === "persona") {
      const [fila] = await db
        .select({
          id: misionero.id,
          nombre: misionero.nombre,
          apellido: misionero.apellido,
          bajaAt: misionero.bajaAt,
          diocesisLocalidadId: misionero.diocesisLocalidadId,
        })
        .from(misionero)
        .where(eq(misionero.id, t.id))
        .limit(1);
      if (!fila) return undefined;

      return {
        tenedor: {
          tipo: "persona",
          id: fila.id,
          deBaja: fila.bajaAt !== null,
          persona: persona(fila.id, fila.nombre, fila.apellido, fila.bajaAt),
        },
        diocesisLocalidadId: fila.diocesisLocalidadId,
      };
    }

    const [fila] = await db
      .select({
        id: matrimonio.id,
        bajaAt: matrimonio.bajaAt,
        aId: esposoA.id,
        aNombre: esposoA.nombre,
        aApellido: esposoA.apellido,
        aBajaAt: esposoA.bajaAt,
        aDiocesisLocalidadId: esposoA.diocesisLocalidadId,
        bId: esposoB.id,
        bNombre: esposoB.nombre,
        bApellido: esposoB.apellido,
        bBajaAt: esposoB.bajaAt,
      })
      .from(matrimonio)
      // Inner, and here that is right rather than dangerous: both spouse columns
      // are `not null` with foreign keys, so a Matrimonio without two Misioneros
      // is unrepresentable and there is no second leg to forget.
      .innerJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .innerJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
      .where(eq(matrimonio.id, t.id))
      .limit(1);
    if (!fila) return undefined;

    return {
      tenedor: {
        tipo: "matrimonio",
        id: fila.id,
        deBaja: fila.bajaAt !== null,
        matrimonio: {
          misioneroA: persona(
            fila.aId,
            fila.aNombre,
            fila.aApellido,
            fila.aBajaAt
          ),
          misioneroB: persona(
            fila.bId,
            fila.bNombre,
            fila.bApellido,
            fila.bBajaAt
          ),
        },
      },
      diocesisLocalidadId: fila.aDiocesisLocalidadId,
    };
  }

  /**
   * The row regardless of territory, so a mutation can tell "does not exist"
   * apart from "not yours" before refusing. A primary-key lookup, named to make
   * the bypass visible; its callers compare the territory immediately.
   */
  static async findByIdSinAlcance(
    id: string
  ): Promise<AsignacionCompleta | undefined> {
    return leerUna(completa().where(eq(asignacion.id, id)).limit(1));
  }

  /** The tenencia actual, if anybody has this image. */
  static async findAbiertaDePeregrina(
    alcance: Alcance,
    peregrinaId: string
  ): Promise<AsignacionCompleta | undefined> {
    return leerUna(
      completa()
        .where(
          conAlcance(alcance, eq(asignacion.peregrinaId, peregrinaId), abierta)
        )
        .limit(1)
    );
  }

  /**
   * The whole chain of custody, oldest first — user stories 4, 5 and 6.
   *
   * Chronological rather than newest-first: the question this answers is "where
   * has this image been", and a chain reads forwards. An Extraviada Peregrina's
   * last holder is the open row, which sorts last and stays open on purpose.
   */
  static async findHistorialDePeregrina(
    alcance: Alcance,
    peregrinaId: string
  ): Promise<AsignacionCompleta[]> {
    return leerVarias(
      completa()
        .where(conAlcance(alcance, eq(asignacion.peregrinaId, peregrinaId)))
        .orderBy(asc(asignacion.abiertaAt), asc(asignacion.createdAt))
    );
  }

  /**
   * Every Peregrina this Misionero has ever had, most recent first — story 7.
   *
   * Both legs: what their Matrimonio held, they held. Somebody looking at a
   * person's page after a marriage ended would otherwise see a gap exactly where
   * the household's images were, and the gap is the years they were married.
   */
  static async findHistorialDeMisionero(
    alcance: Alcance,
    misioneroId: string
  ): Promise<AsignacionCompleta[]> {
    return leerVarias(
      completa()
        .where(conAlcance(alcance, tenidaPor(misioneroId)))
        .orderBy(desc(asignacion.abiertaAt), desc(asignacion.createdAt))
    );
  }

  /**
   * Every image this Misionero still has, **ignoring territory** — the guard
   * behind stories 13 and 14.
   *
   * Unscoped on purpose, and this is the one place where that is not a
   * convenience. A Peregrina can be moved to another Diócesis while a Misionero
   * still physically holds it, so a scoped count would report zero and let the
   * person be closed out with the image in their house. A guard that can be
   * wrong in the permissive direction is not a guard.
   *
   * The caller is responsible for not leaking what it learns: `MisioneroService`
   * names the Código only when the Actor could have seen it anyway, and otherwise
   * says that an image from another territory is outstanding.
   *
   * **Both legs, and this one is the bug the PRD opens with.** The guard keyed on
   * `misionero_id` alone, so the spouse the image was not filed under could be
   * given de baja with it sitting in their house. There is no "their" spouse any
   * more — the couple holds it — and `tenidaPor` says so.
   */
  static async findAbiertasDeMisioneroSinAlcance(
    misioneroId: string
  ): Promise<AsignacionCompleta[]> {
    return leerVarias(
      completa()
        .where(and(tenidaPor(misioneroId), abierta))
        .orderBy(asc(peregrina.codigo))
    );
  }

  /**
   * Every image this Matrimonio still has open, ignoring territory — the guard
   * that refuses to end a marriage while one is outstanding.
   *
   * `matrimonio.bajaAt` mirrors `misionero.bajaAt` exactly (ADR 0010), so it
   * needs the same guard and the same unscoped reading of it: the image can have
   * moved Diócesis while it sat in the couple's house.
   */
  static async findAbiertasDeMatrimonioSinAlcance(
    matrimonioId: string
  ): Promise<AsignacionCompleta[]> {
    return leerVarias(
      completa()
        .where(and(eq(asignacion.matrimonioId, matrimonioId), abierta))
        .orderBy(asc(peregrina.codigo))
    );
  }

  /**
   * Every image this Peregrina's own record still has open, ignoring territory —
   * the guard behind story 16, for the same reason as above.
   */
  static async findAbiertaDePeregrinaSinAlcance(
    peregrinaId: string
  ): Promise<AsignacionCompleta | undefined> {
    return leerUna(
      completa()
        .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
        .limit(1)
    );
  }

  /**
   * Las imágenes abiertas de una página entera de **Tenedores**, en una consulta
   * — la columna «¿Tiene imagen?» del listado.
   *
   * La pregunta se hace con las filas del listado, que son Tenedores: la de una
   * pareja lleva un id de `matrimonio`, y pasada a una API por Misionero no
   * coincidía con nada. La celda decía «Ninguna» con la imagen en la casa, sin
   * error y sin fila de menos — el silencio que ADR 0010 nombra.
   *
   * **La imagen de una pareja se le atribuye a la pareja y a nadie más.** Es un
   * Tenedor y cuenta una vez: atribuírsela además a cada cónyuge sería contar dos
   * veces la misma casa, y los cónyuges de un Matrimonio activo no son filas del
   * listado de todos modos.
   *
   * Está scopeada por el territorio del **Tenedor**, como
   * `findTenedoresSinPeregrina` y por la misma razón: la pregunta es sobre la
   * gente de esta página, así que un id de otra Diócesis no devuelve nada y no
   * hay nada que aprender pasándolo. Un Matrimonio no tiene territorio propio, y
   * es el del cónyuge A.
   *
   * El territorio de la *imagen* vuelve en cada fila en lugar de filtrar: una
   * Peregrina movida a otra Diócesis mientras alguien la tiene en la casa sigue
   * estando en esa casa, así que cuenta como tenida — filtrarla mostraría
   * «Ninguna» a quien tiene una. Nombrar su Código es otra pregunta, y la
   * responde el service comparando ese territorio con el alcance, igual que
   * `mensajeDePendientes`.
   *
   * `asignacion_misionero_idx` cubre la pata individual, `asignacion_matrimonio_idx`
   * la del Matrimonio, y el `join` con peregrina es por clave primaria.
   */
  static async findAbiertasDeTenedores(
    alcance: Alcance,
    tenedores: Tenedor[]
  ): Promise<TenenciaDeTenedor[]> {
    const personaIds = tenedores
      .filter((t) => t.tipo === "persona")
      .map((t) => t.id);
    const matrimonioIds = tenedores
      .filter((t) => t.tipo === "matrimonio")
      .map((t) => t.id);

    // Sin Tenedores no hay pregunta, y `inArray` con una lista vacía es SQL
    // inválido.
    if (personaIds.length === 0 && matrimonioIds.length === 0) return [];

    const pedidos = [
      personaIds.length
        ? inArray(asignacion.misioneroId, personaIds)
        : undefined,
      matrimonioIds.length
        ? inArray(asignacion.matrimonioId, matrimonioIds)
        : undefined,
    ].filter((f) => f !== undefined);

    // El territorio del Tenedor, en la pata que corresponda. La otra queda nula
    // por el check `num_nonnulls(...) = 1`, y `null or true` sigue siendo cierto.
    const territorial =
      alcance.tipo === "nacional"
        ? undefined
        : or(
            eq(misionero.diocesisLocalidadId, alcance.diocesisLocalidadId),
            eq(esposoA.diocesisLocalidadId, alcance.diocesisLocalidadId)
          );

    const filas = await db
      .select({
        misioneroId: asignacion.misioneroId,
        matrimonioId: asignacion.matrimonioId,
        peregrinaId: peregrina.id,
        peregrinaCodigo: peregrina.codigo,
        peregrinaDiocesisLocalidadId: peregrina.diocesisLocalidadId,
      })
      .from(asignacion)
      .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
      // Las dos patas, en left join: olvidarse de una es devolver menos filas y
      // ningún error.
      .leftJoin(misionero, eq(misionero.id, asignacion.misioneroId))
      .leftJoin(matrimonio, eq(matrimonio.id, asignacion.matrimonioId))
      .leftJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .where(and(abierta, or(...pedidos), territorial))
      .orderBy(asc(peregrina.codigo));

    return filas.map((fila) => {
      const tenedor = tenedorDeColumnas(fila);
      if (!tenedor) {
        throw new Error(
          `Asignación abierta de la Peregrina ${fila.peregrinaId} sin Tenedor: ` +
            "ni Misionero ni Matrimonio."
        );
      }
      return {
        tenedor,
        peregrinaId: fila.peregrinaId,
        peregrinaCodigo: fila.peregrinaCodigo,
        peregrinaDiocesisLocalidadId: fila.peregrinaDiocesisLocalidadId,
      };
    });
  }

  /**
   * Peregrinas that have never been in anybody's charge — user story 19.
   *
   * A left join with no matching Asignación, rather than a count of zero, so an
   * image that was held once and returned is *not* here: "never assigned" and
   * "not assigned right now" are different questions and the second one is
   * `misionero_actual_id is null`.
   */
  static async findPeregrinasNuncaAsignadas(
    alcance: Alcance
  ): Promise<{ id: string; codigo: string }[]> {
    return db
      .select({ id: peregrina.id, codigo: peregrina.codigo })
      .from(peregrina)
      .leftJoin(asignacion, eq(asignacion.peregrinaId, peregrina.id))
      .where(
        conAlcance(
          alcance,
          isNull(asignacion.id),
          // Retired images are not idle capacity.
          isNull(peregrina.bajaAt)
        )
      )
      .orderBy(asc(peregrina.codigo));
  }

  /**
   * Tenedores with no image in their charge — story 5, the other half of
   * matching idle capacity to people.
   *
   * Renamed from `findMisionerosSinPeregrina`, and the rename is the fix: it
   * answers with the rows of the listado, which are Tenedores, and a couple is
   * one of them. The old name kept compiling while a household fell on the wrong
   * side of the filter.
   *
   * Scoped by the **holder's** territory and not by the image's, which is the
   * one read in this file where `conAlcance` is the wrong filter: the question is
   * "who in my Diócesis has their hands free", and a person's Diócesis is on
   * their own row — a couple's is spouse A's. The `not exists` deliberately
   * ignores the image's territory, so somebody holding a Peregrina that has since
   * been moved elsewhere is *not* offered as free — the same reason
   * `findAbiertasDeMisioneroSinAlcance` is unscoped.
   */
  static async findTenedoresSinPeregrina(
    alcance: Alcance,
    filtros: FiltrosTerritoriales = {}
  ): Promise<TenedorResueltoDTO[]> {
    return tenedoresPorTenencia(alcance, filtros, "sin");
  }

  /**
   * Tenedores with at least one image in their charge — the other half of the
   * listado's tenencia filter.
   *
   * The same query with `exists` instead of `notExists`, deliberately: "who has
   * their hands free" and "who is holding something" have to be two readings of
   * one predicate, or the two options of one select would disagree about somebody
   * whose Peregrina has moved Diócesis. It ignores the image's territory for the
   * same reason its twin does — an image in somebody's house is in that house.
   */
  static async findTenedoresConPeregrina(
    alcance: Alcance,
    filtros: FiltrosTerritoriales = {}
  ): Promise<TenedorResueltoDTO[]> {
    return tenedoresPorTenencia(alcance, filtros, "con");
  }

  /**
   * Images that have been in the same hands for longer than the Campaña wants —
   * story 8.
   *
   * "Has not changed hands" is read as "the open period started more than N days
   * ago", which is the only reading the data supports without guessing: an image
   * nobody has ever taken out is a different card (never asignada, story 19), and
   * one that came back and is sitting on a shelf is idle rather than stalled.
   *
   * The threshold is a parameter and not a constant here, because what counts as
   * stalled is a judgement the Campaña has not made yet — see the open question
   * in the production plan. The default lives in `tablero.types`, where a person
   * can find and change it.
   */
  static async findPeregrinasEstancadas(
    alcance: Alcance,
    dias: number,
    filtros: FiltrosTerritoriales = {}
  ): Promise<PeregrinaEstancada[]> {
    const antiguedad = sql<number>`cast(floor(extract(epoch from (now() - ${asignacion.abiertaAt})) / 86400) as int)`;

    const filas = await db
      .select({
        peregrinaId: peregrina.id,
        codigo: peregrina.codigo,
        abiertaAt: asignacion.abiertaAt,
        dias: antiguedad,
        misioneroId: misionero.id,
        misioneroNombre: misionero.nombre,
        misioneroApellido: misionero.apellido,
        misioneroBajaAt: misionero.bajaAt,
        matrimonioId: matrimonio.id,
        matrimonioBajaAt: matrimonio.bajaAt,
        esposoAId: esposoA.id,
        esposoANombre: esposoA.nombre,
        esposoAApellido: esposoA.apellido,
        esposoABajaAt: esposoA.bajaAt,
        esposoBId: esposoB.id,
        esposoBNombre: esposoB.nombre,
        esposoBApellido: esposoB.apellido,
        esposoBBajaAt: esposoB.bajaAt,
      })
      .from(asignacion)
      .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
      // Left, for the reason `completa()` is left: the misionero leg was inner
      // here too, so a couple's stalled image was invisible on the card that
      // exists to find stalled images.
      .leftJoin(misionero, eq(misionero.id, asignacion.misioneroId))
      .leftJoin(matrimonio, eq(matrimonio.id, asignacion.matrimonioId))
      .leftJoin(esposoA, eq(esposoA.id, matrimonio.misioneroAId))
      .leftJoin(esposoB, eq(esposoB.id, matrimonio.misioneroBId))
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
      )
      .where(
        conAlcance(
          alcance,
          abierta,
          isNull(peregrina.bajaAt),
          filtros.diocesisLocalidadId
            ? eq(peregrina.diocesisLocalidadId, filtros.diocesisLocalidadId)
            : undefined,
          filtros.region
            ? eq(diocesisLocalidad.region, filtros.region)
            : undefined,
          sql`${asignacion.abiertaAt} <= now() - make_interval(days => ${dias})`
        )
      )
      .orderBy(asc(asignacion.abiertaAt));

    return filas.map((fila) => ({
      peregrinaId: fila.peregrinaId,
      codigo: fila.codigo,
      abiertaAt: fila.abiertaAt,
      dias: fila.dias,
      tenedor: tenedorDeColumnasResueltas(fila, fila.peregrinaId),
    }));
  }

  // ── Writes ─────────────────────────────────────────────────────────────────
  //
  // The three write paths each hold the Asignación table and the denormalised
  // pointer in step, in one transaction, because "this image changed hands" is
  // one fact about the world and half of it is worse than none of it.

  /** Opens a period for a Peregrina nobody currently has. */
  static async abrir(data: AperturaDeAsignacion): Promise<AsignacionCompleta> {
    const { tenedor, ...resto } = data;

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(asignacion)
        .values({ ...resto, ...columnasDeTenedor(tenedor) })
        .returning();
      if (!row) throw new Error("Failed to insert asignacion");

      await tx
        .update(peregrina)
        .set({ ...punteroDeTenedor(tenedor), updatedAt: new Date() })
        .where(eq(peregrina.id, data.peregrinaId));

      return row.id;
    });

    return AsignacionRepository.exigirRecienEscrita(id);
  }

  /**
   * Closes the open period and leaves the Peregrina with nobody — user story 3.
   *
   * `undefined` means there was nothing open to close: either it never was, or
   * somebody else registered the return first. The `cerrada_at is null` predicate
   * is the concurrency control, the same trick `InvitacionRepository.marcarAceptada`
   * uses — no lock, and the loser finds out instead of overwriting.
   */
  static async cerrar(
    peregrinaId: string,
    cierre: { cerradaAt: Date; cerradaPorId: string; notaCierre: string | null }
  ): Promise<AsignacionCompleta | undefined> {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(asignacion)
        .set({
          cerradaAt: cierre.cerradaAt,
          cerradaPorId: cierre.cerradaPorId,
          notaCierre: cierre.notaCierre,
          updatedAt: new Date(),
        })
        .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
        .returning();
      if (!row) return undefined;

      await tx
        .update(peregrina)
        .set({ ...punteroDeTenedor(null), updatedAt: new Date() })
        .where(eq(peregrina.id, peregrinaId));

      return row.id;
    });

    return id ? AsignacionRepository.exigirRecienEscrita(id) : undefined;
  }

  /**
   * Hands the image on: closes one period and opens the next, atomically —
   * user stories 1 and 2.
   *
   * Returns both rows, because the caller has something to say about each: the
   * period that ended and the period that began. `undefined` again means somebody
   * else moved first.
   */
  static async cerrarYAbrir(
    peregrinaId: string,
    cierre: { cerradaAt: Date; cerradaPorId: string; notaCierre: string | null },
    apertura: AperturaDeAsignacion
  ): Promise<{ cerrada: string; abierta: string } | undefined> {
    const { tenedor, ...resto } = apertura;

    return db.transaction(async (tx) => {
      const [cerrada] = await tx
        .update(asignacion)
        .set({
          cerradaAt: cierre.cerradaAt,
          cerradaPorId: cierre.cerradaPorId,
          notaCierre: cierre.notaCierre,
          updatedAt: new Date(),
        })
        .where(and(eq(asignacion.peregrinaId, peregrinaId), abierta))
        .returning();
      if (!cerrada) return undefined;

      const [nueva] = await tx
        .insert(asignacion)
        .values({ ...resto, ...columnasDeTenedor(tenedor) })
        .returning();
      if (!nueva) throw new Error("Failed to insert asignacion");

      await tx
        .update(peregrina)
        .set({ ...punteroDeTenedor(tenedor), updatedAt: new Date() })
        .where(eq(peregrina.id, peregrinaId));

      return { cerrada: cerrada.id, abierta: nueva.id };
    });
  }

  /**
   * Corrects a record — user story 17.
   *
   * `corregidaAt` and `corregidaPorId` are set here rather than by the caller, so
   * that no correction can be applied without leaving a mark. The pointer is
   * refreshed too: correcting which Tenedor held an open period changes who has
   * the image right now.
   *
   * The correction of the holder is a `Tenedor` and not a `misioneroId`, so
   * fixing "it was the couple, not just her" is one edit and not two columns the
   * caller has to null out in the right order — the check constraint refuses
   * anything else anyway, and a constraint violation is not a sentence anybody
   * can act on.
   */
  static async corregir(
    id: string,
    data: {
      tenedor?: Tenedor;
    } & Partial<
      Pick<
        AsignacionRow,
        "abiertaAt" | "cerradaAt" | "notaApertura" | "notaCierre"
      >
    >,
    correccion: { corregidaAt: Date; corregidaPorId: string }
  ): Promise<AsignacionCompleta> {
    const { tenedor, ...resto } = data;

    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(asignacion)
        .set({
          ...resto,
          ...(tenedor && columnasDeTenedor(tenedor)),
          corregidaAt: correccion.corregidaAt,
          corregidaPorId: correccion.corregidaPorId,
          updatedAt: new Date(),
        })
        .where(eq(asignacion.id, id))
        .returning();
      if (!row) throw new Error(`Asignacion not found: ${id}`);

      // Read back off the written row rather than off `tenedor`: a correction
      // that only moved a date leaves the holder alone, and the pointer still
      // has to end up agreeing with whichever leg the row carries.
      await tx
        .update(peregrina)
        .set({
          ...punteroDeTenedor(
            row.cerradaAt === null ? tenedorDeColumnas(row) : null
          ),
          updatedAt: new Date(),
        })
        .where(eq(peregrina.id, row.peregrinaId));
    });

    return AsignacionRepository.exigirRecienEscrita(id);
  }

  /** Reads back a row this repository has just written, resolved for the caller. */
  static async exigirRecienEscrita(id: string): Promise<AsignacionCompleta> {
    const row = await AsignacionRepository.findByIdSinAlcance(id);
    if (!row) throw new Error(`Asignacion not found: ${id}`);
    return row;
  }

  // ── Agregaciones ───────────────────────────────────────────────────────────

  /**
   * How many periods are open and how many have closed — scoped, and filtered
   * through the image's territory like every other read here.
   *
   * The open count is *not* how the tablero answers "how many images are out":
   * that is `misionero_actual_id is not null` on the Peregrina, one table and no
   * join, and it is the same predicate the listado's `tenencia` filter uses. This
   * pair answers a different question — how much movement the history holds.
   */
  static async contarPorTenencia(
    alcance: Alcance,
    filtros: FiltrosTerritoriales = {}
  ): Promise<{ abiertas: number; cerradas: number }> {
    const [row] = await db
      .select({
        abiertas: sql<number>`cast(count(*) filter (where ${abierta}) as int)`,
        cerradas: sql<number>`cast(count(*) filter (where ${isNotNull(
          asignacion.cerradaAt
        )}) as int)`,
      })
      .from(asignacion)
      .innerJoin(peregrina, eq(peregrina.id, asignacion.peregrinaId))
      .innerJoin(
        diocesisLocalidad,
        eq(diocesisLocalidad.id, peregrina.diocesisLocalidadId)
      )
      .where(
        conAlcance(
          alcance,
          filtros.diocesisLocalidadId
            ? eq(peregrina.diocesisLocalidadId, filtros.diocesisLocalidadId)
            : undefined,
          filtros.region
            ? eq(diocesisLocalidad.region, filtros.region)
            : undefined
        )
      );

    return { abiertas: row?.abiertas ?? 0, cerradas: row?.cerradas ?? 0 };
  }
}
