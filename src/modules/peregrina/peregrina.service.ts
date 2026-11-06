import {
  PeregrinaRepository,
  codigoRepetidoEn,
  type PeregrinaConTerritorio,
} from "./peregrina.repository";
import {
  componerCodigo,
  identificacionDe,
  type PeregrinaDTO,
  type CreatePeregrinaInput,
  type UpdatePeregrinaInput,
  type FiltrosDeInventario,
} from "./peregrina.types";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad, PeregrinaEstado } from "./peregrina.schema";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { mapearDiocesisLocalidad } from "@/modules/territorio/territorio.reference";
import type { Region } from "@/modules/territorio/territorio.schema";
import {
  cargaLaModalidad,
  exigirModalidad,
  modalidadPropia,
} from "@/lib/authorization/capacidades";
import {
  ConflictoError,
  NoEncontradoError,
  ValidacionError,
} from "@/lib/errors";
import {
  armarPagina,
  cantidadDePaginas,
  paginaExistente,
  rango,
  type Pagina,
} from "@/lib/paginacion";

/**
 * PeregrinaService
 *
 * Responsibility: business logic for peregrina entities.
 *
 * Every method takes the Actor first — ADR 0001. Every rol reads the whole
 * country (ADR 0016); what the Actor's rol bounds is which Modalidades it may
 * write, and `exigirModalidad` checks that on every write.
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
      identificacion: identificacionDe(row.peregrina),
      codigo: row.peregrina.codigo,
      numeracionAnterior: row.peregrina.numeracionAnterior,
      codigoNum: row.peregrina.codigoNum,
      fechaConsagracion: row.peregrina.fechaConsagracion,
      tipo: row.peregrina.tipo,
      estado: row.peregrina.estado,
      modalidad: row.peregrina.modalidad,
      diocesisLocalidad,
      provincia: diocesisLocalidad.provincia.nombre,
      region: diocesisLocalidad.region,
      tenenciaActual: row.tenedorActual,
      createdById: row.peregrina.createdById,
      createdAt: row.peregrina.createdAt,
      updatedAt: row.peregrina.updatedAt,
    };
  }

  /** The row, or a refusal that says it does not exist. */
  private static async exigirExistente(
    id: string
  ): Promise<PeregrinaConTerritorio> {
    const row = await PeregrinaRepository.findById(id);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");
    return row;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  static async listAll(actor: CurrentUser): Promise<PeregrinaDTO[]> {
    void actor;
    const rows = await PeregrinaRepository.findAll();
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The images this Actor may hand to somebody — every picker that ends in an
   * entrega. Not `listAll`: a Dirigente Joven sees every image but loads only
   * JOV ones (ADR 0016), and an option that always ends in a refusal is a worse
   * bug than the refusal.
   */
  static async listParaEntregar(actor: CurrentUser): Promise<PeregrinaDTO[]> {
    const propia = modalidadPropia(actor.role);
    const rows = propia
      ? await PeregrinaRepository.findByModalidad(propia)
      : await PeregrinaRepository.findAll();
    return rows.map(PeregrinaService.toDTO);
  }

  static async getById(
    actor: CurrentUser,
    id: string
  ): Promise<PeregrinaDTO> {
    const row = await PeregrinaService.exigirExistente(id);
    return PeregrinaService.toDTO(row);
  }

  static async listByEstado(
    actor: CurrentUser,
    estado: PeregrinaEstado
  ): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByEstado(estado);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The listado, filtered — the read behind every list screen and behind every
   * figure the tablero links to.
   *
   * The filters are applied in the database rather than narrowed in memory
   * afterwards, so the rows behind a count are found by the same predicate that
   * produced the count. That is what makes a figure and the list it leads to
   * agree, and the previous arrangement — ask for the narrowest indexed
   * question, filter the rest in the page — could not promise it.
   */
  static async listFiltradas(
    actor: CurrentUser,
    filtros: FiltrosDeInventario
  ): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findFiltradas(filtros);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The listado, filtered and cut into pages — story 23 of the interface issue.
   *
   * The total comes from the aggregate and not from `filas.length`: a count of the
   * rows that happened to be fetched is a count of the page size, which is the
   * mistake the previous dashboard was built on. Same filters, two
   * queries — so the total and the rows can never describe different sets.
   *
   * The page is clamped against the total rather than trusted, and clamped here
   * because this is the only layer that knows how many pages exist. Asking for
   * page nine of three returns page three; returning nothing would read as an
   * empty Diócesis to whoever followed the stale link.
   *
   * `listFiltradas` above stays and is not a duplicate of this: it is the read for
   * a caller that wants every matching row — a picker, a test — and a screen that
   * asked it for a page would be paginating in memory.
   */
  static async listPagina(
    actor: CurrentUser,
    filtros: FiltrosDeInventario,
    pagina = 1
  ): Promise<Pagina<PeregrinaDTO>> {
    const total = await PeregrinaRepository.contarTotal(filtros);
    const actual = paginaExistente(pagina, cantidadDePaginas(total));

    const rows = await PeregrinaRepository.findFiltradas(
      filtros,
      rango(actual)
    );

    return armarPagina(rows.map(PeregrinaService.toDTO), total, actual);
  }

  /** Every Peregrina in a Región. */
  static async listByRegion(
    actor: CurrentUser,
    region: Region
  ): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByRegion(region);
    return rows.map(PeregrinaService.toDTO);
  }

  /**
   * The images nobody currently has — the second step of the assignment flow.
   *
   * Read off the denormalised pointer, which is what it is for: the alternative
   * is an anti-join against Asignación on every keystroke of a picker.
   *
   * Only the Modalidades this Actor loads, because the step after it is an
   * entrega (ADR 0016).
   */
  static async listDisponibles(actor: CurrentUser): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findDisponibles();
    return rows
      .filter((r) => cargaLaModalidad(actor.role, r.peregrina.modalidad))
      .map(PeregrinaService.toDTO);
  }

  static async listByModalidad(
    actor: CurrentUser,
    modalidad: Modalidad
  ): Promise<PeregrinaDTO[]> {
    const rows = await PeregrinaRepository.findByModalidad(modalidad);
    return rows.map(PeregrinaService.toDTO);
  }

  // The dashboard counts used to live here, derived from two ad-hoc aggregates
  // with no filters. They are `TableroService.resumen` now — one seam, one set of
  // filters, and figures that agree with the lists they link to.

  // ── Writes ─────────────────────────────────────────────────────────────────

  static async create(
    actor: CurrentUser,
    input: CreatePeregrinaInput
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.create";

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

    exigirModalidad(actor, input.modalidad, operacion);

    // Three ways in. A typed número makes the Código from it — ADR 0013. An
    // image that already carries a Numeración anterior and no número is
    // registered by it, and no número is spent: a Código nobody wrote on the
    // image identifies nothing (ADR 0012). Neither: the next free número.
    const codigo =
      input.numero !== undefined
        ? await PeregrinaService.codigoEscrito(
            territorio.provincia,
            input.modalidad,
            input.numero
          )
        : input.numeracionAnterior !== undefined
          ? {}
          : await PeregrinaService.codigoNuevo(
              territorio.provincia,
              input.modalidad
            );

    const row = await PeregrinaService.conCodigoUnico(() =>
      PeregrinaRepository.create({
        ...codigo,
        ...(input.numeracionAnterior !== undefined && {
          numeracionAnterior: input.numeracionAnterior,
        }),
        fechaConsagracion: input.fechaConsagracion ?? null,
        tipo: input.tipo,
        estado: "activa",
        modalidad: input.modalidad,
        diocesisLocalidadId: territorio.diocesis.id,
        createdById: actor.id,
      })
    );

    return PeregrinaService.toDTO(row);
  }

  /**
   * Gives a Código to an image that only had its Numeración anterior — ADR 0012.
   *
   * From the image's territory and Modalidad *now*, not when it was registered:
   * the Código is about to be written on it, so it describes where it is. The
   * Numeración anterior stays on the record, and from here on the Código is the
   * image's Identificación.
   *
   * Refused on one that already has a Código, which is never regenerated.
   */
  static async generarCodigo(
    actor: CurrentUser,
    id: string,
    numero?: number
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.generarCodigo";

    const actual = await PeregrinaService.exigirExistente(id);
    exigirModalidad(actor, actual.peregrina.modalidad, operacion);
    if (actual.peregrina.codigo !== null) {
      throw new ConflictoError(
        `Esa Peregrina ya tiene el Código ${actual.peregrina.codigo}.`
      );
    }

    // A número typed by whoever is holding the image, or the next free one.
    const { codigo, codigoNum } =
      numero !== undefined
        ? await PeregrinaService.codigoEscrito(
            actual.provincia,
            actual.peregrina.modalidad,
            numero
          )
        : await PeregrinaService.codigoNuevo(
            actual.provincia,
            actual.peregrina.modalidad
          );
    const row = await PeregrinaService.conCodigoUnico(() =>
      PeregrinaRepository.ponerCodigo(id, codigo, codigoNum)
    );
    if (!row) {
      throw new ConflictoError(
        "Otra persona acaba de generarle un Código a esa Peregrina."
      );
    }

    return PeregrinaService.leerUna(id);
  }

  /** The next Código for a Provincia and Modalidad, with the número it spends. */
  private static async codigoNuevo(
    provincia: { id: string; abreviatura: string },
    modalidad: Modalidad
  ): Promise<{ codigo: string; codigoNum: number }> {
    const num = await PeregrinaRepository.nextCodigoNum(provincia.id, modalidad);
    return {
      codigo: componerCodigo(provincia.abreviatura, modalidad, num),
      codigoNum: num,
    };
  }

  /**
   * The Código a typed número makes, refused if some image already carries it
   * — the one check ADR 0013 asks for. Not that it follows the previous one:
   * images were numbered by hand for years, and gaps are real.
   *
   * Every image counts, the extraviadas and other territories' included,
   * because the unique index does and because a Código written on a lost
   * statue is still written on it.
   */
  private static async codigoEscrito(
    provincia: { abreviatura: string },
    modalidad: Modalidad,
    numero: number,
    exceptoId?: string
  ): Promise<{ codigo: string; codigoNum: number }> {
    const codigo = componerCodigo(provincia.abreviatura, modalidad, numero);
    if (await PeregrinaRepository.existeCodigo(codigo, exceptoId)) {
      throw new ConflictoError(PeregrinaService.codigoRepetido(codigo));
    }
    return { codigo, codigoNum: numero };
  }

  private static codigoRepetido(codigo: string): string {
    return (
      `Ya hay una Peregrina con el Código ${codigo}. Revisá el número, o ` +
      "buscala por su Código en Peregrinas."
    );
  }

  /**
   * A write that sets a Código, with the unique index's refusal turned into the
   * same sentence the check above gives. The check and the write are two
   * statements, and two people can type the same número between them.
   */
  private static async conCodigoUnico<T>(escribir: () => Promise<T>): Promise<T> {
    try {
      return await escribir();
    } catch (error) {
      const codigo = codigoRepetidoEn(error);
      if (codigo !== null) {
        throw new ConflictoError(PeregrinaService.codigoRepetido(codigo));
      }
      throw error;
    }
  }

  static async update(
    actor: CurrentUser,
    id: string,
    input: UpdatePeregrinaInput
  ): Promise<PeregrinaDTO> {
    const operacion = "PeregrinaService.update";

    const actual = await PeregrinaService.exigirExistente(id);

    // Both ends: the Modalidad the image has, and the one it is being given
    // (ADR 0016).
    exigirModalidad(actor, actual.peregrina.modalidad, operacion);
    if (input.modalidad !== undefined) {
      exigirModalidad(actor, input.modalidad, operacion);
    }

    let provincia = actual.provincia;
    if (input.diocesisLocalidadId !== undefined) {
      const territorio = await TerritorioRepository.findDiocesisLocalidadById(
        input.diocesisLocalidadId
      );
      if (!territorio) {
        throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
      }
      provincia = territorio.provincia;
    }

    // The Código is not recomposed when the territory or the Modalidad change.
    // It is written on the image; the system follows reality, not the other way
    // around. Only a número typed in the edit composes a new one, from the
    // Provincia and Modalidad the image ends up with — ADR 0013.
    const modalidad = input.modalidad ?? actual.peregrina.modalidad;
    const codigo =
      input.numero === undefined
        ? {}
        : input.numero === null
          ? { codigo: null, codigoNum: null }
          : await PeregrinaService.codigoEscrito(
              provincia,
              modalidad,
              input.numero,
              id
            );

    const numeracionAnterior =
      input.numeracionAnterior !== undefined
        ? input.numeracionAnterior
        : actual.peregrina.numeracionAnterior;
    const quedaCodigo =
      "codigo" in codigo ? codigo.codigo : actual.peregrina.codigo;
    if (quedaCodigo === null && numeracionAnterior === null) {
      throw new ValidacionError(
        "La imagen tiene que quedar con un Código o con su numeración anterior."
      );
    }

    const row = await PeregrinaService.conCodigoUnico(() =>
      PeregrinaRepository.update(id, {
      ...codigo,
      ...(input.numeracionAnterior !== undefined && {
        numeracionAnterior: input.numeracionAnterior,
      }),
      ...(input.fechaConsagracion !== undefined && {
        fechaConsagracion: input.fechaConsagracion ?? null,
      }),
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.estado !== undefined && { estado: input.estado }),
      ...(input.modalidad !== undefined && { modalidad: input.modalidad }),
      ...(input.diocesisLocalidadId !== undefined && {
        diocesisLocalidadId: input.diocesisLocalidadId,
      }),
      })
    );

    return PeregrinaService.toDTO(row);
  }

  /**
   * Borrar: the Peregrina stops existing, with its whole historial — ADR 0014.
   * Allowed even for an image that was or is in somebody's charge; the Campaña
   * wants only to be warned, and the warning is the screen's. This does what
   * was confirmed.
   *
   * What it costs is real: every Misionero who had the image loses that period
   * from their own page, because there is no longer a Código for it to resolve
   * to. An image that is only lost is not borrada — its Estado is Extraviada.
   */
  static async borrar(actor: CurrentUser, id: string): Promise<void> {
    const operacion = "PeregrinaService.borrar";

    const actual = await PeregrinaService.exigirExistente(id);
    exigirModalidad(actor, actual.peregrina.modalidad, operacion);

    if (!(await PeregrinaRepository.borrar(id))) {
      throw new NoEncontradoError("No existe esa Peregrina.");
    }
  }

  /** Reads a row back after a write, by primary key. */
  private static async leerUna(id: string): Promise<PeregrinaDTO> {
    const row = await PeregrinaRepository.findById(id);
    if (!row) throw new NoEncontradoError("No existe esa Peregrina.");
    return PeregrinaService.toDTO(row);
  }
}
