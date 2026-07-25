"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { PeregrinaService } from "./peregrina.service";
import { revalidatePath } from "next/cache";
import {
  createPeregrinaSchema,
  updatePeregrinaSchema,
} from "./peregrina.types";
import type { ActionResult, PeregrinaDTO } from "./peregrina.types";

/**
 * PeregrinaRouter — Next.js server actions
 *
 * Responsibility: authenticate the caller, delegate ALL logic to
 * PeregrinaService, revalidate the Next.js cache on mutations.
 * No business logic lives here.
 */

export async function getPeregrinasAction(): Promise<PeregrinaDTO[]> {
  await getCurrentUser(); // ensures authenticated
  return PeregrinaService.listAll();
}

export async function getPeregrinaByIdAction(id: string): Promise<PeregrinaDTO> {
  await getCurrentUser();
  return PeregrinaService.getById(id);
}

export async function createPeregrinaAction(
  input: unknown
): Promise<ActionResult<PeregrinaDTO>> {
  const actor = await getCurrentUser();

  const parsed = createPeregrinaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const result = await PeregrinaService.create(actor, parsed.data);

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const result = await PeregrinaService.update(actor, id, parsed.data);

  if (result.ok) {
    revalidatePath("/peregrina");
    revalidatePath(`/peregrina/${id}`);
  }

  return result;
}


export async function deletePeregrinaAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  const result = await PeregrinaService.delete(actor, id);

  if (result.ok) revalidatePath("/peregrina");

  return result;
}

export async function getPeregrinaDashboardStatsAction() {
  await getCurrentUser();
  return PeregrinaService.dashboardStats();
}
