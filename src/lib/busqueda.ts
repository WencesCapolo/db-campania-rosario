import { or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/** Las dos columnas de un nombre, de la tabla o del alias que sea. */
export interface ColumnasDeNombre {
  nombre: PgColumn;
  apellido: PgColumn;
}

/**
 * «Álvarez», «María Álvarez» y «Álvarez María» tienen que encontrar a la misma
 * persona — y, si esa persona está en un Matrimonio, tienen que encontrar al
 * Matrimonio buscando por cualquiera de los dos apellidos.
 *
 * Se compara contra el nombre y el apellido **concatenados**, y en los dos
 * órdenes, porque las tres cosas que alguien escribe son esas: el apellido
 * suelto, el nombre completo, y a veces el nombre completo al revés porque así
 * está en la planilla de la que viene copiando. Un `or` de dos `ilike` sobre las
 * columnas sueltas no toma ninguno de los nombres completos, y pedirle a la
 * gente que sepa cuál de los dos campos está buscando es pedirle que conozca el
 * esquema.
 *
 * Es variádica y no una función por tabla porque hay dos lugares que hacen la
 * misma pregunta sobre distinta cantidad de personas: el filtro «quién la tiene»
 * del inventario, que mira al Misionero actual **y** a los dos cónyuges del
 * Matrimonio actual — cuatro concatenaciones —, y el buscador del listado de
 * Misioneros, que mira a la persona o a los dos cónyuges de la fila. Una segunda
 * copia escrita a mano es un segundo lugar donde discrepar, y ADR 0010 dice que
 * el modo de falla de esta feature es el silencio.
 *
 * `ilike` y no `like`: nadie tipea la mayúscula en un buscador. No lleva índice,
 * y eso es una decisión medida y no un olvido — un `%texto%` no puede usar un
 * índice B-tree, y los dos índices compuestos que se escribieron para los
 * listados ordenados ya fueron borrados por la misma razón: el planner no los
 * eligió (ADR 0007). Esto corre sobre las filas que el territorio ya recortó.
 */
export function coincideAlgunNombre(
  termino: string | undefined,
  ...personas: ColumnasDeNombre[]
): SQL | undefined {
  const texto = termino?.trim().replace(/\s+/g, " ");
  if (!texto || personas.length === 0) return undefined;

  const patron = `%${texto}%`;
  return or(
    ...personas.flatMap((p) => [
      sql`(${p.nombre} || ' ' || ${p.apellido}) ilike ${patron}`,
      sql`(${p.apellido} || ' ' || ${p.nombre}) ilike ${patron}`,
    ])
  );
}
