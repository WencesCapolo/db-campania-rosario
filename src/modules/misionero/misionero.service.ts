import {
  MisioneroRepository,
  type MisioneroConTerritorio,
} from "./misionero.repository";
import type {
  MisioneroDTO,
  CreateMisioneroInput,
  UpdateMisioneroInput,
  AddResumenAnualInput,
} from "./misionero.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { mapearDiocesisLocalidad } from "@/modules/territorio/territorio.reference";
import type { Region } from "@/modules/territorio/territorio.schema";
import {
  dentroDelAlcance,
  derivarAlcance,
  exigirDentroDelAlcance,
  exigirTerritorioDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import type { FiltrosTerritoriales } from "@/modules/territorio/territorio.types";
import {
  armarPagina,
  cantidadDePaginas,
  paginaExistente,
  rango,
  type Pagina,
} from "@/lib/paginacion";
import {
  ConflictoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";
import { AsignacionRepository } from "@/modules/asignacion/asignacion.repository";
// ↑ A service reading another module's *repository* for a cross-entity guard.
//   Only the repository, never the other service, so the two services stay free
//   of a cycle — and the guard reads the Asignación table itself rather than the
//   denormalised pointer, because a guard should consult the source of truth.

/**
 * MisioneroService
 *
 * Responsibility: business logic for misionero entities.
 *
 * Every method takes the Actor first and derives its own territorial scope —
 * ADR 0001. This is the module that made the leak concrete: a Misionero record
 * carries a name and a telephone number, including for the Campaña's youngest
 * branches, and until issue #2 any authenticated Usuario could list all of them.
 */
export class MisioneroService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static toDTO(row: MisioneroConTerritorio): MisioneroDTO {
    let resumenesAnuales: Record<string, string> = {};
    try {
      resumenesAnuales = JSON.parse(
        row.misionero.resumenesAnuales ?? "{}"
      ) as Record<string, string>;
    } catch {
      resumenesAnuales = {};
    }

    const diocesisLocalidad = mapearDiocesisLocalidad({
      diocesis: row.diocesis,
      provincia: row.provincia,
    });

    return {
      id: row.misionero.id,
      nombre: row.misionero.nombre,
      apellido: row.misionero.apellido,
      telefono: row.misionero.telefono ?? null,
      estado: row.misionero.estado,
      diocesisLocalidad,
      provincia: diocesisLocalidad.provincia.nombre,
      region: diocesisLocalidad.region,
      deBaja: row.misionero.bajaAt !== null,
      centroTipo: row.misionero.centroTipo ?? null,
      centroNombre: row.misionero.centroNombre ?? null,
      anioConsagracion: row.misionero.anioConsagracion ?? null,
      resumenesAnuales,
      createdById: row.misionero.createdById,
      createdAt: row.misionero.createdAt,
      updatedAt: row.misionero.updatedAt,
    };
  }

  /** The row this Actor may act on, or a logged refusal. */
  private static async exigirVisible(
    actor: CurrentUser,
    alcance: Alcance,
    id: string,
    operacion: string
  ): Promise<MisioneroConTerritorio> {
    const row = await MisioneroRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe ese Misionero.");

    exigirDentroDelAlcance(
      actor,
      alcance,
      row.misionero.diocesisLocalidadId,
      operacion
    );

    return row;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(actor: CurrentUser): Promise<MisioneroDTO[]> {
    const alcance = derivarAlcance(actor, "MisioneroService.listAll");
    const rows = await MisioneroRepository.findAll(alcance);
    return rows.map(MisioneroService.toDTO);
  }

  static async getById(actor: CurrentUser, id: string): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.getById";
    const alcance = derivarAlcance(actor, operacion);
    const row = await MisioneroService.exigirVisible(actor, alcance, id, operacion);
    return MisioneroService.toDTO(row);
  }

  static async search(
    actor: CurrentUser,
    query: string
  ): Promise<MisioneroDTO[]> {
    if (!query.trim()) return MisioneroService.listAll(actor);

    const alcance = derivarAlcance(actor, "MisioneroService.search");
    const rows = await MisioneroRepository.search(alcance, query.trim());
    return rows.map(MisioneroService.toDTO);
  }

  static async listByRegion(
    actor: CurrentUser,
    region: Region
  ): Promise<MisioneroDTO[]> {
    const alcance = derivarAlcance(actor, "MisioneroService.listByRegion");
    const rows = await MisioneroRepository.findByRegion(alcance, region);
    return rows.map(MisioneroService.toDTO);
  }

  /**
   * The listado, filtered — territory plus a name search (stories 5 and 6 of the
   * tablero, and the search issue #4 left owed).
   *
   * `search` above stays: it is the picker's read, takes a bare string, and is
   * called from the assignment flow. This one takes the shared filters, so the
   * Misionero list and the tablero ask the same question.
   */
  static async listFiltrados(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales & { q?: string }
  ): Promise<MisioneroDTO[]> {
    const operacion = "MisioneroService.listFiltrados";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const rows = await MisioneroRepository.findFiltrados(alcance, filtros);
    return rows.map(MisioneroService.toDTO);
  }

  /**
   * The listado, filtered and cut into pages — story 23 of the interface issue.
   *
   * Counted by an aggregate over the same predicate the rows come from, never by
   * fetching them and taking the length. The page is clamped against that total
   * here, because this is the only layer that knows how many pages there are.
   *
   * `listFiltrados` above stays: it answers "every Misionero matching", which is
   * what the assignment flow's picker needs.
   */
  static async listPagina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales & { q?: string },
    pagina = 1
  ): Promise<Pagina<MisioneroDTO>> {
    const operacion = "MisioneroService.listPagina";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const total = await MisioneroRepository.contarFiltrados(alcance, filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await MisioneroRepository.findFiltrados(
      alcance,
      filtros,
      {},
      rango(actual)
    );

    return armarPagina(rows.map(MisioneroService.toDTO), total, actual);
  }

  // `dashboardStats` is gone: the counts are `TableroService.resumen` now, so
  // there is one aggregation path and one set of filters behind every figure.

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreateMisioneroInput
  ): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.create";
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

    exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);

    const row = await MisioneroRepository.create({
      nombre: input.nombre,
      apellido: input.apellido,
      telefono: input.telefono ?? null,
      estado: "activo",
      diocesisLocalidadId: territorio.diocesis.id,
      centroTipo: input.centroTipo ?? null,
      centroNombre: input.centroNombre ?? null,
      anioConsagracion: input.anioConsagracion ?? null,
      resumenesAnuales: "{}",
      createdById: actor.id,
    });

    return MisioneroService.toDTO(row);
  }

  static async update(
    actor: CurrentUser,
    id: string,
    input: UpdateMisioneroInput
  ): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.update";
    const alcance = derivarAlcance(actor, operacion);

    await MisioneroService.exigirVisible(actor, alcance, id, operacion);

    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }

      exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);
    }

    const row = await MisioneroRepository.update(id, {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.apellido !== undefined && { apellido: input.apellido }),
      ...(input.telefono !== undefined && { telefono: input.telefono ?? null }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.diocesisLocalidadId !== undefined && {
        diocesisLocalidadId: input.diocesisLocalidadId,
      }),
      ...(input.centroTipo !== undefined && { centroTipo: input.centroTipo ?? null }),
      ...(input.centroNombre !== undefined && {
        centroNombre: input.centroNombre ?? null,
      }),
      ...(input.anioConsagracion !== undefined && {
        anioConsagracion: input.anioConsagracion ?? null,
      }),
    });

    return MisioneroService.toDTO(row);
  }

  static async addResumenAnual(
    actor: CurrentUser,
    input: AddResumenAnualInput
  ): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.addResumenAnual";
    const alcance = derivarAlcance(actor, operacion);

    await MisioneroService.exigirVisible(
      actor,
      alcance,
      input.misioneroId,
      operacion
    );

    if (input.year > new Date().getFullYear()) {
      throw new ValidacionError("Año inválido.");
    }

    const row = await MisioneroRepository.upsertResumenAnual(
      input.misioneroId,
      input.year,
      input.resumen
    );

    return MisioneroService.toDTO(row);
  }

  /**
   * A Misionero has left the Campaña — user stories 12, 13, 14 and 15.
   *
   * They stop appearing in active lists and keep resolving by name inside every
   * Asignación they ever held, which is why the row is never destroyed: deleting
   * it would destroy the record of what they were responsible for, and that record
   * is the entire point of this issue.
   *
   * **Refused while they still have a Peregrina**, and the refusal names it. The
   * image is physically with them; closing the person out first is how images stop
   * being anybody's problem and then stop being findable.
   */
  static async darDeBaja(
    actor: CurrentUser,
    id: string
  ): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.darDeBaja";
    const alcance = derivarAlcance(actor, operacion);

    const actual = await MisioneroService.exigirVisible(
      actor,
      alcance,
      id,
      operacion
    );

    const pendientes =
      await AsignacionRepository.findAbiertasDeMisioneroSinAlcance(id);
    if (pendientes.length > 0) {
      throw new ConflictoError(
        MisioneroService.mensajeDePendientes(actual, alcance, pendientes)
      );
    }

    const row = await MisioneroRepository.darDeBaja(id);
    if (!row) throw new ConflictoError("Ese Misionero ya estaba dado de baja.");

    return MisioneroService.leerUno(id);
  }

  static async reactivar(
    actor: CurrentUser,
    id: string
  ): Promise<MisioneroDTO> {
    const operacion = "MisioneroService.reactivar";
    const alcance = derivarAlcance(actor, operacion);

    await MisioneroService.exigirVisible(actor, alcance, id, operacion);

    const row = await MisioneroRepository.reactivar(id);
    if (!row) throw new ConflictoError("Ese Misionero no estaba dado de baja.");

    return MisioneroService.leerUno(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Says which Peregrina is outstanding — user story 14 — without saying it about
   * a territory the Actor cannot see.
   *
   * The guard itself is deliberately unscoped, because an image can be moved to
   * another Diócesis while this Misionero still physically holds it and a guard
   * that missed that would let the person be closed out with the image in their
   * house. But naming a Código from another territory would confirm a record the
   * Actor is not allowed to read. So the Código appears when it was theirs to see
   * anyway, and otherwise the refusal says what to do instead — which is what the
   * story actually needs: a next step, not an identifier.
   */
  private static mensajeDePendientes(
    actual: MisioneroConTerritorio,
    alcance: Alcance,
    pendientes: { peregrinaCodigo: string; peregrinaDiocesisLocalidadId: string }[]
  ): string {
    const nombre = `${actual.misionero.nombre} ${actual.misionero.apellido}`;
    const visibles = pendientes.filter((p) =>
      dentroDelAlcance(alcance, p.peregrinaDiocesisLocalidadId)
    );

    if (visibles.length === pendientes.length) {
      const codigos = visibles.map((p) => p.peregrinaCodigo).join(", ");
      const cuantas =
        pendientes.length === 1
          ? `la Peregrina ${codigos}`
          : `${pendientes.length} Peregrinas a cargo: ${codigos}`;
      return (
        `No se puede dar de baja a ${nombre}: todavía tiene ${cuantas}. ` +
        "Registrá primero que fue devuelta o que pasó a otro Misionero."
      );
    }

    const ajenas = pendientes.length - visibles.length;
    const detalle = visibles.length
      ? `${visibles.map((p) => p.peregrinaCodigo).join(", ")}, y ${ajenas} de otro territorio`
      : `${ajenas} de otro territorio`;

    return (
      `No se puede dar de baja a ${nombre}: todavía tiene Peregrinas a cargo (${detalle}). ` +
      "Pedile a un Asesor Nacional que registre la devolución de las que no podés ver."
    );
  }

  /** Reads a row back after a write, by primary key, already scope-checked. */
  private static async leerUno(id: string): Promise<MisioneroDTO> {
    const row = await MisioneroRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe ese Misionero.");
    return MisioneroService.toDTO(row);
  }
}
