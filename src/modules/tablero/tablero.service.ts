import type { CurrentUser } from "@/modules/user/user.types";
import {
  derivarAlcance,
  esNacional,
  exigirTerritorioDentroDelAlcance,
} from "@/lib/authorization/alcance";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import type { FiltrosDeInventario } from "@/modules/peregrina/peregrina.types";
import type { TableroDTO } from "./tablero.types";

/**
 * TableroService — the figures, and nothing else.
 *
 * A module with no table of its own, and therefore no repository and no schema.
 * It reads the repository of the module that owns the table, which is the one
 * direction allowed: a service may read another module's *repository* for a
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

    const [
      totalPeregrinas,
      sinTenencia,
      porEstado,
      porModalidad,
      porConsagracion,
      porProvincia,
      porDiocesis,
    ] = await Promise.all([
      PeregrinaRepository.contarTotal(alcance, filtros),
      PeregrinaRepository.contarSinTenencia(alcance, filtros),
      PeregrinaRepository.contarPorEstado(alcance, filtros),
      PeregrinaRepository.contarPorModalidad(alcance, filtros),
      PeregrinaRepository.contarPorQuinquenioDeConsagracion(alcance, filtros),
      nacional ? PeregrinaRepository.contarPorProvincia(alcance, filtros) : null,
      nacional
        ? PeregrinaRepository.contarPorDiocesisLocalidad(alcance, filtros)
        : null,
    ]);

    return {
      vista: nacional ? "nacional" : "diocesana",
      totalPeregrinas,
      sinTenencia,
      porEstado,
      porModalidad,
      porConsagracion,
      porProvincia,
      porDiocesis,
    };
  }
}
