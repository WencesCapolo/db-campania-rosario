"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { UserService } from "./user.service";
import { revalidatePath } from "next/cache";
import type { CreateUserInput, ActionResult, UserDTO } from "./user.types";
import type { Role } from "./user.schema";

/**
 * UserRouter
 *
 * Responsibility: Next.js server actions — the entry point from the UI.
 * Each function:
 *   1. Authenticates the caller via getCurrentUser()
 *   2. Delegates ALL logic to UserService
 *   3. Revalidates Next.js cache when data changes
 *
 * No business logic lives here.
 */

export async function getUsersAction(): Promise<UserDTO[]> {
    await getCurrentUser(); // ensures authenticated
    return UserService.listUsers();
}

export async function createUserAction(
    input: CreateUserInput
): Promise<ActionResult<{ id: string }>> {
    const actor = await getCurrentUser();
    const result = await UserService.createUser(actor, input);

    if (result.ok) revalidatePath("/admin/users");

    return result;
}

export async function updateUserRoleAction(
    targetId: string,
    newRole: Role
): Promise<ActionResult> {
    const actor = await getCurrentUser();
    const result = await UserService.updateRole(actor, targetId, newRole);

    if (result.ok) revalidatePath("/admin/users");

    return result;
}