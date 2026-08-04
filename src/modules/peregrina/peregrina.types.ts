import { z } from "zod";
import {
  peregrinaTipoEnum,
  peregrinaEstadoEnum,
  modalidadEnum,
  type PeregrinaEstado,
  type PeregrinaTipo,
  type Modalidad,
} from "./peregrina.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import type { TenedorResueltoDTO } from "@/lib/tenedor";
import {
  filtrosTerritorialesSchema,
  type DiocesisLocalidadDTO,
} from "@/modules/territorio/territorio.types";

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
 * Who has the image right now, resolved to a name so a list can render it — one
 * Misionero, or one Matrimonio (ADR 0010).
 *
 * Read off Peregrina's two denormalised pointers rather than the open
 * Asignación, so that a list of two hundred rows costs a handful of joins and
 * not two hundred. `deBaja` travels with it because a Misionero given de baja
 * still shows up as the holder — that pairing is exactly what the guard on
 * `MisioneroService.darDeBaja` prevents, so seeing it means something went
 * wrong.
 *
 * Es el mismo tipo que lleva una Asignación: la pregunta «quién la tiene» tiene
 * una sola forma de respuesta, la conteste el puntero o el período. Ver
 * `lib/tenedor.ts` para por qué el tipo vive donde vive.
 */
export type { TenedorResueltoDTO, PersonaDeTenedorDTO } from "@/lib/tenedor";

export interface PeregrinaDTO {
  id: string;
  codigo: string;
  tipo: PeregrinaTipo;
  estado: PeregrinaEstado;
  modalidad: Modalidad;
  diocesisLocalidad: DiocesisLocalidadDTO;
  provincia: string;
  region: Region;
  /** The open Asignación's Tenedor, or null when nobody has it — *libre*. */
  tenenciaActual: TenedorResueltoDTO | null;
  deBaja: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// Three territory fields became one choice. Provincia and Región follow from
// the Diócesis/Localidad, so a contradictory combination is unrepresentable.

export const createPeregrinaSchema = z.object({
  tipo: z.enum(peregrinaTipoEnum.enumValues, {
    message: "Elegí un Tipo válido.",
  }),
  modalidad: z.enum(modalidadEnum.enumValues, {
    message: "Elegí una Modalidad válida.",
  }),
  diocesisLocalidadId: z.string().min(1, "Elegí una Diócesis/Localidad."),
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

// ── Filtros ───────────────────────────────────────────────────────────────────
// One definition, shared by the tablero and by the listados. The vocabulary and
// the behaviour cannot diverge between screens because there is nothing to keep
// in step: both parse the same schema out of the same address.
//
// It lives in peregrina because peregrina owns four of the six dimensions —
// Estado, Modalidad, Tipo and Código. Territory is a foreign key and a Región,
// both of which this module already reads.

/**
 * Whether an image is in somebody's charge right now.
 *
 * Read off los dos punteros denormalizados — `libre` es que **ninguno** de los
 * dos esté puesto (ADR 0010) —, y por lo tanto *no* es la misma pregunta que
 * "nunca se asignó", que es un anti-join contra Asignación y vive en
 * `AsignacionRepository`. Una imagen entregada y devuelta es `libre` acá y no
 * está en la lista de las nunca asignadas.
 */
export const TENENCIAS = ["libre", "asignada"] as const;
export type Tenencia = (typeof TENENCIAS)[number];

export const TENENCIA_LABELS: Record<Tenencia, string> = {
  libre: "No la tiene nadie",
  asignada: "En manos de un Misionero",
};

/**
 * The filters, validated. Every field optional: absent means "no restriction",
 * which is what an empty picker means to somebody reading the screen.
 *
 * Estado accepts the full enum rather than `ESTADOS_SELECCIONABLES`. `inactiva`
 * is excluded from *entry* and from the control, but a record carrying it has to
 * stay reachable — a filter that refused the value would make those records
 * unreadable rather than merely unwritable.
 *
 * `diocesisLocalidadId` narrows within the Actor's own scope and can never widen
 * it. That is not enforced here — a schema cannot know who is asking — but in
 * the service, which refuses an out-of-scope territory rather than quietly
 * falling back to the Actor's own. Falling back would relabel one Diócesis's
 * figures with another's name, which is worse than a refusal.
 */
export const filtrosDeInventarioSchema = filtrosTerritorialesSchema.extend({
  codigo: z.string().trim().min(1).max(40).optional(),
  /**
   * El nombre de quien la tiene ahora — no un id.
   *
   * Es texto y no un selector de Misionero a propósito: quien pregunta "¿quién
   * tenía la de Álvarez?" tiene el apellido en la cabeza, no un id, y un selector
   * de todos los Misioneros de una Diócesis es una lista de cientos. Se resuelve
   * contra la tenencia *actual* — el puntero denormalizado — así que responde
   * "quién la tiene", nunca "quién la tuvo alguna vez": eso es historia y vive en
   * Asignación.
   */
  misionero: z.string().trim().min(1).max(80).optional(),
  estado: z.enum(peregrinaEstadoEnum.enumValues).optional(),
  modalidad: z.enum(modalidadEnum.enumValues).optional(),
  tipo: z.enum(peregrinaTipoEnum.enumValues).optional(),
  tenencia: z.enum(TENENCIAS).optional(),
});

export type FiltrosDeInventario = z.infer<typeof filtrosDeInventarioSchema>;

export const SIN_FILTROS: FiltrosDeInventario = {};

/** The address's names for the filters — one list, so no screen invents a key. */
export const CLAVES_DE_FILTRO = [
  "codigo",
  "misionero",
  "estado",
  "modalidad",
  "tipo",
  "diocesisLocalidadId",
  "region",
  "tenencia",
] as const satisfies readonly (keyof FiltrosDeInventario)[];

/**
 * Filters as they arrive from the address — lenient, and deliberately so.
 *
 * A value that is not a member of its enum is *dropped*: `?estado=activva` is a
 * typo or a stale link, and refusing the whole screen over one is worse than
 * ignoring it. The one thing that is never dropped is a territory, because
 * dropping it would fall back to the Actor's own scope and show them their own
 * figures under somebody else's name — so it is passed through to the service,
 * which refuses it.
 *
 * The strict schema still runs at the router boundary. This narrows `unknown`
 * from a query string down to something the schema can accept; it is not a
 * substitute for parsing.
 */
export function filtrosDesdeParams(
  params: Record<string, string | string[] | undefined>,
): FiltrosDeInventario {
  const primero = (clave: string): string | undefined => {
    const valor = params[clave];
    const texto = (Array.isArray(valor) ? valor[0] : valor)?.trim();
    return texto ? texto : undefined;
  };

  const candidato: Record<string, string | undefined> = {};
  for (const clave of CLAVES_DE_FILTRO) candidato[clave] = primero(clave);

  // A territory is kept even when the rest of the shape is rejected, so the
  // service gets the chance to refuse it rather than never seeing it.
  const territorio = candidato.diocesisLocalidadId;
  const parsed = filtrosDeInventarioSchema.safeParse(candidato);
  if (parsed.success) return limpiar(parsed.data);

  const uno = <T>(clave: keyof FiltrosDeInventario, esquema: z.ZodType<T>) => {
    const r = esquema.safeParse(candidato[clave]);
    return r.success ? r.data : undefined;
  };

  return limpiar({
    codigo: uno("codigo", filtrosDeInventarioSchema.shape.codigo),
    misionero: uno("misionero", filtrosDeInventarioSchema.shape.misionero),
    estado: uno("estado", filtrosDeInventarioSchema.shape.estado),
    modalidad: uno("modalidad", filtrosDeInventarioSchema.shape.modalidad),
    tipo: uno("tipo", filtrosDeInventarioSchema.shape.tipo),
    diocesisLocalidadId: territorio,
    region: uno("region", filtrosDeInventarioSchema.shape.region),
    tenencia: uno("tenencia", filtrosDeInventarioSchema.shape.tenencia),
  });
}

/** Drops the absent keys, so two equivalent filter sets compare equal. */
function limpiar(filtros: FiltrosDeInventario): FiltrosDeInventario {
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined) limpio[clave] = valor;
  }
  return limpio as FiltrosDeInventario;
}

export function hayFiltros(filtros: FiltrosDeInventario): boolean {
  return CLAVES_DE_FILTRO.some((clave) => filtros[clave] !== undefined);
}

/**
 * The filters as a query string — how a figure on the tablero links to the
 * records behind it (story 21) and how a filtered view gets shared (story 20).
 */
export function comoQueryString(filtros: FiltrosDeInventario): string {
  const params = new URLSearchParams();
  for (const clave of CLAVES_DE_FILTRO) {
    const valor = filtros[clave];
    if (valor !== undefined) params.set(clave, valor);
  }
  return params.toString();
}

// ── Result pattern ────────────────────────────────────────────────────────────

export type { ActionResult } from "@/lib/action-result";
