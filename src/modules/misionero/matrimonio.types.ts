import { z } from "zod";
import {
  centroTipoEnum,
  misioneroEstadoEnum,
  type CentroTipo,
} from "./misionero.schema";
import type { MisioneroEstado } from "./misionero.schema";
import type { MisioneroDTO } from "./misionero.types";

// ── El Tenedor ────────────────────────────────────────────────────────────────

/**
 * Whoever a Peregrina is in the charge of: one Misionero, or one Matrimonio.
 *
 * A union type and **not** a `tenedor` table — ADR 0010. The type is free; the
 * table would have cost a denormalised label to render, which is a second copy
 * of two people's names waiting to drift out of date.
 *
 * It is one value for three reasons, and the third is the one that decided it:
 * the four charge-changing methods take one parameter instead of two half-filled
 * ones; the repository has one place that fans it out to the two columns; and a
 * native `<select>` holds one string, while the listado is one list of both
 * kinds. See `valorDeTenedor` / `tenedorDesdeValor` below.
 */
export type Tenedor =
  | { tipo: "persona"; id: string }
  | { tipo: "matrimonio"; id: string };

export type TipoDeTenedor = Tenedor["tipo"];

export const tenedorSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("persona"), id: z.string().min(1) }),
  z.object({ tipo: z.literal("matrimonio"), id: z.string().min(1) }),
]);

/**
 * The `<option value>` for a Tenedor, and its inverse.
 *
 * A native `<select>` — which CLAUDE.md §6 requires, for the OS picker and the
 * focus handling — carries one string per option. The listado's union already
 * projects `(id, tipo)`, so the value is built from columns that exist rather
 * than from anything a component invents.
 *
 * `tenedorDesdeValor` returns null rather than throwing on a malformed string:
 * its caller is a change handler, and the only thing that can produce a value
 * here is an option this same module rendered. A refusal belongs at the router,
 * where `tenedorSchema` parses.
 */
export function valorDeTenedor(t: Tenedor): string {
  return `${t.tipo}:${t.id}`;
}

export function tenedorDesdeValor(valor: string): Tenedor | null {
  const corte = valor.indexOf(":");
  if (corte < 1) return null;
  const tipo = valor.slice(0, corte);
  const id = valor.slice(corte + 1);
  if (!id) return null;
  if (tipo === "persona" || tipo === "matrimonio") return { tipo, id };
  return null;
}

// ── DTO ───────────────────────────────────────────────────────────────────────

/**
 * A Matrimonio as a screen receives it.
 *
 * Territory is not a column on the table and is not one here either: it is
 * spouse A's, and it is well defined only because both spouses share it. The
 * DTO flattens that so no screen has to know which spouse it came from.
 */
export interface MatrimonioDTO {
  id: string;
  misioneroA: MisioneroDTO;
  misioneroB: MisioneroDTO;
  estado: MisioneroEstado;
  // No teléfono on the couple: each spouse carries their own, both optional.
  // Read them off `misioneroA.telefono` / `misioneroB.telefono`.
  centroTipo: CentroTipo | null;
  centroNombre: string | null;
  /** The Matrimonio has ended — a separation, or a death. */
  deBaja: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One row of the listado, which is a union of two kinds.
 *
 * `etiqueta` is computed at read time by `lib/formato.ts` and is deliberately
 * not stored — see the note on `Tenedor` about the label a supertype table
 * would have needed.
 */
export type TenedorDTO =
  | { tipo: "persona"; persona: MisioneroDTO }
  | { tipo: "matrimonio"; matrimonio: MatrimonioDTO };

// ── Inputs ────────────────────────────────────────────────────────────────────

const nombrePersona = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `El ${campo} es obligatorio.`)
    .max(120, `El ${campo} no puede superar los 120 caracteres.`);

/**
 * Each spouse's own number, and both are optional.
 *
 * Two rather than one because a household has two, and the second is exactly the
 * one somebody reaches for when the first does not answer — which is the reason
 * the Campaña writes a phone down at all. Neither is required: a Misionero's
 * teléfono has always been optional, and making the first half of a couple carry
 * an obligation the same person would not carry alone would be an odd rule.
 */
const telefono = z
  .string()
  .trim()
  .max(40, "El teléfono no puede superar los 40 caracteres.")
  .nullish();

const anioConsagracion = z
  .number()
  .int()
  .min(1900, "El año de consagración no puede ser anterior a 1900.")
  .refine(
    (a) => a <= new Date().getFullYear(),
    "El año de consagración no puede estar en el futuro."
  )
  .nullish();

/**
 * Both spouses, in one submit.
 *
 * The field names carry the suffix the form's blur validation reads, so
 * `useValidacionAlSalir` keeps working against this schema unchanged — one
 * schema, parsed by the router and consulted by the field, never a second copy
 * of the rule written for the client (ADR 0008).
 *
 * The territory and the Centro appear once, because a household has one of each
 * and asking twice invites two answers that disagree. The teléfono and the Año
 * de consagración are per spouse: two people are consecrated in two different
 * years, and a household has two numbers.
 */
export const createMatrimonioSchema = z.object({
  nombreA: nombrePersona("nombre"),
  apellidoA: nombrePersona("apellido"),
  telefonoA: telefono,
  anioConsagracionA: anioConsagracion,

  nombreB: nombrePersona("nombre"),
  apellidoB: nombrePersona("apellido"),
  telefonoB: telefono,
  anioConsagracionB: anioConsagracion,

  diocesisLocalidadId: z.string().min(1, "Elegí una Diócesis/Localidad."),
  centroTipo: z.enum(centroTipoEnum.enumValues).nullish(),
  centroNombre: z.string().trim().max(200).nullish(),
});

export type CreateMatrimonioInput = z.infer<typeof createMatrimonioSchema>;

/**
 * A correction to a couple already entered.
 *
 * Derived from `createMatrimonioSchema` rather than written out again, so a rule
 * added to entry cannot fail to apply to an edit — an apellido that may not be
 * blank on the way in may not become blank later either.
 *
 * `estado` is the one field that is here and not there: a couple is entered
 * activo, and the only way to make one inactivo is by editing it afterwards.
 * There is deliberately no `bajaAt` — ending a Matrimonio is `baja`, which is a
 * refusal-carrying operation of its own and not a field somebody can set.
 */
export const updateMatrimonioSchema = createMatrimonioSchema.partial().extend({
  estado: z.enum(misioneroEstadoEnum.enumValues).optional(),
});

export type UpdateMatrimonioInput = z.infer<typeof updateMatrimonioSchema>;
