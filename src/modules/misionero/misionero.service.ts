import { MisioneroRepository } from "./misionero.repository";
import type {
  MisioneroDTO,
  CreateMisioneroInput,
  UpdateMisioneroInput,
  AddResumenAnualInput,
  ActionResult,
} from "./misionero.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Region } from "@/modules/peregrina/peregrina.schema";

/**
 * MisioneroService
 *
 * Responsibility: business logic for misionero entities.
 * Reads are unrestricted (any authenticated user).
 * Writes require an authenticated user.
 */
export class MisioneroService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static toDTO(row: Awaited<ReturnType<typeof MisioneroRepository.getById>>): MisioneroDTO {
    let resumenesAnuales: Record<string, string> = {};
    try {
      resumenesAnuales = JSON.parse(row.resumenesAnuales ?? "{}") as Record<string, string>;
    } catch {
      resumenesAnuales = {};
    }

    return {
      id: row.id,
      nombre: row.nombre,
      apellido: row.apellido,
      telefono: row.telefono ?? null,
      estado: row.estado,
      region: row.region,
      provincia: row.provincia,
      diocesisLocalidad: row.diocesisLocalidad,
      centroTipo: row.centroTipo ?? null,
      centroNombre: row.centroNombre ?? null,
      anioConsagracion: row.anioConsagracion ?? null,
      resumenesAnuales,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

  static async listByRegion(region: string): Promise<MisioneroDTO[]> {
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
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio." };
    if (!input.apellido.trim()) return { ok: false, error: "El apellido es obligatorio." };
    if (!input.provincia.trim()) return { ok: false, error: "La provincia es obligatoria." };
    if (!input.diocesisLocalidad.trim()) return { ok: false, error: "La diócesis/localidad es obligatoria." };

    const row = await MisioneroRepository.create({
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      telefono: input.telefono?.trim() ?? null,
      estado: "activo",
      region: input.region as Region,
      provincia: input.provincia.trim(),
      diocesisLocalidad: input.diocesisLocalidad.trim(),
      centroTipo: input.centroTipo ?? null,
      centroNombre: input.centroNombre?.trim() ?? null,
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
    const row = await MisioneroRepository.update(id, {
      ...(input.nombre !== undefined && { nombre: input.nombre.trim() }),
      ...(input.apellido !== undefined && { apellido: input.apellido.trim() }),
      ...(input.telefono !== undefined && { telefono: input.telefono?.trim() ?? null }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.region !== undefined && { region: input.region as Region }),
      ...(input.provincia !== undefined && { provincia: input.provincia.trim() }),
      ...(input.diocesisLocalidad !== undefined && { diocesisLocalidad: input.diocesisLocalidad.trim() }),
      ...(input.centroTipo !== undefined && { centroTipo: input.centroTipo }),
      ...(input.centroNombre !== undefined && { centroNombre: input.centroNombre?.trim() ?? null }),
      ...(input.anioConsagracion !== undefined && { anioConsagracion: input.anioConsagracion }),
    });

    return { ok: true, data: MisioneroService.toDTO(row) };
  }

  static async addResumenAnual(
    _actor: CurrentUser,
    input: AddResumenAnualInput
  ): Promise<ActionResult<MisioneroDTO>> {
    if (!input.resumen.trim()) return { ok: false, error: "El resumen no puede estar vacío." };
    if (input.year < 2000 || input.year > new Date().getFullYear()) {
      return { ok: false, error: "Año inválido." };
    }

    const row = await MisioneroRepository.upsertResumenAnual(
      input.misioneroId,
      input.year,
      input.resumen.trim()
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
