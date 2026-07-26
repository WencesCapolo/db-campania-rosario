"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { UserService } from "./user.service";
import { revalidatePath } from "next/cache";
import { actualizarUsuarioSchema } from "./user.types";
import type {
    ActionResult,
    IdentidadHuerfanaDTO,
    UserDTO,
} from "./user.types";
import { aResultado } from "@/lib/errors";

/**
 * UserRouter
 *
 * Responsibility: Next.js server actions — the entry point from the UI. Resolve
 * the Actor, parse input, delegate, revalidate, map errors in one place.
 *
 * There is no `createUserAction`. A Usuario is created by accepting an
 * invitation, so the action that used to mint a row with `crypto.randomUUID()` —
 * an id no session could ever match — is gone. See invitacion.router.
 */

export async function getUsersAction(opts?: {
    incluirBajas?: boolean;
}): Promise<UserDTO[]> {
    const actor = await getCurrentUser();
    return UserService.listarUsuarios(actor, opts ?? {});
}

/** User story 17 — a half-finished provisioning should not go unnoticed. */
export async function getIdentidadesSinUsuarioAction(): Promise<
    IdentidadHuerfanaDTO[]
> {
    const actor = await getCurrentUser();
    return UserService.listarIdentidadesSinUsuario(actor);
}

/** User story 16 — a real-world reassignment: new rol, new territory, or both. */
export async function actualizarUsuarioAction(
    targetId: string,
    input: unknown
): Promise<ActionResult<UserDTO>> {
    const actor = await getCurrentUser();

    const parsed = actualizarUsuarioSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
            codigo: "validacion",
        };
    }

    const result = await aResultado(() =>
        UserService.actualizar(actor, targetId, parsed.data)
    );

    if (result.ok) revalidatePath("/admin/users");

    return result;
}

/** User story 15 — access ends, attributions stay. */
export async function darDeBajaUsuarioAction(
    targetId: string
): Promise<ActionResult<UserDTO>> {
    const actor = await getCurrentUser();
    const result = await aResultado(() =>
        UserService.darDeBaja(actor, targetId)
    );

    if (result.ok) revalidatePath("/admin/users");

    return result;
}

export async function reactivarUsuarioAction(
    targetId: string
): Promise<ActionResult<UserDTO>> {
    const actor = await getCurrentUser();
    const result = await aResultado(() =>
        UserService.reactivar(actor, targetId)
    );

    if (result.ok) revalidatePath("/admin/users");

    return result;
}
