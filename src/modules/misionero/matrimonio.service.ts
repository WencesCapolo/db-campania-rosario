import {
  MatrimonioRepository,
  type MatrimonioConEsposos,
} from "./matrimonio.repository";
import { mapearMatrimonio } from "./misionero.mapper";
import type {
  CreateMatrimonioInput,
  MatrimonioDTO,
  UpdateMatrimonioInput,
} from "./matrimonio.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { nombreDeTenedor } from "@/lib/formato";
import {
  AsignacionRepository,
  type AsignacionCompleta,
} from "@/modules/asignacion/asignacion.repository";
// ↑ A service reading another module's *repository* for a cross-entity guard —
//   the same import `MisioneroService` has carried since issue 3, for the same
//   baja. Only the repository, never the other service. The one-way chain
//   constrains the *schema* imports; this one closes nothing.
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

/**
 * MatrimonioService
 *
 * Responsibility: business logic for the Matrimonio — a couple who take charge
 * of a Peregrina together, and who are **one** Tenedor rather than two people
 * (ADR 0010).
 *
 * Every method takes the Actor first, like every other service here. The wrinkle
 * this one has and the others do not: a Matrimonio has no territory column, so
 * its territory is spouse A's — which is only well defined because `create`
 * writes the same Diócesis/Localidad to both spouses, in the same transaction.
 * That invariant is this file's to keep.
 */
export class MatrimonioService {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async get(actor: CurrentUser, id: string): Promise<MatrimonioDTO> {
    const row = await MatrimonioService.exigirExistente(id);
    return mapearMatrimonio(row);
  }

  /**
   * The Matrimonio listado, one page at a time.
   *
   * Counted by an aggregate over the same predicate the rows come from, never by
   * fetching them and taking the length, and the page is clamped against that
   * total here because this is the only layer that knows how many pages there
   * are (ADR 0008).
   *
   * This is not the `/misionero` roster: that one is `MisioneroService.listPagina`
   * and unions both kinds. This one answers "the couples", which is what a screen
   * about Matrimonios asks.
   */
  static async listPagina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales & { q?: string },
    pagina = 1
  ): Promise<Pagina<MatrimonioDTO>> {
    const total = await MatrimonioRepository.contarFiltrados(filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await MatrimonioRepository.findFiltrados(
      filtros,
      {},
      rango(actual)
    );

    return armarPagina(rows.map(mapearMatrimonio), total, actual);
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Two Misioneros and one Matrimonio, in one submit and one transaction.
   *
   * Half a marriage is not a thing. A crash between the second insert and the
   * third would leave two individuals nobody meant to enter — and worse, two
   * individuals each selectable on their own in every picker, which is exactly
   * the state this feature exists to end. The transaction itself lives in
   * `MatrimonioRepository.crear`, where the statements are; this method decides
   * what goes into it.
   *
   * **Both spouses get the same `diocesisLocalidadId`, and this is the only
   * place that is true by construction.** Everything downstream leans on it: the
   * couple's Diócesis filter, its Región on the tablero and its place in the
   * listado are all read off spouse A. Two spouses in two Diócesis would make "the couple's
   * territory" a coin flip.
   *
   * Each spouse's `telefono` is their own and both are optional. It was a single
   * household number at first; a couple has two, and the second is the one
   * somebody reaches for when the first does not answer.
   */
  static async create(
    actor: CurrentUser,
    input: CreateMatrimonioInput
  ): Promise<MatrimonioDTO> {
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

    // What the household shares, and only that: the territory is the invariant
    // spouse A's row is read for, and the Centro is one place. The teléfono is
    // *not* here — each spouse has their own, both optional.
    const comunes = {
      estado: "activo" as const,
      diocesisLocalidadId: territorio.diocesis.id,
      centroTipo: input.centroTipo ?? null,
      centroNombre: input.centroNombre ?? null,
      resumenesAnuales: "{}",
      createdById: actor.id,
    };

    const id = await MatrimonioRepository.crear({
      esposoA: {
        ...comunes,
        nombre: input.nombreA,
        apellido: input.apellidoA,
        telefono: input.telefonoA ?? null,
        email: input.emailA ?? null,
        fechaConsagracion: input.fechaConsagracionA ?? null,
      },
      esposoB: {
        ...comunes,
        nombre: input.nombreB,
        apellido: input.apellidoB,
        telefono: input.telefonoB ?? null,
        email: input.emailB ?? null,
        fechaConsagracion: input.fechaConsagracionB ?? null,
      },
      matrimonio: {
        estado: "activo",
        centroTipo: input.centroTipo ?? null,
        centroNombre: input.centroNombre ?? null,
        createdById: actor.id,
      },
    });

    return MatrimonioService.leerUno(id);
  }

  /**
   * A correction to a couple already entered.
   *
   * Moving the household moves **both** spouses, in one transaction — the shared
   * territory is the invariant `create` establishes, and an edit that moved one
   * of them would break it quietly, leaving the couple filed under one Diócesis
   * and half of it under another.
   */
  static async update(
    actor: CurrentUser,
    id: string,
    input: UpdateMatrimonioInput
  ): Promise<MatrimonioDTO> {
    const actual = await MatrimonioService.exigirExistente(id);

    let destino: string | undefined;
    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }
      destino = territorio.diocesis.id;
    }

    const territorial =
      destino !== undefined ? { diocesisLocalidadId: destino } : {};

    await MatrimonioRepository.actualizar(id, {
      matrimonio: {
        ...(input.estado !== undefined && { estado: input.estado }),
        ...(input.centroTipo !== undefined && {
          centroTipo: input.centroTipo ?? null,
        }),
        ...(input.centroNombre !== undefined && {
          centroNombre: input.centroNombre ?? null,
        }),
      },
      esposoA: {
        id: actual.esposoA.misionero.id,
        cambios: {
          ...territorial,
          ...(input.nombreA !== undefined && { nombre: input.nombreA }),
          ...(input.apellidoA !== undefined && { apellido: input.apellidoA }),
          ...(input.telefonoA !== undefined && {
            telefono: input.telefonoA ?? null,
          }),
          ...(input.emailA !== undefined && {
            email: input.emailA ?? null,
          }),
          ...(input.fechaConsagracionA !== undefined && {
            fechaConsagracion: input.fechaConsagracionA ?? null,
          }),
        },
      },
      esposoB: {
        id: actual.esposoB.misionero.id,
        cambios: {
          ...territorial,
          ...(input.nombreB !== undefined && { nombre: input.nombreB }),
          ...(input.apellidoB !== undefined && { apellido: input.apellidoB }),
          ...(input.telefonoB !== undefined && {
            telefono: input.telefonoB ?? null,
          }),
          ...(input.emailB !== undefined && {
            email: input.emailB ?? null,
          }),
          ...(input.fechaConsagracionB !== undefined && {
            fechaConsagracion: input.fechaConsagracionB ?? null,
          }),
        },
      },
    });

    return MatrimonioService.leerUno(id);
  }

  /**
   * The Matrimonio ended — a separation, or a death.
   *
   * Soft, like every other baja: the closed Asignaciones the couple held keep
   * pointing here, because what the historial says about a period is what was
   * true then. Setting it also hands the two spouses back their individual
   * lives, with no code anywhere doing that on purpose — the roster's
   * `not exists (active marriage)` clause simply stops matching them.
   *
   * Refused while an Asignación is open, exactly as `misionero.bajaAt` is: an
   * image physically in that house has not left the inventory, whatever the
   * paperwork says, and ending the household first is how images get lost.
   *
   * Reading `AsignacionRepository` from here is legal and is not a cycle —
   * CLAUDE.md §4: a service may read another module's **repository** for a
   * cross-entity guard, never another module's service. `MisioneroService` has
   * done exactly this for its own baja since issue 3. Only the *schema* imports
   * run one way.
   *
   * Every open Asignación counts, wherever the image is filed, like the
   * Misionero guard it mirrors: the image can have moved Diócesis while it sat
   * in the couple's house.
   */
  static async baja(actor: CurrentUser, id: string): Promise<MatrimonioDTO> {
    const actual = await MatrimonioService.exigirExistente(id);

    const pendientes =
      await AsignacionRepository.findAbiertasDeMatrimonio(id);
    if (pendientes.length > 0) {
      throw new ConflictoError(
        MatrimonioService.mensajeDePendientes(actual, pendientes)
      );
    }

    const row = await MatrimonioRepository.darDeBaja(id);
    if (!row) throw new ConflictoError("Ese Matrimonio ya estaba dado de baja.");

    return MatrimonioService.leerUno(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * The couple, given de baja or not, or a refusal that says it does not exist.
   *
   * The two spouses are supposed to share a Diócesis, and everything about the
   * couple's territory is read off spouse A. If that ever stops being true the
   * couple is half-filed, so it is worth a line in the log rather than a
   * silently wrong Región on the tablero.
   */
  private static async exigirExistente(
    id: string
  ): Promise<MatrimonioConEsposos> {
    const row = await MatrimonioRepository.findById(id, { incluirBajas: true });
    if (!row) throw new NoEncontradoError("No existe ese Matrimonio.");

    if (
      row.esposoB.misionero.diocesisLocalidadId !==
      row.esposoA.misionero.diocesisLocalidadId
    ) {
      console.warn(
        "[matrimonio-partido]",
        JSON.stringify({
          matrimonioId: row.matrimonio.id,
          diocesisA: row.esposoA.misionero.diocesisLocalidadId,
          diocesisB: row.esposoB.misionero.diocesisLocalidadId,
        })
      );
    }

    return row;
  }

  /**
   * Why a Matrimonio cannot be ended yet, in the words of somebody who has to
   * act on it: every Código still in the house, so the refusal has a way out.
   *
   * Deliberately parallel to `MisioneroService.mensajeDePendientes`.
   */
  private static mensajeDePendientes(
    actual: MatrimonioConEsposos,
    pendientes: AsignacionCompleta[]
  ): string {
    const nombre = nombreDeTenedor({
      tipo: "matrimonio",
      matrimonio: {
        misioneroA: actual.esposoA.misionero,
        misioneroB: actual.esposoB.misionero,
      },
    });

    const identificaciones = pendientes
      .map((p) => p.peregrinaIdentificacion)
      .join(", ");
    const cuantas =
      pendientes.length === 1
        ? `la Peregrina ${identificaciones}`
        : `${pendientes.length} Peregrinas a cargo: ${identificaciones}`;
    return (
      `No se puede dar de baja al matrimonio ${nombre}: todavía tiene ${cuantas}. ` +
      "Registrá primero que fue devuelta o que pasó a otro Misionero."
    );
  }

  /** Reads a couple back after a write, by primary key. */
  private static async leerUno(id: string): Promise<MatrimonioDTO> {
    const row = await MatrimonioRepository.findById(id, { incluirBajas: true });
    if (!row) throw new NoEncontradoError("No existe ese Matrimonio.");
    return mapearMatrimonio(row);
  }
}
