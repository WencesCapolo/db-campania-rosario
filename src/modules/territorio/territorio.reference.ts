import type {
  DiocesisLocalidadRow,
  ProvinciaRow,
  Region,
} from "./territorio.schema";
import type { DiocesisLocalidadDTO, ProvinciaDTO } from "./territorio.types";

/**
 * The 24 Argentine provincias, with the abbreviation that goes into a
 * Peregrina's Código.
 *
 * The abbreviations are the ones the system has always used — they were a
 * hardcoded map in peregrina.service before this became reference data, and
 * they are load-bearing: an abbreviation is physically written on an image, so
 * changing one desynchronises the system from reality. Do not edit them.
 *
 * There is no Región here any more. It was a best-effort guess, and when the
 * Campaña's own list arrived it turned out that a Provincia does not have one:
 * Santa Fe is in two Regiones and so is Buenos Aires. Región now belongs to each
 * Diócesis/Localidad — see DIOCESIS_SEED.
 */
export interface ProvinciaSeed {
  nombre: string;
  abreviatura: string;
}

export const PROVINCIAS_SEED: readonly ProvinciaSeed[] = [
  { nombre: "Jujuy", abreviatura: "JUJ" },
  { nombre: "Salta", abreviatura: "SAL" },
  { nombre: "Tucumán", abreviatura: "TUC" },
  { nombre: "Catamarca", abreviatura: "CAT" },
  { nombre: "Santiago del Estero", abreviatura: "SDE" },

  { nombre: "La Rioja", abreviatura: "LRJ" },
  { nombre: "Mendoza", abreviatura: "MZA" },
  { nombre: "San Juan", abreviatura: "SJN" },
  { nombre: "San Luis", abreviatura: "SLU" },

  { nombre: "Córdoba", abreviatura: "CBA" },
  { nombre: "Santa Fe", abreviatura: "SFE" },
  { nombre: "Entre Ríos", abreviatura: "ERI" },

  { nombre: "Misiones", abreviatura: "MIS" },
  { nombre: "Corrientes", abreviatura: "COR" },
  { nombre: "Chaco", abreviatura: "CHA" },
  { nombre: "Formosa", abreviatura: "FOR" },

  { nombre: "Buenos Aires", abreviatura: "BA" },
  { nombre: "Ciudad Autónoma de Buenos Aires", abreviatura: "CAB" },

  { nombre: "La Pampa", abreviatura: "LPA" },

  { nombre: "Río Negro", abreviatura: "RNE" },
  { nombre: "Neuquén", abreviatura: "NEU" },
  { nombre: "Chubut", abreviatura: "CHU" },
  { nombre: "Santa Cruz", abreviatura: "SCR" },
  { nombre: "Tierra del Fuego", abreviatura: "TDF" },
];


/**
 * The Campaña's Diócesis and Localidades, as its own spreadsheet lists them.
 *
 * This is the list that made Región move off Provincia. Two provinces are split
 * across pastoral regions and no per-province answer could have been right for
 * both halves:
 *
 *   Santa Fe      — Reconquista is NEA; Rosario, Venado Tuerto, Santa Fe and
 *                   Rafaela are CENTRO.
 *   Buenos Aires  — the conurbano and CABA are BS. AS; San Nicolás, La Plata,
 *                   Chascomús, Mar del Plata, Bahía Blanca, Azul, 9 de Julio
 *                   and Mercedes are R. PAM.
 *
 * The names are transcribed as the Campaña writes them, abbreviations and all
 * ("Arq. Salta", "Cdel EJE", "9 de julio/Pehuajo"). They are what a Referente
 * will look for in the picker, and tidying them into official diocesan titles
 * would make the list harder to use, not easier.
 *
 * Two notes on what this seed does *not* decide:
 *
 *   - The CABA entries sit under Buenos Aires, because the spreadsheet puts
 *     them there. That means a Devoto image gets a "BA" Código rather than
 *     "CAB". If the Campaña wants them separate, moving them is a few clicks in
 *     /admin/territorio and does not need a deployment.
 *   - "CABA Centro" appears twice in the spreadsheet. It is seeded once.
 *
 * Like the Provincias, this only ever fills an empty database. An installation
 * that already has territories keeps them untouched, and everything here is
 * editable in the app.
 */
export interface DiocesisSeed {
  /** Matches a ProvinciaSeed.nombre. */
  provincia: string;
  nombre: string;
  region: Region;
}

export const DIOCESIS_SEED: readonly DiocesisSeed[] = [
  // Jujuy
  { provincia: "Jujuy", nombre: "Jujuy/Jujuy", region: "NOA" },

  // Salta
  { provincia: "Salta", nombre: "Arq. Salta", region: "NOA" },

  // Tucumán
  { provincia: "Tucumán", nombre: "Arq. Tucumán", region: "NOA" },

  // Santiago del Estero
  { provincia: "Santiago del Estero", nombre: "SdEstero/La Banda", region: "NOA" },
  { provincia: "Santiago del Estero", nombre: "Añatuya/Los Juries", region: "NOA" },

  // Catamarca
  { provincia: "Catamarca", nombre: "Catamarca/Cap", region: "NOA" },
  { provincia: "Catamarca", nombre: "Cafayate/SMaria", region: "NOA" },

  // La Rioja
  { provincia: "La Rioja", nombre: "La Rioja /LR", region: "CUYO" },

  // Mendoza
  { provincia: "Mendoza", nombre: "San Rafael", region: "CUYO" },
  { provincia: "Mendoza", nombre: "Arq. Mendoza", region: "CUYO" },

  // San Juan
  { provincia: "San Juan", nombre: "Arq. San Juan", region: "CUYO" },

  // San Luis
  { provincia: "San Luis", nombre: "San Luis", region: "CUYO" },

  // Chaco
  { provincia: "Chaco", nombre: "Arq. Resistencia", region: "NEA" },

  // Formosa
  { provincia: "Formosa", nombre: "Formosa", region: "NEA" },

  // Corrientes
  { provincia: "Corrientes", nombre: "Goya", region: "NEA" },
  { provincia: "Corrientes", nombre: "Sto Tomé/ Ituzaingó", region: "NEA" },
  { provincia: "Corrientes", nombre: "Arq. Corrientes", region: "NEA" },

  // Misiones
  { provincia: "Misiones", nombre: "Puerto Iguazú", region: "NEA" },
  { provincia: "Misiones", nombre: "Oberá", region: "NEA" },
  { provincia: "Misiones", nombre: "Posadas", region: "NEA" },

  // Santa Fe
  { provincia: "Santa Fe", nombre: "Reconquista", region: "NEA" },
  { provincia: "Santa Fe", nombre: "Arq. Rosario", region: "CENTRO" },
  { provincia: "Santa Fe", nombre: "Vdo Tuerto/S Eduardo", region: "CENTRO" },
  { provincia: "Santa Fe", nombre: "Arq.Santa Fe/Sto Tome", region: "CENTRO" },
  { provincia: "Santa Fe", nombre: "Rafaela", region: "CENTRO" },

  // Entre Ríos
  { provincia: "Entre Ríos", nombre: "Concordia", region: "CENTRO" },
  { provincia: "Entre Ríos", nombre: "Gualeguaychú", region: "CENTRO" },
  { provincia: "Entre Ríos", nombre: "Arq. Paraná", region: "CENTRO" },

  // Córdoba
  { provincia: "Córdoba", nombre: "Arq. Cordoba", region: "CENTRO" },
  { provincia: "Córdoba", nombre: "Rio Cuarto", region: "CENTRO" },
  { provincia: "Córdoba", nombre: "Cdel EJE", region: "CENTRO" },
  { provincia: "Córdoba", nombre: "Villa Maria", region: "CENTRO" },
  { provincia: "Córdoba", nombre: "Pre. Dean Funes", region: "CENTRO" },
  { provincia: "Córdoba", nombre: "San Francisco", region: "CENTRO" },

  // Buenos Aires
  { provincia: "Buenos Aires", nombre: "CABA V Devoto", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "CABA V Flores", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "CABA V Belgrano", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "CABA Centro", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "CABA Zona Mater", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "San Isidro", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "San Miguel", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "Avellaneda-LanúsE", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "San Martín/V Ballester", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "Lomas de Zamora", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "Morón", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "Quilmes", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "Zarate Campana", region: "BS. AS" },
  { provincia: "Buenos Aires", nombre: "San Nicolás", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Arq. La Plata", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Chascomus", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Mar del Plata", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Arq. Bahìa Blanca", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Azul-RAUCH", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "9 de julio/Pehuajo", region: "R. PAM" },
  { provincia: "Buenos Aires", nombre: "Mercedes Lujan", region: "R. PAM" },

  // La Pampa
  { provincia: "La Pampa", nombre: "Santa Rosa", region: "R. PAM" },

  // Chubut
  { provincia: "Chubut", nombre: "Rawson", region: "R. PAT" },
  { provincia: "Chubut", nombre: "Comodoro R", region: "R. PAT" },
  { provincia: "Chubut", nombre: "Pre Esquel", region: "R. PAT" },

  // Neuquén
  { provincia: "Neuquén", nombre: "Neuquen", region: "R. PAT" },

  // Río Negro
  { provincia: "Río Negro", nombre: "S C de Bariloche", region: "R. PAT" },
  { provincia: "Río Negro", nombre: "Viedma", region: "R. PAT" },
  { provincia: "Río Negro", nombre: "Alto valleRN/Cipolleti", region: "R. PAT" },

  // Santa Cruz
  { provincia: "Santa Cruz", nombre: "Río Gallegos", region: "R. PAT" },

  // Tierra del Fuego
  { provincia: "Tierra del Fuego", nombre: "D Rio Gallegos/Usuhaia", region: "R. PAT" },
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

/**
 * Maps a Diócesis/Localidad row and its Provincia onto the DTO every module
 * shows.
 *
 * Pure, and here rather than in a service, because three modules now render a
 * territory — territorio itself, and the invitation and user-management screens
 * — and three copies of this mapping is three chances for one of them to forget
 * that Región is derived from the Provincia rather than stored.
 */
export function mapearDiocesisLocalidad(row: {
  diocesis: DiocesisLocalidadRow;
  provincia: ProvinciaRow;
}): DiocesisLocalidadDTO {
  const provincia: ProvinciaDTO = {
    id: row.provincia.id,
    nombre: row.provincia.nombre,
    abreviatura: row.provincia.abreviatura,
    deBaja: row.provincia.bajaAt !== null,
  };

  return {
    id: row.diocesis.id,
    nombre: row.diocesis.nombre,
    deBaja: row.diocesis.bajaAt !== null,
    provincia,
    // The Diócesis's own Región, read off its own row. It used to be copied
    // down from the Provincia, which is what made Reconquista and Rosario
    // impossible to tell apart.
    region: row.diocesis.region,
  };
}
