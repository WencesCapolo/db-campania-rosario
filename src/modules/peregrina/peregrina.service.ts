import {
  PeregrinaRepository,
  type PeregrinaConTerritorio,
} from "./peregrina.repository";
import type {
  PeregrinaDTO,
  CreatePeregrinaInput,
  UpdatePeregrinaInput,
} from "./peregrina.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad, PeregrinaEstado } from "./peregrina.schema";
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

  static async listByModalidad(
    actor: CurrentUser,
    modalidad: Modalidad
  ): Promise<PeregrinaDTO[]> {
    const alcance = derivarAlcance(actor, "PeregrinaService.listByModalidad");
    const rows = await PeregrinaRepository.findByModalidad(alcance, modalidad);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The dashboard counts. Scoped like every other read: a Referente Local's
   * totals are their own Diócesis's totals, which is the only number that means
   * anything to them anyway.
   */
  static async dashboardStats(actor: CurrentUser) {
    const alcance = derivarAlcance(actor, "PeregrinaService.dashboardStats");
    const [byEstado, byRegion] = await Promise.all([
      PeregrinaRepository.countByEstado(alcance),
      PeregrinaRepository.countByRegion(alcance),
    ]);
    return { byEstado, byRegion };
  }

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

  static async delete(actor: CurrentUser, id: string): Promise<void> {
    const operacion = "PeregrinaService.delete";
    const alcance = derivarAlcance(actor, operacion);

    await PeregrinaService.exigirVisible(actor, alcance, id, operacion);
    await PeregrinaRepository.delete(id);
  }
}
