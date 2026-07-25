import {
  MisioneroRepository,
  type MisioneroConTerritorio,
} from "./misionero.repository";
import type {
  MisioneroDTO,
  CreateMisioneroInput,
  UpdateMisioneroInput,
  AddResumenAnualInput,
  ActionResult,
} from "./misionero.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import type { Region } from "@/modules/territorio/territorio.schema";

/**
 * MisioneroService
 *
 * Responsibility: business logic for misionero entities.
 *
 * Reads are still open to any authenticated Usuario — the defect issue #2
 * exists to fix, and it is fixed there rather than half-fixed here.
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

    const provincia = {
      id: row.provincia.id,
      nombre: row.provincia.nombre,
      abreviatura: row.provincia.abreviatura,
      region: row.provincia.region,
      deBaja: row.provincia.bajaAt !== null,
    };

    return {
      id: row.misionero.id,
      nombre: row.misionero.nombre,
      apellido: row.misionero.apellido,
      telefono: row.misionero.telefono ?? null,
      estado: row.misionero.estado,
      diocesisLocalidad: {
        id: row.diocesis.id,
        nombre: row.diocesis.nombre,
        deBaja: row.diocesis.bajaAt !== null,
        provincia,
        region: provincia.region,
      },
      provincia: provincia.nombre,
      region: provincia.region,
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

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(): Promise<MisioneroDTO[]> {
    const rows = await MisioneroRepository.findAll();
    return rows.map(MisioneroService.toDTO);
  }

  static async getById(id: string): Promise<MisioneroDTO> {
    const row = await MisioneroRepository.getById(id);
    return MisioneroService.toDTO(row);
  }

  static async search(query: string): Promise<MisioneroDTO[]> {
    if (!query.trim()) return MisioneroService.listAll();
    const rows = await MisioneroRepository.search(query.trim());
    return rows.map(MisioneroService.toDTO);
  }

  static async listByRegion(region: Region): Promise<MisioneroDTO[]> {
    const rows = await MisioneroRepository.findByRegion(region);
    return rows.map(MisioneroService.toDTO);
  }

  static async dashboardStats() {
    return MisioneroRepository.countByEstado();
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreateMisioneroInput
  ): Promise<ActionResult<MisioneroDTO>> {
    const territorio = await TerritorioRepository.findDiocesisLocalidadById(
      input.diocesisLocalidadId
    );
    if (!territorio) {
      return { ok: false, error: "No existe esa Diócesis/Localidad." };
    }
    if (territorio.diocesis.bajaAt !== null) {
      return {
        ok: false,
        error: `«${territorio.diocesis.nombre}» está dada de baja.`,
      };
    }

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

    return { ok: true, data: MisioneroService.toDTO(row) };
  }

  static async update(
    _actor: CurrentUser,
    id: string,
    input: UpdateMisioneroInput
  ): Promise<ActionResult<MisioneroDTO>> {
    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        return { ok: false, error: "No existe esa Diócesis/Localidad." };
      }
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

    return { ok: true, data: MisioneroService.toDTO(row) };
  }

  static async addResumenAnual(
    _actor: CurrentUser,
    input: AddResumenAnualInput
  ): Promise<ActionResult<MisioneroDTO>> {
    if (input.year > new Date().getFullYear()) {
      return { ok: false, error: "Año inválido." };
    }

    const row = await MisioneroRepository.upsertResumenAnual(
      input.misioneroId,
      input.year,
      input.resumen
    );

    return { ok: true, data: MisioneroService.toDTO(row) };
  }

  static async delete(
    _actor: CurrentUser,
    id: string
  ): Promise<ActionResult> {
    await MisioneroRepository.delete(id);
    return { ok: true, data: undefined };
  }
}
