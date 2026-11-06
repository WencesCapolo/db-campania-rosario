import type { CurrentUser } from "@/modules/user/user.types";
import {
  PeregrinaRepository,
  codigoRepetidoEn,
  type PeregrinaConTerritorio,
} from "@/modules/peregrina/peregrina.repository";
import {
  ESTADO_LABELS,
  MODALIDAD_LABELS,
  MODALIDADES,
  TIPO_LABELS,
  componerCodigo,
  createPeregrinaSchema,
  identificacionDe,
  type CreatePeregrinaInput,
  type FiltrosDeInventario,
} from "@/modules/peregrina/peregrina.types";
import {
  peregrinaTipoEnum,
  type Modalidad,
  type PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import { mapearMatrimonio, mapearMisionero } from "@/modules/misionero/misionero.mapper";
import {
  CENTRO_LABELS,
  CENTRO_TIPOS,
  createMisioneroSchema,
  type CreateMisioneroInput,
  type MisioneroDTO,
} from "@/modules/misionero/misionero.types";
import type { CentroTipo } from "@/modules/misionero/misionero.schema";
import { valorDeTenedor, type Tenedor } from "@/modules/misionero/matrimonio.types";
import {
  AsignacionRepository,
  esSegundaAsignacionAbierta,
} from "@/modules/asignacion/asignacion.repository";
import { TerritorioRepository } from "@/modules/territorio/territorio.repository";
import { normalizarNombre } from "@/modules/territorio/territorio.reference";
import {
  cargaLaModalidad,
  exigirModalidad,
  modalidadPropia,
} from "@/lib/authorization/capacidades";
import { ConflictoError, ValidacionError } from "@/lib/errors";
import { nombreCompleto, nombreDeTenedor, nombreEnLista } from "@/lib/formato";
import {
  celdaDeFecha,
  claveDeTitulo,
  escribirLibro,
  leerHoja,
  type ColumnaDeSalida,
  type FilaLeida,
  type HojaDeSalida,
  type ValorLeido,
} from "./planilla.libro";
import { PlanillaRepository, type CargaDePlanilla } from "./planilla.repository";
import {
  COLUMNAS,
  COLUMNAS_DE_IMAGEN_NUEVA,
  COLUMNAS_OBLIGATORIAS,
  HOJA_DE_MISIONEROS,
  MAXIMO_DE_BYTES,
  MAXIMO_DE_FILAS,
  type ColumnaDeImportacion,
  type FilaRevisadaDTO,
  type FiltrosDeMisionerosParaExportar,
  type RevisionDTO,
  type TotalesDeCargaDTO,
} from "./planilla.types";

/**
 * PlanillaService — ADR 0017.
 *
 * Downstream of every other module, like `tablero`, and for the same reason: it
 * composes their repositories — Misionero, Peregrina, Asignación and the
 * territory — and nothing imports it.
 *
 * Every method takes the Actor first (ADR 0001). The downloads are reads, so
 * every rol has them. The import is three kinds of write, and each is held to
 * exactly what the same write by hand is held to: the same Zod schemas, the
 * same `exigirModalidad`, the same guards `asignar` applies.
 */
export class PlanillaService {
  // ── Descargas ──────────────────────────────────────────────────────────────

  /** El listado de Peregrinas con sus filtros, entero, como planilla. */
  static async peregrinas(
    actor: CurrentUser,
    filtros: FiltrosDeInventario
  ): Promise<Buffer> {
    void actor;
    const filas = await PeregrinaRepository.findFiltradas(filtros);

    const columnas: ColumnaDeSalida[] = [
      { titulo: "Identificación", ancho: 18 },
      { titulo: "Código", ancho: 16 },
      { titulo: "Numeración anterior", ancho: 20 },
      { titulo: "Modalidad", ancho: 10 },
      { titulo: "Nombre de la Modalidad", ancho: 30 },
      { titulo: "Tipo", ancho: 12 },
      { titulo: "Estado", ancho: 20 },
      { titulo: "¿Quién la tiene?", ancho: 32 },
      { titulo: "Diócesis/Localidad", ancho: 26 },
      { titulo: "Provincia", ancho: 20 },
      { titulo: "Región", ancho: 10 },
      { titulo: "Fecha de consagración", ancho: 14, fecha: true },
      { titulo: "Registrada el", ancho: 14, fecha: true },
    ];

    return escribirLibro([
      {
        nombre: "Peregrinas",
        columnas,
        filas: filas.map((f) => [
          identificacionDe(f.peregrina),
          f.peregrina.codigo,
          f.peregrina.numeracionAnterior,
          f.peregrina.modalidad,
          MODALIDAD_LABELS[f.peregrina.modalidad],
          TIPO_LABELS[f.peregrina.tipo],
          ESTADO_LABELS[f.peregrina.estado],
          f.tenedorActual ? nombreDeTenedor(f.tenedorActual) : "Nadie",
          f.diocesis.nombre,
          f.provincia.nombre,
          f.diocesis.region,
          celdaDeFecha(f.peregrina.fechaConsagracion),
          celdaDeFecha(diaEnArgentina(f.peregrina.createdAt)),
        ]),
      },
    ]);
  }

  /**
   * El listado de Misioneros con sus filtros, entero, como planilla.
   *
   * Una fila por **persona** y no por Tenedor: una planilla se ordena por
   * apellido, y un matrimonio en una celda no se ordena. Los dos cónyuges dicen
   * con quién están casados y llevan las imágenes de la casa.
   */
  static async misioneros(
    actor: CurrentUser,
    filtros: FiltrosDeMisionerosParaExportar
  ): Promise<Buffer> {
    void actor;
    const { imagen, ...delRoster } = filtros;
    let roster = await MisioneroRepository.findFiltrados(delRoster);

    // El filtro de tenencia, como lo hace el listado: la intersección con los
    // Tenedores que tienen —o no— alguna imagen, sin mirar dónde está la imagen.
    if (imagen) {
      const conOSin =
        imagen === "sin"
          ? await AsignacionRepository.findTenedoresSinPeregrina()
          : await AsignacionRepository.findTenedoresConPeregrina();
      const claves = new Set(conOSin.map((t) => valorDeTenedor(t)));
      roster = roster.filter((f) =>
        claves.has(
          valorDeTenedor(
            f.tipo === "persona"
              ? { tipo: "persona", id: f.persona.misionero.id }
              : { tipo: "matrimonio", id: f.matrimonio.matrimonio.id }
          )
        )
      );
    }

    const tenedores: Tenedor[] = roster.map((f) =>
      f.tipo === "persona"
        ? { tipo: "persona", id: f.persona.misionero.id }
        : { tipo: "matrimonio", id: f.matrimonio.matrimonio.id }
    );
    const imagenes = new Map<string, string[]>();
    for (const t of await AsignacionRepository.findAbiertasDeTenedores(tenedores)) {
      const clave = valorDeTenedor(t.tenedor);
      imagenes.set(clave, [...(imagenes.get(clave) ?? []), t.peregrinaIdentificacion]);
    }

    const fila = (
      p: MisioneroDTO,
      tenedor: Tenedor,
      conyuge: MisioneroDTO | null,
      centro: { tipo: CentroTipo | null; nombre: string | null }
    ) => [
      p.apellido,
      p.nombre,
      p.telefono,
      p.email,
      p.diocesisLocalidad.nombre,
      p.provincia,
      p.region,
      centro.tipo ? CENTRO_LABELS[centro.tipo] : null,
      centro.nombre,
      celdaDeFecha(p.fechaConsagracion),
      conyuge ? nombreCompleto(conyuge) : null,
      (imagenes.get(valorDeTenedor(tenedor)) ?? []).join(", ") || null,
      celdaDeFecha(diaEnArgentina(p.createdAt)),
    ];

    const filas = roster.flatMap((f) => {
      if (f.tipo === "persona") {
        const p = mapearMisionero(f.persona);
        return [
          fila(p, { tipo: "persona", id: p.id }, null, {
            tipo: p.centroTipo,
            nombre: p.centroNombre,
          }),
        ];
      }
      const m = mapearMatrimonio(f.matrimonio);
      const casa: Tenedor = { tipo: "matrimonio", id: m.id };
      const centro = { tipo: m.centroTipo, nombre: m.centroNombre };
      return [
        fila(m.misioneroA, casa, m.misioneroB, centro),
        fila(m.misioneroB, casa, m.misioneroA, centro),
      ];
    });

    return escribirLibro([
      {
        nombre: "Misioneros",
        columnas: [
          { titulo: "Apellido", ancho: 20 },
          { titulo: "Nombre", ancho: 20 },
          { titulo: "Teléfono", ancho: 18 },
          { titulo: "Email", ancho: 30 },
          { titulo: "Diócesis/Localidad", ancho: 26 },
          { titulo: "Provincia", ancho: 20 },
          { titulo: "Región", ancho: 10 },
          { titulo: "Tipo de Centro", ancho: 14 },
          { titulo: "Nombre del Centro", ancho: 28 },
          { titulo: "Fecha de consagración", ancho: 14, fecha: true },
          { titulo: "Matrimonio con", ancho: 26 },
          { titulo: "Imágenes a cargo", ancho: 30 },
          { titulo: "Cargado el", ancho: 14, fecha: true },
        ],
        filas,
      },
    ]);
  }

  /**
   * La plantilla para importar, armada para este Actor: los desplegables salen
   * de la base y de los enums, y el de Modalidad trae sólo las que el Actor
   * carga — un Dirigente Joven ve una sola opción, porque cualquier otra
   * terminaría en un error al revisar.
   */
  static async plantilla(actor: CurrentUser): Promise<Buffer> {
    const territorios = await TerritorioRepository.findDiocesisLocalidades();
    const modalidades = MODALIDADES.filter((m) => cargaLaModalidad(actor.role, m));

    const listas = {
      diocesis: territorios.map((t) => etiquetaDeTerritorio(t.diocesis.nombre, t.provincia.nombre)),
      modalidades: modalidades.map(etiquetaDeModalidad),
      tipos: peregrinaTipoEnum.enumValues.map((t) => TIPO_LABELS[t]),
      centros: CENTRO_TIPOS.map((c) => CENTRO_LABELS[c]),
    };
    const rango = (columna: string, n: number) =>
      `Listas!$${columna}$1:$${columna}$${Math.max(n, 1)}`;

    const propia = modalidadPropia(actor.role);

    const misioneros: HojaDeSalida = {
      nombre: HOJA_DE_MISIONEROS,
      filasParaLlenar: MAXIMO_DE_FILAS,
      filas: [],
      columnas: [
        { titulo: COLUMNAS.nombre, ancho: 18, obligatoria: true },
        { titulo: COLUMNAS.apellido, ancho: 18, obligatoria: true },
        { titulo: COLUMNAS.telefono, ancho: 16 },
        { titulo: COLUMNAS.email, ancho: 26 },
        {
          titulo: COLUMNAS.diocesis,
          ancho: 34,
          obligatoria: true,
          lista: rango("A", listas.diocesis.length),
          ayuda: "Elegila de la lista. Una imagen nueva de la fila queda en la misma.",
        },
        { titulo: COLUMNAS.centroTipo, ancho: 14, lista: rango("D", listas.centros.length) },
        { titulo: COLUMNAS.centroNombre, ancho: 24 },
        {
          titulo: COLUMNAS.fechaConsagracion,
          ancho: 16,
          fecha: true,
          ayuda: "Del Misionero. Día, mes y año: 15/08/1998.",
        },
        {
          titulo: COLUMNAS.codigo,
          ancho: 22,
          ayuda:
            "Si la imagen ya está en el sistema y no la tiene nadie: su Código, " +
            "como «CBA JOV 0012». Se le entrega a este Misionero. Si la imagen es " +
            "nueva, dejá esta vacía y llená las de la imagen nueva.",
        },
        {
          titulo: COLUMNAS.modalidad,
          ancho: 30,
          lista: rango("B", listas.modalidades.length),
          ayuda: propia
            ? `Tu usuario carga sólo imágenes de ${MODALIDAD_LABELS[propia]}.`
            : "Si la fila trae una imagen nueva, es obligatoria.",
        },
        {
          titulo: COLUMNAS.tipo,
          ancho: 14,
          lista: rango("C", listas.tipos.length),
          ayuda: "Si se deja vacío, es Peregrina.",
        },
        {
          titulo: COLUMNAS.numero,
          ancho: 14,
          ayuda:
            "El número que la imagen ya tiene escrito. Vacío: el sistema le da el " +
            "siguiente, salvo que escribas su numeración anterior.",
        },
        {
          titulo: COLUMNAS.numeracionAnterior,
          ancho: 22,
          ayuda:
            "Lo que la imagen tenía escrito antes del formato de la Campaña, tal " +
            "como se lee. Sin número, queda registrada así y sin Código.",
        },
        {
          titulo: COLUMNAS.fechaImagen,
          ancho: 18,
          fecha: true,
          ayuda: "De la imagen. Día, mes y año: 15/08/1998.",
        },
      ],
    };

    const comoLlenarla: HojaDeSalida = {
      nombre: "Cómo llenarla",
      columnas: [{ titulo: "Cómo llenar la planilla", ancho: 110 }],
      filas: [
        ["Una fila por Misionero nuevo, en la hoja «Misioneros». Nombre, Apellido y Diócesis/Localidad son obligatorios."],
        ["Si a la persona se le asigna una imagen que ya está en el sistema, escribí su Código. Si la imagen es nueva, llená las columnas «… de la imagen nueva»."],
        ["Si no se le asigna ninguna, dejá vacías todas las columnas de la imagen."],
        ["Los matrimonios se cargan como dos filas, una por persona, y se arman después en la plataforma."],
        ["Al subirla, el sistema revisa cada fila y dice qué corregir. Si alguna tiene un error no se carga ninguna: corregí la planilla y volvé a subirla."],
        [`Hasta ${MAXIMO_DE_FILAS} filas por planilla. Esta planilla sólo crea registros: no cambia los que ya existen.`],
      ],
    };

    // Una hoja por lista, en columnas, y oculta: los desplegables la leen.
    const largo = Math.max(...Object.values(listas).map((l) => l.length));
    const hojaDeListas: HojaDeSalida = {
      nombre: "Listas",
      oculta: true,
      columnas: ["A", "B", "C", "D"].map((titulo) => ({ titulo, ancho: 30 })),
      filas: [],
    };
    for (let i = 0; i < largo; i++) {
      hojaDeListas.filas.push([
        listas.diocesis[i] ?? null,
        listas.modalidades[i] ?? null,
        listas.tipos[i] ?? null,
        listas.centros[i] ?? null,
      ]);
    }

    return escribirLibro([misioneros, comoLlenarla, hojaDeListas]);
  }

  // ── Importar ───────────────────────────────────────────────────────────────

  /** Lee la planilla y dice, fila por fila, qué se cargaría y qué está mal. */
  static async revisar(actor: CurrentUser, archivo: Buffer): Promise<RevisionDTO> {
    return (await PlanillaService.planificar(actor, archivo)).revision;
  }

  /**
   * Carga la planilla — todo o nada.
   *
   * Se revisa otra vez, sobre el estado de la base de ahora y no el de cuando
   * se mostró la revisión: alguien pudo entregar una de esas imágenes en el
   * medio. Primero la Modalidad de cada imagen, con `exigirModalidad`, para que
   * una planilla fuera del rol sea una denegación registrada y no un error de
   * validación más. Después, si queda un solo error, no se escribe nada.
   */
  static async importar(
    actor: CurrentUser,
    archivo: Buffer
  ): Promise<TotalesDeCargaDTO> {
    const operacion = "PlanillaService.importar";
    const { revision, filas } = await PlanillaService.planificar(actor, archivo);

    for (const f of filas) {
      if (f.modalidad) exigirModalidad(actor, f.modalidad, operacion);
    }

    if (!revision.lista) {
      throw new ValidacionError(
        "La planilla tiene errores, así que no se cargó nada. Revisala de nuevo."
      );
    }

    const carga: CargaDePlanilla = { misioneros: [], peregrinas: [], aperturas: [] };
    const ahora = new Date();

    for (const f of filas) {
      if (!f.misionero) continue; // Inalcanzable con la revisión lista.
      const misioneroId = crypto.randomUUID();
      carga.misioneros.push({
        id: misioneroId,
        nombre: f.misionero.nombre,
        apellido: f.misionero.apellido,
        telefono: f.misionero.telefono ?? null,
        email: f.misionero.email ?? null,
        estado: "activo",
        diocesisLocalidadId: f.misionero.diocesisLocalidadId,
        centroTipo: f.misionero.centroTipo ?? null,
        centroNombre: f.misionero.centroNombre ?? null,
        fechaConsagracion: f.misionero.fechaConsagracion ?? null,
        resumenesAnuales: "{}",
        createdById: actor.id,
      });

      let peregrinaId: string | null = null;
      if (f.imagen?.tipo === "existente") peregrinaId = f.imagen.peregrinaId;
      if (f.imagen?.tipo === "nueva") {
        peregrinaId = crypto.randomUUID();
        const n = f.imagen.datos;
        carga.peregrinas.push({
          id: peregrinaId,
          ...(f.imagen.codigo && {
            codigo: f.imagen.codigo.codigo,
            codigoNum: f.imagen.codigo.numero,
          }),
          ...(n.numeracionAnterior !== undefined && {
            numeracionAnterior: n.numeracionAnterior,
          }),
          fechaConsagracion: n.fechaConsagracion ?? null,
          tipo: n.tipo,
          estado: "activa",
          modalidad: n.modalidad,
          diocesisLocalidadId: n.diocesisLocalidadId,
          createdById: actor.id,
        });
      }

      if (peregrinaId) {
        carga.aperturas.push({
          peregrinaId,
          tenedor: { tipo: "persona", id: misioneroId },
          abiertaAt: ahora,
          registradaPorId: actor.id,
          notaApertura: "Cargada desde una planilla.",
        });
      }
    }

    try {
      await PlanillaRepository.cargar(carga);
    } catch (error) {
      const codigo = codigoRepetidoEn(error);
      if (codigo !== null) {
        throw new ConflictoError(
          `Mientras tanto alguien registró una imagen con el Código ${codigo}. ` +
            "No se cargó nada: revisá la planilla de nuevo."
        );
      }
      if (esSegundaAsignacionAbierta(error)) {
        throw new ConflictoError(
          "Mientras tanto alguien entregó una de las imágenes de la planilla. " +
            "No se cargó nada: revisá la planilla de nuevo."
        );
      }
      throw error;
    }

    return revision.totales;
  }

  /**
   * La revisión, y lo que se escribiría si la revisión está lista. Una sola
   * función para las dos, así lo que se muestra y lo que se carga no pueden
   * contar historias distintas.
   */
  private static async planificar(
    actor: CurrentUser,
    archivo: Buffer
  ): Promise<{ revision: RevisionDTO; filas: FilaPlaneada[] }> {
    const vacia = (errores: string[]) => ({
      revision: {
        filas: [],
        errores,
        lista: false,
        totales: { misioneros: 0, imagenesNuevas: 0, entregas: 0 },
      },
      filas: [],
    });

    if (archivo.byteLength > MAXIMO_DE_BYTES) {
      return vacia([
        `El archivo pesa más de ${MAXIMO_DE_BYTES / 1024 / 1024} MB. ` +
          `Partilo en planillas de hasta ${MAXIMO_DE_FILAS} filas.`,
      ]);
    }

    const hoja = await leerHoja(archivo, HOJA_DE_MISIONEROS);

    const faltan = COLUMNAS_OBLIGATORIAS.filter(
      (c) => !hoja.titulos.includes(claveDeTitulo(COLUMNAS[c]))
    );
    if (faltan.length > 0) {
      return vacia([
        `Falta${faltan.length > 1 ? "n" : ""} la${faltan.length > 1 ? "s" : ""} ` +
          `columna${faltan.length > 1 ? "s" : ""} ` +
          faltan.map((c) => `«${COLUMNAS[c]}»`).join(", ") +
          ". Usá la plantilla que se descarga de esta pantalla: la primera fila " +
          "tiene que tener los títulos.",
      ]);
    }
    if (hoja.filas.length === 0) {
      return vacia(["La planilla no tiene ninguna fila con datos debajo de los títulos."]);
    }
    if (hoja.filas.length > MAXIMO_DE_FILAS) {
      return vacia([
        `La planilla tiene ${hoja.filas.length} filas, y el máximo es ` +
          `${MAXIMO_DE_FILAS}. Partila en varias.`,
      ]);
    }

    const territorios = new Resolutor(
      (await TerritorioRepository.findDiocesisLocalidades()).map((t) => ({
        id: t.diocesis.id,
        etiqueta: etiquetaDeTerritorio(t.diocesis.nombre, t.provincia.nombre),
        nombre: t.diocesis.nombre,
        provincia: { id: t.provincia.id, abreviatura: t.provincia.abreviatura },
      }))
    );

    // ── Cada fila por sí sola ──
    const filas = hoja.filas.map((f) => leerFila(f, territorios));

    // ── Contra la base y contra las otras filas ──
    await PlanillaService.revisarImagenes(actor, filas);
    await PlanillaService.avisarHomonimos(filas);

    const revision: RevisionDTO = {
      filas: filas.map(
        (f): FilaRevisadaDTO => ({
          numero: f.numero,
          misionero: f.nombreMostrado,
          imagen: f.imagenMostrada,
          errores: [...new Set(f.errores)],
          avisos: [...new Set(f.avisos)],
        })
      ),
      errores: [],
      lista: filas.every((f) => f.errores.length === 0),
      totales: {
        misioneros: filas.length,
        imagenesNuevas: filas.filter((f) => f.imagen?.tipo === "nueva").length,
        entregas: filas.filter((f) => f.imagen !== null).length,
      },
    };

    return { revision, filas };
  }

  /**
   * Las imágenes de la planilla, contra la base y entre sí: las guardas de
   * `AsignacionService.asignar` y de `PeregrinaService.create`, fila por fila.
   */
  private static async revisarImagenes(
    actor: CurrentUser,
    filas: FilaPlaneada[]
  ): Promise<void> {
    // Los Códigos que la planilla nombra: los de imágenes ya cargadas y los que
    // escribe a mano para las nuevas. Una sola lectura para todos.
    const escritos = filas.flatMap((f) =>
      f.imagen?.tipo === "existente"
        ? [f.imagen.codigoEscrito]
        : f.imagen?.tipo === "nueva" && f.imagen.codigo
          ? [f.imagen.codigo.codigo]
          : []
    );
    const enLaBase = new Map(
      (await PeregrinaRepository.findByCodigos([...new Set(escritos)])).map(
        (p): [string, PeregrinaConTerritorio] => [p.peregrina.codigo ?? "", p]
      )
    );

    // Un Código en dos filas es un error en las dos: no hay forma de saber
    // cuál de las dos personas se la lleva, ni cuál imagen nueva es la real.
    const filasPorCodigo = new Map<string, number[]>();
    for (const f of filas) {
      const c =
        f.imagen?.tipo === "existente"
          ? f.imagen.codigoEscrito
          : f.imagen?.tipo === "nueva"
            ? f.imagen.codigo?.codigo
            : undefined;
      if (c) filasPorCodigo.set(c, [...(filasPorCodigo.get(c) ?? []), f.numero]);
    }

    const negativaDelRol = (m: Modalidad) =>
      `Tu usuario carga sólo imágenes de ${MODALIDAD_LABELS[modalidadPropia(actor.role) ?? m]}, ` +
      `y esta es de ${MODALIDAD_LABELS[m]}.`;

    for (const f of filas) {
      const img = f.imagen;
      if (!img) continue;

      const codigo = img.tipo === "existente" ? img.codigoEscrito : img.codigo?.codigo;
      const repetida = codigo ? filasPorCodigo.get(codigo) ?? [] : [];
      if (codigo && repetida.length > 1) {
        f.errores.push(
          `El Código ${codigo} está en más de una fila (${repetida.join(", ")}).`
        );
      }

      if (img.tipo === "existente") {
        const encontrada = enLaBase.get(img.codigoEscrito);
        if (!encontrada) {
          f.errores.push(
            `No hay ninguna imagen con el Código ${img.codigoEscrito}. Si es nueva, ` +
              "dejá vacío el Código y llená las columnas de la imagen nueva."
          );
          continue;
        }
        img.peregrinaId = encontrada.peregrina.id;
        f.modalidad = encontrada.peregrina.modalidad;
        if (!cargaLaModalidad(actor.role, encontrada.peregrina.modalidad)) {
          f.errores.push(negativaDelRol(encontrada.peregrina.modalidad));
        }
        if (encontrada.tenedorActual) {
          f.errores.push(
            `La imagen ${img.codigoEscrito} ya la tiene ` +
              `${nombreDeTenedor(encontrada.tenedorActual)}. Para pasársela a ` +
              "otra persona, usá «Entregar una imagen» en la plataforma."
          );
        }
        continue;
      }

      f.modalidad = img.datos.modalidad;
      if (!cargaLaModalidad(actor.role, img.datos.modalidad)) {
        f.errores.push(negativaDelRol(img.datos.modalidad));
      }
      if (img.codigo && enLaBase.has(img.codigo.codigo)) {
        f.errores.push(
          `Ya hay una imagen con el Código ${img.codigo.codigo}. Revisá el número, ` +
            "o si es esa imagen, escribí su Código en la columna de imágenes ya cargadas."
        );
      }
    }

    // Las nuevas sin número ni numeración anterior: el siguiente número libre
    // de su Provincia y Modalidad, salteando los que la planilla escribe a mano.
    const pedidos = new Map<string, { provincia: { id: string; abreviatura: string }; modalidad: Modalidad; filas: FilaPlaneada[] }>();
    for (const f of filas) {
      if (f.imagen?.tipo !== "nueva" || !f.imagen.automatico) continue;
      const clave = `${f.imagen.provincia.id}:${f.imagen.datos.modalidad}`;
      const pedido = pedidos.get(clave) ?? {
        provincia: f.imagen.provincia,
        modalidad: f.imagen.datos.modalidad,
        filas: [],
      };
      pedido.filas.push(f);
      pedidos.set(clave, pedido);
    }
    for (const pedido of pedidos.values()) {
      const ocupados = new Set(
        filas.flatMap((f) =>
          f.imagen?.tipo === "nueva" &&
          f.imagen.codigo &&
          !f.imagen.automatico &&
          f.imagen.provincia.id === pedido.provincia.id &&
          f.imagen.datos.modalidad === pedido.modalidad
            ? [f.imagen.codigo.numero]
            : []
        )
      );
      let numero = await PeregrinaRepository.nextCodigoNum(
        pedido.provincia.id,
        pedido.modalidad
      );
      for (const f of pedido.filas) {
        while (ocupados.has(numero)) numero++;
        if (f.imagen?.tipo !== "nueva") continue;
        f.imagen.codigo = {
          codigo: componerCodigo(pedido.provincia.abreviatura, pedido.modalidad, numero),
          numero,
        };
        f.imagenMostrada = `${f.imagen.codigo.codigo} (nueva)`;
        numero++;
      }
    }

    // El siguiente número es el mayor de las imágenes que hoy están en esa
    // Provincia, y una imagen que se mudó de Provincia se llevó su Código: el
    // número puede estar escrito en otra parte. El alta a mano lo descubre al
    // escribir; acá se dice antes, en la fila.
    const automaticas = filas.flatMap((f) =>
      f.imagen?.tipo === "nueva" && f.imagen.automatico && f.imagen.codigo
        ? [{ fila: f, codigo: f.imagen.codigo.codigo }]
        : []
    );
    const tomados = new Set(
      (await PeregrinaRepository.findByCodigos(automaticas.map((a) => a.codigo))).map(
        (p) => p.peregrina.codigo
      )
    );
    for (const a of automaticas) {
      if (tomados.has(a.codigo)) {
        a.fila.errores.push(
          `El número que seguía, ${a.codigo}, ya está escrito en otra imagen. ` +
            "Escribí el número de esta a mano."
        );
      }
    }
  }

  /**
   * Un aviso, no un error, cuando el Misionero parece estar ya cargado o está
   * dos veces en la planilla: puede ser otra persona con el mismo nombre, y eso
   * lo sabe quien carga.
   */
  private static async avisarHomonimos(filas: FilaPlaneada[]): Promise<void> {
    const clave = (nombre: string, apellido: string, diocesisId: string) =>
      `${diocesisId}:${normalizarNombre(nombre).replace(/\s+/g, " ")}:${normalizarNombre(apellido).replace(/\s+/g, " ")}`;

    const conPersona = filas.filter(
      (f): f is FilaPlaneada & { misionero: CreateMisioneroInput } => f.misionero !== null
    );
    const diocesis = [...new Set(conPersona.map((f) => f.misionero.diocesisLocalidadId))];

    const yaCargados = new Set<string>();
    for (const id of diocesis) {
      for (const m of await MisioneroRepository.findByDiocesisLocalidad(id)) {
        yaCargados.add(clave(m.misionero.nombre, m.misionero.apellido, id));
      }
    }

    const enLaPlanilla = new Map<string, number[]>();
    for (const f of conPersona) {
      const k = clave(f.misionero.nombre, f.misionero.apellido, f.misionero.diocesisLocalidadId);
      enLaPlanilla.set(k, [...(enLaPlanilla.get(k) ?? []), f.numero]);
    }

    for (const f of conPersona) {
      const k = clave(f.misionero.nombre, f.misionero.apellido, f.misionero.diocesisLocalidadId);
      if (yaCargados.has(k)) {
        f.avisos.push(
          "Ya hay un Misionero con este nombre en esta Diócesis/Localidad. Si es " +
            "la misma persona, sacala de la planilla."
        );
      }
      const iguales = enLaPlanilla.get(k) ?? [];
      if (iguales.length > 1) {
        f.avisos.push(
          `La misma persona está en más de una fila (${iguales.join(", ")}).`
        );
      }
    }
  }
}

// ── Lo que se planea con cada fila ────────────────────────────────────────────

type ImagenPlaneada =
  | {
      tipo: "existente";
      codigoEscrito: string;
      /** Puesto por la revisión contra la base; vacío si no se encontró. */
      peregrinaId: string;
    }
  | {
      tipo: "nueva";
      datos: CreatePeregrinaInput;
      provincia: { id: string; abreviatura: string };
      /** El Código que se le escribe, o null si se registra por su numeración. */
      codigo: { codigo: string; numero: number } | null;
      /** Sin número ni numeración: el número lo pone la revisión. */
      automatico: boolean;
    };

interface FilaPlaneada {
  numero: number;
  nombreMostrado: string;
  imagenMostrada: string | null;
  /** Null cuando la fila no pasó el esquema del alta: tiene errores. */
  misionero: CreateMisioneroInput | null;
  imagen: ImagenPlaneada | null;
  /** La Modalidad de la imagen, cuando se sabe — la que `exigirModalidad` mira. */
  modalidad: Modalidad | null;
  errores: string[];
  avisos: string[];
}

/**
 * Una fila, por sí sola: lo que dice cada celda, pasado por los mismos esquemas
 * que el alta a mano. Lo que necesita la base o las otras filas lo agrega
 * después `PlanillaService`.
 */
function leerFila(fila: FilaLeida, territorios: Resolutor): FilaPlaneada {
  const errores: string[] = [];
  const avisos: string[] = [];
  const celda = (c: ColumnaDeImportacion) => fila.celdas.get(claveDeTitulo(COLUMNAS[c]));
  const texto = (c: ColumnaDeImportacion) => textoDe(celda(c));

  const fecha = (c: ColumnaDeImportacion): string | undefined => {
    const v = celda(c);
    if (v === undefined) return undefined;
    const leida = fechaDe(v);
    if (leida === null) {
      errores.push(
        `«${COLUMNAS[c]}»: no se entiende «${textoDe(v)}». Escribí día, mes y año, como 15/08/1998.`
      );
      return undefined;
    }
    return leida;
  };

  // ── El territorio ──
  const textoDeDiocesis = texto("diocesis");
  let territorio: ReturnType<Resolutor["buscar"]> = null;
  if (!textoDeDiocesis) {
    errores.push("Falta la Diócesis/Localidad.");
  } else {
    territorio = territorios.buscar(textoDeDiocesis);
    if (territorio === "ambigua") {
      errores.push(
        `Hay más de una Diócesis/Localidad «${textoDeDiocesis}». Elegila de la ` +
          "lista de la planilla, que dice la Provincia."
      );
    } else if (territorio === null) {
      errores.push(
        `No encontramos la Diócesis/Localidad «${textoDeDiocesis}». Elegila de la lista de la planilla.`
      );
    }
  }
  const lugar = territorio && territorio !== "ambigua" ? territorio : null;

  // ── El Centro ──
  const textoDeCentro = texto("centroTipo");
  const centroTipo = textoDeCentro
    ? CENTRO_TIPOS.find((c) => iguales(CENTRO_LABELS[c], textoDeCentro))
    : undefined;
  if (textoDeCentro && !centroTipo) {
    errores.push(
      `«${COLUMNAS.centroTipo}»: «${textoDeCentro}» no es una opción. ` +
        `Elegí ${CENTRO_TIPOS.map((c) => CENTRO_LABELS[c]).join(", ")}.`
    );
  }

  // ── La persona, con el esquema del alta ──
  const persona = createMisioneroSchema.safeParse({
    nombre: texto("nombre") ?? "",
    apellido: texto("apellido") ?? "",
    telefono: texto("telefono") ?? null,
    email: texto("email") ?? null,
    // El mensaje de un territorio que falta ya está arriba, más preciso.
    diocesisLocalidadId: lugar?.id ?? "-",
    centroTipo: centroTipo ?? null,
    centroNombre: texto("centroNombre") ?? null,
    fechaConsagracion: fecha("fechaConsagracion"),
  });
  if (!persona.success) {
    errores.push(...persona.error.issues.map((i) => i.message));
  }

  const nombre = texto("nombre");
  const apellido = texto("apellido");
  const nombreMostrado =
    nombre && apellido
      ? nombreEnLista({ nombre, apellido })
      : (apellido ?? nombre ?? "(sin nombre)");

  // ── La imagen ──
  const codigoEscrito = texto("codigo");
  const traeNueva = COLUMNAS_DE_IMAGEN_NUEVA.some((c) => celda(c) !== undefined);

  let imagen: ImagenPlaneada | null = null;
  let imagenMostrada: string | null = null;

  if (codigoEscrito && traeNueva) {
    errores.push(
      "Escribí el Código de una imagen ya cargada o los datos de una imagen " +
        "nueva, no los dos."
    );
  } else if (codigoEscrito) {
    const codigo = normalizarCodigo(codigoEscrito);
    imagen = { tipo: "existente", codigoEscrito: codigo, peregrinaId: "" };
    imagenMostrada = `${codigo} (ya cargada)`;
  } else if (traeNueva) {
    const textoDeModalidad = texto("modalidad");
    const modalidad = textoDeModalidad ? modalidadDe(textoDeModalidad) : null;
    if (!textoDeModalidad) {
      errores.push("Falta la Modalidad de la imagen nueva.");
    } else if (!modalidad) {
      errores.push(
        `«${COLUMNAS.modalidad}»: «${textoDeModalidad}» no es una Modalidad. Elegila de la lista.`
      );
    }

    const textoDeTipo = texto("tipo");
    const tipo: PeregrinaTipo | undefined = textoDeTipo
      ? peregrinaTipoEnum.enumValues.find((t) => iguales(TIPO_LABELS[t], textoDeTipo))
      : "peregrina";
    if (!tipo) {
      errores.push(
        `«${COLUMNAS.tipo}»: «${textoDeTipo}» no es una opción. Elegí Peregrina o Auxiliar.`
      );
    }

    const textoDeNumero = texto("numero");
    const numero = textoDeNumero === undefined ? undefined : numeroDe(textoDeNumero);
    if (Number.isNaN(numero)) {
      errores.push(
        `«${COLUMNAS.numero}»: «${textoDeNumero}» no es un número. Escribí sólo el ` +
          "número, como 12: la Provincia y la Modalidad ya las sabe el sistema."
      );
    }

    const datos = createPeregrinaSchema.safeParse({
      numeracionAnterior: texto("numeracionAnterior"),
      numero: Number.isNaN(numero) ? undefined : numero,
      fechaConsagracion: fecha("fechaImagen"),
      tipo: tipo ?? "peregrina",
      modalidad: modalidad ?? "JOV",
      diocesisLocalidadId: lugar?.id ?? "-",
    });
    if (!datos.success) {
      errores.push(...datos.error.issues.map((i) => `Imagen nueva: ${i.message}`));
    }

    if (datos.success && lugar && modalidad && tipo && !Number.isNaN(numero)) {
      const d = datos.data;
      const codigo =
        d.numero !== undefined
          ? {
              codigo: componerCodigo(lugar.provincia.abreviatura, d.modalidad, d.numero),
              numero: d.numero,
            }
          : null;
      imagen = {
        tipo: "nueva",
        datos: d,
        provincia: lugar.provincia,
        codigo,
        automatico: d.numero === undefined && d.numeracionAnterior === undefined,
      };
      imagenMostrada = codigo
        ? `${codigo.codigo} (nueva)`
        : d.numeracionAnterior !== undefined
          ? `${d.numeracionAnterior} (nueva, sin Código)`
          : "(nueva)";
    }
  }

  return {
    numero: fila.numero,
    nombreMostrado,
    imagenMostrada,
    misionero: persona.success ? persona.data : null,
    imagen,
    modalidad: imagen?.tipo === "nueva" ? imagen.datos.modalidad : null,
    errores,
    avisos,
  };
}

// ── Lectura de celdas ─────────────────────────────────────────────────────────

/** El texto de una celda. Un teléfono escrito como número sigue siendo texto. */
function textoDe(v: ValorLeido | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (v instanceof Date) return diaDeCelda(v);
  const t = String(v).trim();
  return t === "" ? undefined : t;
}

/** Un número entero escrito en la celda, o NaN si dice otra cosa. */
function numeroDe(texto: string): number {
  return /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
}

/**
 * Una fecha como `AAAA-MM-DD`, venga como venga: una celda de fecha, un número
 * de serie de Excel en una celda sin formato, o texto en `dd/mm/aaaa`. Si no se
 * entiende, null; si se entiende pero no existe —el 31 de febrero—, la rechaza
 * después `fechaDeConsagracionSchema`, con su mensaje.
 */
function fechaDe(v: ValorLeido): string | null {
  if (v instanceof Date) return diaDeCelda(v);
  if (typeof v === "number") {
    // Días desde el 30/12/1899, que es como Excel cuenta.
    return Number.isInteger(v) && v > 0
      ? diaDeCelda(new Date(Date.UTC(1899, 11, 30) + v * 86_400_000))
      : null;
  }
  const t = v.trim();
  const dma = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (dma) return `${dma[3]}-${dma[2]!.padStart(2, "0")}-${dma[1]!.padStart(2, "0")}`;
  const amd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (amd) return `${amd[1]}-${amd[2]!.padStart(2, "0")}-${amd[3]!.padStart(2, "0")}`;
  return null;
}

/** El día de una celda de fecha: Excel las guarda a medianoche UTC. */
function diaDeCelda(d: Date): string {
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
}

/** El día de un instante en la Argentina, que es donde se registró. */
function diaEnArgentina(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/**
 * «cba jov 12» y «CBA JOV 0012» son el mismo Código. Lo que no tiene esa forma
 * se compara tal como está escrito, en mayúsculas.
 */
function normalizarCodigo(texto: string): string {
  const t = texto.trim().toUpperCase().replace(/\s+/g, " ");
  const m = /^([A-Z]{3}) ?([A-Z]{3}) ?(\d{1,4})$/.exec(t);
  return m ? `${m[1]} ${m[2]} ${m[3]!.padStart(4, "0")}` : t;
}

const iguales = (a: string, b: string) => normalizarNombre(a) === normalizarNombre(b);

function etiquetaDeModalidad(m: Modalidad): string {
  return `${m} — ${MODALIDAD_LABELS[m]}`;
}

/** «JOV», «Jóvenes» o «JOV — Jóvenes», como venga del desplegable o a mano. */
function modalidadDe(texto: string): Modalidad | null {
  const codigo = /^([A-Za-z]{3})(\b|$)/.exec(texto.trim())?.[1]?.toUpperCase();
  const porCodigo = MODALIDADES.find((m) => m === codigo);
  if (porCodigo) return porCodigo;
  return MODALIDADES.find((m) => iguales(MODALIDAD_LABELS[m], texto)) ?? null;
}

function etiquetaDeTerritorio(nombre: string, provincia: string): string {
  return `${nombre} (${provincia})`;
}

interface TerritorioDeImportacion {
  id: string;
  etiqueta: string;
  nombre: string;
  provincia: { id: string; abreviatura: string };
}

/**
 * Encuentra una Diócesis/Localidad por lo que dice la celda: la etiqueta del
 * desplegable, «Rosario (Santa Fe)», o el nombre solo cuando no se repite entre
 * Provincias. Sin acentos ni mayúsculas, como el resto del territorio.
 */
class Resolutor {
  private porEtiqueta = new Map<string, TerritorioDeImportacion>();
  private porNombre = new Map<string, TerritorioDeImportacion[]>();

  constructor(territorios: TerritorioDeImportacion[]) {
    for (const t of territorios) {
      this.porEtiqueta.set(normalizarNombre(t.etiqueta), t);
      const n = normalizarNombre(t.nombre);
      this.porNombre.set(n, [...(this.porNombre.get(n) ?? []), t]);
    }
  }

  buscar(texto: string): TerritorioDeImportacion | "ambigua" | null {
    const n = normalizarNombre(texto).replace(/\s+/g, " ");
    const exacta = this.porEtiqueta.get(n);
    if (exacta) return exacta;
    const porNombre = this.porNombre.get(n) ?? [];
    if (porNombre.length > 1) return "ambigua";
    return porNombre[0] ?? null;
  }
}
