import { z } from "zod";
import {
  centroTipoEnum,
  misioneroEstadoEnum,
  type MisioneroEstado,
  type CentroTipo,
} from "./misionero.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

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
  peregrinaId: string | null;
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

const nombrePersona = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

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
  nombre: nombrePersona,
  apellido: nombrePersona.describe("apellido"),
  telefono,
  diocesisLocalidadId: z.string().min(1, "Elegí una Diócesis/Localidad."),
  centroTipo: z.enum(centroTipoEnum.enumValues).nullish(),
  centroNombre: z.string().trim().max(200).nullish(),
  anioConsagracion,
});

export const updateMisioneroSchema = z.object({
  nombre: nombrePersona.optional(),
  apellido: nombrePersona.optional(),
  telefono,
  estado: z.enum(misioneroEstadoEnum.enumValues).optional(),
  diocesisLocalidadId: z.string().min(1).optional(),
  centroTipo: z.enum(centroTipoEnum.enumValues).nullish(),
  centroNombre: z.string().trim().max(200).nullish(),
  anioConsagracion,
  /** FK to peregrina — null unassigns. */
  peregrinaId: z.string().nullish(),
});

export const addResumenAnualSchema = z.object({
  misioneroId: z.string().min(1),
  year: z.number().int().min(2000, "Año inválido."),
  resumen: z.string().trim().min(1, "El resumen no puede estar vacío."),
});

export type CreateMisioneroInput = z.infer<typeof createMisioneroSchema>;
export type UpdateMisioneroInput = z.infer<typeof updateMisioneroSchema>;
export type AddResumenAnualInput = z.infer<typeof addResumenAnualSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
