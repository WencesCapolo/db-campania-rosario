"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { PeregrinaService } from "./peregrina.service";
import { revalidatePath } from "next/cache";
import {
  createPeregrinaSchema,
  updatePeregrinaSchema,
} from "./peregrina.types";
import type { ActionResult, PeregrinaDTO } from "./peregrina.types";
import type { Modalidad, PeregrinaEstado } from "./peregrina.schema";
import { aResultado } from "@/lib/errors";

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
 * The two filtered reads the listado uses.
 *
 * `listByEstado` and `listByModalidad` have existed and been tested since issue
 * #1; they simply had no action in front of them, because there was no screen.
 * Both are indexed reads, which is why the list asks for them rather than
 * fetching everything and narrowing in the browser.
 *
 * `inactiva` is reachable here on purpose. It is excluded from *entry* and from
 * the filter control — see `ESTADOS_SELECCIONABLES` — but a record already
 * carrying it must stay readable, and a read that refused the value would make
 * those records unreachable rather than merely unwritable.
 */
export async function getPeregrinasPorEstadoAction(
  estado: PeregrinaEstado
): Promise<PeregrinaDTO[]> {
  const actor = await getCurrentUser();
  return PeregrinaService.listByEstado(actor, estado);
}

export async function getPeregrinasPorModalidadAction(
  modalidad: Modalidad
): Promise<PeregrinaDTO[]> {
  const actor = await getCurrentUser();
  return PeregrinaService.listByModalidad(actor, modalidad);
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

export async function getPeregrinaDashboardStatsAction() {
  const actor = await getCurrentUser();
  return PeregrinaService.dashboardStats(actor);
}
