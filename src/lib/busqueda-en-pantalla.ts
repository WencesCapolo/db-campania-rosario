/**
 * Filtrar una lista que ya está en pantalla mientras se escribe — el flujo de
 * entrega y el diálogo de la ficha filtran igual, así que la regla vive una sola
 * vez. La búsqueda contra la base es `coincideAlgunNombre`, en `busqueda.ts`.
 */

/** Sin tildes ni mayúsculas: «alvarez» tiene que encontrar a «Álvarez». */
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Cada palabra de lo escrito tiene que estar en la opción, en cualquier orden:
 * «maria alvarez» y «alvarez maria» encuentran a la misma persona.
 */
export function coincide(etiqueta: string, busqueda: string): boolean {
  const donde = normalizar(etiqueta);
  return normalizar(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => donde.includes(palabra));
}
