import { z } from "zod";
import { roleEnum } from "@/db/schema/users";
import type { Role } from "@/modules/user/user.schema";
import type { InvitacionEstado } from "./invitacion.schema";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

export type { ActionResult } from "@/lib/action-result";

// ── DTO ───────────────────────────────────────────────────────────────────────

export interface InvitacionDTO {
  id: string;
  email: string;
  rol: Role;
  estado: InvitacionEstado;
  /** Null for the two country-wide rols. Resolved, so the UI can name it. */
  diocesisLocalidad: DiocesisLocalidadDTO | null;
  invitadaPorId: string;
  usuarioId: string | null;
  createdAt: Date;
  aceptadaAt: Date | null;
  revocadaAt: Date | null;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

/**
 * The email is normalised here, at the boundary, rather than in the service:
 * an invitation is matched to an identity by email and nothing else, so
 * "Maria@Ejemplo.com " and "maria@ejemplo.com" have to be the same string
 * before either side of the comparison is stored.
 */
export const invitarSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "El email es obligatorio.")
    .pipe(z.email("Escribí un email válido.")),

  rol: z.enum(roleEnum.enumValues, { message: "Elegí un rol válido." }),

  // Absent for admin and asesor_nacional, required for the other two. The pair
  // is checked in the service, where the hierarchy lives.
  diocesisLocalidadId: z.string().min(1).nullish(),
});

export type InvitarInput = z.infer<typeof invitarSchema>;

/** The Neon Auth identity of whoever just signed in. */
export interface Identidad {
  id: string;
  email: string;
  displayName?: string | null;
}
