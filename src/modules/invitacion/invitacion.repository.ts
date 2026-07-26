import { db } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { invitacion } from "./invitacion.schema";
import type { InvitacionRow, NewInvitacionRow } from "./invitacion.schema";
import {
  diocesisLocalidad,
  provincia,
} from "@/modules/territorio/territorio.schema";
import type {
  DiocesisLocalidadRow,
  ProvinciaRow,
} from "@/modules/territorio/territorio.schema";
import type { Alcance } from "@/lib/authorization/alcance";

/**
 * An invitation travels with its territory resolved, when it has one, so the
 * pending-invitations list can name the Diócesis instead of showing an id.
 * `diocesis` is null for the two country-wide rols — hence a left join.
 */
export interface InvitacionConTerritorio {
  invitacion: InvitacionRow;
  diocesis: DiocesisLocalidadRow | null;
  provincia: ProvinciaRow | null;
}

function conTerritorio() {
  return db
    .select({ invitacion, diocesis: diocesisLocalidad, provincia })
    .from(invitacion)
    .leftJoin(
      diocesisLocalidad,
      eq(diocesisLocalidad.id, invitacion.diocesisLocalidadId)
    )
    .leftJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId));
}

/**
 * The territorial filter, as SQL.
 *
 * A scoped Actor sees invitations into their own Diócesis. Invitations with no
 * territory belong to the two nacional rols, which a scoped Actor can neither
 * issue nor manage, so they stay out of the list.
 */
function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(invitacion.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

/**
 * InvitacionRepository
 *
 * Responsibility: raw database access for the `invitacion` table.
 * No business logic. No permission checks — the scope it filters by is derived
 * by the service and handed in.
 */
export class InvitacionRepository {
  /**
   * The live invitation for an email, if there is one.
   *
   * Not scoped, and deliberately so: this is the lookup that runs when somebody
   * signs in for the first time, before they have a rol or a territory at all.
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

  static async findById(
    alcance: Alcance,
    id: string
  ): Promise<InvitacionConTerritorio | undefined> {
    const filtros = [eq(invitacion.id, id), condicionDeAlcance(alcance)].filter(
      (f) => f !== undefined
    );

    const [row] = await conTerritorio()
      .where(and(...filtros))
      .limit(1);
    return row;
  }

  /** Every invitation still waiting for a first sign-in — user story 13. */
  static async findPendientes(
    alcance: Alcance
  ): Promise<InvitacionConTerritorio[]> {
    const filtros = [
      eq(invitacion.estado, "pendiente"),
      condicionDeAlcance(alcance),
    ].filter((f) => f !== undefined);

    return conTerritorio()
      .where(and(...filtros))
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
