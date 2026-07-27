"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { PeregrinaService } from "./peregrina.service";
import { revalidatePath } from "next/cache";
import {
  createPeregrinaSchema,
  updatePeregrinaSchema,
  filtrosDeInventarioSchema,
} from "./peregrina.types";
import type { ActionResult, PeregrinaDTO } from "./peregrina.types";
import type { PeregrinaEstado } from "./peregrina.schema";
import { aResultado } from "@/lib/errors";
import { paginaSchema, type Pagina } from "@/lib/paginacion";

/**
 * PeregrinaRouter — Next.js server actions
 *
 * Responsibility: resolve the Actor, parse input with Zod so nothing invalid
 * reaches a service, delegate, revalidate the cache, and map thrown domain
 * errors onto a result. No business logic lives here.
 *
 * Reads let the error through to the page's error boundary rather than swallowing
 * it into an empty list: a silently blank table is a bug, and an authorization
 * refusal that renders as "no hay Peregrinas" is a lie.
 */

export async function getPeregrinasAction(): Promise<PeregrinaDTO[]> {
  const actor = await getCurrentUser();
  return PeregrinaService.listAll(actor);
}

export async function getPeregrinaByIdAction(id: string): Promise<PeregrinaDTO> {
  const actor = await getCurrentUser();
  return PeregrinaService.getById(actor, id);
}

/**
 * The listado's one read — every filter, in the database.
 *
 * The filters are parsed here, at the boundary, and an invalid shape is a
 * refusal rather than a silently ignored value: the lenient reading of a query
 * string happens in `filtrosDesdeParams` before this is called, and by the time
 * a filter reaches a service it is either valid or absent.
 *
 * `inactiva` is reachable on purpose. It is excluded from *entry* and from the
 * filter control — see `ESTADOS_SELECCIONABLES` — but a record already carrying
 * it must stay readable, and a read that refused the value would make those
 * records unreachable rather than merely unwritable.
 */
export async function getPeregrinasFiltradasAction(
  filtros: unknown
): Promise<PeregrinaDTO[]> {
  const actor = await getCurrentUser();
  const parsed = filtrosDeInventarioSchema.parse(filtros ?? {});
  return PeregrinaService.listFiltradas(actor, parsed);
}

/**
 * The listado's read, one page at a time — story 23.
 *
 * The page is parsed here like everything else that arrives from outside: the
 * lenient reading of `?pagina=` happens in `paginaDesdeParams`, so what gets to
 * this boundary is either a positive integer or absent. A page past the end is
 * not a validation failure — the service clamps it, because only it knows how
 * many pages the filters leave.
 */
export async function getPeregrinasPaginadasAction(
  filtros: unknown,
  pagina: unknown
): Promise<Pagina<PeregrinaDTO>> {
  const actor = await getCurrentUser();
  const parsedFiltros = filtrosDeInventarioSchema.parse(filtros ?? {});
  const parsedPagina = paginaSchema.parse(pagina ?? 1);
  return PeregrinaService.listPagina(actor, parsedFiltros, parsedPagina);
}

export async function getPeregrinasPorEstadoAction(
  estado: PeregrinaEstado
): Promise<PeregrinaDTO[]> {
  const actor = await getCurrentUser();
  return PeregrinaService.listByEstado(actor, estado);
}

export async function createPeregrinaAction(
  input: unknown
): Promise<ActionResult<PeregrinaDTO>> {
  const actor = await getCurrentUser();

  const parsed = createPeregrinaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      codigo: "validacion",
    };
  }

  const result = await aResultado(() =>
    PeregrinaService.create(actor, parsed.data)
  );

  if (result.ok) revalidatePath("/peregrina");

  return result;
}

export async function updatePeregrinaAction(
  id: string,
  input: unknown
): Promise<ActionResult<PeregrinaDTO>> {
  const actor = await getCurrentUser();

  const parsed = updatePeregrinaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      codigo: "validacion",
    };
  }

  const result = await aResultado(() =>
    PeregrinaService.update(actor, id, parsed.data)
  );

  if (result.ok) {
    revalidatePath("/peregrina");
    revalidatePath(`/peregrina/${id}`);
  }

  return result;
}

/**
 * Takes a Peregrina out of the active inventory — user story 16.
 *
 * There is no delete action. An Asignación that cannot resolve its Código is a
 * row of unreadable ids, so records are given de baja and never destroyed.
 */
export async function darDeBajaPeregrinaAction(
  id: string
): Promise<ActionResult<PeregrinaDTO>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => PeregrinaService.darDeBaja(actor, id));

  if (result.ok) {
    revalidatePath("/peregrina");
    revalidatePath(`/peregrina/${id}`);
  }

  return result;
}

export async function reactivarPeregrinaAction(
  id: string
): Promise<ActionResult<PeregrinaDTO>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => PeregrinaService.reactivar(actor, id));

  if (result.ok) {
    revalidatePath("/peregrina");
    revalidatePath(`/peregrina/${id}`);
  }

  return result;
}
