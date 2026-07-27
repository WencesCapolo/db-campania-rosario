import { z } from "zod";
import { REGIONES, type Region } from "./territorio.schema";

// ── DTOs (what the UI receives) ───────────────────────────────────────────────
// Never a Drizzle row. A Diócesis/Localidad always arrives with its Provincia
// resolved, because a caller that has to traverse for it is a caller that can
// get it wrong.

/**
 * A Provincia has no Región.
 *
 * It used to. The Campaña's pastoral regions cut across provincial borders —
 * Santa Fe is both NEA and CENTRO, Buenos Aires is both BS. AS and R. PAM — so
 * one Región per Provincia was an answer that had to be wrong somewhere, and
 * was wrong in eight places. Región belongs to the Diócesis/Localidad now.
 */
export interface ProvinciaDTO {
  id: string;
  nombre: string;
  abreviatura: string;
  deBaja: boolean;
}

export interface DiocesisLocalidadDTO {
  id: string;
  nombre: string;
  deBaja: boolean;
  provincia: ProvinciaDTO;
  /** This Diócesis's own Región, not its Provincia's — see ProvinciaDTO. */
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

/**
 * The territorial half of the shared filters.
 *
 * It lives here rather than beside the rest of them because territory is upstream
 * of everything: Misionero and Peregrina both filter by it, and the import chain
 * runs territorio → misionero → peregrina → asignacion. A Peregrina-owned
 * definition would be unreachable from Misionero, and a second copy there is how
 * "my Diócesis" would come to mean two things.
 *
 * Both fields narrow within the Actor's `Alcance` and neither can widen it. The
 * refusal for an out-of-scope id belongs to the services, which know who asked.
 */
export const filtrosTerritorialesSchema = z.object({
  diocesisLocalidadId: z.string().min(1).optional(),
  region: regionSchema.optional(),
});

export type FiltrosTerritoriales = z.infer<typeof filtrosTerritorialesSchema>;

export const crearProvinciaSchema = z.object({
  nombre: nombreTerritorio,
  abreviatura: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "La abreviatura debe tener al menos 2 caracteres.")
    .max(4, "La abreviatura no puede superar los 4 caracteres.")
    .regex(/^[A-ZÑ]+$/, "La abreviatura solo puede tener letras."),
});

export const renombrarProvinciaSchema = z.object({
  id: z.string().min(1),
  nombre: nombreTerritorio,
});

export const crearDiocesisLocalidadSchema = z.object({
  nombre: nombreTerritorio,
  provinciaId: z.string().min(1, "Elegí una Provincia."),
  // Asked for rather than derived from the Provincia, because it is not
  // derivable: Reconquista and Rosario are both in Santa Fe and in different
  // Regiones. Whoever adds the Diócesis is the one who knows which.
  region: regionSchema,
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

export type { ActionResult } from "@/lib/action-result";
