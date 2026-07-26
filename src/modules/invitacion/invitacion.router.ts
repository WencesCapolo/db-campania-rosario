"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/get-current-user";
import { InvitacionService } from "./invitacion.service";
import { invitarSchema } from "./invitacion.types";
import type { ActionResult, InvitacionDTO } from "./invitacion.types";
import { aResultado } from "@/lib/errors";

/**
 * InvitacionRouter — Next.js server actions.
 *
 * Resolves the Actor, parses input with Zod, delegates, revalidates, maps errors
 * in one place. No business logic.
 *
 * There is no "accept invitation" action. Accepting happens inside
 * getCurrentUser() on first sign-in, because the person accepting has no Actor to
 * authenticate an action with — the invitation itself is their authorisation.
 */

export async function getInvitacionesPendientesAction(): Promise<
  InvitacionDTO[]
> {
  const actor = await getCurrentUser();
  return InvitacionService.listarPendientes(actor);
}

export async function invitarAction(
  input: unknown
): Promise<ActionResult<InvitacionDTO>> {
  const actor = await getCurrentUser();

  const parsed = invitarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      codigo: "validacion",
    };
  }

  const result = await aResultado(() =>
    InvitacionService.invitar(actor, parsed.data)
  );

  if (result.ok) revalidatePath("/admin/users");

  return result;
}

export async function revocarInvitacionAction(
  id: string
): Promise<ActionResult<InvitacionDTO>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => InvitacionService.revocar(actor, id));

  if (result.ok) revalidatePath("/admin/users");

  return result;
}
