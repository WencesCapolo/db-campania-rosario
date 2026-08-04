import type {
  Modalidad,
  PeregrinaEstado,
  PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import type { TenedorResueltoDTO } from "@/lib/tenedor";

/**
 * What the tablero is, as a type.
 *
 * Numbers and keys, never labels and never links. `MODALIDAD_LABELS` and
 * `ESTADO_LABELS` already exist and the screen owns the hrefs, so a DTO carrying
 * either would be a second place for the Campaña's own words to live.
 */

// ── Muestras ──────────────────────────────────────────────────────────────────

/**
 * A list that has been cut short, and says so.
 *
 * The tablero shows the first few rows of every list card, because eight rows of
 * Códigos is a card and forty is a screen. `total` is the real count, computed
 * from the same query — so "mostrando 8 de 23" is a fact rather than a
 * reassurance, and a silent truncation cannot read as "that is all of them".
 */
export interface Muestra<T> {
  total: number;
  filas: T[];
}

export const FILAS_POR_TARJETA = 8;

// ── Conteos ───────────────────────────────────────────────────────────────────

export interface ConteoPorEstado {
  estado: PeregrinaEstado;
  total: number;
}

export interface ConteoPorModalidad {
  modalidad: Modalidad;
  total: number;
}

export interface ConteoPorTipo {
  tipo: PeregrinaTipo;
  total: number;
}

export interface ConteoPorRegion {
  region: Region;
  total: number;
}

export interface ConteoPorDiocesis {
  diocesisLocalidadId: string;
  nombre: string;
  total: number;
}

export interface ConteoPorMes {
  /** `YYYY-MM`. Sortable as a string, which is why it is not two numbers. */
  mes: string;
  total: number;
}

// ── Filas ─────────────────────────────────────────────────────────────────────

/**
 * An Extraviada and whoever last had it — story 9.
 *
 * The Tenedor whole, and not a loose nombre/apellido pair, because the hands an
 * image was last in can be two: a card that says «la tenía Ana Álvarez» when the
 * couple had it names half the household, and the other half is who answers the
 * phone. `nombreDeTenedor` in `lib/formato.ts` is the only place that decides
 * how it reads (ADR 0010).
 */
export interface FilaExtraviada {
  id: string;
  codigo: string;
  /**
   * Null only when nobody ever had it. Marking a Peregrina `extraviada`
   * deliberately leaves its Asignación open, precisely so this name survives.
   */
  ultimoTenedor: TenedorResueltoDTO | null;
}

/** An image that has not changed hands in a long time — story 8. */
export interface FilaEstancada {
  peregrinaId: string;
  codigo: string;
  /** One answer to «¿quién la tiene?», whether that is one person or a couple. */
  tenedor: TenedorResueltoDTO;
  dias: number;
}

export interface FilaPeregrinaBreve {
  id: string;
  codigo: string;
}

/*
 * No hay `FilaMisioneroBreve`. La tarjeta de manos libres lista **Tenedores**, y
 * un `{ id, nombre, apellido }` no puede escribir un hogar: la casa aparecía dos
 * veces o con la mitad de su nombre. Es `TenedorResueltoDTO`, que es la misma
 * forma que contestan la tarjeta de Extraviadas y la de estancadas.
 */

// ── El tablero ────────────────────────────────────────────────────────────────

/**
 * One screen, four rols.
 *
 * `vista` is the only thing that changes between them, and it is derived from the
 * Actor's rol rather than chosen: a Región breakdown is the question an Asesor
 * Nacional can act on, and it is a single row with the Actor's own name in it for
 * a Referente Local — which is not a breakdown, it is noise. `null` therefore
 * means "not a question this rol has", not "no data".
 */
export interface TableroDTO {
  vista: "nacional" | "diocesana";

  totalPeregrinas: number;
  totalMisioneros: number;
  /** Images nobody has right now — story 4. */
  sinTenencia: number;

  porEstado: ConteoPorEstado[];
  porModalidad: ConteoPorModalidad[];
  porTipo: ConteoPorTipo[];

  /** Nacional only — stories 10 and 11. */
  porRegion: ConteoPorRegion[] | null;
  /** Nacional only: the Diócesis side by side, biggest first. */
  porDiocesis: ConteoPorDiocesis[] | null;
  /** Nacional only — story 12, derived from `created_at`. */
  crecimiento: ConteoPorMes[] | null;

  /**
   * Null when an Estado filter is active and is not `extraviada`.
   *
   * A card that ignored the filter would contradict the figure above it, which is
   * the confusion story 18 exists to prevent. Saying "this card does not apply to
   * the filter you chose" is the honest version.
   */
  extraviadas: Muestra<FilaExtraviada> | null;

  /** Null when a Tenencia filter is active — same reason as above. */
  nuncaAsignadas: Muestra<FilaPeregrinaBreve> | null;

  /**
   * Quiénes tienen las manos libres — historia 5.
   *
   * Tenedores y no Misioneros, y una pareja cuenta **una vez**: la cifra de esta
   * tarjeta linkea a una lista, y una casa contada dos veces daría un número más
   * grande que la lista que abre (ADR 0010).
   */
  tenedoresSinPeregrina: Muestra<TenedorResueltoDTO>;
  estancadas: Muestra<FilaEstancada>;

  /** The threshold behind `estancadas`, so the screen can name it. */
  umbralDeDiasEstancada: number;
}

// ── Umbral ────────────────────────────────────────────────────────────────────

/**
 * How long an image may stay in the same hands before the tablero mentions it.
 *
 * Six months, and it is a **guess**: the Campaña has not answered what counts as
 * stalled — it is an open question in the production plan, and issue #3
 * deliberately shipped `diasEnCargo` as an interval rather than a verdict for the
 * same reason. Configurable so the answer, when it arrives, is an environment
 * variable and not a deployment.
 *
 * Read per call rather than captured at import, so a test can set it.
 */
const UMBRAL_POR_DEFECTO = 180;

export function umbralDeDiasEstancada(): number {
  const crudo = process.env.TABLERO_DIAS_ESTANCADA;
  if (crudo === undefined) return UMBRAL_POR_DEFECTO;

  const dias = Number(crudo);
  return Number.isInteger(dias) && dias > 0 ? dias : UMBRAL_POR_DEFECTO;
}
