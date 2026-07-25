import { z } from "zod";
import { REGIONES, type Region } from "./territorio.schema";

// ── DTOs (what the UI receives) ───────────────────────────────────────────────
// Never a Drizzle row. A Diócesis/Localidad always arrives with its Provincia
// and Región already resolved, because a caller that has to traverse for them
// is a caller that can get them wrong.

export interface ProvinciaDTO {
  id: string;
  nombre: string;
  abreviatura: string;
  region: Region;
  deBaja: boolean;
}

export interface DiocesisLocalidadDTO {
  id: string;
  nombre: string;
  deBaja: boolean;
  provincia: ProvinciaDTO;
  region: Region;
}

/** What a territory is worth before you change it — see user story 10. */
export interface UsoTerritorio {
  peregrinas: number;
  misioneros: number;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// Zod is the source of truth for shapes; the router parses, so nothing invalid
// reaches the service. Messages are in Spanish because users read them.

const nombreTerritorio = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

export const regionSchema = z.enum(REGIONES as unknown as [Region, ...Region[]], {
  message: "Elegí una Región válida.",
});

export const crearProvinciaSchema = z.object({
  nombre: nombreTerritorio,
  abreviatura: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "La abreviatura debe tener al menos 2 caracteres.")
    .max(4, "La abreviatura no puede superar los 4 caracteres.")
    .regex(/^[A-ZÑ]+$/, "La abreviatura solo puede tener letras."),
  region: regionSchema,
});

export const renombrarProvinciaSchema = z.object({
  id: z.string().min(1),
  nombre: nombreTerritorio,
});

export const crearDiocesisLocalidadSchema = z.object({
  nombre: nombreTerritorio,
  provinciaId: z.string().min(1, "Elegí una Provincia."),
});

export const renombrarDiocesisLocalidadSchema = z.object({
  id: z.string().min(1),
  nombre: nombreTerritorio,
});

export const buscarPorNombreSchema = z.object({
  provincia: z.string(),
  diocesisLocalidad: z.string(),
});

export type CrearProvinciaInput = z.infer<typeof crearProvinciaSchema>;
export type RenombrarProvinciaInput = z.infer<typeof renombrarProvinciaSchema>;
export type CrearDiocesisLocalidadInput = z.infer<
  typeof crearDiocesisLocalidadSchema
>;
export type RenombrarDiocesisLocalidadInput = z.infer<
  typeof renombrarDiocesisLocalidadSchema
>;
export type BuscarPorNombreInput = z.infer<typeof buscarPorNombreSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
