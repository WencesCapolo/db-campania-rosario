import { db } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { invitacion } from "./invitacion.schema";
import type { InvitacionRow, NewInvitacionRow } from "./invitacion.schema";

/**
 * InvitacionRepository
 *
 * Responsibility: raw database access for the `invitacion` table.
 * No business logic. No permission checks.
 */
export class InvitacionRepository {
  /**
   * The live invitation for an email, if there is one.
   *
   * This is the lookup that runs when somebody signs in for the first time,
   * before they have a rol at all.
   */
  static async findPendientePorEmail(
    email: string
  ): Promise<InvitacionRow | undefined> {
    const [row] = await db
      .select()
      .from(invitacion)
      .where(and(eq(invitacion.email, email), eq(invitacion.estado, "pendiente")))
      .limit(1);
    return row;
  }

  static async findById(id: string): Promise<InvitacionRow | undefined> {
    const [row] = await db
      .select()
      .from(invitacion)
      .where(eq(invitacion.id, id))
      .limit(1);
    return row;
  }

  /** Every invitation still waiting for a first sign-in — user story 13. */
  static async findPendientes(): Promise<InvitacionRow[]> {
    return db
      .select()
      .from(invitacion)
      .where(eq(invitacion.estado, "pendiente"))
      .orderBy(asc(invitacion.createdAt));
  }

  static async create(data: NewInvitacionRow): Promise<InvitacionRow> {
    const [row] = await db.insert(invitacion).values(data).returning();
    if (!row) throw new Error("Failed to insert invitacion");
    return row;
  }

  /**
   * Marks an invitation accepted, and only if it is still pending.
   *
   * The estado predicate is the concurrency control: two simultaneous first
   * sign-ins both read a pending invitation, and only one of them updates a row.
   * The loser gets `undefined` and knows not to create a second Usuario.
   */
  static async marcarAceptada(
    id: string,
    usuarioId: string
  ): Promise<InvitacionRow | undefined> {
    const [row] = await db
      .update(invitacion)
      .set({ estado: "aceptada", usuarioId, aceptadaAt: new Date() })
      .where(and(eq(invitacion.id, id), eq(invitacion.estado, "pendiente")))
      .returning();
    return row;
  }

  static async marcarRevocada(id: string): Promise<InvitacionRow | undefined> {
    const [row] = await db
      .update(invitacion)
      .set({ estado: "revocada", revocadaAt: new Date() })
      .where(and(eq(invitacion.id, id), eq(invitacion.estado, "pendiente")))
      .returning();
    return row;
  }
}
