import { z } from "zod";
import {
  peregrinaEstadoEnum,
  peregrinaTipoEnum,
  modalidadEnum,
  type PeregrinaEstado,
  type PeregrinaTipo,
  type Modalidad,
} from "./peregrina.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

// ── DTO (what the UI receives) ────────────────────────────────────────────────
// The territory arrives resolved: full names rather than abbreviations, with
// Provincia and Región already traversed so that no caller has to do it and
// get it wrong.

export interface PeregrinaDTO {
  id: string;
  codigo: string;
  tipo: PeregrinaTipo;
  estado: PeregrinaEstado;
  modalidad: Modalidad;
  diocesisLocalidad: DiocesisLocalidadDTO;
  provincia: string;
  region: Region;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// Three territory fields became one choice. Provincia and Región follow from
// the Diócesis/Localidad, so a contradictory combination is unrepresentable.

export const createPeregrinaSchema = z.object({
  tipo: z.enum(peregrinaTipoEnum.enumValues, { message: "Elegí un Tipo válido." }),
  modalidad: z.enum(modalidadEnum.enumValues, {
    message: "Elegí una Modalidad válida.",
  }),
  diocesisLocalidadId: z
    .string()
    .min(1, "Elegí una Diócesis/Localidad."),
});

export const updatePeregrinaSchema = z.object({
  tipo: z.enum(peregrinaTipoEnum.enumValues).optional(),
  estado: z.enum(peregrinaEstadoEnum.enumValues).optional(),
  modalidad: z.enum(modalidadEnum.enumValues).optional(),
  diocesisLocalidadId: z.string().min(1).optional(),
});

export type CreatePeregrinaInput = z.infer<typeof createPeregrinaSchema>;
export type UpdatePeregrinaInput = z.infer<typeof updatePeregrinaSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type { ActionResult } from "@/lib/action-result";
