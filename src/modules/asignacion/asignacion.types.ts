import { z } from "zod";
import {
  tenedorSchema,
  type Tenedor,
} from "@/modules/misionero/matrimonio.types";
import type { TenedorResueltoDTO } from "@/lib/tenedor";

// ── DTOs (what the UI receives) ───────────────────────────────────────────────

/**
 * The login that registered a period of charge — user story 5.
 *
 * A Buzón is one per function, shared by everybody who does it (ADR 0016), so
 * this cannot answer *who*. Copy built on top of it must not imply individual
 * accountability: "Registrada por María Pérez" is not true of a shared login.
 */
export interface RegistroDTO {
  usuarioId: string;
}

/**
 * The holder side of an Asignación, resolved to a name — one Misionero, or one
 * Matrimonio (ADR 0010).
 *
 * Re-exported rather than redefined: `peregrina.tenenciaActual` answers the same
 * question off the denormalised pointer, and two shapes for one answer is how a
 * screen ends up with two ways of rendering a couple. See `lib/tenedor.ts` for
 * why the type lives where it does.
 */
export type { TenedorResueltoDTO, PersonaDeTenedorDTO } from "@/lib/tenedor";

/** The Peregrina side, resolved to its Identificación. */
export interface PeregrinaDeAsignacionDTO {
  id: string;
  identificacion: string;
}

/**
 * Qué imagen tiene un **Tenedor** ahora mismo — la columna «¿Tiene imagen?» del
 * listado de Misioneros.
 *
 * Va por Tenedor y no por Misionero, que es el bug que ADR 0010 avisa que falla
 * en silencio: el listado es una unión cuyas filas son Tenedores, y la fila de un
 * Matrimonio lleva un id de `matrimonio`. Pasado a una API por Misionero no
 * coincidía con nada y la celda decía «Ninguna» con la imagen en la casa.
 *
 * La clave es el `Tenedor` entero y no el id solo: un id de persona y uno de
 * pareja son dos espacios de ids distintos, y comparar sólo el id haría de una
 * persona y un Matrimonio la misma fila si alguna vez colisionaran.
 */
export interface TenenciaDeTenedorDTO {
  tenedor: Tenedor;
  /** Las que tiene abiertas, ordenadas por Identificación. */
  peregrinas: { id: string; identificacion: string }[];
}

export interface AsignacionDTO {
  id: string;
  peregrina: PeregrinaDeAsignacionDTO;
  /** Quién tuvo la imagen en este período: un Misionero, o un Matrimonio. */
  tenedor: TenedorResueltoDTO;

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

/**
 * El Tenedor, tal como llega de un `<select>` — story 1 y ADR 0010.
 *
 * Se parsea acá, en el borde, y no en el service: una unión discriminada mal
 * formada no tiene que poder llegar a una regla de negocio. Es el mismo esquema
 * que arma el `<option value>`, así que la pantalla y el router no pueden
 * discrepar sobre qué es un Tenedor.
 */
const tenedor = tenedorSchema;

/** Give a Peregrina that nobody currently has to a Tenedor — story 1 and 8. */
export const asignarSchema = z.object({
  peregrinaId: id("una Peregrina"),
  tenedor,
  nota,
});

/**
 * Hand an image on: close the open Asignación and open another, in one
 * transaction — story 1 and 2.
 *
 * Deliberately not the same operation as `asignar`. Assigning a Peregrina that
 * somebody already has is refused rather than silently closing their period,
 * because somebody who did not know it was out needs to be told, not obeyed.
 */
export const entregarSchema = z.object({
  peregrinaId: id("una Peregrina"),
  /** Quién la recibe: el nuevo Misionero, o el nuevo Matrimonio. */
  tenedor,
  /** Context for the period that ends. */
  notaCierre: nota,
  /** Context for the period that begins. */
  nota,
});

/**
 * The image came back and is not going straight out again — story 3.
 *
 * No lleva Tenedor, y eso no es un olvido de ADR 0010: devolver cierra *el
 * período abierto*, sea de quien sea, y una Peregrina tiene a lo sumo uno. Pedir
 * quién la devuelve sería pedir un dato que el sistema ya tiene y contra el que
 * habría que validar la respuesta.
 */
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
    /** Corregir quién la tuvo: la persona equivocada, o el Matrimonio entero. */
    tenedor: tenedorSchema.optional(),
    abiertaAt: z.coerce.date().optional(),
    cerradaAt: z.coerce.date().optional(),
    notaApertura: nota,
    notaCierre: nota,
  })
  .refine(
    (v) =>
      v.tenedor !== undefined ||
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
