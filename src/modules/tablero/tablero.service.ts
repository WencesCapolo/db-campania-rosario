import type { CurrentUser } from "@/modules/user/user.types";
import {
  derivarAlcance,
  esNacional,
  exigirTerritorioDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import type { PeregrinaConTerritorio } from "@/modules/peregrina/peregrina.repository";
import type { FiltrosDeInventario } from "@/modules/peregrina/peregrina.types";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import { AsignacionRepository } from "@/modules/asignacion/asignacion.repository";
import {
  FILAS_POR_TARJETA,
  umbralDeDiasEstancada,
  type FilaExtraviada,
  type Muestra,
  type TableroDTO,
} from "./tablero.types";

/**
 * TableroService — the figures, and nothing else.
 *
 * A module with no table of its own, and therefore no repository and no schema.
 * It reads the repositories of the three modules that do own tables, which is the
 * one direction allowed: a service may read another module's *repository* for a
 * cross-entity question, never another module's service. Nothing imports tablero,
 * so it sits at the end of the chain and cannot be part of a cycle.
 *
 * Why the aggregates are not here: a count over `peregrina` belongs in the
 * repository that owns `peregrina`, next to the filters it shares with that
 * table's list read. Putting them here would give the tablero a second definition
 * of "in my territory, en reparación" to keep in step with the listado's — which
 * is the exact failure the previous dashboard had.
 *
 * Everything below runs against the Actor's own scope (ADR 0001), derived once so
 * that no two figures on one screen can have been computed against different
 * territories.
 */
export class TableroService {
  static async resumen(
    actor: CurrentUser,
    filtros: FiltrosDeInventario = {}
  ): Promise<TableroDTO> {
    const operacion = "TableroService.resumen";
    const alcance = derivarAlcance(actor, operacion);

    // The one thing a query string could try to do that scoping forbids. Refused
    // rather than intersected away — see `exigirTerritorioDentroDelAlcance`.
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const nacional = esNacional(actor.role);
    const dias = umbralDeDiasEstancada();

    // Territorial filters travel to the reads that are about people rather than
    // images: a Misionero has no Estado, Modalidad or Tipo, and passing them
    // would silently drop the filter or invent a relationship.
    const territoriales = {
      diocesisLocalidadId: filtros.diocesisLocalidadId,
      region: filtros.region,
    };

    const [
      totalPeregrinas,
      totalMisioneros,
      sinTenencia,
      porEstado,
      porModalidad,
      porTipo,
      porRegion,
      porDiocesis,
      crecimiento,
      extraviadas,
      nuncaAsignadas,
      tenedoresSinPeregrina,
      estancadas,
    ] = await Promise.all([
      PeregrinaRepository.contarTotal(alcance, filtros),
      MisioneroRepository.contarTotal(alcance, territoriales),
      PeregrinaRepository.contarSinTenencia(alcance, filtros),
      PeregrinaRepository.contarPorEstado(alcance, filtros),
      PeregrinaRepository.contarPorModalidad(alcance, filtros),
      PeregrinaRepository.contarPorTipo(alcance, filtros),
      nacional ? PeregrinaRepository.contarPorRegion(alcance, filtros) : null,
      nacional
        ? PeregrinaRepository.contarPorDiocesisLocalidad(alcance, filtros)
        : null,
      nacional ? PeregrinaRepository.contarPorMes(alcance, filtros) : null,
      TableroService.extraviadas(alcance, filtros),
      TableroService.nuncaAsignadas(alcance, filtros),
      AsignacionRepository.findTenedoresSinPeregrina(alcance, territoriales),
      AsignacionRepository.findPeregrinasEstancadas(
        alcance,
        dias,
        territoriales
      ),
    ]);

    return {
      vista: nacional ? "nacional" : "diocesana",
      totalPeregrinas,
      totalMisioneros,
      sinTenencia,
      porEstado,
      porModalidad,
      porTipo,
      porRegion,
      porDiocesis,
      crecimiento,
      extraviadas,
      nuncaAsignadas,
      tenedoresSinPeregrina: recortar(tenedoresSinPeregrina),
      // `abiertaAt` se queda en el repositorio: la tarjeta dice «hace 412 días»,
      // que es la cifra sobre la que alguien actúa, y una fecha al lado sería la
      // misma información dos veces en el ancho de un teléfono.
      estancadas: recortar(
        estancadas.map((fila) => ({
          peregrinaId: fila.peregrinaId,
          codigo: fila.codigo,
          // El Tenedor entero y no dos campos sueltos: las manos pueden ser dos,
          // y la tarjeta dice a quién llamar (ADR 0010).
          tenedor: fila.tenedor,
          dias: fila.dias,
        }))
      ),
      umbralDeDiasEstancada: dias,
    };
  }

  /**
   * The Extraviadas, with whoever last had each one — story 9.
   *
   * Read off the Peregrina's denormalised pointer, which is exactly why marking an
   * image `extraviada` leaves its Asignación open: closing it would delete the
   * answer to "who had it", and this card is the reason that decision was made.
   */
  private static async extraviadas(
    alcance: Alcance,
    filtros: FiltrosDeInventario
  ): Promise<Muestra<FilaExtraviada> | null> {
    if (filtros.estado !== undefined && filtros.estado !== "extraviada") {
      return null;
    }

    const rows = await PeregrinaRepository.findFiltradas(alcance, {
      ...filtros,
      estado: "extraviada",
    });

    return recortar(rows.map(aFilaExtraviada));
  }

  /**
   * Peregrinas nobody has ever had charge of — story 19, and the card issue #4
   * left owed.
   *
   * Not the same as `sinTenencia`: an image handed out and returned is free but
   * not unused, and the two would be indistinguishable if this counted the
   * pointer instead of the absence of any Asignación.
   */
  private static async nuncaAsignadas(
    alcance: Alcance,
    filtros: FiltrosDeInventario
  ): Promise<Muestra<{ id: string; codigo: string }> | null> {
    if (filtros.tenencia === "asignada") return null;

    const rows = await AsignacionRepository.findPeregrinasNuncaAsignadas(
      alcance
    );
    return recortar(rows);
  }
}

/**
 * Keeps the count honest while keeping the card short.
 *
 * The cut happens after the query rather than as a `limit`, because the total is
 * the number the card leads with and a limited query cannot report it. These
 * lists are the small ones by definition — images nobody has, people with none —
 * and if one of them is ever big enough for that to matter, the fix is a `limit`
 * plus a `count`, not a cap that lies.
 */
function recortar<T>(filas: T[]): Muestra<T> {
  return { total: filas.length, filas: filas.slice(0, FILAS_POR_TARJETA) };
}

function aFilaExtraviada(row: PeregrinaConTerritorio): FilaExtraviada {
  return {
    id: row.peregrina.id,
    codigo: row.peregrina.codigo,
    // `tenedorActual` ya viene resuelto y es una respuesta, no dos: un
    // Matrimonio se lee como un Tenedor y no como el cónyuge que se tipeó
    // primero — que era la mitad de la respuesta que el PRD vino a arreglar.
    ultimoTenedor: row.tenedorActual,
  };
}
