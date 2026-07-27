import { z } from "zod";
import {
  centroTipoEnum,
  misioneroEstadoEnum,
  type MisioneroEstado,
  type CentroTipo,
} from "./misionero.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import {
  filtrosTerritorialesSchema,
  type DiocesisLocalidadDTO,
} from "@/modules/territorio/territorio.types";

// ── Labels ────────────────────────────────────────────────────────────────────

/**
 * How each kind of centro is written on screen.
 *
 * Here rather than in a page, because two screens need it: the detail page had
 * its own copy and the creation form would have been the second. A label table
 * duplicated per screen is how "Ermita" becomes "ermita" on one of them.
 *
 * Typed as a total `Record`, so adding a value to `centroTipoEnum` without a
 * Spanish label for it fails the typecheck rather than rendering the enum's raw
 * value at somebody.
 */
export const CENTRO_LABELS: Record<CentroTipo, string> = {
  santuario: "Santuario",
  ermita: "Ermita",
  parroquia: "Parroquia",
};

export const CENTRO_TIPOS: readonly CentroTipo[] = centroTipoEnum.enumValues;

// ── DTO (what the UI receives) ────────────────────────────────────────────────

export interface MisioneroDTO {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  estado: MisioneroEstado;
  diocesisLocalidad: DiocesisLocalidadDTO;
  provincia: string;
  region: Region;
  /**
   * Given de baja — they have left the Campaña. Excluded from every list by
   * default and still resolving by name inside historical Asignaciones, which is
   * the whole reason the row is never destroyed (user story 15).
   */
  deBaja: boolean;
  centroTipo: CentroTipo | null;
  centroNombre: string | null;
  anioConsagracion: number | null;
  /** { [year: string]: string } */
  resumenesAnuales: Record<string, string>;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

/**
 * The two halves of a person's name, each complaining about itself.
 *
 * A factory rather than one schema reused twice, because the message is shown
 * *under the field* — story 14 — and "El nombre es obligatorio." beneath the
 * Apellido box is a message about the wrong box. `.describe("apellido")` looks
 * like it fixes that and does not: it annotates the schema without touching what
 * Zod says when it refuses.
 */
const nombrePersona = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `El ${campo} es obligatorio.`)
    .max(120, `El ${campo} no puede superar los 120 caracteres.`);

const telefono = z
  .string()
  .trim()
  .max(40, "El teléfono no puede superar los 40 caracteres.")
  .nullish();

// The Campaña has no Misioneros consecrated before this, and a year in the
// future is a typo. Evaluated per call so the suite does not rot in January.
const anioConsagracion = z
  .number()
  .int()
  .min(1900, "El año de consagración no puede ser anterior a 1900.")
  .refine(
    (a) => a <= new Date().getFullYear(),
    "El año de consagración no puede estar en el futuro."
  )
  .nullish();

export const createMisioneroSchema = z.object({
  nombre: nombrePersona("nombre"),
  apellido: nombrePersona("apellido"),
  telefono,
  diocesisLocalidadId: z.string().min(1, "Elegí una Diócesis/Localidad."),
  centroTipo: z.enum(centroTipoEnum.enumValues).nullish(),
  centroNombre: z.string().trim().max(200).nullish(),
  anioConsagracion,
});

export const updateMisioneroSchema = z.object({
  nombre: nombrePersona("nombre").optional(),
  apellido: nombrePersona("apellido").optional(),
  telefono,
  estado: z.enum(misioneroEstadoEnum.enumValues).optional(),
  diocesisLocalidadId: z.string().min(1).optional(),
  centroTipo: z.enum(centroTipoEnum.enumValues).nullish(),
  centroNombre: z.string().trim().max(200).nullish(),
  anioConsagracion,
  // There is deliberately no `peregrinaId` here any more. Charge used to be a
  // pointer this input overwrote, which is exactly how the previous holder
  // disappeared. It is an Asignación now — see `AsignacionService.asignar`,
  // `entregar` and `devolver`. Leaving this field would be a second, unguarded
  // way to change charge, and the one that skips the invariant.
});

export const addResumenAnualSchema = z.object({
  misioneroId: z.string().min(1),
  year: z.number().int().min(2000, "Año inválido."),
  resumen: z.string().trim().min(1, "El resumen no puede estar vacío."),
});

// ── Filtros ───────────────────────────────────────────────────────────────────

/**
 * What can be asked of a list of people: where they are, and their name.
 *
 * The territorial half is the shared schema, so `?diocesisLocalidadId=` means the
 * same thing here, on the Peregrina list and on the tablero. Estado, Modalidad
 * and Tipo are deliberately absent — they are properties of an image, and a
 * "Misioneros de Modalidad Jóvenes" filter would be inventing a relationship the
 * Campaña does not record.
 */
export const filtrosDeMisioneroSchema = filtrosTerritorialesSchema.extend({
  q: z.string().trim().min(1).max(80).optional(),
});

export type FiltrosDeMisionero = z.infer<typeof filtrosDeMisioneroSchema>;

export type CreateMisioneroInput = z.infer<typeof createMisioneroSchema>;
export type UpdateMisioneroInput = z.infer<typeof updateMisioneroSchema>;
export type AddResumenAnualInput = z.infer<typeof addResumenAnualSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type { ActionResult } from "@/lib/action-result";
