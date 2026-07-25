import type { Region } from "./territorio.schema";

/**
 * The 24 Argentine provincias, with the abbreviation that goes into a
 * Peregrina's Código and the Región each one belongs to.
 *
 * The abbreviations are the ones the system has always used — they were a
 * hardcoded map in peregrina.service before this became reference data, and
 * they are load-bearing: an abbreviation is physically written on an image, so
 * changing one desynchronises the system from reality. Do not edit them.
 *
 * The Región column is a different matter. It is a best-effort reading of the
 * Campaña's seven pastoral regions and has NOT been confirmed against the
 * Campaña's own structure. It is only ever used to seed an empty database —
 * the migration derives real installations' mapping from their own data, and
 * an Asesor Nacional can correct any of it in the app without a deployment.
 */
export interface ProvinciaSeed {
  nombre: string;
  abreviatura: string;
  region: Region;
}

export const PROVINCIAS_SEED: readonly ProvinciaSeed[] = [
  // NOA
  { nombre: "Jujuy", abreviatura: "JUJ", region: "NOA" },
  { nombre: "Salta", abreviatura: "SAL", region: "NOA" },
  { nombre: "Tucumán", abreviatura: "TUC", region: "NOA" },
  { nombre: "Catamarca", abreviatura: "CAT", region: "NOA" },
  { nombre: "Santiago del Estero", abreviatura: "SDE", region: "NOA" },

  // CUYO
  { nombre: "La Rioja", abreviatura: "LRJ", region: "CUYO" },
  { nombre: "Mendoza", abreviatura: "MZA", region: "CUYO" },
  { nombre: "San Juan", abreviatura: "SJN", region: "CUYO" },
  { nombre: "San Luis", abreviatura: "SLU", region: "CUYO" },

  // CENTRO
  { nombre: "Córdoba", abreviatura: "CBA", region: "CENTRO" },
  { nombre: "Santa Fe", abreviatura: "SFE", region: "CENTRO" },
  { nombre: "Entre Ríos", abreviatura: "ERI", region: "CENTRO" },

  // NEA
  { nombre: "Misiones", abreviatura: "MIS", region: "NEA" },
  { nombre: "Corrientes", abreviatura: "COR", region: "NEA" },
  { nombre: "Chaco", abreviatura: "CHA", region: "NEA" },
  { nombre: "Formosa", abreviatura: "FOR", region: "NEA" },

  // BS. AS
  { nombre: "Buenos Aires", abreviatura: "BA", region: "BS. AS" },
  { nombre: "Ciudad Autónoma de Buenos Aires", abreviatura: "CAB", region: "BS. AS" },

  // R. PAM
  { nombre: "La Pampa", abreviatura: "LPA", region: "R. PAM" },

  // R. PAT
  { nombre: "Río Negro", abreviatura: "RNE", region: "R. PAT" },
  { nombre: "Neuquén", abreviatura: "NEU", region: "R. PAT" },
  { nombre: "Chubut", abreviatura: "CHU", region: "R. PAT" },
  { nombre: "Santa Cruz", abreviatura: "SCR", region: "R. PAT" },
  { nombre: "Tierra del Fuego", abreviatura: "TDF", region: "R. PAT" },
];

/**
 * Trim, fold case, strip accents. "Córdoba", "córdoba" and "Cordoba " are one
 * place. Mirrors the `territorio_normalizar` SQL function used by migration
 * 0001 — keep the two in step.
 */
export function normalizarNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
