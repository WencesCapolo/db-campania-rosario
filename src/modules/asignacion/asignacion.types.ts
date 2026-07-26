import { z } from "zod";

// ── DTOs (what the UI receives) ───────────────────────────────────────────────

/**
 * The login that registered a period of charge — user story 5.
 *
 * Referentes Locales share one login per territory (settled 2026-07-25), so this
 * answers *which territory* registered it and not *who*. Copy built on top of it
 * must not imply individual accountability: "Registrada por Villa María" is
 * true, "Registrada por María Pérez" is not.
 */
export interface RegistroDTO {
  usuarioId: string;
  /** The Diócesis/Localidad of that login. Null for the two nacional rols. */
  diocesisLocalidad: string | null;
}

/** The Misionero side of an Asignación, resolved to a name. */
export interface MisioneroDeAsignacionDTO {
  id: string;
  nombre: string;
  apellido: string;
  /**
   * They have left the Campaña. Historical Asignaciones still name them, which
   * is user story 15 and the reason nothing is ever destroyed.
   */
  deBaja: boolean;
}

/** The Peregrina side, resolved to its Código. */
export interface PeregrinaDeAsignacionDTO {
  id: string;
  codigo: string;
  deBaja: boolean;
}

export interface AsignacionDTO {
  id: string;
  peregrina: PeregrinaDeAsignacionDTO;
  misionero: MisioneroDeAsignacionDTO;

  abiertaAt: Date;
  /** Null means open: this Misionero has the image right now. */
  cerradaAt: Date | null;
  abierta: boolean;

  /**
   * Whole days from opening to closing, or to now while it is still open — user
   * story 18.
   *
   * The interval, not a verdict. What counts as "has not changed hands recently"
   * is still unanswered (it affects one issue #5 card), so the screen decides
   * where to draw the line and this stays a number.
   */
  diasEnCargo: number;

  registradaPor: RegistroDTO;
  cerradaPor: RegistroDTO | null;

  notaApertura: string | null;
  notaCierre: string | null;

  /** Set when the record was corrected, so the correction is itself visible. */
  corregidaAt: Date | null;
  corregidaPor: RegistroDTO | null;

  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

const nota = z
  .string()
  .trim()
  .max(500, "La nota no puede superar los 500 caracteres.")
  .nullish();

const id = (que: string) => z.string().min(1, `Elegí ${que}.`);

/** Give a Peregrina that nobody currently has to a Misionero — story 1 and 8. */
export const asignarSchema = z.object({
  peregrinaId: id("una Peregrina"),
  misioneroId: id("un Misionero"),
  nota,
});

/**
 * Hand an image on: close the open Asignación and open another, in one
 * transaction — story 1 and 2.
 *
 * Deliberately not the same operation as `asignar`. Assigning a Peregrina that
 * somebody already has is refused rather than silently closing their period,
 * because a Referente who did not know it was out needs to be told, not obeyed.
 */
export const entregarSchema = z.object({
  peregrinaId: id("una Peregrina"),
  misioneroId: id("el nuevo Misionero"),
  /** Context for the period that ends. */
  notaCierre: nota,
  /** Context for the period that begins. */
  nota,
});

/** The image came back and is not going straight out again — story 3. */
export const devolverSchema = z.object({
  peregrinaId: id("una Peregrina"),
  notaCierre: nota,
});

/**
 * Correct a mistaken Asignación — story 17. An edit, never a deletion: a typo
 * must not become permanent history, and neither must the correction be silent.
 */
export const corregirSchema = z
  .object({
    asignacionId: z.string().min(1),
    misioneroId: z.string().min(1).optional(),
    abiertaAt: z.coerce.date().optional(),
    cerradaAt: z.coerce.date().optional(),
    notaApertura: nota,
    notaCierre: nota,
  })
  .refine(
    (v) =>
      v.misioneroId !== undefined ||
      v.abiertaAt !== undefined ||
      v.cerradaAt !== undefined ||
      v.notaApertura !== undefined ||
      v.notaCierre !== undefined,
    { message: "No hay nada que corregir." }
  );

export type AsignarInput = z.infer<typeof asignarSchema>;
export type EntregarInput = z.infer<typeof entregarSchema>;
export type DevolverInput = z.infer<typeof devolverSchema>;
export type CorregirInput = z.infer<typeof corregirSchema>;

// ── Result pattern ────────────────────────────────────────────────────────────

export type { ActionResult } from "@/lib/action-result";
