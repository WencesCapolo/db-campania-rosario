import {
  AsignacionRepository,
  esSegundaAsignacionAbierta,
  type AsignacionCompleta,
} from "./asignacion.repository";
import type {
  AsignacionDTO,
  AsignarInput,
  CorregirInput,
  DevolverInput,
  EntregarInput,
  RegistroDTO,
  TenenciaDeMisioneroDTO,
} from "./asignacion.types";
import type { CurrentUser } from "@/modules/user/user.types";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import type { PeregrinaConTerritorio } from "@/modules/peregrina/peregrina.repository";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import type { MisioneroConTerritorio } from "@/modules/misionero/misionero.repository";
import {
  dentroDelAlcance,
  derivarAlcance,
  exigirDentroDelAlcance,
  exigirTerritorioDentroDelAlcance,
  type Alcance,
} from "@/lib/authorization/alcance";
import type { FiltrosTerritoriales } from "@/modules/territorio/territorio.types";
import {
  ConflictoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * AsignacionService
 *
 * Responsibility: the chain of custody. Who has which Peregrina, who had it
 * before, and the one rule that makes the answer trustworthy —
 *
 *   **A Peregrina has at most one open Asignación.**
 *
 * Enforced here and, independently, by a partial unique index on open rows, so a
 * concurrent double-assignment fails at the storage layer instead of racing. Both
 * halves matter: the service gives a person a sentence they can act on, the index
 * gives the data a guarantee no amount of concurrency can talk it out of.
 *
 * There is deliberately no matching rule on the Misionero side. A Misionero may
 * have several Peregrinas at once (settled with the Campaña on 2026-07-25).
 *
 * Every method takes the Actor first and derives its own scope — ADR 0001. An
 * Asignación has no territory of its own, so it is scoped through its Peregrina's;
 * see `condicionDeAlcance` in the repository for what that costs and why it is
 * still the right way round.
 */
export class AsignacionService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static registro(
    usuarioId: string | null,
    diocesis: string | null
  ): RegistroDTO | null {
    if (!usuarioId) return null;
    return { usuarioId, diocesisLocalidad: diocesis };
  }

  private static toDTO(row: AsignacionCompleta): AsignacionDTO {
    const a = row.asignacion;
    const fin = a.cerradaAt ?? new Date();

    return {
      id: a.id,
      peregrina: {
        id: a.peregrinaId,
        codigo: row.peregrinaCodigo,
        deBaja: row.peregrinaBajaAt !== null,
      },
      misionero: {
        id: a.misioneroId,
        nombre: row.misioneroNombre,
        apellido: row.misioneroApellido,
        deBaja: row.misioneroBajaAt !== null,
      },
      abiertaAt: a.abiertaAt,
      cerradaAt: a.cerradaAt,
      abierta: a.cerradaAt === null,
      // The interval, not a verdict about it. What counts as "has not changed
      // hands recently" is still unanswered, so the screen draws that line.
      diasEnCargo: Math.max(
        0,
        Math.floor((fin.getTime() - a.abiertaAt.getTime()) / MS_POR_DIA)
      ),
      registradaPor: AsignacionService.registro(
        a.registradaPorId,
        row.registradaPorDiocesis
      ) ?? { usuarioId: a.registradaPorId, diocesisLocalidad: null },
      cerradaPor: AsignacionService.registro(
        a.cerradaPorId,
        row.cerradaPorDiocesis
      ),
      notaApertura: a.notaApertura,
      notaCierre: a.notaCierre,
      corregidaAt: a.corregidaAt,
      corregidaPor: AsignacionService.registro(
        a.corregidaPorId,
        row.corregidaPorDiocesis
      ),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  /**
   * The Peregrina this Actor is about to act on, or a refusal.
   *
   * Unscoped primary-key lookup, then the territory is compared — the shape every
   * mutation in this codebase uses, so that "no existe" and "es de otro
   * territorio" are different answers in the log and the same answer to the
   * caller.
   */
  private static async exigirPeregrinaVisible(
    actor: CurrentUser,
    alcance: Alcance,
    peregrinaId: string,
    operacion: string
  ): Promise<PeregrinaConTerritorio> {
    const row = await PeregrinaRepository.findByIdSinAlcance(peregrinaId);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");

    exigirDentroDelAlcance(
      actor,
      alcance,
      row.peregrina.diocesisLocalidadId,
      operacion
    );

    return row;
  }

  private static async exigirMisioneroVisible(
    actor: CurrentUser,
    alcance: Alcance,
    misioneroId: string,
    operacion: string
  ): Promise<MisioneroConTerritorio> {
    const row = await MisioneroRepository.findByIdSinAlcance(misioneroId);
    if (!row) throw new NoEncontradoError("No existe ese Misionero.");

    // Both ends are checked, exactly as they are on a move: otherwise a Referente
    // Local could hand one of their images to somebody in the next Diócesis and
    // lose sight of it in the same motion.
    exigirDentroDelAlcance(
      actor,
      alcance,
      row.misionero.diocesisLocalidadId,
      operacion
    );

    return row;
  }

  /** A Misionero who has left the Campaña cannot take charge of anything new. */
  private static exigirMisioneroActivo(row: MisioneroConTerritorio): void {
    if (row.misionero.bajaAt !== null) {
      throw new ValidacionError(
        `${row.misionero.nombre} ${row.misionero.apellido} está dado de baja, ` +
          "así que no puede tener una Peregrina a cargo. Reactivalo primero."
      );
    }
  }

  /** A Peregrina out of service is not handed to anybody. */
  private static exigirPeregrinaActiva(row: PeregrinaConTerritorio): void {
    if (row.peregrina.bajaAt !== null) {
      throw new ValidacionError(
        `La Peregrina ${row.peregrina.codigo} está dada de baja, así que no se ` +
          "puede asignar. Reactivala primero."
      );
    }
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * The full chain of custody for a Peregrina, oldest first — user stories 4, 5
   * and 6.
   *
   * For an Extraviada Peregrina the last entry is still open, on purpose: that is
   * the answer to "who had it", and closing it would delete the only lead anybody
   * has.
   */
  static async historialDePeregrina(
    actor: CurrentUser,
    peregrinaId: string
  ): Promise<AsignacionDTO[]> {
    const operacion = "AsignacionService.historialDePeregrina";
    const alcance = derivarAlcance(actor, operacion);

    // Refused before it is empty: a history somebody may not see must not render
    // as "sin historial", which would confirm the record exists.
    await AsignacionService.exigirPeregrinaVisible(
      actor,
      alcance,
      peregrinaId,
      operacion
    );

    const rows = await AsignacionRepository.findHistorialDePeregrina(
      alcance,
      peregrinaId
    );
    return rows.map(AsignacionService.toDTO);
  }

  /** Every Peregrina a Misionero has ever had charge of — user story 7. */
  static async historialDeMisionero(
    actor: CurrentUser,
    misioneroId: string
  ): Promise<AsignacionDTO[]> {
    const operacion = "AsignacionService.historialDeMisionero";
    const alcance = derivarAlcance(actor, operacion);

    await AsignacionService.exigirMisioneroVisible(
      actor,
      alcance,
      misioneroId,
      operacion
    );

    const rows = await AsignacionRepository.findHistorialDeMisionero(
      alcance,
      misioneroId
    );
    return rows.map(AsignacionService.toDTO);
  }

  /** Who has this image right now, or null because nobody does. */
  static async tenenciaActual(
    actor: CurrentUser,
    peregrinaId: string
  ): Promise<AsignacionDTO | null> {
    const operacion = "AsignacionService.tenenciaActual";
    const alcance = derivarAlcance(actor, operacion);

    await AsignacionService.exigirPeregrinaVisible(
      actor,
      alcance,
      peregrinaId,
      operacion
    );

    const row = await AsignacionRepository.findAbiertaDePeregrina(
      alcance,
      peregrinaId
    );
    return row ? AsignacionService.toDTO(row) : null;
  }

  static async getById(
    actor: CurrentUser,
    id: string
  ): Promise<AsignacionDTO> {
    const operacion = "AsignacionService.getById";
    const alcance = derivarAlcance(actor, operacion);
    const row = await AsignacionService.exigirVisible(actor, alcance, id, operacion);
    return AsignacionService.toDTO(row);
  }

  /**
   * Qué tiene cada uno de una página de Misioneros — la columna «¿Tiene imagen?»
   * del listado.
   *
   * Una consulta para la página entera y no una por fila: veinte filas serían
   * veinte viajes, y es la misma pregunta hecha veinte veces.
   *
   * El repositorio scopea por el territorio de la persona, así que un id de otra
   * Diócesis no devuelve nada — pasar ids ajenos no enseña si esa persona tiene
   * una imagen. Lo que este método decide es lo otro: **nombrar** el Código. Sale
   * sólo cuando la imagen está dentro del alcance; las demás se cuentan en
   * `ajenas`, porque una imagen movida a otra Diócesis sigue estando en la casa de
   * quien la tiene y decir «Ninguna» sería mentir en la dirección cómoda.
   */
  static async tenenciasDeMisioneros(
    actor: CurrentUser,
    misioneroIds: string[]
  ): Promise<TenenciaDeMisioneroDTO[]> {
    const alcance = derivarAlcance(
      actor,
      "AsignacionService.tenenciasDeMisioneros"
    );

    const filas = await AsignacionRepository.findAbiertasDeMisioneros(
      alcance,
      misioneroIds
    );

    const porMisionero = new Map<string, TenenciaDeMisioneroDTO>();
    for (const id of misioneroIds) {
      porMisionero.set(id, { misioneroId: id, peregrinas: [], ajenas: 0 });
    }

    for (const fila of filas) {
      // Existe siempre: el repositorio sólo devuelve filas de los ids pedidos.
      const tenencia = porMisionero.get(fila.misioneroId);
      if (!tenencia) continue;

      if (dentroDelAlcance(alcance, fila.peregrinaDiocesisLocalidadId)) {
        tenencia.peregrinas.push({
          id: fila.peregrinaId,
          codigo: fila.peregrinaCodigo,
        });
      } else {
        tenencia.ajenas += 1;
      }
    }

    return [...porMisionero.values()];
  }

  /** Peregrinas nobody has ever had charge of — user story 19. */
  static async listarNuncaAsignadas(
    actor: CurrentUser
  ): Promise<{ id: string; codigo: string }[]> {
    const alcance = derivarAlcance(
      actor,
      "AsignacionService.listarNuncaAsignadas"
    );
    return AsignacionRepository.findPeregrinasNuncaAsignadas(alcance);
  }

  /**
   * Misioneros with their hands free — user story 5 of the tablero.
   *
   * Scoped by the *person's* territory rather than by an image's, which is what
   * the question means: "who here could take one". The repository ignores the
   * image's territory when deciding whether somebody is free, so a Misionero
   * holding a Peregrina that has since moved Diócesis is not offered.
   */
  static async listarMisionerosSinPeregrina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales = {}
  ): Promise<{ id: string; nombre: string; apellido: string }[]> {
    const operacion = "AsignacionService.listarMisionerosSinPeregrina";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);
    return AsignacionRepository.findMisionerosSinPeregrina(alcance, filtros);
  }

  /**
   * Misioneros holding at least one image — the other half of the listado's
   * tenencia filter.
   *
   * Same scope rule as its twin above, and the same reason: the question is about
   * the people of a territory, so it is their own Diócesis that bounds it. An
   * image that has since moved elsewhere still counts as held.
   */
  static async listarMisionerosConPeregrina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales = {}
  ): Promise<{ id: string; nombre: string; apellido: string }[]> {
    const operacion = "AsignacionService.listarMisionerosConPeregrina";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);
    return AsignacionRepository.findMisionerosConPeregrina(alcance, filtros);
  }

  /**
   * Images that have not changed hands in `dias` days — user story 8.
   *
   * The threshold is the caller's, because nobody in the Campaña has drawn the
   * line yet: `diasEnCargo` has always returned the interval and left the verdict
   * to the screen. The tablero's default lives in `tablero.types`.
   */
  static async listarEstancadas(
    actor: CurrentUser,
    dias: number,
    filtros: FiltrosTerritoriales = {}
  ) {
    const operacion = "AsignacionService.listarEstancadas";
    const alcance = derivarAlcance(actor, operacion);
    exigirTerritorioDentroDelAlcance(actor, alcance, filtros, operacion);
    return AsignacionRepository.findPeregrinasEstancadas(alcance, dias, filtros);
  }

  // `dashboardStats` is gone. Tenencia is counted off the Peregrina's own
  // denormalised pointer in `TableroService`, which is one query instead of two
  // and the same number the listado's `tenencia` filter returns.

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Gives a Peregrina nobody currently has to a Misionero — user stories 1 and 8.
   *
   * Refused if somebody already has it, rather than quietly closing their period.
   * A Referente who did not know the image was out needs to be told, not obeyed —
   * and being told *who* has it is the point: it turns a refusal into the next
   * phone call.
   */
  static async asignar(
    actor: CurrentUser,
    input: AsignarInput
  ): Promise<AsignacionDTO> {
    const operacion = "AsignacionService.asignar";
    const alcance = derivarAlcance(actor, operacion);

    const peregrina = await AsignacionService.exigirPeregrinaVisible(
      actor,
      alcance,
      input.peregrinaId,
      operacion
    );
    AsignacionService.exigirPeregrinaActiva(peregrina);

    const misionero = await AsignacionService.exigirMisioneroVisible(
      actor,
      alcance,
      input.misioneroId,
      operacion
    );
    AsignacionService.exigirMisioneroActivo(misionero);

    const abierta = await AsignacionRepository.findAbiertaDePeregrina(
      alcance,
      input.peregrinaId
    );
    if (abierta) {
      throw new ConflictoError(
        `La Peregrina ${peregrina.peregrina.codigo} ya está a cargo de ` +
          `${abierta.misioneroNombre} ${abierta.misioneroApellido}. ` +
          "Si pasó a otra persona, usá «Pasar a otro Misionero» en lugar de asignarla de nuevo."
      );
    }

    return AsignacionService.abrirTraduciendoElConflicto(
      {
        peregrinaId: input.peregrinaId,
        misioneroId: input.misioneroId,
        registradaPorId: actor.id,
        notaApertura: input.nota ?? null,
      },
      peregrina.peregrina.codigo
    );
  }

  /**
   * Hands the image on — user stories 1 and 2.
   *
   * One transaction closes the outgoing period and opens the incoming one, so the
   * count of open Asignaciones for this Peregrina is one throughout and the
   * previous Misionero's involvement is preserved instead of overwritten. That
   * preservation is the whole point of the issue: the old pointer knew the fourth
   * holder of an image and nothing about the first three.
   */
  static async entregar(
    actor: CurrentUser,
    input: EntregarInput
  ): Promise<{ cerrada: AsignacionDTO; abierta: AsignacionDTO }> {
    const operacion = "AsignacionService.entregar";
    const alcance = derivarAlcance(actor, operacion);

    const peregrina = await AsignacionService.exigirPeregrinaVisible(
      actor,
      alcance,
      input.peregrinaId,
      operacion
    );
    AsignacionService.exigirPeregrinaActiva(peregrina);

    const misionero = await AsignacionService.exigirMisioneroVisible(
      actor,
      alcance,
      input.misioneroId,
      operacion
    );
    AsignacionService.exigirMisioneroActivo(misionero);

    const actual = await AsignacionRepository.findAbiertaDePeregrina(
      alcance,
      input.peregrinaId
    );
    if (!actual) {
      throw new ConflictoError(
        `La Peregrina ${peregrina.peregrina.codigo} no está a cargo de nadie, ` +
          "así que no hay a quién pasársela. Usá «Asignar» directamente."
      );
    }
    if (actual.asignacion.misioneroId === input.misioneroId) {
      throw new ValidacionError(
        `La Peregrina ${peregrina.peregrina.codigo} ya está a cargo de ` +
          `${actual.misioneroNombre} ${actual.misioneroApellido}.`
      );
    }

    const ahora = new Date();
    let ids: { cerrada: string; abierta: string } | undefined;
    try {
      ids = await AsignacionRepository.cerrarYAbrir(
        input.peregrinaId,
        {
          cerradaAt: ahora,
          cerradaPorId: actor.id,
          notaCierre: input.notaCierre ?? null,
        },
        {
          peregrinaId: input.peregrinaId,
          misioneroId: input.misioneroId,
          abiertaAt: ahora,
          registradaPorId: actor.id,
          notaApertura: input.nota ?? null,
        }
      );
    } catch (error) {
      throw AsignacionService.traducirConflicto(
        error,
        peregrina.peregrina.codigo
      );
    }

    if (!ids) {
      // The `cerrada_at is null` predicate found nothing to claim, which means
      // somebody else registered a move between the read above and this write.
      throw new ConflictoError(
        `Otra persona registró un movimiento de la Peregrina ${peregrina.peregrina.codigo} ` +
          "justo antes. Volvé a mirar quién la tiene y probá de nuevo."
      );
    }

    const [cerrada, abierta] = await Promise.all([
      AsignacionRepository.exigirRecienEscrita(ids.cerrada),
      AsignacionRepository.exigirRecienEscrita(ids.abierta),
    ]);

    return {
      cerrada: AsignacionService.toDTO(cerrada),
      abierta: AsignacionService.toDTO(abierta),
    };
  }

  /**
   * The image came back and is not going straight out again — user story 3.
   *
   * An image held centrally is a real state, and the previous version of the
   * system could not express it: unassigning meant blanking a pointer, which read
   * as "never had one".
   */
  static async devolver(
    actor: CurrentUser,
    input: DevolverInput
  ): Promise<AsignacionDTO> {
    const operacion = "AsignacionService.devolver";
    const alcance = derivarAlcance(actor, operacion);

    const peregrina = await AsignacionService.exigirPeregrinaVisible(
      actor,
      alcance,
      input.peregrinaId,
      operacion
    );

    const cerrada = await AsignacionRepository.cerrar(input.peregrinaId, {
      cerradaAt: new Date(),
      cerradaPorId: actor.id,
      notaCierre: input.notaCierre ?? null,
    });

    if (!cerrada) {
      throw new ConflictoError(
        `La Peregrina ${peregrina.peregrina.codigo} no está a cargo de nadie, ` +
          "así que no hay nada que devolver."
      );
    }

    return AsignacionService.toDTO(cerrada);
  }

  /**
   * Corrects a mistaken record — user story 17.
   *
   * An edit and never a deletion, so a typo does not become permanent history and
   * the correction does not become invisible history: `corregidaAt` is stamped by
   * the repository on every path.
   */
  static async corregir(
    actor: CurrentUser,
    input: CorregirInput
  ): Promise<AsignacionDTO> {
    const operacion = "AsignacionService.corregir";
    const alcance = derivarAlcance(actor, operacion);

    const actual = await AsignacionService.exigirVisible(
      actor,
      alcance,
      input.asignacionId,
      operacion
    );

    const seguiraAbierta =
      input.cerradaAt !== undefined
        ? false
        : actual.asignacion.cerradaAt === null;

    if (input.misioneroId !== undefined) {
      const misionero = await AsignacionService.exigirMisioneroVisible(
        actor,
        alcance,
        input.misioneroId,
        operacion
      );
      // A closed period may perfectly well name somebody who has since left the
      // Campaña — that is what history is. An open one may not: they would be
      // holding an image while being absent from every active list.
      if (seguiraAbierta) AsignacionService.exigirMisioneroActivo(misionero);
    }

    const abiertaAt = input.abiertaAt ?? actual.asignacion.abiertaAt;
    const cerradaAt = input.cerradaAt ?? actual.asignacion.cerradaAt;

    if (abiertaAt.getTime() > Date.now()) {
      throw new ValidacionError(
        "La fecha de inicio no puede estar en el futuro: una Asignación registra " +
          "lo que ya pasó."
      );
    }
    if (cerradaAt && cerradaAt.getTime() < abiertaAt.getTime()) {
      throw new ValidacionError(
        "La fecha de devolución no puede ser anterior a la de entrega."
      );
    }

    try {
      const row = await AsignacionRepository.corregir(
        input.asignacionId,
        {
          ...(input.misioneroId !== undefined && {
            misioneroId: input.misioneroId,
          }),
          ...(input.abiertaAt !== undefined && { abiertaAt: input.abiertaAt }),
          ...(input.cerradaAt !== undefined && { cerradaAt: input.cerradaAt }),
          ...(input.notaApertura !== undefined && {
            notaApertura: input.notaApertura ?? null,
          }),
          ...(input.notaCierre !== undefined && {
            notaCierre: input.notaCierre ?? null,
          }),
        },
        { corregidaAt: new Date(), corregidaPorId: actor.id }
      );
      return AsignacionService.toDTO(row);
    } catch (error) {
      throw AsignacionService.traducirConflicto(error, actual.peregrinaCodigo);
    }
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private static async exigirVisible(
    actor: CurrentUser,
    alcance: Alcance,
    id: string,
    operacion: string
  ): Promise<AsignacionCompleta> {
    const row = await AsignacionRepository.findByIdSinAlcance(id);
    if (!row) throw new NoEncontradoError("No existe esa Asignación.");

    exigirDentroDelAlcance(
      actor,
      alcance,
      row.peregrinaDiocesisLocalidadId,
      operacion
    );

    return row;
  }

  private static async abrirTraduciendoElConflicto(
    data: Parameters<typeof AsignacionRepository.abrir>[0],
    codigo: string
  ): Promise<AsignacionDTO> {
    try {
      return AsignacionService.toDTO(await AsignacionRepository.abrir(data));
    } catch (error) {
      throw AsignacionService.traducirConflicto(error, codigo);
    }
  }

  /**
   * Turns the database's half of the invariant into a sentence.
   *
   * The service checks first, so reaching this means two people assigned the same
   * image in the same instant and the partial unique index settled it. Without
   * this the loser would see "algo falló al guardar", which is both true and
   * useless.
   */
  private static traducirConflicto(error: unknown, codigo: string): unknown {
    if (esSegundaAsignacionAbierta(error)) {
      return new ConflictoError(
        `Otra persona acaba de registrar quién tiene la Peregrina ${codigo}. ` +
          "Mirá el historial y volvé a intentarlo si hace falta."
      );
    }
    return error;
  }
}
