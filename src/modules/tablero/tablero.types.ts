import type {
  Modalidad,
  PeregrinaEstado,
} from "@/modules/peregrina/peregrina.schema";

/**
 * What the tablero is, as a type.
 *
 * Numbers and keys, never labels and never links. `MODALIDAD_LABELS` and
 * `ESTADO_LABELS` already exist and the screen owns the hrefs, so a DTO carrying
 * either would be a second place for the Campaña's own words to live.
 */

// ── Conteos ───────────────────────────────────────────────────────────────────

export interface ConteoPorEstado {
  estado: PeregrinaEstado;
  total: number;
}

export interface ConteoPorModalidad {
  modalidad: Modalidad;
  total: number;
}

export interface ConteoPorProvincia {
  provinciaId: string;
  nombre: string;
  total: number;
}

export interface ConteoPorDiocesis {
  diocesisLocalidadId: string;
  nombre: string;
  /** La Provincia, para distinguir dos Diócesis que se llaman parecido. */
  provincia: string;
  total: number;
}

/**
 * Cinco años por fila: `desde` 2010 es 2010–2014. Null es una imagen en manos
 * de alguien que no tiene el año cargado.
 */
export interface ConteoPorQuinquenio {
  desde: number | null;
  total: number;
}

// ── El tablero ────────────────────────────────────────────────────────────────

/**
 * Cómo se reparten las imágenes: por Estado, por Modalidad, por territorio y por
 * el año de consagración de quien las tiene.
 *
 * `vista` is derived from the Actor's rol rather than chosen: a Provincia or
 * Diócesis breakdown is the question an Asesor Nacional can act on, and it is a
 * single row with the Actor's own name in it for a Referente Local — which is not
 * a breakdown, it is noise. `null` therefore means "not a question this rol
 * has", not "no data".
 */
export interface TableroDTO {
  vista: "nacional" | "diocesana";

  totalPeregrinas: number;
  /** Images nobody has right now — the ones the año breakdown cannot place. */
  sinTenencia: number;

  porEstado: ConteoPorEstado[];
  porModalidad: ConteoPorModalidad[];
  /**
   * Las imágenes que alguien tiene, por el Año de consagración de quien la
   * tiene. Las libres no están: son `sinTenencia`.
   */
  porConsagracion: ConteoPorQuinquenio[];

  /** Nacional only, biggest first. */
  porProvincia: ConteoPorProvincia[] | null;
  /** Nacional only: the Diócesis side by side, biggest first. */
  porDiocesis: ConteoPorDiocesis[] | null;
}
