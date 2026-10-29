import {
  MisioneroRepository,
  type FilaDeRoster,
  type MisioneroConTerritorio,
} from "./misionero.repository";
import { mapearMatrimonio, mapearMisionero } from "./misionero.mapper";
import type { TenedorDTO } from "./matrimonio.types";
import type {
  MisioneroDTO,
  CreateMisioneroInput,
  UpdateMisioneroInput,
  AddResumenAnualInput,
} from "./misionero.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import type { Region } from "@/modules/territorio/territorio.schema";
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
import { MatrimonioRepository } from "./matrimonio.repository";
// ↑ A service reading another module's *repository* for a cross-entity guard.
//   Only the repository, never the other service, so the two services stay free
//   of a cycle — and the guard reads the Asignación table itself rather than the
//   denormalised pointer, because a guard should consult the source of truth.

/**
 * MisioneroService
 *
 * Responsibility: business logic for misionero entities.
 *
 * Every method takes the Actor first — ADR 0001. Every rol reads and writes any
 * Misionero in the country (ADR 0016): a Misionero has no Modalidad, so there
 * is nothing here for the Actor's rol to narrow.
 */
export class MisioneroService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * The row-to-DTO mapping moved to `misionero.mapper.ts` when the Matrimonio
   * arrived: `MatrimonioService` renders two spouses, so the same mapping is now
   * needed by two services in this module. Kept as a name here because every
   * read below reads better with it.
   */
  private static toDTO(row: MisioneroConTerritorio): MisioneroDTO {
    return mapearMisionero(row);
  }

  /** One roster row — a person, or the household that replaces two of them. */
  private static toTenedorDTO(fila: FilaDeRoster): TenedorDTO {
    return fila.tipo === "persona"
      ? { tipo: "persona", persona: mapearMisionero(fila.persona) }
      : { tipo: "matrimonio", matrimonio: mapearMatrimonio(fila.matrimonio) };
  }

  /** The row, given de baja or not, or a refusal that says it does not exist. */
  private static async exigirExistente(
    id: string
  ): Promise<MisioneroConTerritorio> {
    const row = await MisioneroRepository.findById(id, { incluirBajas: true });
    if (!row) throw new NoEncontradoError("No existe ese Misionero.");
    return row;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(actor: CurrentUser): Promise<MisioneroDTO[]> {
    void actor;
    const rows = await MisioneroRepository.findAll();
    return rows.map(MisioneroService.toDTO);
  }

  static async getById(actor: CurrentUser, id: string): Promise<MisioneroDTO> {
    const row = await MisioneroService.exigirExistente(id);
    return MisioneroService.toDTO(row);
  }

  /**
   * The id of the active Matrimonio this Misionero belongs to, or null. The
   * edit screen asks, because a spouse's territory and Centro are the couple's
   * and are changed on the couple's page.
   */
  static async matrimonioActivo(
    actor: CurrentUser,
    id: string
  ): Promise<string | null> {
    await MisioneroService.exigirExistente(id);
    const fila = await MatrimonioRepository.deMisionero(id);
    return fila?.id ?? null;
  }

  static async search(
    actor: CurrentUser,
    query: string
  ): Promise<MisioneroDTO[]> {
    if (!query.trim()) return MisioneroService.listAll(actor);

    const rows = await MisioneroRepository.search(query.trim());
    return rows.map(MisioneroService.toDTO);
  }

  static async listByRegion(
    actor: CurrentUser,
    region: Region
  ): Promise<MisioneroDTO[]> {
    const rows = await MisioneroRepository.findByRegion(region);
    return rows.map(MisioneroService.toDTO);
  }

  /**
   * The collapsed roster, filtered — territory plus a name search (stories 5 and
   * 6 of the tablero, and the search issue #4 left owed).
   *
   * It answers in `TenedorDTO`, not `MisioneroDTO`, and that is the whole point
   * of ADR 0010: `/misionero` lists **individuals who are nobody's spouse, plus
   * households**. A Misionero in an active Matrimonio is not here, because they
   * are not a holder on their own — the couple is, as one row. A search hits
   * either spouse, so "Benítez" finds "Ana Álvarez y Juan Benítez".
   *
   * `search` above stays and still answers in people: it is a bare-string read
   * called from the assignment flow, and it has not been collapsed yet.
   */
  static async listFiltrados(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales & { q?: string }
  ): Promise<TenedorDTO[]> {
    const rows = await MisioneroRepository.findFiltrados(filtros);
    return rows.map(MisioneroService.toTenedorDTO);
  }

  /**
   * The same roster, cut into pages — story 23 of the interface issue.
   *
   * Counted by an aggregate over the same predicate the rows come from, never by
   * fetching them and taking the length — and over the *union*, so a couple
   * counts once and the total matches the rows somebody can actually page
   * through. The page is clamped against that total here, because this is the
   * only layer that knows how many pages there are.
   */
  static async listPagina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales & { q?: string },
    pagina = 1
  ): Promise<Pagina<TenedorDTO>> {
    const total = await MisioneroRepository.contarFiltrados(filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await MisioneroRepository.findFiltrados(
      filtros,
      {},
      rango(actual)
    );

    return armarPagina(rows.map(MisioneroService.toTenedorDTO), total, actual);
  }

  // `dashboardStats` is gone: the counts are `TableroService.resumen` now, so
  // there is one aggregation path and one set of filters behind every figure.

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreateMisioneroInput
  ): Promise<MisioneroDTO> {
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

    const row = await MisioneroRepository.create({
      nombre: input.nombre,
      apellido: input.apellido,
      telefono: input.telefono ?? null,
      email: input.email ?? null,
      estado: "activo",
      diocesisLocalidadId: territorio.diocesis.id,
      centroTipo: input.centroTipo ?? null,
      centroNombre: input.centroNombre ?? null,
      fechaConsagracion: input.fechaConsagracion ?? null,
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
    await MisioneroService.exigirExistente(id);

    // A spouse's territory and Centro belong to the household (ADR 0010):
    // changing them for one of the two would split the couple across two
    // Diócesis. Those are corrected on the Matrimonio, which moves both.
    const tocaLaCasa =
      input.diocesisLocalidadId !== undefined ||
      input.centroTipo !== undefined ||
      input.centroNombre !== undefined;
    if (tocaLaCasa && (await MatrimonioRepository.deMisionero(id))) {
      throw new ValidacionError(
        "Es parte de un matrimonio: el territorio y el Centro se cambian " +
          "desde la ficha del matrimonio, para los dos a la vez."
      );
    }

    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }
    }

    const row = await MisioneroRepository.update(id, {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.apellido !== undefined && { apellido: input.apellido }),
      ...(input.telefono !== undefined && { telefono: input.telefono ?? null }),
      ...(input.email !== undefined && { email: input.email ?? null }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.diocesisLocalidadId !== undefined && {
        diocesisLocalidadId: input.diocesisLocalidadId,
      }),
      ...(input.centroTipo !== undefined && { centroTipo: input.centroTipo ?? null }),
      ...(input.centroNombre !== undefined && {
        centroNombre: input.centroNombre ?? null,
      }),
      ...(input.fechaConsagracion !== undefined && {
        fechaConsagracion: input.fechaConsagracion ?? null,
      }),
    });

    return MisioneroService.toDTO(row);
  }

  static async addResumenAnual(
    actor: CurrentUser,
    input: AddResumenAnualInput
  ): Promise<MisioneroDTO> {
    await MisioneroService.exigirExistente(input.misioneroId);

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
    const actual = await MisioneroService.exigirExistente(id);

    const pendientes =
      await AsignacionRepository.findAbiertasDeMisionero(id);
    if (pendientes.length > 0) {
      throw new ConflictoError(
        MisioneroService.mensajeDePendientes(actual, pendientes)
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
    await MisioneroService.exigirExistente(id);

    const row = await MisioneroRepository.reactivar(id);
    if (!row) throw new ConflictoError("Ese Misionero no estaba dado de baja.");

    return MisioneroService.leerUno(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Says which Peregrina is outstanding — user story 14 — so the refusal is a
   * next step and not only a no.
   *
   * The guard reads every open Asignación of this Misionero, wherever the image
   * is filed: an image can be moved to another Diócesis while this Misionero
   * still physically holds it, and a guard that missed that would let the person
   * be closed out with the image in their house.
   */
  private static mensajeDePendientes(
    actual: MisioneroConTerritorio,
    pendientes: { peregrinaIdentificacion: string }[]
  ): string {
    const nombre = `${actual.misionero.nombre} ${actual.misionero.apellido}`;
    const identificaciones = pendientes
      .map((p) => p.peregrinaIdentificacion)
      .join(", ");
    const cuantas =
      pendientes.length === 1
        ? `la Peregrina ${identificaciones}`
        : `${pendientes.length} Peregrinas a cargo: ${identificaciones}`;
    return (
      `No se puede dar de baja a ${nombre}: todavía tiene ${cuantas}. ` +
      "Registrá primero que fue devuelta o que pasó a otro Misionero."
    );
  }

  /** Reads a row back after a write, by primary key. */
  private static async leerUno(id: string): Promise<MisioneroDTO> {
    const row = await MisioneroRepository.findById(id, { incluirBajas: true });
    if (!row) throw new NoEncontradoError("No existe ese Misionero.");
    return MisioneroService.toDTO(row);
  }
}
