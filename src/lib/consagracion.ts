import { z } from "zod";
import { deCampoDeFecha, fecha, paraCampoDeFecha } from "@/lib/formato";

/**
 * The day, if the text names one that exists. `new Date` rolls "1998-13-40"
 * over into 1999 instead of refusing it, so the round trip has to come back to
 * the same text — or Postgres would be the one to refuse it, with no message
 * anybody can read.
 */
function diaReal(valor: string): Date | null {
  const d = deCampoDeFecha(valor);
  return d && paraCampoDeFecha(d) === valor ? d : null;
}

/**
 * La Fecha de consagración — de un Misionero o de una Peregrina (ADR 0013).
 *
 * Un día del calendario, como lo entrega un `<input type="date">`: `AAAA-MM-DD`.
 * Viaja como texto de punta a punta — la columna es `date` en modo string — para
 * que ninguna zona horaria lo corra un día, que es lo que pasa cuando un día se
 * convierte en un instante.
 *
 * Una sola copia de la regla porque la usan tres esquemas: el Misionero, los dos
 * cónyuges de un Matrimonio y la Peregrina. Antes de 1900 no hay consagraciones
 * en la Campaña, y una fecha en el futuro es un error de tipeo. «Hoy» se evalúa
 * en cada llamada para que la suite no se pudra en enero.
 */
export const fechaDeConsagracionSchema = z
  .string()
  .trim()
  .refine(
    (v) => diaReal(v) !== null,
    "Escribí una fecha válida, con día, mes y año.",
  )
  .refine(
    (v) => v >= "1900-01-01",
    "La fecha de consagración no puede ser anterior a 1900.",
  )
  .refine(
    (v) => {
      const d = diaReal(v);
      return d === null || d.getTime() <= Date.now();
    },
    "La fecha de consagración no puede estar en el futuro.",
  )
  .nullish();

/** Para leer en pantalla: «1 de enero de 1998». */
export function fechaDeConsagracion(valor: string): string {
  const d = deCampoDeFecha(valor);
  return d ? fecha(d) : valor;
}
