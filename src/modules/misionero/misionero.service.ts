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
  derivarAlcance,
  exigirDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import { NoEncontradoError, ValidacionError } from "@/lib/errors";

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
      peregrinaId: row.misionero.peregrinaId ?? null,
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

  static async dashboardStats(actor: CurrentUser) {
    const alcance = derivarAlcance(actor, "MisioneroService.dashboardStats");
    return MisioneroRepository.countByEstado(alcance);
  }

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
      ...(input.peregrinaId !== undefined && {
        peregrinaId: input.peregrinaId ?? null,
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

  static async delete(actor: CurrentUser, id: string): Promise<void> {
    const operacion = "MisioneroService.delete";
    const alcance = derivarAlcance(actor, operacion);

    await MisioneroService.exigirVisible(actor, alcance, id, operacion);
    await MisioneroRepository.delete(id);
  }
}
