import { PeregrinaRepository } from "./peregrina.repository";
import type {
  PeregrinaDTO,
  CreatePeregrinaInput,
  UpdatePeregrinaInput,
  ActionResult,
} from "./peregrina.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Region, Modalidad, PeregrinaEstado } from "./peregrina.schema";

// Short province abbreviation map for the `codigo` field
const PROVINCIA_ABBR: Record<string, string> = {
  "JUJUY": "JUJ",
  "SALTA": "SAL",
  "TUCUMÁN": "TUC",
  "CATAMARCA": "CAT",
  "SANTIAGO DEL ESTERO": "SDE",
  "CÓRDOBA": "CBA",
  "LA RIOJA": "LRJ",
  "MENDOZA": "MZA",
  "SAN JUAN": "SJN",
  "SAN LUIS": "SLU",
  "MISIONES": "MIS",
  "CORRIENTES": "COR",
  "CHACO": "CHA",
  "FORMOSA": "FOR",
  "ENTRE RÍOS": "ERI",
  "BUENOS AIRES": "BA",
  "CABA": "CAB",
  "SANTA FE": "SFE",
  "LA PAMPA": "LPA",
  "RÍO NEGRO": "RNE",
  "NEUQUÉN": "NEU",
  "CHUBUT": "CHU",
  "SANTA CRUZ": "SCR",
  "TIERRA DEL FUEGO": "TDF",
};

function buildCodigo(provincia: string, modalidad: Modalidad, num: number): string {
  const abbr = PROVINCIA_ABBR[provincia.toUpperCase()] ?? provincia.slice(0, 3).toUpperCase();
  const numStr = String(num).padStart(4, "0");
  return `${abbr} ${modalidad} ${numStr}`;
}

/**
 * PeregrinaService
 *
 * Responsibility: business logic for peregrina entities.
 * Reads are unrestricted (any authenticated user).
 * Writes require an authenticated user (createdById is always set).
 */
export class PeregrinaService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static toDTO(row: Awaited<ReturnType<typeof PeregrinaRepository.getById>>): PeregrinaDTO {
    return {
      id: row.id,
      codigo: row.codigo,
      tipo: row.tipo,
      estado: row.estado,
      region: row.region,
      provincia: row.provincia,
      diocesisLocalidad: row.diocesisLocalidad,
      modalidad: row.modalidad,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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
    if (!input.provincia.trim()) return { ok: false, error: "La provincia es obligatoria." };
    if (!input.diocesisLocalidad.trim()) return { ok: false, error: "La diócesis/localidad es obligatoria." };

    // Generate the next sequential number and compose the código
    const num = await PeregrinaRepository.nextCodigoNum(input.provincia, input.modalidad);
    const codigo = buildCodigo(input.provincia, input.modalidad, num);

    const row = await PeregrinaRepository.create({
      codigo,
      codigoNum: num,
      tipo: input.tipo,
      estado: "activa",
      region: input.region,
      provincia: input.provincia.trim(),
      diocesisLocalidad: input.diocesisLocalidad.trim(),
      modalidad: input.modalidad,
      createdById: actor.id,
    });

    return { ok: true, data: PeregrinaService.toDTO(row) };
  }

  static async update(
    _actor: CurrentUser,
    id: string,
    input: UpdatePeregrinaInput
  ): Promise<ActionResult<PeregrinaDTO>> {
    const row = await PeregrinaRepository.update(id, {
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.provincia !== undefined && { provincia: input.provincia.trim() }),
      ...(input.diocesisLocalidad !== undefined && { diocesisLocalidad: input.diocesisLocalidad.trim() }),
      ...(input.modalidad !== undefined && { modalidad: input.modalidad }),
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