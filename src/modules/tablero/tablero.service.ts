import type { CurrentUser } from "@/modules/user/user.types";
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
 * of "en Córdoba, en reparación" to keep in step with the listado's — which is
 * the exact failure the previous dashboard had.
 *
 * Every figure below is computed from the same filters, so no two figures on one
 * screen can have been asked different questions. Every rol sees the whole
 * country (ADR 0016), so the Actor does not change the answer.
 */
export class TableroService {
  static async resumen(
    actor: CurrentUser,
    filtros: FiltrosDeInventario = {}
  ): Promise<TableroDTO> {
    const [
      totalPeregrinas,
      sinTenencia,
      porEstado,
      porModalidad,
      porConsagracion,
      porProvincia,
      porDiocesis,
    ] = await Promise.all([
      PeregrinaRepository.contarTotal(filtros),
      PeregrinaRepository.contarSinTenencia(filtros),
      PeregrinaRepository.contarPorEstado(filtros),
      PeregrinaRepository.contarPorModalidad(filtros),
      PeregrinaRepository.contarPorQuinquenioDeConsagracion(filtros),
      PeregrinaRepository.contarPorProvincia(filtros),
      PeregrinaRepository.contarPorDiocesisLocalidad(filtros),
    ]);

    return {
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
