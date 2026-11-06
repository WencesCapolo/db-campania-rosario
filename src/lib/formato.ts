import type { AsignacionDTO } from "@/modules/asignacion/asignacion.types";

/**
 * How dates, durations and attribution are worded, in one place.
 *
 * These were three local helpers at the bottom of the historial page. They are
 * here because the Misionero detail page needs the same three and a second copy
 * is how "Entrega registrada desde Villa María" quietly becomes "Registrada por
 * María Pérez" on one screen and not the other.
 */

/**
 * The Campaña's calendar. Every day this app shows or reads is a day in
 * Argentina, wherever the code runs: a server component renders on a machine in
 * UTC, and a period opened at 21:00 on the 26th is 00:00 UTC on the 27th. Read
 * through the machine's own clock, that period showed as opened a day later on
 * every server-rendered page, and a correction dialog rendered there put the
 * wrong day in its field.
 */
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/**
 * Argentina has kept UTC−3 all year since 2009. A fixed offset is what turns a
 * typed day back into an instant without asking the machine where it is.
 */
const DESFASE_ARGENTINA = "-03:00";

export function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: ZONA_HORARIA,
  }).format(d);
}

/**
 * The day an instant falls on in Argentina, as `AAAA-MM-DD` — what an
 * `<input type="date">` expects, and what names a file or a cell.
 *
 * Never `toISOString()`, which answers in UTC: somebody would open a correction
 * dialog to fix a nota and save the date as a day later than it was.
 */
export function diaEnArgentina(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(d);
}

/**
 * Back again: midnight in Argentina, which is what somebody typing a date into a
 * form means by it — not midnight in London, and not midnight wherever the
 * server is. The two are a fixed point of each other.
 */
export function deCampoDeFecha(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00${DESFASE_ARGENTINA}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dias(n: number): string {
  if (n === 0) return "hoy mismo";
  return n === 1 ? "1 día" : `${n} días`;
}

export function nombreCompleto(p: { nombre: string; apellido: string }): string {
  return `${p.nombre} ${p.apellido}`;
}

/** Apellido first, because a list is scanned by surname and not read as prose. */
export function nombreEnLista(p: Persona): string {
  return `${p.apellido}, ${p.nombre}`;
}

type Persona = { nombre: string; apellido: string };

/**
 * A Tenedor's name — one Misionero, or a Matrimonio as a single answer.
 *
 * ADR 0010: a couple is one Tenedor, so every screen that asks "who has this
 * image" gets one name back and never two rows. These two functions are the only
 * place that decides how that name reads, which is the same reason
 * `nombreCompleto` is here rather than in a page.
 *
 * The couple's surname collapses when both spouses share it — `Pérez, Ana y
 * Juan` rather than `Pérez, Ana y Pérez, Juan`. It is a string comparison with
 * nothing downstream of it: the sort key is spouse A's surname either way, so a
 * mismatch here is cosmetic and can never move a row in the listado. It exists
 * because the uncollapsed version reads like the system entered the household
 * twice, which is the confusion a Matrimonio is for removing.
 */
export type TenedorConNombre =
  | { tipo: "persona"; persona: Persona }
  | { tipo: "matrimonio"; matrimonio: { misioneroA: Persona; misioneroB: Persona } };

export function nombreDeTenedor(t: TenedorConNombre): string {
  if (t.tipo === "persona") return nombreCompleto(t.persona);
  const { misioneroA: a, misioneroB: b } = t.matrimonio;
  return a.apellido === b.apellido
    ? `${a.nombre} y ${b.nombre} ${a.apellido}`
    : `${nombreCompleto(a)} y ${nombreCompleto(b)}`;
}

export function nombreDeTenedorEnLista(t: TenedorConNombre): string {
  if (t.tipo === "persona") return nombreEnLista(t.persona);
  const { misioneroA: a, misioneroB: b } = t.matrimonio;
  return a.apellido === b.apellido
    ? `${a.apellido}, ${a.nombre} y ${b.nombre}`
    : `${nombreEnLista(a)} y ${nombreEnLista(b)}`;
}

/**
 * A login, never a person.
 *
 * A Buzón is shared by everybody who does one function (ADR 0016), so the
 * record cannot answer *who* registered a period of charge. This function exists
 * so that no screen has to remember that: there is nothing here that could
 * render a name, because there is no name in `RegistroDTO` to render. Every
 * Buzón covers the country, so the record says so rather than naming a place.
 */
export function registro(a: AsignacionDTO): string {
  const entrega = "Entrega registrada a nivel nacional";
  if (!a.cerradaPor) return `${entrega}.`;
  return `${entrega}; devolución a nivel nacional.`;
}
