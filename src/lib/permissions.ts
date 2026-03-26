import { ROLE_HIERARCHY, type Role } from "@/db/schema";

/**
 * Returns true if `actorRole` outranks `targetRole` in the hierarchy.
 * A role can only act on roles strictly below it.
 */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
    const actorIndex = ROLE_HIERARCHY.indexOf(actorRole);
    const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);
    return actorIndex < targetIndex; // lower index = higher privilege
}

/**
 * Returns all roles that `actorRole` is allowed to assign when creating users.
 *
 * admin              → can create: asesor_nacional, responsable_diocesano, referente_local
 * asesor_nacional    → can create: responsable_diocesano, referente_local
 * responsable_diocesano → can create: referente_local
 * referente_local    → cannot create any user
 */
export function creatableRoles(actorRole: Role): Role[] {
    const actorIndex = ROLE_HIERARCHY.indexOf(actorRole);
    return ROLE_HIERARCHY.slice(actorIndex + 1);
}

/**
 * Returns true if the actor can create a user with the given role.
 */
export function canCreateUserWithRole(actorRole: Role, targetRole: Role): boolean {
    return creatableRoles(actorRole).includes(targetRole);
}

/**
 * Returns true if the actor is an admin.
 */
export function isAdmin(role: Role): boolean {
    return role === "admin";
}

/**
 * Readable Spanish labels for each role.
 */
export const ROLE_LABELS: Record<Role, string> = {
    admin: "Administrador",
    asesor_nacional: "Asesor Nacional",
    responsable_diocesano: "Responsable Diocesano",
    referente_local: "Referente Local",
};