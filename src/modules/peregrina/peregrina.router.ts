"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { PeregrinaService } from "./peregrina.service";
import { revalidatePath } from "next/cache";
import {
  createPeregrinaSchema,
  updatePeregrinaSchema,
} from "./peregrina.types";
import type { ActionResult, PeregrinaDTO } from "./peregrina.types";
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

export async function deletePeregrinaAction(
  id: string
): Promise<ActionResult<void>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => PeregrinaService.delete(actor, id));

  if (result.ok) revalidatePath("/peregrina");

  return result;
}

export async function getPeregrinaDashboardStatsAction() {
  const actor = await getCurrentUser();
  return PeregrinaService.dashboardStats(actor);
}
