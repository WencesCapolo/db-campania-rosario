"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { MisioneroService } from "./misionero.service";
import { revalidatePath } from "next/cache";
import type {
  CreateMisioneroInput,
  UpdateMisioneroInput,
  AddResumenAnualInput,
  ActionResult,
  MisioneroDTO,
} from "./misionero.types";

/**
 * MisioneroRouter — Next.js server actions
 *
 * Responsibility: authenticate the caller, delegate ALL logic to
 * MisioneroService, revalidate the Next.js cache on mutations.
 * No business logic lives here.
 */

export async function getMisionerosAction(): Promise<MisioneroDTO[]> {
  await getCurrentUser();
  return MisioneroService.listAll();
}

export async function getMisioneroByIdAction(id: string): Promise<MisioneroDTO> {
  await getCurrentUser();
  return MisioneroService.getById(id);
}

export async function searchMisionerosAction(query: string): Promise<MisioneroDTO[]> {
  await getCurrentUser();
  return MisioneroService.search(query);
}

export async function createMisioneroAction(
  input: CreateMisioneroInput
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();
  const result = await MisioneroService.create(actor, input);

  if (result.ok) revalidatePath("/misionero");

  return result;
}

export async function updateMisioneroAction(
  id: string,
  input: UpdateMisioneroInput
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();
  const result = await MisioneroService.update(actor, id, input);

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/misionero/${id}`);
  }

  return result;
}

export async function addResumenAnualAction(
  input: AddResumenAnualInput
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();
  const result = await MisioneroService.addResumenAnual(actor, input);

  if (result.ok) revalidatePath(`/misionero/${input.misioneroId}`);

  return result;
}

export async function deleteMisioneroAction(id: string): Promise<ActionResult> {
  const actor = await getCurrentUser();
  const result = await MisioneroService.delete(actor, id);

  if (result.ok) revalidatePath("/misionero");

  return result;
}

/**
 * Assigns (or unassigns) a Peregrina to a Misionero.
 * The FK lives on `misionero.peregrinaId`, so this mutation belongs here.
 */
export async function assignPeregrinaAction(
  misioneroId: string,
  peregrinaId: string | null
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();
  const result = await MisioneroService.update(actor, misioneroId, { peregrinaId });

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/misionero/${misioneroId}`);
    revalidatePath("/peregrina");
  }

  return result;
}

export async function getMisioneroDashboardStatsAction() {
  await getCurrentUser();
  return MisioneroService.dashboardStats();
}
