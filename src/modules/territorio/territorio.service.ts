import { TerritorioRepository } from "./territorio.repository";
import type { ProvinciaRow } from "./territorio.schema";
import {
  mapearDiocesisLocalidad,
  normalizarNombre,
} from "./territorio.reference";
import type {
  CrearDiocesisLocalidadInput,
  CrearProvinciaInput,
  DiocesisLocalidadDTO,
  ProvinciaDTO,
  RenombrarDiocesisLocalidadInput,
  RenombrarProvinciaInput,
  UsoTerritorio,
} from "./territorio.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { configura } from "@/lib/authorization/capacidades";
import { registrarDenegacion } from "@/lib/authorization/registro";
import {
  ConflictoError,
  NoAutorizadoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";

/**
 * TerritorioService
 *
 * Responsibility: the Campaña's territorial reference data.
 *
 * Every method takes the Actor first — ADR 0001.
 *
 * Reads are available to every authenticated Actor, because everyone needs the
 * selection lists to enter a record at all, and every list is the whole country
 * (ADR 0016). Writes are Asesor Nacional and above, so the canonical list cannot
 * drift.
 *
 * Región is deliberately absent from the write surface. The seven pastoral
 * regions are structure, not reference data — there is no method to add,
 * rename or remove one, and that is the point.
 */
export class TerritorioService {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  private static toProvinciaDTO(row: ProvinciaRow): ProvinciaDTO {
    return {
      id: row.id,
      nombre: row.nombre,
      abreviatura: row.abreviatura,
      deBaja: row.bajaAt !== null,
    };
  }

  /**
   * Asesor Nacional and above. Every rol sees the whole country since ADR
   * 0016; changing the canonical list is configuration, and only these two
   * configure.
   */
  private static exigirQueConfigura(actor: CurrentUser, operacion: string): void {
    if (configura(actor.role)) return;

    registrarDenegacion({
      actor,
      operacion,
      motivo: "sólo un rol que configura administra el territorio",
    });
    throw new NoAutorizadoError(NO_AUTORIZADO_TERRITORIO);
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  static async listarProvincias(actor: CurrentUser): Promise<ProvinciaDTO[]> {
    void actor;
    const rows = await TerritorioRepository.findProvincias();
    return rows.map(TerritorioService.toProvinciaDTO);
  }

  /**
   * The selection list a Usuario picks a territory from. Excludes anything
   * given de baja.
   */
  static async listarDiocesisLocalidades(
    actor: CurrentUser,
    filtros: { provinciaId?: string } = {}
  ): Promise<DiocesisLocalidadDTO[]> {
    void actor;
    const rows = await TerritorioRepository.findDiocesisLocalidades({
      provinciaId: filtros.provinciaId,
    });

    return rows.map(mapearDiocesisLocalidad);
  }

  /**
   * How many live records point at a territory — user story 10 of issue #1.
   *
   * Nacional only. It is the count behind an "are you sure" on the territory
   * admin screens, which nobody else reaches, and a count of records is still
   * information about records.
   */
  static async usoDeDiocesisLocalidad(
    actor: CurrentUser,
    id: string
  ): Promise<UsoTerritorio> {
    TerritorioService.exigirQueConfigura(actor, "TerritorioService.usoDeDiocesisLocalidad");
    return TerritorioRepository.countUsoDiocesisLocalidad(id);
  }

  static async usoDeProvincia(
    actor: CurrentUser,
    id: string
  ): Promise<UsoTerritorio> {
    TerritorioService.exigirQueConfigura(actor, "TerritorioService.usoDeProvincia");
    return TerritorioRepository.countUsoProvincia(id);
  }

  // ── Writes: Provincia ───────────────────────────────────────────────────────

  static async crearProvincia(
    actor: CurrentUser,
    input: CrearProvinciaInput
  ): Promise<ProvinciaDTO> {
    TerritorioService.exigirQueConfigura(actor, "TerritorioService.crearProvincia");

    const yaExiste = await TerritorioRepository.findProvinciaByNombre(
      normalizarNombre(input.nombre)
    );
    if (yaExiste) {
      throw new ConflictoError(`Ya existe la Provincia «${yaExiste.nombre}».`);
    }

    const row = await TerritorioRepository.createProvincia({
      nombre: input.nombre,
      abreviatura: input.abreviatura,
    });

    return TerritorioService.toProvinciaDTO(row);
  }

  /**
   * Renames a Provincia. The rename propagates everywhere the name is
   * displayed, because the name is stored once.
   *
   * The abbreviation is not renameable: it is written into Códigos already
   * printed on images. A Provincia no longer has a Región to rename — that
   * belongs to each Diócesis/Localidad.
   */
  static async renombrarProvincia(
    actor: CurrentUser,
    input: RenombrarProvinciaInput
  ): Promise<ProvinciaDTO> {
    TerritorioService.exigirQueConfigura(actor, "TerritorioService.renombrarProvincia");

    const colision = await TerritorioRepository.findProvinciaByNombre(
      normalizarNombre(input.nombre)
    );
    if (colision && colision.id !== input.id) {
      throw new ConflictoError(`Ya existe la Provincia «${colision.nombre}».`);
    }

    const row = await TerritorioRepository.updateProvincia(input.id, {
      nombre: input.nombre,
    });
    if (!row) throw new NoEncontradoError("No existe esa Provincia.");

    return TerritorioService.toProvinciaDTO(row);
  }

  static async darDeBajaProvincia(
    actor: CurrentUser,
    id: string
  ): Promise<ProvinciaDTO> {
    TerritorioService.exigirQueConfigura(actor, "TerritorioService.darDeBajaProvincia");

    const uso = await TerritorioRepository.countUsoProvincia(id);
    if (uso.peregrinas > 0 || uso.misioneros > 0) {
      throw new ConflictoError(enUso("la Provincia", uso));
    }

    const row = await TerritorioRepository.updateProvincia(id, {
      bajaAt: new Date(),
    });
    if (!row) throw new NoEncontradoError("No existe esa Provincia.");

    return TerritorioService.toProvinciaDTO(row);
  }

  // ── Writes: Diócesis/Localidad ──────────────────────────────────────────────

  static async crearDiocesisLocalidad(
    actor: CurrentUser,
    input: CrearDiocesisLocalidadInput
  ): Promise<DiocesisLocalidadDTO> {
    TerritorioService.exigirQueConfigura(
      actor,
      "TerritorioService.crearDiocesisLocalidad"
    );

    const provincia = await TerritorioRepository.findProvinciaById(
      input.provinciaId
    );
    if (!provincia) throw new NoEncontradoError("No existe esa Provincia.");
    if (provincia.bajaAt !== null) {
      throw new ValidacionError(
        `La Provincia «${provincia.nombre}» está dada de baja.`
      );
    }

    const yaExiste = await TerritorioRepository.findDiocesisLocalidadByNombre(
      provincia.id,
      normalizarNombre(input.nombre)
    );
    if (yaExiste) {
      throw new ConflictoError(
        `Ya existe «${yaExiste.diocesis.nombre}» en ${provincia.nombre}.`
      );
    }

    const row = await TerritorioRepository.createDiocesisLocalidad({
      nombre: input.nombre,
      provinciaId: provincia.id,
      region: input.region,
    });

    return mapearDiocesisLocalidad({ diocesis: row, provincia });
  }

  static async renombrarDiocesisLocalidad(
    actor: CurrentUser,
    input: RenombrarDiocesisLocalidadInput
  ): Promise<DiocesisLocalidadDTO> {
    TerritorioService.exigirQueConfigura(
      actor,
      "TerritorioService.renombrarDiocesisLocalidad"
    );

    const actual = await TerritorioRepository.findDiocesisLocalidadById(input.id);
    if (!actual) throw new NoEncontradoError("No existe esa Diócesis/Localidad.");

    const colision = await TerritorioRepository.findDiocesisLocalidadByNombre(
      actual.provincia.id,
      normalizarNombre(input.nombre)
    );
    if (colision && colision.diocesis.id !== input.id) {
      throw new ConflictoError(
        `Ya existe «${colision.diocesis.nombre}» en ${actual.provincia.nombre}.`
      );
    }

    const row = await TerritorioRepository.updateDiocesisLocalidad(input.id, {
      nombre: input.nombre,
    });
    if (!row) throw new NoEncontradoError("No existe esa Diócesis/Localidad.");

    return mapearDiocesisLocalidad({
      diocesis: row,
      provincia: actual.provincia,
    });
  }

  /**
   * Gives a Diócesis/Localidad de baja: it stops appearing in selection lists
   * without destroying the records that reference it. Refused while any live
   * Peregrina or Misionero still points at it, so nothing is orphaned.
   */
  static async darDeBajaDiocesisLocalidad(
    actor: CurrentUser,
    id: string
  ): Promise<DiocesisLocalidadDTO> {
    TerritorioService.exigirQueConfigura(
      actor,
      "TerritorioService.darDeBajaDiocesisLocalidad"
    );

    const actual = await TerritorioRepository.findDiocesisLocalidadById(id);
    if (!actual) throw new NoEncontradoError("No existe esa Diócesis/Localidad.");

    const uso = await TerritorioRepository.countUsoDiocesisLocalidad(id);
    if (uso.peregrinas > 0 || uso.misioneros > 0) {
      throw new ConflictoError(enUso("la Diócesis/Localidad", uso));
    }

    const row = await TerritorioRepository.updateDiocesisLocalidad(id, {
      bajaAt: new Date(),
    });
    if (!row) throw new NoEncontradoError("No existe esa Diócesis/Localidad.");

    return mapearDiocesisLocalidad({
      diocesis: row,
      provincia: actual.provincia,
    });
  }
}

const NO_AUTORIZADO_TERRITORIO =
  "No tenés permisos para modificar el territorio. Pedíselo a un Asesor Nacional.";

function enUso(que: string, uso: UsoTerritorio): string {
  const partes: string[] = [];
  if (uso.peregrinas > 0) {
    partes.push(`${uso.peregrinas} ${uso.peregrinas === 1 ? "Peregrina" : "Peregrinas"}`);
  }
  if (uso.misioneros > 0) {
    partes.push(`${uso.misioneros} ${uso.misioneros === 1 ? "Misionero" : "Misioneros"}`);
  }
  return `No se puede dar de baja ${que}: ${partes.join(" y ")} todavía la usan.`;
}
