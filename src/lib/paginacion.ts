import { z } from "zod";

/**
 * Paginación — one definition, every listado.
 *
 * It lives here rather than beside the filters because two modules need it and
 * the import chain runs one way: `peregrina` may not read `misionero`, so a
 * shared page size declared in either would have to be copied into the other,
 * and a page size that differs per screen is a page size somebody has to guess.
 *
 * The page is in the address, exactly like the filters and for the same reasons
 * — it survives opening a record and coming back, it survives a reload, and it
 * can be pasted into a message. Nothing here holds state.
 *
 * What it is deliberately not: a cursor. An offset re-reads rows the previous
 * page already read, which is the honest cost, and in exchange somebody can be
 * told "página 3 de 7" and jump. A Diócesis has hundreds of images rather than
 * millions, the ordering is a unique Código, and "página 3" is a thing a
 * Referente says out loud on the phone. A cursor buys deep-page performance the
 * Campaña will not reach and loses the count that makes the control legible.
 */

/**
 * Twenty rows.
 *
 * Twenty is already a long scroll on a 390px phone — a Peregrina's row carries a
 * Código, an Estado pill, a name and a territory — and fifty would be four
 * screens of flicking to reach the control that gets you off the page. It is the
 * same number for every listado on purpose: a page size that differs per screen
 * is a page size somebody has to guess when they say "página 3" out loud.
 */
export const FILAS_POR_PAGINA = 20;

/** The address's name for it, so no screen invents a second one. */
export const CLAVE_DE_PAGINA = "pagina";

/**
 * A page of rows, and enough about the whole to draw the control.
 *
 * `total` is the count of everything matching, from an aggregate query — never
 * `filas.length`, which is a count of the page size and is exactly the mistake
 * the previous dashboard made.
 */
export interface Pagina<T> {
  filas: T[];
  total: number;
  /** Which page these rows are, already clamped to something that exists. */
  pagina: number;
  paginas: number;
  porPagina: number;
}

/** Strict, for the router boundary. */
export const paginaSchema = z.number().int().min(1);

/**
 * The page as it arrives from the address — lenient, like `filtrosDesdeParams`.
 *
 * `?pagina=0`, `?pagina=abc` and `?pagina=` are all a stale link or a typo, and
 * refusing the whole screen over one is worse than showing the first page. A
 * page past the end is not corrected here: the service clamps it, because only
 * the service knows how many there are.
 */
export function paginaDesdeParams(
  params: Record<string, string | string[] | undefined>,
): number {
  const valor = params[CLAVE_DE_PAGINA];
  const texto = (Array.isArray(valor) ? valor[0] : valor)?.trim();
  if (!texto) return 1;

  const numero = Number(texto);
  return Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

/** `limit`/`offset` for a page, in the shape a repository takes them. */
export function rango(
  pagina: number,
  porPagina: number = FILAS_POR_PAGINA,
): { limit: number; offset: number } {
  return { limit: porPagina, offset: (pagina - 1) * porPagina };
}

/**
 * How many pages a total makes — at least one, even at zero rows.
 *
 * Zero pages would make "página 1 de 0" the empty state's heading, and an empty
 * listado still has a first page: it is the page saying nothing matched.
 */
export function cantidadDePaginas(
  total: number,
  porPagina: number = FILAS_POR_PAGINA,
): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/**
 * The page somebody actually gets, given how many exist.
 *
 * Asking for page nine of three is clamped to three rather than answered with an
 * empty list. An empty list at page nine reads as "there is nothing here", which
 * is a lie about the data — and the address that produced it is usually a
 * bookmark taken before rows were given de baja.
 */
export function paginaExistente(pagina: number, paginas: number): number {
  if (!Number.isFinite(pagina)) return 1;
  return Math.min(Math.max(1, Math.trunc(pagina)), paginas);
}

export function armarPagina<T>(
  filas: T[],
  total: number,
  pagina: number,
  porPagina: number = FILAS_POR_PAGINA,
): Pagina<T> {
  return {
    filas,
    total,
    pagina,
    paginas: cantidadDePaginas(total, porPagina),
    porPagina,
  };
}
