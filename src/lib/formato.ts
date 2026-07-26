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
