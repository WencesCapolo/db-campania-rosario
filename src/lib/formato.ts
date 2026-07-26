import type { AsignacionDTO, RegistroDTO } from "@/modules/asignacion/asignacion.types";

/**
 * How dates, durations and attribution are worded, in one place.
 *
 * These were three local helpers at the bottom of the historial page. They are
 * here because the Misionero detail page needs the same three and a second copy
 * is how "Entrega registrada desde Villa María" quietly becomes "Registrada por
 * María Pérez" on one screen and not the other.
 */

export function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(d);
}

/**
 * A `Date` as an `<input type="date">` expects it, and back again.
 *
 * Both are written from the local calendar fields rather than through
 * `toISOString()`, and that is the whole reason they exist. Argentina is UTC−3, so
 * a period opened at 21:00 on the 26th is 00:00 UTC on the 27th: `toISOString()`
 * would put "2026-07-27" in the field, somebody would open a correction dialog to
 * fix a nota and save the date as a day later than it was. The round trip has to
 * be a fixed point, and the only way it is one is if both halves agree on which
 * calendar they mean.
 *
 * `deCampoDeFecha` returns local midnight, which is what somebody typing a date
 * into a form means by it — not midnight in London.
 */
export function paraCampoDeFecha(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function deCampoDeFecha(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dias(n: number): string {
  if (n === 0) return "hoy mismo";
  return n === 1 ? "1 día" : `${n} días`;
}

export function nombreCompleto(p: { nombre: string; apellido: string }): string {
  return `${p.nombre} ${p.apellido}`;
}

/**
 * A territory, never a person.
 *
 * Referentes Locales share one login per territory (settled 2026-07-25), so the
 * record answers *which territory* registered a period of charge and cannot
 * answer *who*. This function exists so that no screen has to remember that:
 * there is nothing here that could render a name, because there is no name in
 * `RegistroDTO` to render.
 */
function desde(r: RegistroDTO, verbo: string): string {
  return r.diocesisLocalidad
    ? `${verbo} desde ${r.diocesisLocalidad}`
    : `${verbo} a nivel nacional`;
}

export function registro(a: AsignacionDTO): string {
  const entrega = desde(a.registradaPor, "Entrega registrada");
  if (!a.cerradaPor) return `${entrega}.`;
  // The second clause is lowercased by writing it that way, not by
  // `.toLowerCase()` on the result — which would also lowercase the territory
  // and give "devolución desde villa maría".
  return `${entrega}; ${desde(a.cerradaPor, "devolución")}.`;
}
