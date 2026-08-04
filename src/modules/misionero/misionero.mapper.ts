import { mapearDiocesisLocalidad } from "@/modules/territorio/territorio.reference";
import type { MisioneroConTerritorio } from "./misionero.repository";
import type { MatrimonioConEsposos } from "./matrimonio.repository";
import type { MisioneroDTO } from "./misionero.types";
import type { MatrimonioDTO } from "./matrimonio.types";

/**
 * Rows to DTOs, for the two kinds of Tenedor.
 *
 * Here rather than private to a service because both services need both: a
 * Matrimonio renders its two spouses, and the collapsed listado renders both
 * kinds side by side. Two copies of `mapearMisionero` is two chances for one of
 * them to forget that `deBaja` is `bajaAt !== null` rather than a column.
 *
 * Pure, and the boundary the module's Drizzle rows stop at.
 */

export function mapearMisionero(row: MisioneroConTerritorio): MisioneroDTO {
  let resumenesAnuales: Record<string, string> = {};
  try {
    resumenesAnuales = JSON.parse(
      row.misionero.resumenesAnuales ?? "{}"
    ) as Record<string, string>;
  } catch {
    // A resumen that will not parse is a row somebody edited by hand. Losing the
    // text is bad; refusing to render the person is worse — they would vanish
    // from the listado with no message anywhere saying why.
    resumenesAnuales = {};
  }

  const diocesisLocalidad = mapearDiocesisLocalidad({
    diocesis: row.diocesis,
    provincia: row.provincia,
  });

  return {
    id: row.misionero.id,
    nombre: row.misionero.nombre,
    apellido: row.misionero.apellido,
    telefono: row.misionero.telefono ?? null,
    estado: row.misionero.estado,
    diocesisLocalidad,
    provincia: diocesisLocalidad.provincia.nombre,
    region: diocesisLocalidad.region,
    deBaja: row.misionero.bajaAt !== null,
    centroTipo: row.misionero.centroTipo ?? null,
    centroNombre: row.misionero.centroNombre ?? null,
    anioConsagracion: row.misionero.anioConsagracion ?? null,
    resumenesAnuales,
    createdById: row.misionero.createdById,
    createdAt: row.misionero.createdAt,
    updatedAt: row.misionero.updatedAt,
  };
}

/**
 * The couple, with both spouses inside it.
 *
 * There is no `etiqueta` here. How a Matrimonio is written — `Ana y Juan Pérez`
 * when the surnames match, `Ana Álvarez y Juan Benítez` when they do not — is
 * computed at render time by `lib/formato.ts` and deliberately not stored: a
 * stored label is a second copy of two people's names waiting to drift out of
 * date, and avoiding that copy is half of why ADR 0010 chose a union type over a
 * `tenedor` supertype table.
 */
export function mapearMatrimonio(row: MatrimonioConEsposos): MatrimonioDTO {
  return {
    id: row.matrimonio.id,
    misioneroA: mapearMisionero(row.esposoA),
    misioneroB: mapearMisionero(row.esposoB),
    estado: row.matrimonio.estado,
    // No teléfono on the couple: each spouse carries their own, both optional.
    centroTipo: row.matrimonio.centroTipo ?? null,
    centroNombre: row.matrimonio.centroNombre ?? null,
    deBaja: row.matrimonio.bajaAt !== null,
    createdById: row.matrimonio.createdById,
    createdAt: row.matrimonio.createdAt,
    updatedAt: row.matrimonio.updatedAt,
  };
}
