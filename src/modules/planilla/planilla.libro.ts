import ExcelJS from "exceljs";
import { ValidacionError } from "@/lib/errors";

/**
 * Lo único que sabe de Excel — ADR 0017.
 *
 * Arma un `.xlsx` a partir de hojas ya decididas y lee uno de vuelta como texto
 * por celda. No sabe qué es una Peregrina: qué columnas hay, qué dicen y qué
 * se hace con lo que vuelve es del servicio. Así `exceljs` queda detrás de una
 * sola puerta, y cambiarlo es cambiar este archivo.
 */

/** Lo que puede ir en una celda de una planilla que se descarga. */
export type ValorDeSalida = string | number | Date | null;

export interface ColumnaDeSalida {
  titulo: string;
  /** En caracteres, como lo mide Excel. */
  ancho: number;
  /** Una celda de fecha se muestra `dd/mm/aaaa` y se ordena como fecha. */
  fecha?: boolean;
  /** Un comentario en el encabezado: qué va en la columna. */
  ayuda?: string;
  /**
   * Un desplegable, como el rango de la hoja de listas de donde sale — p. ej.
   * `Listas!$A$1:$A$40`. Sólo tiene sentido en una plantilla.
   */
  lista?: string;
  /** El encabezado en negrita y con un asterisco: hay que llenarla. */
  obligatoria?: boolean;
}

export interface HojaDeSalida {
  nombre: string;
  columnas: ColumnaDeSalida[];
  filas: ValorDeSalida[][];
  /**
   * Una hoja de listas para los desplegables: está, pero no se ve, y no lleva
   * encabezado.
   */
  oculta?: boolean;
  /** Cuántas filas vacías llevan desplegables, en una plantilla. */
  filasParaLlenar?: number;
}

/**
 * Una fecha guardada como `AAAA-MM-DD`, como celda de Excel.
 *
 * Medianoche UTC, porque así escribe y lee Excel sus fechas: una fecha local
 * se correría un día en la Argentina, que está tres horas detrás.
 */
export function celdaDeFecha(valor: string | null): Date | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    : null;
}

export async function escribirLibro(hojas: HojaDeSalida[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Campaña del Rosario";
  libro.created = new Date();

  for (const hoja of hojas) {
    const ws = libro.addWorksheet(hoja.nombre, {
      state: hoja.oculta ? "hidden" : "visible",
      // El encabezado queda fijo al bajar: con cientos de filas, quien está en
      // la fila 300 sigue sabiendo qué es cada columna.
      views: hoja.oculta ? [] : [{ state: "frozen", ySplit: 1 }],
    });

    // Una hoja oculta es una lista para los desplegables: sin encabezado, así
    // la fila 1 ya es la primera opción.
    ws.columns = hoja.columnas.map((c) => ({
      ...(!hoja.oculta && {
        header: c.obligatoria ? `${c.titulo} *` : c.titulo,
      }),
      width: c.ancho,
      style: c.fecha ? { numFmt: "dd/mm/yyyy" } : {},
    }));

    if (!hoja.oculta) {
      const encabezado = ws.getRow(1);
      encabezado.font = { bold: true };
      encabezado.alignment = { vertical: "middle", wrapText: true };
      encabezado.height = 32;
      hoja.columnas.forEach((c, i) => {
        if (c.ayuda) ws.getCell(1, i + 1).note = c.ayuda;
      });
    }

    for (const fila of hoja.filas) ws.addRow(fila);

    // Un rango por columna, y no una validación por celda. exceljs junta las
    // celdas en rangos ordenando las direcciones como texto — «E10» antes que
    // «E2» —, y escribe rangos superpuestos que Excel ofrece «reparar» al
    // abrir. Un rango dado entero lo escribe tal cual. `dataValidations` existe
    // en la hoja pero no en los tipos de exceljs.
    const hasta = hoja.filasParaLlenar ?? 0;
    const validaciones = (
      ws as unknown as {
        dataValidations: {
          add(rango: string, validacion: ExcelJS.DataValidation): void;
        };
      }
    ).dataValidations;
    hoja.columnas.forEach((c, i) => {
      if (!c.lista || hasta === 0) return;
      const letra = ws.getColumn(i + 1).letter;
      validaciones.add(`${letra}2:${letra}${hasta + 1}`, {
        type: "list",
        allowBlank: true,
        formulae: [c.lista],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: c.titulo,
        error: "Elegí una opción de la lista.",
      });
    });

    if (!hoja.oculta && hoja.filas.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columnas.length },
      };
    }
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ── Leer ──────────────────────────────────────────────────────────────────────

/** Una fila leída: su número en Excel, y cada celda por título de columna. */
export interface FilaLeida {
  numero: number;
  celdas: Map<string, ValorLeido>;
}

/**
 * Lo que trae una celda, sin interpretar. Una fecha llega como `Date` cuando la
 * celda tiene formato de fecha, y como texto o número cuando no.
 */
export type ValorLeido = string | number | Date;

export interface HojaLeida {
  /** Los títulos tal como están escritos, normalizados con `claveDeTitulo`. */
  titulos: string[];
  filas: FilaLeida[];
}

/**
 * Un título de columna, comparable: sin acentos, sin mayúsculas, sin el
 * asterisco de obligatoria y con los espacios colapsados. Así «Diocesis /
 * localidad» y «Diócesis/Localidad *» son la misma columna.
 */
export function claveDeTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * La primera hoja visible de un `.xlsx`, o la que se llama como se pide.
 *
 * El encabezado es la primera fila que tiene algo. Las filas sin ninguna celda
 * escrita se saltean: una plantilla trae quinientas con desplegables y nada
 * más, y ninguna de ellas es un Misionero.
 */
export async function leerHoja(
  archivo: Buffer,
  nombreDeHoja: string
): Promise<HojaLeida> {
  const libro = new ExcelJS.Workbook();
  try {
    // exceljs declares its own `Buffer` as an `ArrayBuffer`; at runtime it takes
    // the bytes either way, so it gets exactly the ones this Buffer views.
    const bytes = archivo.buffer.slice(
      archivo.byteOffset,
      archivo.byteOffset + archivo.byteLength
    ) as ArrayBuffer;
    await libro.xlsx.load(bytes);
  } catch {
    throw new ValidacionError(
      "No pudimos abrir el archivo. Tiene que ser una planilla de Excel (.xlsx): " +
        "si la tenés en otro formato, abrila en Excel y guardala como «Libro de Excel»."
    );
  }

  const ws =
    libro.getWorksheet(nombreDeHoja) ??
    libro.worksheets.find((h) => h.state === "visible");
  if (!ws) throw new ValidacionError("La planilla no tiene ninguna hoja.");

  let titulos: string[] | null = null;
  const filas: FilaLeida[] = [];

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    const valores: (ValorLeido | null)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      valores[col - 1] = valorDeCelda(cell.value);
    });

    if (titulos === null) {
      titulos = valores.map((v) => (v === null ? "" : claveDeTitulo(String(v))));
      return;
    }

    const celdas = new Map<string, ValorLeido>();
    valores.forEach((v, i) => {
      const titulo = titulos?.[i];
      if (v !== null && v !== undefined && titulo) celdas.set(titulo, v);
    });
    if (celdas.size > 0) filas.push({ numero, celdas });
  });

  return { titulos: titulos ?? [], filas };
}

/**
 * Lo que una celda dice, sin la envoltura de exceljs. Un email escrito en Excel
 * se vuelve un hipervínculo solo; una fórmula vale su resultado; un texto con
 * formato es la suma de sus pedazos. Vacío es null, y un texto en blanco también.
 */
function valorDeCelda(valor: ExcelJS.CellValue): ValorLeido | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string") return valor.trim() || null;
  if (typeof valor === "number" || valor instanceof Date) return valor;
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if ("richText" in valor) {
    return valor.richText.map((t) => t.text).join("").trim() || null;
  }
  if ("hyperlink" in valor) {
    const texto = typeof valor.text === "string" ? valor.text : valor.hyperlink;
    return texto.replace(/^mailto:/, "").trim() || null;
  }
  if ("result" in valor) {
    const r = valor.result;
    if (r === undefined || r === null || typeof r === "object") {
      return r instanceof Date ? r : null;
    }
    return typeof r === "boolean" ? (r ? "Sí" : "No") : r;
  }
  return null;
}
