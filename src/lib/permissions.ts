import type { Role } from "@/db/schema/users";

/**
 * Readable Spanish labels for each role.
 */
export const ROLE_LABELS: Record<Role, string> = {
    admin: "Administrador",
    asesor_nacional: "Asesor Nacional",
    responsable_diocesano: "Responsable Diocesano",
    dirigente_joven: "Dirigente Joven",
};