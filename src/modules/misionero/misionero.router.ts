"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { MisioneroService } from "./misionero.service";
import { revalidatePath } from "next/cache";
import {
  addResumenAnualSchema,
  createMisioneroSchema,
  updateMisioneroSchema,
} from "./misionero.types";
import type { ActionResult, MisioneroDTO } from "./misionero.types";
import { aResultado } from "@/lib/errors";

/**
 * MisioneroRouter — Next.js server actions
 *
 * Responsibility: resolve the Actor, parse input with Zod, delegate, revalidate,
 * and map thrown domain errors onto a result. No business logic lives here.
 */

export async function getMisionerosAction(): Promise<MisioneroDTO[]> {
  const actor = await getCurrentUser();
  return MisioneroService.listAll(actor);
}

export async function getMisioneroByIdAction(id: string): Promise<MisioneroDTO> {
  const actor = await getCurrentUser();
  return MisioneroService.getById(actor, id);
}

export async function searchMisionerosAction(query: string): Promise<MisioneroDTO[]> {
  const actor = await getCurrentUser();
  return MisioneroService.search(actor, query);
}

export async function createMisioneroAction(
  input: unknown
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();

  const parsed = createMisioneroSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    MisioneroService.create(actor, parsed.data)
  );

  if (result.ok) revalidatePath("/misionero");

  return result;
}

export async function updateMisioneroAction(
  id: string,
  input: unknown
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();

  const parsed = updateMisioneroSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    MisioneroService.update(actor, id, parsed.data)
  );

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/misionero/${id}`);
  }

  return result;
}

export async function addResumenAnualAction(
  input: unknown
): Promise<ActionResult<MisioneroDTO>> {
  const actor = await getCurrentUser();

  const parsed = addResumenAnualSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    MisioneroService.addResumenAnual(actor, parsed.data)
  );

  if (result.ok) revalidatePath(`/misionero/${parsed.data.misioneroId}`);

  return result;
}

export async function deleteMisioneroAction(
  id: string
): Promise<ActionResult<void>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => MisioneroService.delete(actor, id));

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
  const result = await aResultado(() =>
    MisioneroService.update(actor, misioneroId, { peregrinaId })
  );

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/misionero/${misioneroId}`);
    revalidatePath("/peregrina");
  }

  return result;
}

export async function getMisioneroDashboardStatsAction() {
  const actor = await getCurrentUser();
  return MisioneroService.dashboardStats(actor);
}

/**
 * Users see one message at a time, and the first failing field is the one
 * their cursor is nearest.
 */
function invalido(error: { issues: { message: string }[] }): {
  ok: false;
  error: string;
  codigo: "validacion";
} {
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Datos inválidos.",
    codigo: "validacion",
  };
}
