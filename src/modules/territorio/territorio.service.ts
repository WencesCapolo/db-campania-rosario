import {
  TerritorioRepository,
  type DiocesisLocalidadConProvincia,
} from "./territorio.repository";
import { REGIONES, type ProvinciaRow, type Region } from "./territorio.schema";
import { normalizarNombre } from "./territorio.reference";
import type {
  ActionResult,
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
 * list they get: an Asesor Nacional sees the country, a Responsable Diocesano
 * or Referente Local sees their own Provincia. Writes are Asesor Nacional and
 * above, so the canonical list cannot drift.
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
      region: row.region,
      deBaja: row.bajaAt !== null,
    };
  }

  private static toDiocesisDTO(
    row: DiocesisLocalidadConProvincia
  ): DiocesisLocalidadDTO {
    const provincia = TerritorioService.toProvinciaDTO(row.provincia);
    return {
      id: row.diocesis.id,
      nombre: row.diocesis.nombre,
      deBaja: row.diocesis.bajaAt !== null,
      provincia,
      region: provincia.region,
    };
  }

  /**
   * Asesor Nacional and above. These Actors see the whole country, and they
   * are the only ones who may change the canonical list — one predicate
   * because it is one fact about them, not a coincidence.
   */
  private static esNacional(actor: CurrentUser): boolean {
    return actor.role === "admin" || actor.role === "asesor_nacional";
  }

  private static puedeEscribir(actor: CurrentUser): boolean {
    return TerritorioService.esNacional(actor);
  }

  /**
   * The Provincia a selection list is narrowed to, or null for a country-wide
   * Actor.
   *
   * A Responsable Diocesano and a Referente Local are bounded by their own
   * Diócesis/Localidad, but a picker containing exactly one entry is not a
   * picker. They get their whole Provincia — enough to register a Misionero in
   * the next town without scrolling the country. Issue #2 decides whether
   * authorization tightens this to the Diócesis itself.
   */
  private static async provinciaDelActor(
    actor: CurrentUser
  ): Promise<string | null> {
    if (TerritorioService.esNacional(actor)) return null;
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
   * given de baja, and never reaches outside the Actor's own territory.
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

    return rows.map(TerritorioService.toDiocesisDTO);
  }

  /**
   * Resolves one Diócesis/Localidad to its Provincia and Región.
   *
   * Not narrowed to the Actor's territory: a record they can already see has
   * to render its territory, and today reads on Peregrina and Misionero are
   * open to any authenticated Usuario. Issue #2 closes those reads, and this
   * follows them when it does.
   */
  static async obtenerDiocesisLocalidad(
    _actor: CurrentUser,
    id: string
  ): Promise<DiocesisLocalidadDTO | null> {
    const row = await TerritorioRepository.findDiocesisLocalidadById(id);
    return row ? TerritorioService.toDiocesisDTO(row) : null;
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
    _actor: CurrentUser,
    input: BuscarPorNombreInput
  ): Promise<ActionResult<DiocesisLocalidadDTO>> {
    const provinciaBuscada = normalizarNombre(input.provincia);
    const diocesisBuscada = normalizarNombre(input.diocesisLocalidad);

    if (!provinciaBuscada) {
      return { ok: false, error: "La provincia es obligatoria." };
    }
    if (!diocesisBuscada) {
      return { ok: false, error: "La diócesis/localidad es obligatoria." };
    }

    const provincia = await TerritorioRepository.findProvinciaByNombre(
      provinciaBuscada
    );
    if (!provincia) {
      return {
        ok: false,
        error: `No existe la Provincia «${input.provincia.trim()}».`,
      };
    }

    const encontrada = await TerritorioRepository.findDiocesisLocalidadByNombre(
      provincia.id,
      diocesisBuscada
    );
    if (!encontrada) {
      return {
        ok: false,
        error: `No existe la Diócesis/Localidad «${input.diocesisLocalidad.trim()}» en ${provincia.nombre}.`,
      };
    }

    return { ok: true, data: TerritorioService.toDiocesisDTO(encontrada) };
  }

  /** How many live records point at a territory — user story 10. */
  static async usoDeDiocesisLocalidad(
    _actor: CurrentUser,
    id: string
  ): Promise<UsoTerritorio> {
    return TerritorioRepository.countUsoDiocesisLocalidad(id);
  }

  static async usoDeProvincia(
    _actor: CurrentUser,
    id: string
  ): Promise<UsoTerritorio> {
    return TerritorioRepository.countUsoProvincia(id);
  }

  // ── Writes: Provincia ───────────────────────────────────────────────────────

  static async crearProvincia(
    actor: CurrentUser,
    input: CrearProvinciaInput
  ): Promise<ActionResult<ProvinciaDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const yaExiste = await TerritorioRepository.findProvinciaByNombre(
      normalizarNombre(input.nombre)
    );
    if (yaExiste) {
      return { ok: false, error: `Ya existe la Provincia «${yaExiste.nombre}».` };
    }

    const row = await TerritorioRepository.createProvincia({
      nombre: input.nombre,
      abreviatura: input.abreviatura,
      region: input.region,
    });

    return { ok: true, data: TerritorioService.toProvinciaDTO(row) };
  }

  /**
   * Renames a Provincia. The rename propagates everywhere the name is
   * displayed, because the name is stored once.
   *
   * The abbreviation is not renameable and neither is the Región: the
   * abbreviation is written into Códigos already printed on images, and the
   * Región is structure.
   */
  static async renombrarProvincia(
    actor: CurrentUser,
    input: RenombrarProvinciaInput
  ): Promise<ActionResult<ProvinciaDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const colision = await TerritorioRepository.findProvinciaByNombre(
      normalizarNombre(input.nombre)
    );
    if (colision && colision.id !== input.id) {
      return { ok: false, error: `Ya existe la Provincia «${colision.nombre}».` };
    }

    const row = await TerritorioRepository.updateProvincia(input.id, {
      nombre: input.nombre,
    });
    if (!row) return { ok: false, error: "No existe esa Provincia." };

    return { ok: true, data: TerritorioService.toProvinciaDTO(row) };
  }

  static async darDeBajaProvincia(
    actor: CurrentUser,
    id: string
  ): Promise<ActionResult<ProvinciaDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const uso = await TerritorioRepository.countUsoProvincia(id);
    if (uso.peregrinas > 0 || uso.misioneros > 0) {
      return { ok: false, error: enUso("la Provincia", uso) };
    }

    const row = await TerritorioRepository.updateProvincia(id, {
      bajaAt: new Date(),
    });
    if (!row) return { ok: false, error: "No existe esa Provincia." };

    return { ok: true, data: TerritorioService.toProvinciaDTO(row) };
  }

  // ── Writes: Diócesis/Localidad ──────────────────────────────────────────────

  static async crearDiocesisLocalidad(
    actor: CurrentUser,
    input: CrearDiocesisLocalidadInput
  ): Promise<ActionResult<DiocesisLocalidadDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const provincia = await TerritorioRepository.findProvinciaById(
      input.provinciaId
    );
    if (!provincia) return { ok: false, error: "No existe esa Provincia." };
    if (provincia.bajaAt !== null) {
      return {
        ok: false,
        error: `La Provincia «${provincia.nombre}» está dada de baja.`,
      };
    }

    const yaExiste = await TerritorioRepository.findDiocesisLocalidadByNombre(
      provincia.id,
      normalizarNombre(input.nombre)
    );
    if (yaExiste) {
      return {
        ok: false,
        error: `Ya existe «${yaExiste.diocesis.nombre}» en ${provincia.nombre}.`,
      };
    }

    const row = await TerritorioRepository.createDiocesisLocalidad({
      nombre: input.nombre,
      provinciaId: provincia.id,
    });

    return {
      ok: true,
      data: TerritorioService.toDiocesisDTO({ diocesis: row, provincia }),
    };
  }

  static async renombrarDiocesisLocalidad(
    actor: CurrentUser,
    input: RenombrarDiocesisLocalidadInput
  ): Promise<ActionResult<DiocesisLocalidadDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const actual = await TerritorioRepository.findDiocesisLocalidadById(input.id);
    if (!actual) return { ok: false, error: "No existe esa Diócesis/Localidad." };

    const colision = await TerritorioRepository.findDiocesisLocalidadByNombre(
      actual.provincia.id,
      normalizarNombre(input.nombre)
    );
    if (colision && colision.diocesis.id !== input.id) {
      return {
        ok: false,
        error: `Ya existe «${colision.diocesis.nombre}» en ${actual.provincia.nombre}.`,
      };
    }

    const row = await TerritorioRepository.updateDiocesisLocalidad(input.id, {
      nombre: input.nombre,
    });
    if (!row) return { ok: false, error: "No existe esa Diócesis/Localidad." };

    return {
      ok: true,
      data: TerritorioService.toDiocesisDTO({
        diocesis: row,
        provincia: actual.provincia,
      }),
    };
  }

  /**
   * Gives a Diócesis/Localidad de baja: it stops appearing in selection lists
   * without destroying the records that reference it. Refused while any live
   * Peregrina or Misionero still points at it, so nothing is orphaned.
   */
  static async darDeBajaDiocesisLocalidad(
    actor: CurrentUser,
    id: string
  ): Promise<ActionResult<DiocesisLocalidadDTO>> {
    if (!TerritorioService.puedeEscribir(actor)) {
      return { ok: false, error: NO_AUTORIZADO };
    }

    const actual = await TerritorioRepository.findDiocesisLocalidadById(id);
    if (!actual) return { ok: false, error: "No existe esa Diócesis/Localidad." };

    const uso = await TerritorioRepository.countUsoDiocesisLocalidad(id);
    if (uso.peregrinas > 0 || uso.misioneros > 0) {
      return { ok: false, error: enUso("la Diócesis/Localidad", uso) };
    }

    const row = await TerritorioRepository.updateDiocesisLocalidad(id, {
      bajaAt: new Date(),
    });
    if (!row) return { ok: false, error: "No existe esa Diócesis/Localidad." };

    return {
      ok: true,
      data: TerritorioService.toDiocesisDTO({
        diocesis: row,
        provincia: actual.provincia,
      }),
    };
  }
}

const NO_AUTORIZADO =
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
