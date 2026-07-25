import {
  PeregrinaRepository,
  type PeregrinaConTerritorio,
} from "./peregrina.repository";
import type {
  PeregrinaDTO,
  CreatePeregrinaInput,
  UpdatePeregrinaInput,
  ActionResult,
} from "./peregrina.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad, PeregrinaEstado } from "./peregrina.schema";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import type { Region } from "@/modules/territorio/territorio.schema";

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
 * Reads are still open to any authenticated Usuario — that is the defect
 * issue #2 exists to fix, and it is fixed there rather than half-fixed here.
 */
export class PeregrinaService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static toDTO(row: PeregrinaConTerritorio): PeregrinaDTO {
    const provincia = {
      id: row.provincia.id,
      nombre: row.provincia.nombre,
      abreviatura: row.provincia.abreviatura,
      region: row.provincia.region,
      deBaja: row.provincia.bajaAt !== null,
    };

    return {
      id: row.peregrina.id,
      codigo: row.peregrina.codigo,
      tipo: row.peregrina.tipo,
      estado: row.peregrina.estado,
      modalidad: row.peregrina.modalidad,
      diocesisLocalidad: {
        id: row.diocesis.id,
        nombre: row.diocesis.nombre,
        deBaja: row.diocesis.bajaAt !== null,
        provincia,
        region: provincia.region,
      },
      provincia: provincia.nombre,
      region: provincia.region,
      createdById: row.peregrina.createdById,
      createdAt: row.peregrina.createdAt,
      updatedAt: row.peregrina.updatedAt,
    };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findAll();
    return rows.map(PeregrinaService.toDTO);
  }

  static async getById(id: string): Promise<PeregrinaDTO> {
    const row = await PeregrinaRepository.getById(id);
    return PeregrinaService.toDTO(row);
  }

  static async listByEstado(estado: PeregrinaEstado): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByEstado(estado);
    return rows.map(PeregrinaService.toDTO);
  }

  static async listByRegion(region: Region): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByRegion(region);
    return rows.map(PeregrinaService.toDTO);
  }

  static async listByModalidad(modalidad: Modalidad): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByModalidad(modalidad);
    return rows.map(PeregrinaService.toDTO);
  }

  static async dashboardStats() {
    const [byEstado, byRegion] = await Promise.all([
      PeregrinaRepository.countByEstado(),
      PeregrinaRepository.countByRegion(),
    ]);
    return { byEstado, byRegion };
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreatePeregrinaInput
  ): Promise<ActionResult<PeregrinaDTO>> {
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

    return { ok: true, data: PeregrinaService.toDTO(row) };
  }

  static async update(
    _actor: CurrentUser,
    id: string,
    input: UpdatePeregrinaInput
  ): Promise<ActionResult<PeregrinaDTO>> {
    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        return { ok: false, error: "No existe esa Diócesis/Localidad." };
      }
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

    return { ok: true, data: PeregrinaService.toDTO(row) };
  }

  static async delete(
    _actor: CurrentUser,
    id: string
  ): Promise<ActionResult> {
    await PeregrinaRepository.delete(id);
    return { ok: true, data: undefined };
  }
}
