import {
  PeregrinaRepository,
  type PeregrinaConTerritorio,
} from "./peregrina.repository";
import type {
  PeregrinaDTO,
  CreatePeregrinaInput,
  UpdatePeregrinaInput,
  FiltrosDeInventario,
} from "./peregrina.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad, PeregrinaEstado } from "./peregrina.schema";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { mapearDiocesisLocalidad } from "@/modules/territorio/territorio.reference";
import type { Region } from "@/modules/territorio/territorio.schema";
import {
  derivarAlcance,
  exigirDentroDelAlcance,
  exigirTerritorioDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import {
  ConflictoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";
import {
  armarPagina,
  cantidadDePaginas,
  paginaExistente,
  rango,
  type Pagina,
} from "@/lib/paginacion";
import { nombreDeTenedor } from "@/lib/formato";
import { AsignacionRepository } from "@/modules/asignacion/asignacion.repository";
// ↑ The one import that runs against the module direction, and it is deliberate:
//   the guard below has to know whether an Asignación is open before it lets a
//   Peregrina leave the inventory. Only the repository, never the service, so
//   there is no cycle between the two services.

/**
 * Composes a Código: `[Provincia Modalidad Número]`, e.g. "CBA JOV 0001".
 *
 * The abbreviation now comes from the Provincia reference record instead of a
 * hardcoded map, so an Asesor Nacional can add a Provincia without a
 * deployment. The format is unchanged, and existing Códigos are never
 * regenerated — a Código is physically written on the image.
 */
function buildCodigo(
  abreviatura: string,
  modalidad: Modalidad,
  num: number
): string {
  return `${abreviatura} ${modalidad} ${String(num).padStart(4, "0")}`;
}

/**
 * PeregrinaService
 *
 * Responsibility: business logic for peregrina entities.
 *
 * Every method takes the Actor first and derives its own territorial scope from
 * that Actor's rol — ADR 0001. A Referente Local's list contains their own
 * Diócesis and nothing else; an Asesor Nacional's contains the country. The same
 * scope guards the writes, so a record in another territory can be neither read
 * nor changed nor moved.
 */
export class PeregrinaService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static toDTO(row: PeregrinaConTerritorio): PeregrinaDTO {
    const diocesisLocalidad = mapearDiocesisLocalidad({
      diocesis: row.diocesis,
      provincia: row.provincia,
    });

    return {
      id: row.peregrina.id,
      codigo: row.peregrina.codigo,
      tipo: row.peregrina.tipo,
      estado: row.peregrina.estado,
      modalidad: row.peregrina.modalidad,
      diocesisLocalidad,
      provincia: diocesisLocalidad.provincia.nombre,
      region: diocesisLocalidad.region,
      tenenciaActual: row.tenedorActual,
      deBaja: row.peregrina.bajaAt !== null,
      createdById: row.peregrina.createdById,
      createdAt: row.peregrina.createdAt,
      updatedAt: row.peregrina.updatedAt,
    };
  }

  /**
   * The row this Actor is about to act on, or a refusal.
   *
   * The lookup is by primary key and deliberately unscoped, then the territory
   * is compared: that is what lets "no existe" and "es de otro territorio" be
   * different answers to an operator reading the log, while the Actor is told
   * only that it is not theirs.
   */
  private static async exigirVisible(
    actor: CurrentUser,
    alcance: Alcance,
    id: string,
    operacion: string
  ): Promise<PeregrinaConTerritorio> {
    const row = await PeregrinaRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");

    exigirDentroDelAlcance(
      actor,
      alcance,
      row.peregrina.diocesisLocalidadId,
      operacion
    );

    return row;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(actor: CurrentUser): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listAll");
    const rows = await PeregrinaRepository.findAll(alcance);
    return rows.map(PeregrinaService.toDTO);
  }

  static async getById(
    actor: CurrentUser,
    id: string
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.getById";
    const alcance = derivarAlcance(actor, operacion);
    const row = await PeregrinaService.exigirVisible(actor, alcance, id, operacion);
    return PeregrinaService.toDTO(row);
  }

  static async listByEstado(
    actor: CurrentUser,
    estado: PeregrinaEstado
  ): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listByEstado");
    const rows = await PeregrinaRepository.findByEstado(alcance, estado);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The listado, filtered — the read behind every list screen and behind every
   * figure the tablero links to.
   *
   * The filters are applied in the database rather than narrowed in memory
   * afterwards, so the rows behind a count are found by the same predicate that
   * produced the count. That is what makes a figure and the list it leads to
   * agree, and the previous arrangement — ask for the narrowest indexed
   * question, filter the rest in the page — could not promise it.
   */
  static async listFiltradas(
    actor: CurrentUser,
    filtros: FiltrosDeInventario
  ): Promise<PeregrinaDTO[]> {
    const operacion = "PeregrinaService.listFiltradas";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const rows = await PeregrinaRepository.findFiltradas(alcance, filtros);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The listado, filtered and cut into pages — story 23 of the interface issue.
   *
   * The total comes from the aggregate and not from `filas.length`: a count of the
   * rows that happened to be fetched is a count of the page size, which is the
   * mistake the previous dashboard was built on. Same `Alcance`, same filters,
   * two queries — so the total and the rows can never describe different sets.
   *
   * The page is clamped against the total rather than trusted, and clamped here
   * because this is the only layer that knows how many pages exist. Asking for
   * page nine of three returns page three; returning nothing would read as an
   * empty Diócesis to whoever followed the stale link.
   *
   * `listFiltradas` above stays and is not a duplicate of this: it is the read for
   * a caller that wants every matching row — a picker, a test — and a screen that
   * asked it for a page would be paginating in memory.
   */
  static async listPagina(
    actor: CurrentUser,
    filtros: FiltrosDeInventario,
    pagina = 1
  ): Promise<Pagina<PeregrinaDTO>> {
    const operacion = "PeregrinaService.listPagina";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const total = await PeregrinaRepository.contarTotal(alcance, filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await PeregrinaRepository.findFiltradas(
      alcance,
      filtros,
      {},
      rango(actual)
    );

    return armarPagina(rows.map(PeregrinaService.toDTO), total, actual);
  }

  /**
   * Every Peregrina in a Región — and, for a scoped Actor, the intersection of
   * that Región with their own territory rather than the Región itself. Asking
   * for somebody else's Región returns nothing; the filter narrows, never widens.
   */
  static async listByRegion(
    actor: CurrentUser,
    region: Region
  ): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listByRegion");
    const rows = await PeregrinaRepository.findByRegion(alcance, region);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The images nobody currently has — the second step of the assignment flow.
   *
   * Read off the denormalised pointer, which is what it is for: the alternative
   * is an anti-join against Asignación on every keystroke of a picker.
   */
  static async listDisponibles(actor: CurrentUser): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listDisponibles");
    const rows = await PeregrinaRepository.findDisponibles(alcance);
    return rows.map(PeregrinaService.toDTO);
  }

  static async listByModalidad(
    actor: CurrentUser,
    modalidad: Modalidad
  ): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listByModalidad");
    const rows = await PeregrinaRepository.findByModalidad(alcance, modalidad);
    return rows.map(PeregrinaService.toDTO);
  }

  // The dashboard counts used to live here, derived from two ad-hoc aggregates
  // with no filters. They are `TableroService.resumen` now — one seam, one set of
  // filters, and figures that agree with the lists they link to.

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreatePeregrinaInput
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.create";
    const alcance = derivarAlcance(actor, operacion);

    const territorio = await TerritorioRepository.findDiocesisLocalidadById(
      input.diocesisLocalidadId
    );
    if (!territorio) {
      throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
    }
    if (territorio.diocesis.bajaAt !== null) {
      throw new ValidacionError(
        `«${territorio.diocesis.nombre}» está dada de baja.`
      );
    }

    // Registering into somebody else's territory is a write that leaves the
    // Actor's scope, so it is refused for the same reason reading it would be.
    exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);

    const num = await PeregrinaRepository.nextCodigoNum(
      territorio.provincia.id,
      input.modalidad
    );

    const row = await PeregrinaRepository.create({
      codigo: buildCodigo(
        territorio.provincia.abreviatura,
        input.modalidad,
        num
      ),
      codigoNum: num,
      tipo: input.tipo,
      estado: "activa",
      modalidad: input.modalidad,
      diocesisLocalidadId: territorio.diocesis.id,
      createdById: actor.id,
    });

    return PeregrinaService.toDTO(row);
  }

  static async update(
    actor: CurrentUser,
    id: string,
    input: UpdatePeregrinaInput
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.update";
    const alcance = derivarAlcance(actor, operacion);

    await PeregrinaService.exigirVisible(actor, alcance, id, operacion);

    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }

      // Both ends of a move are checked. Otherwise a Referente Local could push
      // a record into the next Diócesis and lose sight of it in the same motion.
      exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);
    }

    // The Código is not recomposed when the territory changes. It is written on
    // the image; the system follows reality, not the other way around.
    const row = await PeregrinaRepository.update(id, {
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.modalidad !== undefined && { modalidad: input.modalidad }),
      ...(input.diocesisLocalidadId !== undefined && {
        diocesisLocalidadId: input.diocesisLocalidadId,
      }),
    });

    return PeregrinaService.toDTO(row);
  }

  /**
   * Takes a Peregrina out of the active inventory without erasing its history —
   * user story 16.
   *
   * There is no hard delete any more, and this method is why. An Asignación that
   * cannot resolve its Código is a row of unreadable ids, so the record stays and
   * only stops appearing in lists.
   *
   * Refused while somebody still has the image. A Peregrina that is physically in
   * a Misionero's house has not left the inventory, whatever the paperwork says,
   * and giving it de baja would hide the one record that says where it is.
   */
  static async darDeBaja(
    actor: CurrentUser,
    id: string
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.darDeBaja";
    const alcance = derivarAlcance(actor, operacion);

    const actual = await PeregrinaService.exigirVisible(
      actor,
      alcance,
      id,
      operacion
    );

    // Unscoped on purpose — see the repository. A Misionero can be holding an
    // image whose territory has since changed, and a guard that misses that case
    // is a guard that loses images.
    const abierta = await AsignacionRepository.findAbiertaDePeregrinaSinAlcance(
      id
    );
    if (abierta) {
      throw new ConflictoError(
        `No se puede dar de baja la Peregrina ${actual.peregrina.codigo}: ` +
          `todavía está a cargo de ${nombreDeTenedor(abierta.tenedor)}. ` +
          "Registrá primero que fue devuelta."
      );
    }

    const row = await PeregrinaRepository.darDeBaja(id);
    if (!row) {
      throw new ConflictoError("Esa Peregrina ya estaba dada de baja.");
    }

    return PeregrinaService.leerUna(id);
  }

  static async reactivar(
    actor: CurrentUser,
    id: string
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.reactivar";
    const alcance = derivarAlcance(actor, operacion);

    await PeregrinaService.exigirVisible(actor, alcance, id, operacion);

    const row = await PeregrinaRepository.reactivar(id);
    if (!row) throw new ConflictoError("Esa Peregrina no estaba dada de baja.");

    return PeregrinaService.leerUna(id);
  }

  /** Reads a row back after a write, by primary key, already scope-checked. */
  private static async leerUna(id: string): Promise<PeregrinaDTO> {
    const row = await PeregrinaRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");
    return PeregrinaService.toDTO(row);
  }
}
