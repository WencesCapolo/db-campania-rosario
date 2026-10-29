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
  TenenciaDeTenedorDTO,
} from "./asignacion.types";
import type { TenedorResueltoDTO } from "@/lib/tenedor";
import type { CurrentUser } from "@/modules/user/user.types";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import type { PeregrinaConTerritorio } from "@/modules/peregrina/peregrina.repository";
import { identificacionDe } from "@/modules/peregrina/peregrina.types";
import { MatrimonioRepository } from "@/modules/misionero/matrimonio.repository";
// ↑ Un repositorio de otro módulo, río arriba, para una guarda entre entidades:
//   exactamente la forma que ADR 0004 permite y la única que no arma un ciclo.
//   Nunca el service.
import {
  valorDeTenedor,
  type Tenedor,
} from "@/modules/misionero/matrimonio.types";
import { nombreDeTenedor } from "@/lib/formato";
import { exigirModalidad } from "@/lib/authorization/capacidades";
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
 * Every method takes the Actor first — ADR 0001. Every write checks the
 * Modalidad of the image it moves (ADR 0016); an Asignación has no Modalidad of
 * its own, so it is its Peregrina's.
 */
export class AsignacionService {
  // ── Helpers ───────────────────────────────────────────────────────────────

  private static registro(usuarioId: string | null): RegistroDTO | null {
    return usuarioId ? { usuarioId } : null;
  }

  private static toDTO(row: AsignacionCompleta): AsignacionDTO {
    const a = row.asignacion;
    const fin = a.cerradaAt ?? new Date();

    return {
      id: a.id,
      peregrina: {
        id: a.peregrinaId,
        identificacion: row.peregrinaIdentificacion,
      },
      tenedor: row.tenedor,
      abiertaAt: a.abiertaAt,
      cerradaAt: a.cerradaAt,
      abierta: a.cerradaAt === null,
      // The interval, not a verdict about it. What counts as "has not changed
      // hands recently" is still unanswered, so the screen draws that line.
      diasEnCargo: Math.max(
        0,
        Math.floor((fin.getTime() - a.abiertaAt.getTime()) / MS_POR_DIA)
      ),
      registradaPor: { usuarioId: a.registradaPorId },
      cerradaPor: AsignacionService.registro(a.cerradaPorId),
      notaApertura: a.notaApertura,
      notaCierre: a.notaCierre,
      corregidaAt: a.corregidaAt,
      corregidaPor: AsignacionService.registro(a.corregidaPorId),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  /** The Peregrina about to be acted on, or a refusal that says it does not exist. */
  private static async exigirPeregrina(
    peregrinaId: string
  ): Promise<PeregrinaConTerritorio> {
    const row = await PeregrinaRepository.findById(peregrinaId);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");
    return row;
  }

  /**
   * El Tenedor sobre el que se va a escribir, o una negativa — una sola guarda
   * para las dos clases (ADR 0010).
   */
  private static async exigirTenedor(
    tenedor: Tenedor
  ): Promise<TenedorResueltoDTO> {
    const row = await AsignacionRepository.findTenedor(tenedor);
    if (!row) {
      throw new NoEncontradoError(
        tenedor.tipo === "persona"
          ? "No existe ese Misionero."
          : "No existe ese Matrimonio."
      );
    }
    return row;
  }

  /** Quien se fue de la Campaña — o el Matrimonio que terminó — no recibe nada. */
  private static exigirTenedorActivo(tenedor: TenedorResueltoDTO): void {
    if (!tenedor.deBaja) return;

    throw new ValidacionError(
      tenedor.tipo === "persona"
        ? `${nombreDeTenedor(tenedor)} está dado de baja, así que no puede ` +
          "tener una Peregrina a cargo. Reactivalo primero."
        : `El Matrimonio de ${nombreDeTenedor(tenedor)} está dado de baja, ` +
          "así que no puede tener una Peregrina a cargo."
    );
  }

  /**
   * **Un Misionero casado nunca tiene una imagen solo** — ADR 0010.
   *
   * Si un cónyuge pudiera recibirla por su cuenta tendría que aparecer en el
   * picker, y aparecer en el picker es aparecer en el listado: el Matrimonio
   * pasaría a ser una tercera fila al lado de las dos que vino a reemplazar.
   *
   * `MatrimonioRepository` es un repositorio río arriba y se lee para una guarda
   * entre entidades — la forma que ADR 0004 permite. No hay ninguna restricción
   * de storage detrás de esto, igual que «un Misionero puede tener varias
   * Peregrinas a la vez» (2026-07-25): es una regla de negocio y vive acá.
   *
   * La corre `asignar` y también `entregar`. ADR 0010 nombra sólo `asignar`
   * porque es la puerta que se discutió, pero las dos abren un período: una
   * regla que cuida una sola de las dos puertas no es una regla.
   */
  private static async exigirQueNoEsteCasado(tenedor: Tenedor): Promise<void> {
    if (tenedor.tipo !== "persona") return;

    const casado = await MatrimonioRepository.deMisionero(tenedor.id);
    if (!casado) return;

    // El nombre de la pareja sale del repositorio propio, resuelto: la fila de
    // `matrimonio` tiene dos ids y ningún nombre, y la negativa tiene que decir
    // a quién elegir en lugar de a quién no.
    const pareja = await AsignacionRepository.findTenedor({
      tipo: "matrimonio",
      id: casado.id,
    });

    const comoSeLlaman = pareja
      ? `«${nombreDeTenedor(pareja)}»`
      : "que integra";

    throw new ValidacionError(
      `Esa persona está en el Matrimonio ${comoSeLlaman}, y un Matrimonio tiene ` +
        "la imagen a cargo como una sola persona. Elegí el Matrimonio en la lista."
    );
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
    // Refused before it is empty: a Peregrina that does not exist has no
    // historial, rather than an empty one.
    await AsignacionService.exigirPeregrina(peregrinaId);

    const rows = await AsignacionRepository.findHistorialDePeregrina(peregrinaId);
    return rows.map(AsignacionService.toDTO);
  }

  /**
   * Every Peregrina a Misionero has ever had charge of — user story 7.
   *
   * Incluye lo que tuvo su Matrimonio: la casa era la de los dos, y una página
   * de una persona a la que le falta justo lo del hogar tiene un agujero con la
   * forma de los años que estuvo casada. El repositorio lo resuelve; acá sólo se
   * comprueba que la persona exista.
   */
  static async historialDeMisionero(
    actor: CurrentUser,
    misioneroId: string
  ): Promise<AsignacionDTO[]> {
    await AsignacionService.exigirTenedor({ tipo: "persona", id: misioneroId });

    const rows = await AsignacionRepository.findHistorialDeMisionero(misioneroId);
    return rows.map(AsignacionService.toDTO);
  }

  /** Who has this image right now, or null because nobody does. */
  static async tenenciaActual(
    actor: CurrentUser,
    peregrinaId: string
  ): Promise<AsignacionDTO | null> {
    await AsignacionService.exigirPeregrina(peregrinaId);

    const row = await AsignacionRepository.findAbiertaDePeregrina(peregrinaId);
    return row ? AsignacionService.toDTO(row) : null;
  }

  static async getById(
    actor: CurrentUser,
    id: string
  ): Promise<AsignacionDTO> {
    const row = await AsignacionService.exigirAsignacion(id);
    return AsignacionService.toDTO(row);
  }

  /**
   * Qué tiene cada uno de una página de **Tenedores** — la columna «¿Tiene
   * imagen?» del listado.
   *
   * Toma Tenedores y contesta con la misma clave, para que una fila del listado
   * pueda buscarse a sí misma. Preguntar por id de Misionero era el bug: la fila
   * de una pareja lleva un id de `matrimonio`, no coincidía con nada y la celda
   * decía «Ninguna» con la imagen en la casa (ADR 0010).
   *
   * La clave del mapa es `valorDeTenedor` y no el id pelado: un id de persona y
   * uno de pareja viven en tablas distintas, y una colisión pondría la imagen de
   * una casa en la fila de otra.
   *
   * Una consulta para la página entera y no una por fila: veinte filas serían
   * veinte viajes, y es la misma pregunta hecha veinte veces.
   *
   * Una imagen movida a otra Diócesis sigue estando en la casa de quien la tiene,
   * así que se nombra igual: decir «Ninguna» sería mentir en la dirección cómoda.
   */
  static async tenenciasDeTenedores(
    actor: CurrentUser,
    tenedores: Tenedor[]
  ): Promise<TenenciaDeTenedorDTO[]> {
    const filas = await AsignacionRepository.findAbiertasDeTenedores(tenedores);

    const porTenedor = new Map<string, TenenciaDeTenedorDTO>();
    for (const t of tenedores) {
      porTenedor.set(valorDeTenedor(t), {
        tenedor: t,
        peregrinas: [],
      });
    }

    for (const fila of filas) {
      // Existe siempre: el repositorio sólo devuelve filas de los Tenedores
      // pedidos.
      const tenencia = porTenedor.get(valorDeTenedor(fila.tenedor));
      if (!tenencia) continue;

      tenencia.peregrinas.push({
        id: fila.peregrinaId,
        identificacion: fila.peregrinaIdentificacion,
      });
    }

    return [...porTenedor.values()];
  }

  /** Peregrinas nobody has ever had charge of — user story 19. */
  static async listarNuncaAsignadas(
    actor: CurrentUser
  ): Promise<{ id: string; identificacion: string }[]> {
    void actor;
    return AsignacionRepository.findPeregrinasNuncaAsignadas();
  }

  /**
   * Tenedores with their hands free — user story 5 of the tablero.
   *
   * Antes se llamaba `listarMisionerosSinPeregrina`, y el nombre había pasado a
   * mentir: lo que contesta son las filas del listado, que son Tenedores, y una
   * pareja es una de ellas y cuenta una vez (ADR 0010). Un nombre que sigue
   * compilando mientras contesta otra pregunta es exactamente el modo de falla de
   * este cambio.
   *
   * Filtered by the *holder's* territory rather than by an image's, which is what
   * the question means: "who here could take one". A couple's territory is spouse
   * A's. The repository ignores the image's territory when deciding whether
   * somebody is free, so a Tenedor holding a Peregrina that has since moved
   * Diócesis is not offered.
   */
  static async listarTenedoresSinPeregrina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales = {}
  ): Promise<TenedorResueltoDTO[]> {
    return AsignacionRepository.findTenedoresSinPeregrina(filtros);
  }

  /**
   * Tenedores holding at least one image — the other half of the listado's
   * tenencia filter.
   *
   * Same territory rule as its twin above, and the same reason: the question is
   * about the holders of a territory, so it is their own Diócesis that filters
   * it. An image that has since moved elsewhere still counts as held.
   */
  static async listarTenedoresConPeregrina(
    actor: CurrentUser,
    filtros: FiltrosTerritoriales = {}
  ): Promise<TenedorResueltoDTO[]> {
    return AsignacionRepository.findTenedoresConPeregrina(filtros);
  }

  /**
   * Images that have not changed hands in `dias` days — user story 8.
   *
   * The threshold is the caller's, because nobody in the Campaña has drawn the
   * line yet: `diasEnCargo` has always returned the interval and left the verdict
   * to the screen.
   */
  static async listarEstancadas(
    actor: CurrentUser,
    dias: number,
    filtros: FiltrosTerritoriales = {}
  ) {
    return AsignacionRepository.findPeregrinasEstancadas(dias, filtros);
  }

  // `dashboardStats` is gone. Tenencia is counted off the Peregrina's own
  // denormalised pointer in `TableroService`, which is one query instead of two
  // and the same number the listado's `tenencia` filter returns.

  // ── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Gives a Peregrina nobody currently has to a Misionero — user stories 1 and 8.
   *
   * Refused if somebody already has it, rather than quietly closing their period.
   * Somebody who did not know the image was out needs to be told, not obeyed —
   * and being told *who* has it is the point: it turns a refusal into the next
   * phone call.
   */
  static async asignar(
    actor: CurrentUser,
    input: AsignarInput
  ): Promise<AsignacionDTO> {
    const operacion = "AsignacionService.asignar";

    const peregrina = await AsignacionService.exigirPeregrina(input.peregrinaId);
    exigirModalidad(actor, peregrina.peregrina.modalidad, operacion);

    const tenedor = await AsignacionService.exigirTenedor(input.tenedor);
    AsignacionService.exigirTenedorActivo(tenedor);
    await AsignacionService.exigirQueNoEsteCasado(input.tenedor);

    const abierta = await AsignacionRepository.findAbiertaDePeregrina(input.peregrinaId);
    if (abierta) {
      throw new ConflictoError(
        `La Peregrina ${identificacionDe(peregrina.peregrina)} ya está a cargo de ` +
          `${nombreDeTenedor(abierta.tenedor)}. ` +
          "Si pasó a otra persona, usá «Pasar a otro Misionero» en lugar de asignarla de nuevo."
      );
    }

    return AsignacionService.abrirTraduciendoElConflicto(
      {
        peregrinaId: input.peregrinaId,
        tenedor: input.tenedor,
        registradaPorId: actor.id,
        notaApertura: input.nota ?? null,
      },
      identificacionDe(peregrina.peregrina)
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

    const peregrina = await AsignacionService.exigirPeregrina(input.peregrinaId);
    exigirModalidad(actor, peregrina.peregrina.modalidad, operacion);

    const tenedor = await AsignacionService.exigirTenedor(input.tenedor);
    AsignacionService.exigirTenedorActivo(tenedor);
    await AsignacionService.exigirQueNoEsteCasado(input.tenedor);

    const actual = await AsignacionRepository.findAbiertaDePeregrina(input.peregrinaId);
    if (!actual) {
      throw new ConflictoError(
        `La Peregrina ${identificacionDe(peregrina.peregrina)} no está a cargo de nadie, ` +
          "así que no hay a quién pasársela. Usá «Asignar» directamente."
      );
    }
    // Los dos campos, porque un id de Misionero y uno de Matrimonio son dos
    // espacios de ids distintos: comparar sólo el id haría de una persona y una
    // pareja «el mismo Tenedor» si alguna vez colisionaran.
    if (
      actual.tenedor.tipo === input.tenedor.tipo &&
      actual.tenedor.id === input.tenedor.id
    ) {
      throw new ValidacionError(
        `La Peregrina ${identificacionDe(peregrina.peregrina)} ya está a cargo de ` +
          `${nombreDeTenedor(actual.tenedor)}.`
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
          tenedor: input.tenedor,
          abiertaAt: ahora,
          registradaPorId: actor.id,
          notaApertura: input.nota ?? null,
        }
      );
    } catch (error) {
      throw AsignacionService.traducirConflicto(
        error,
        identificacionDe(peregrina.peregrina)
      );
    }

    if (!ids) {
      // The `cerrada_at is null` predicate found nothing to claim, which means
      // somebody else registered a move between the read above and this write.
      throw new ConflictoError(
        `Otra persona registró un movimiento de la Peregrina ${identificacionDe(peregrina.peregrina)} ` +
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

    const peregrina = await AsignacionService.exigirPeregrina(input.peregrinaId);
    exigirModalidad(actor, peregrina.peregrina.modalidad, operacion);

    const cerrada = await AsignacionRepository.cerrar(input.peregrinaId, {
      cerradaAt: new Date(),
      cerradaPorId: actor.id,
      notaCierre: input.notaCierre ?? null,
    });

    if (!cerrada) {
      throw new ConflictoError(
        `La Peregrina ${identificacionDe(peregrina.peregrina)} no está a cargo de nadie, ` +
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

    const actual = await AsignacionService.exigirAsignacion(input.asignacionId);
    const peregrina = await AsignacionService.exigirPeregrina(actual.asignacion.peregrinaId);
    exigirModalidad(actor, peregrina.peregrina.modalidad, operacion);

    const seguiraAbierta =
      input.cerradaAt !== undefined
        ? false
        : actual.asignacion.cerradaAt === null;

    if (input.tenedor !== undefined) {
      const tenedor = await AsignacionService.exigirTenedor(input.tenedor);
      // A closed period may perfectly well name somebody who has since left the
      // Campaña — that is what history is. An open one may not: they would be
      // holding an image while being absent from every active list.
      if (seguiraAbierta) {
        AsignacionService.exigirTenedorActivo(tenedor);
        // Y tampoco por acá se cuela una imagen a nombre de un solo cónyuge:
        // corregir un período abierto es decir quién la tiene ahora.
        await AsignacionService.exigirQueNoEsteCasado(input.tenedor);
      }
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
          ...(input.tenedor !== undefined && { tenedor: input.tenedor }),
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
      throw AsignacionService.traducirConflicto(error, actual.peregrinaIdentificacion);
    }
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private static async exigirAsignacion(
    id: string
  ): Promise<AsignacionCompleta> {
    const row = await AsignacionRepository.findById(id);
    if (!row) throw new NoEncontradoError("No existe esa Asignación.");
    return row;
  }

  private static async abrirTraduciendoElConflicto(
    data: Parameters<typeof AsignacionRepository.abrir>[0],
    identificacion: string
  ): Promise<AsignacionDTO> {
    try {
      return AsignacionService.toDTO(await AsignacionRepository.abrir(data));
    } catch (error) {
      throw AsignacionService.traducirConflicto(error, identificacion);
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
  private static traducirConflicto(error: unknown, identificacion: string): unknown {
    if (esSegundaAsignacionAbierta(error)) {
      return new ConflictoError(
        `Otra persona acaba de registrar quién tiene la Peregrina ${identificacion}. ` +
          "Mirá el historial y volvé a intentarlo si hace falta."
      );
    }
    return error;
  }
}
