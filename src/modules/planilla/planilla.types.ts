import { z } from "zod";
import { filtrosDeMisioneroSchema } from "@/modules/misionero/misionero.types";

/**
 * Planillas de Excel — ADR 0017.
 *
 * Exportar es una lectura con los filtros de la pantalla. Importar crea
 * Misioneros, cada uno con una imagen opcional que se le entrega, y es todo o
 * nada: se revisa, y sólo una planilla sin errores se carga, en una transacción.
 */

/** Más que esto no es una carga a mano: es una migración, y se hace de otra forma. */
export const MAXIMO_DE_FILAS = 500;

/** Quinientas filas de texto ocupan menos de 200 KB; esto deja mucho margen. */
export const MAXIMO_DE_BYTES = 2 * 1024 * 1024;

/** Cómo se llama la hoja que se lee, y la que trae la plantilla. */
export const HOJA_DE_MISIONEROS = "Misioneros";

/**
 * Las columnas de la plantilla, por clave. El título es lo que se lee de vuelta:
 * el orden no importa, y una columna opcional que falta es una columna vacía.
 *
 * Los títulos de la imagen dicen «nueva» o «ya cargada» porque son dos caminos
 * distintos, y una sola columna «Código» no diría cuál de los dos se quiso.
 */
export const COLUMNAS = {
  nombre: "Nombre",
  apellido: "Apellido",
  telefono: "Teléfono",
  email: "Email",
  diocesis: "Diócesis/Localidad",
  centroTipo: "Tipo de Centro",
  centroNombre: "Nombre del Centro",
  fechaConsagracion: "Fecha de consagración",
  codigo: "Código de una imagen ya cargada",
  modalidad: "Modalidad de la imagen nueva",
  tipo: "Tipo de la imagen nueva",
  numero: "Número de la imagen nueva",
  numeracionAnterior: "Numeración anterior de la imagen nueva",
  fechaImagen: "Fecha de consagración de la imagen nueva",
} as const;

export type ColumnaDeImportacion = keyof typeof COLUMNAS;

export const COLUMNAS_OBLIGATORIAS: readonly ColumnaDeImportacion[] = [
  "nombre",
  "apellido",
  "diocesis",
];

/** Las columnas que, con algo escrito, dicen que la fila trae una imagen nueva. */
export const COLUMNAS_DE_IMAGEN_NUEVA: readonly ColumnaDeImportacion[] = [
  "modalidad",
  "tipo",
  "numero",
  "numeracionAnterior",
  "fechaImagen",
];

// ── Lo que vuelve a la pantalla ───────────────────────────────────────────────

/** Una fila de la planilla, como la revisión la entendió. */
export interface FilaRevisadaDTO {
  /** El número de fila en Excel, para que se encuentre a la primera. */
  numero: number;
  /** «Gómez, Ana», o lo que se pueda decir de una fila sin nombre. */
  misionero: string;
  /** Qué imagen se le entrega, si alguna — su Identificación y de dónde sale. */
  imagen: string | null;
  /** Frenan la carga entera. */
  errores: string[];
  /** No la frenan: algo que quien carga sabe y el sistema no. */
  avisos: string[];
}

export interface RevisionDTO {
  filas: FilaRevisadaDTO[];
  /** Lo que está mal en la planilla y no en una fila: columnas, tamaño. */
  errores: string[];
  /** Ningún error, ni general ni de fila: se puede cargar. */
  lista: boolean;
  totales: TotalesDeCargaDTO;
}

export interface TotalesDeCargaDTO {
  misioneros: number;
  imagenesNuevas: number;
  entregas: number;
}

// ── Filtros de las descargas ──────────────────────────────────────────────────

/**
 * Los mismos filtros que el listado de Misioneros tiene en la dirección: el
 * buscador, el territorio y el de tenencia, `?imagen=con|sin`.
 */
export const filtrosDeMisionerosParaExportarSchema =
  filtrosDeMisioneroSchema.extend({
    imagen: z.enum(["con", "sin"]).optional(),
  });

export type FiltrosDeMisionerosParaExportar = z.infer<
  typeof filtrosDeMisionerosParaExportarSchema
>;

export type { ActionResult } from "@/lib/action-result";
