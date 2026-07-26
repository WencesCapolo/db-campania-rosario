import { z } from "zod";
import {
  peregrinaTipoEnum,
  modalidadEnum,
  type PeregrinaEstado,
  type PeregrinaTipo,
  type Modalidad,
} from "./peregrina.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

// ── Estados ───────────────────────────────────────────────────────────────────

/**
 * The Estados a Referente may choose. `inactiva` is missing on purpose: records
 * already carry it and keep displaying it, but nothing new is entered as
 * `inactiva`, so each one gets corrected knowingly rather than rewritten by a
 * migration that would have to guess what the person meant.
 */
export const ESTADOS_SELECCIONABLES = [
  "activa",
  "en_reparacion",
  "extraviada",
] as const satisfies readonly PeregrinaEstado[];

export type EstadoSeleccionable = (typeof ESTADOS_SELECCIONABLES)[number];

/** Spanish labels, including for the legacy value, because it still renders. */
export const ESTADO_LABELS: Record<PeregrinaEstado, string> = {
  activa: "Activa",
  en_reparacion: "En reparación",
  extraviada: "Extraviada",
  inactiva: "Inactiva (en desuso)",
};

// ── Modalidades ───────────────────────────────────────────────────────────────

/**
 * The Campaña's own names for its apostolates.
 *
 * A `Record<Modalidad, string>` rather than a lookup with a fallback, so adding
 * a Modalidad to the enum and forgetting to name it is a type error rather than
 * a screen that renders "SOR".
 *
 * There is no `MODALIDADES_SELECCIONABLES` beside it, unlike Estado: every
 * Modalidad here is one somebody may choose. The two placeholder values that
 * were not real apostolates were removed from the enum outright in migration
 * 0006, so there is nothing to exclude.
 */
export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  MIS: "Misioneritos",
  FAM: "Familias",
  MAT: "Matrimonios",
  TRA: "Trabajo",
  RIE: "Niños y Bebés en riesgo",
  DUL: "Dulce Espera (niños por nacer)",
  JOV: "Jóvenes",
  NVI: "No Videntes",
  SAL: "De la Salud",
  SER: "Serenidad y Confianza",
  TAX: "Taxistas",
  HPR: "Hijo Pródigo",
  CEN: "Cenáculo",
  SOR: "Sordos",
  SAC: "María Madre y Reina de los Sacerdotes",
  VOC: "Vocaciones",
};

/** Ordered for a picker: the Campaña's own order, not alphabetical. */
export const MODALIDADES: readonly Modalidad[] = modalidadEnum.enumValues;

export const TIPO_LABELS: Record<PeregrinaTipo, string> = {
  peregrina: "Peregrina",
  auxiliar: "Auxiliar",
};

// ── DTO (what the UI receives) ────────────────────────────────────────────────
// The territory arrives resolved: full names rather than abbreviations, with
// Provincia and Región already traversed so that no caller has to do it and
// get it wrong.

/**
 * Who has the image right now, resolved to a name so a list can render it.
 *
 * Read off Peregrina's denormalised pointer rather than the open Asignación, so
 * that a list of two hundred rows costs one join and not two hundred. `deBaja`
 * is here because a Misionero given de baja still shows up as the holder — that
 * pairing is exactly what the guard on `MisioneroService.darDeBaja` prevents, so
 * seeing it means something went wrong.
 */
export interface TenenciaActualDTO {
  misioneroId: string;
  nombre: string;
  apellido: string;
  deBaja: boolean;
}

export interface PeregrinaDTO {
  id: string;
  codigo: string;
  tipo: PeregrinaTipo;
  estado: PeregrinaEstado;
  modalidad: Modalidad;
  diocesisLocalidad: DiocesisLocalidadDTO;
  provincia: string;
  region: Region;
  /** The open Asignación's Misionero, or null when nobody has it. */
  tenenciaActual: TenenciaActualDTO | null;
  deBaja: boolean;
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
  // Seleccionables, not the full enum: `inactiva` is readable and unwritable.
  estado: z
    .enum(ESTADOS_SELECCIONABLES, { message: "Elegí un Estado válido." })
    .optional(),
  modalidad: z.enum(modalidadEnum.enumValues).optional(),
  diocesisLocalidadId: z.string().min(1).optional(),
});

export type CreatePeregrinaInput = z.infer<typeof createPeregrinaSchema>;
export type UpdatePeregrinaInput = z.infer<typeof updatePeregrinaSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type { ActionResult } from "@/lib/action-result";
