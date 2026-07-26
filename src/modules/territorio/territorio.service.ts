import { TerritorioRepository } from "./territorio.repository";
import { REGIONES, type ProvinciaRow, type Region } from "./territorio.schema";
import {
  mapearDiocesisLocalidad,
  normalizarNombre,
} from "./territorio.reference";
import type {
  BuscarPorNombreInput,
  CrearDiocesisLocalidadInput,
  CrearProvinciaInput,
  DiocesisLocalidadDTO,
  ProvinciaDTO,
  RenombrarDiocesisLocalidadInput,
  RenombrarProvinciaInput,
  UsoTerritorio,
} from "./territorio.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { esNacional } from "@/lib/authorization/alcance";
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
 * Every method takes the Actor first and derives its own scope — ADR 0001.
 * There is no signature here that permits an unscoped listing.
 *
 * Reads are available to every authenticated Actor, because everyone needs the
 * selection lists to enter a record at all. What differs is *how much* of the
 * list they get. Writes are Asesor Nacional and above, so the canonical list
 * cannot drift.
 *
 * **A deliberate divergence, decided in issue #2 rather than inherited from
 * issue #1.** Peregrina and Misionero data is scoped to the Actor's own
 * Diócesis/Localidad. The *selection lists* here are scoped one level wider, to
 * their Provincia. Two reasons, and neither is laziness: a picker containing
 * exactly one entry is not a picker, and a Referente Local registering a
 * Misionero venerating an image in the next town needs to be able to name that
 * town. What the wider list does *not* do is widen anything: the Diócesis a
 * Referente Local can *see in a list* is not a Diócesis whose records they can
 * read — `derivarAlcance` decides that, separately, and it stops at their own.
 * The PRD's scope table governs data; this governs vocabulary.
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
   * Asesor Nacional and above. These Actors see the whole country, and they
   * are the only ones who may change the canonical list — one predicate
   * because it is one fact about them, not a coincidence.
   */
  private static exigirNacional(actor: CurrentUser, operacion: string): void {
    if (esNacional(actor.role)) return;

    registrarDenegacion({
      actor,
      operacion,
      motivo: "sólo un rol nacional administra el territorio",
    });
    throw new NoAutorizadoError(NO_AUTORIZADO_TERRITORIO);
  }

  /**
   * The Provincia a selection list is narrowed to, or null for a country-wide
   * Actor. See the divergence note on the class.
   */
  private static async provinciaDelActor(
    actor: CurrentUser
  ): Promise<string | null> {
    if (esNacional(actor.role)) return null;
    if (!actor.diocesisLocalidadId) return null;

    const propia = await TerritorioRepository.findDiocesisLocalidadById(
      actor.diocesisLocalidadId
    );
    return propia?.provincia.id ?? null;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /**
   * The seven pastoral regions. Fixed structure, identical for every Actor.
   *
   * The Actor is still the first parameter, even though the answer does not
   * depend on it: ADR 0001 asks for no signature that permits an unscoped
   * query, and an exception here would be one more shape to remember.
   */
  static listarRegiones(actor: CurrentUser): readonly Region[] {
    void actor;
    return REGIONES;
  }

  static async listarProvincias(actor: CurrentUser): Promise<ProvinciaDTO[]> {
    const provinciaId = await TerritorioService.provinciaDelActor(actor);
    const rows = await TerritorioRepository.findProvincias();

    const visibles = provinciaId
      ? rows.filter((r) => r.id === provinciaId)
      : rows;

    return visibles.map(TerritorioService.toProvinciaDTO);
  }

  /**
   * The selection list a Usuario picks a territory from. Excludes anything
   * given de baja, and never reaches outside the Actor's own Provincia.
   */
  static async listarDiocesisLocalidades(
    actor: CurrentUser,
    filtros: { provinciaId?: string } = {}
  ): Promise<DiocesisLocalidadDTO[]> {
    const propia = await TerritorioService.provinciaDelActor(actor);

    // A scoped Actor asking for someone else's Provincia gets nothing, not
    // everything — the filter narrows, it never widens.
    if (propia && filtros.provinciaId && filtros.provinciaId !== propia) {
      return [];
    }

    const rows = await TerritorioRepository.findDiocesisLocalidades({
      provinciaId: propia ?? filtros.provinciaId,
    });

    return rows.map(mapearDiocesisLocalidad);
  }

  /**
   * Resolves one Diócesis/Localidad to its Provincia and Región.
   *
   * Narrowed to what the Actor may see, which it was not in issue #1: back then
   * Peregrina and Misionero reads were open, so a record's territory had to
   * resolve for anybody. Those reads are closed now, and a record an Actor can
   * see arrives with its territory already joined in — so nothing legitimate
   * needs this method to reach outside the Actor's Provincia, and it no longer
   * does. Returns null for a Diócesis outside it, exactly as for one that does
   * not exist.
   */
  static async obtenerDiocesisLocalidad(
    actor: CurrentUser,
    id: string
  ): Promise<DiocesisLocalidadDTO | null> {
    const row = await TerritorioRepository.findDiocesisLocalidadById(id);
    if (!row) return null;

    const propia = await TerritorioService.provinciaDelActor(actor);
    if (propia && row.provincia.id !== propia) return null;

    return mapearDiocesisLocalidad(row);
  }

  /**
   * Resolves a free-text Provincia and Diócesis/Localidad onto reference
   * records, ignoring case, accents and surrounding whitespace.
   *
   * This is what a value typed before territory was reference data has to go
   * through. An unmatched value is reported by name — never silently dropped,
   * never quietly created.
   */
  static async buscarPorNombre(
    actor: CurrentUser,
    input: BuscarPorNombreInput
  ): Promise<DiocesisLocalidadDTO> {
    const provinciaBuscada = normalizarNombre(input.provincia);
    const diocesisBuscada = normalizarNombre(input.diocesisLocalidad);

    if (!provinciaBuscada) {
      throw new ValidacionError("La provincia es obligatoria.");
    }
    if (!diocesisBuscada) {
      throw new ValidacionError("La diócesis/localidad es obligatoria.");
    }

    const provincia = await TerritorioRepository.findProvinciaByNombre(
      provinciaBuscada
    );
    if (!provincia) {
      throw new NoEncontradoError(
        `No existe la Provincia «${input.provincia.trim()}».`
      );
    }

    const encontrada = await TerritorioRepository.findDiocesisLocalidadByNombre(
      provincia.id,
      diocesisBuscada
    );
    if (!encontrada) {
      throw new NoEncontradoError(
        `No existe la Diócesis/Localidad «${input.diocesisLocalidad.trim()}» en ${provincia.nombre}.`
      );
    }

    // Same narrowing as obtenerDiocesisLocalidad: a name is a lookup key, and a
    // lookup that reaches outside the Actor's Provincia is still a read.
    const propia = await TerritorioService.provinciaDelActor(actor);
    if (propia && encontrada.provincia.id !== propia) {
      registrarDenegacion({
        actor,
        operacion: "TerritorioService.buscarPorNombre",
        territorioSolicitado: encontrada.diocesis.id,
        motivo: "búsqueda por nombre fuera de la Provincia del Actor",
      });
      throw new NoEncontradoError(
        `No existe la Diócesis/Localidad «${input.diocesisLocalidad.trim()}» en ${provincia.nombre}.`
      );
    }

    return mapearDiocesisLocalidad(encontrada);
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
    TerritorioService.exigirNacional(actor, "TerritorioService.usoDeDiocesisLocalidad");
    return TerritorioRepository.countUsoDiocesisLocalidad(id);
  }

  static async usoDeProvincia(
    actor: CurrentUser,
    id: string
  ): Promise<UsoTerritorio> {
    TerritorioService.exigirNacional(actor, "TerritorioService.usoDeProvincia");
    return TerritorioRepository.countUsoProvincia(id);
  }

  // ── Writes: Provincia ───────────────────────────────────────────────────────

  static async crearProvincia(
    actor: CurrentUser,
    input: CrearProvinciaInput
  ): Promise<ProvinciaDTO> {
    TerritorioService.exigirNacional(actor, "TerritorioService.crearProvincia");

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
    TerritorioService.exigirNacional(actor, "TerritorioService.renombrarProvincia");

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
    TerritorioService.exigirNacional(actor, "TerritorioService.darDeBajaProvincia");

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
    TerritorioService.exigirNacional(
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
    TerritorioService.exigirNacional(
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
    TerritorioService.exigirNacional(
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
