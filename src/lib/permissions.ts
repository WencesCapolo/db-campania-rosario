import { ROLE_HIERARCHY, superaEnRango, type Role } from "@/db/schema/users";

/**
 * Returns true if `actorRole` outranks `targetRole` in the hierarchy.
 * A role can only act on roles strictly below it.
 */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
    return superaEnRango(actorRole, targetRole);
}

/**
 * Returns all roles that `actorRole` is allowed to assign when creating users.
 *
 * admin                 → can create: asesor_nacional, responsable_diocesano, dirigente_joven
 * asesor_nacional       → can create: responsable_diocesano, dirigente_joven
 * responsable_diocesano → cannot create any user
 * dirigente_joven       → cannot create any user
 */
export function creatableRoles(actorRole: Role): Role[] {
    return ROLE_HIERARCHY.filter((rol) => superaEnRango(actorRole, rol));
}

/**
 * Whether the Users screen offers controls on a row of this rol.
 *
 * `canManageRole` is strictly-lower, and that is the rule for everyone but an
 * admin: since 2026-07-25 an admin is a real person who may invite and manage
 * another admin, and `UserService` already allows it. This is the screen's
 * copy of that exception, so the button and the service agree.
 */
export function puedeAdministrar(actorRole: Role, targetRole: Role): boolean {
    return actorRole === "admin" || canManageRole(actorRole, targetRole);
}

/** The rols this actor may hand out — inviting, or changing a Usuario's rol. */
export function rolesAsignables(actorRole: Role): Role[] {
    const menores = creatableRoles(actorRole);
    return actorRole === "admin" ? ["admin", ...menores] : menores;
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
 * The rols bounded by a territory.
 *
 * The other two cover the country, and `derivarAlcance` gives them no filter at
 * all. Two forms need this — inviting somebody and changing what they are — and
 * each had, or was about to have, its own copy of the list. A rol added to the
 * enum and forgotten in one of those copies is a Usuario created with no
 * territory, which `derivarAlcance` then refuses on every request: a form that
 * successfully creates an account nobody can use.
 *
 * This is a UI concern and lives here rather than in `UserService`, which decides
 * the same question for itself from the rol it was handed. Two independent
 * answers on purpose: this one shapes a form, and the service's one is the rule.
 */
// Empty since ADR 0016: every rol covers the country.
export const ROLES_CON_TERRITORIO: readonly Role[] = [];

export function llevaTerritorio(rol: Role): boolean {
    return ROLES_CON_TERRITORIO.includes(rol);
}

/**
 * Readable Spanish labels for each role.
 */
export const ROLE_LABELS: Record<Role, string> = {
    admin: "Administrador",
    asesor_nacional: "Asesor Nacional",
    responsable_diocesano: "Responsable Diocesano",
    dirigente_joven: "Dirigente Joven",
};