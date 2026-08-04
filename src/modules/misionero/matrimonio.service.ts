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
import {
  dentroDelAlcance,
  derivarAlcance,
  exigirDentroDelAlcance,
  exigirTerritorioDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import { nombreDeTenedor } from "@/lib/formato";
import { registrarDenegacion } from "@/lib/authorization/registro";
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
 * Every method takes the Actor first and derives its own territorial scope, like
 * every other service here. The wrinkle this one has and the others do not: a
 * Matrimonio has no territory column, so its scope is spouse A's — which is only
 * well defined because `create` writes the same Diócesis/Localidad to both
 * spouses, in the same transaction. That invariant is this file's to keep.
 */
export class MatrimonioService {
  // ── Reads ──────────────────────────────────────────────────────────────────

  static async get(actor: CurrentUser, id: string): Promise<MatrimonioDTO> {
    const operacion = "MatrimonioService.get";
    const alcance = derivarAlcance(actor, operacion);
    const row = await MatrimonioService.exigirVisible(
      actor,
      alcance,
      id,
      operacion
    );
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
    const operacion = "MatrimonioService.listPagina";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);

    const total = await MatrimonioRepository.contarFiltrados(alcance, filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await MatrimonioRepository.findFiltrados(
      alcance,
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
   * couple's Alcance, its Región on the tablero and its place in the listado are
   * all read off spouse A. Two spouses in two Diócesis would make "the couple's
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
    const operacion = "MatrimonioService.create";
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
        anioConsagracion: input.anioConsagracionA ?? null,
      },
      esposoB: {
        ...comunes,
        nombre: input.nombreB,
        apellido: input.apellidoB,
        telefono: input.telefonoB ?? null,
        anioConsagracion: input.anioConsagracionB ?? null,
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
   * of them would break it quietly, leaving the couple visible from one Diócesis
   * and scoped to another.
   */
  static async update(
    actor: CurrentUser,
    id: string,
    input: UpdateMatrimonioInput
  ): Promise<MatrimonioDTO> {
    const operacion = "MatrimonioService.update";
    const alcance = derivarAlcance(actor, operacion);

    const actual = await MatrimonioService.exigirVisible(
      actor,
      alcance,
      id,
      operacion
    );

    let destino: string | undefined;
    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }
      exigirDentroDelAlcance(actor, alcance, territorio.diocesis.id, operacion);
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
          ...(input.anioConsagracionA !== undefined && {
            anioConsagracion: input.anioConsagracionA ?? null,
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
          ...(input.anioConsagracionB !== undefined && {
            anioConsagracion: input.anioConsagracionB ?? null,
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
   * Unscoped on purpose, like the Misionero guard it mirrors: the image can have
   * moved Diócesis while it sat in the couple's house, and a guard that reads
   * only what the Actor can see would err permissive — it would let a couple be
   * ended because the evidence against it was out of view. The *message* is
   * scoped instead, naming only the Códigos this Actor may know about.
   */
  static async baja(actor: CurrentUser, id: string): Promise<MatrimonioDTO> {
    const operacion = "MatrimonioService.baja";
    const alcance = derivarAlcance(actor, operacion);

    const actual = await MatrimonioService.exigirVisible(
      actor,
      alcance,
      id,
      operacion
    );

    const pendientes =
      await AsignacionRepository.findAbiertasDeMatrimonioSinAlcance(id);
    if (pendientes.length > 0) {
      throw new ConflictoError(
        MatrimonioService.mensajeDePendientes(actual, alcance, pendientes)
      );
    }

    const row = await MatrimonioRepository.darDeBaja(id);
    if (!row) throw new ConflictoError("Ese Matrimonio ya estaba dado de baja.");

    return MatrimonioService.leerUno(id);
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * The couple this Actor may act on, or a logged refusal.
   *
   * Read without the scope first, so "does not exist" and "not yours" stay
   * different answers, and then compared — against **spouse A's** territory,
   * because that is the couple's. What is logged is the territory and never a
   * person: Referentes Locales share one login per territory.
   */
  private static async exigirVisible(
    actor: CurrentUser,
    alcance: Alcance,
    id: string,
    operacion: string
  ): Promise<MatrimonioConEsposos> {
    const row = await MatrimonioRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe ese Matrimonio.");

    exigirDentroDelAlcance(
      actor,
      alcance,
      row.esposoA.misionero.diocesisLocalidadId,
      operacion
    );

    // The two spouses are supposed to share a Diócesis, and everything about the
    // couple's scope is read off spouse A. If that ever stops being true the
    // couple is half-visible, so it is worth a line in the log rather than a
    // silently wrong Región on the tablero.
    if (
      row.esposoB.misionero.diocesisLocalidadId !==
      row.esposoA.misionero.diocesisLocalidadId
    ) {
      registrarDenegacion({
        actor,
        operacion,
        territorioSolicitado: row.esposoB.misionero.diocesisLocalidadId,
        motivo: "los dos esposos de un Matrimonio están en Diócesis distintas",
      });
    }

    return row;
  }

  /**
   * Why a Matrimonio cannot be ended yet, in the words of somebody who has to
   * act on it.
   *
   * The guard reads unscoped, so this message has to do the scoping the guard
   * deliberately did not: a Código from a Diócesis this Actor cannot see is
   * counted but not named. Saying "3 Peregrinas: CBA JOV 0007, …" where one of
   * them belongs to another territory would leak an image's Código to somebody
   * with no business knowing it, and saying nothing at all would leave a refusal
   * with no way out of it.
   *
   * Deliberately parallel to `MisioneroService.mensajeDePendientes`, down to the
   * two branches — a Referente who has read one of these has read both.
   */
  private static mensajeDePendientes(
    actual: MatrimonioConEsposos,
    alcance: Alcance,
    pendientes: AsignacionCompleta[]
  ): string {
    const nombre = nombreDeTenedor({
      tipo: "matrimonio",
      matrimonio: {
        misioneroA: actual.esposoA.misionero,
        misioneroB: actual.esposoB.misionero,
      },
    });

    const visibles = pendientes.filter((p) =>
      dentroDelAlcance(alcance, p.peregrinaDiocesisLocalidadId)
    );

    if (visibles.length === pendientes.length) {
      const codigos = visibles.map((p) => p.peregrinaCodigo).join(", ");
      const cuantas =
        pendientes.length === 1
          ? `la Peregrina ${codigos}`
          : `${pendientes.length} Peregrinas a cargo: ${codigos}`;
      return (
        `No se puede dar de baja al matrimonio ${nombre}: todavía tiene ${cuantas}. ` +
        "Registrá primero que fue devuelta o que pasó a otro Misionero."
      );
    }

    const ajenas = pendientes.length - visibles.length;
    const detalle = visibles.length
      ? `${visibles.map((p) => p.peregrinaCodigo).join(", ")}, y ${ajenas} de otro territorio`
      : `${ajenas} de otro territorio`;

    return (
      `No se puede dar de baja al matrimonio ${nombre}: todavía tiene Peregrinas a cargo (${detalle}). ` +
      "Pedile a un Asesor Nacional que registre la devolución de las que no podés ver."
    );
  }

  /** Reads a couple back after a write, by primary key, already scope-checked. */
  private static async leerUno(id: string): Promise<MatrimonioDTO> {
    const row = await MatrimonioRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe ese Matrimonio.");
    return mapearMatrimonio(row);
  }
}
