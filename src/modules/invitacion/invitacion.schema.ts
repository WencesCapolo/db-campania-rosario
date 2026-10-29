import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users, roleEnum } from "@/db/schema/users";
// ↑ One-way import: invitacion → user. It knows nothing about invitations,
//   which is what keeps Actor resolution free of a cycle.

// ── Estado ────────────────────────────────────────────────────────────────────
// An invitation is a record with a life, not a boolean. `pendiente` is waiting
// for a first sign-in, `aceptada` produced a Usuario, `revocada` never will.
// There is no `expirada`: nothing in the Campaña's process has a deadline, and
// inventing one would silently lock people out.

export const invitacionEstadoEnum = pgEnum("invitacion_estado", [
  "pendiente",
  "aceptada",
  "revocada",
]);

export type InvitacionEstado = (typeof invitacionEstadoEnum.enumValues)[number];

// ── Table ─────────────────────────────────────────────────────────────────────
// Nobody self-registers. A Usuario exists because a Usuario of higher rank
// invited them, and this table is the evidence: who invited whom, to what rol.
//
// Note that the Rol enum is `roleEnum`, imported rather than redefined — one
// hierarchy, one enum, so an invitation cannot offer a rol the users table
// cannot hold.

export const invitacion = pgTable(
  "invitacion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Normalised to lowercase and trimmed by the service before it gets here.
    // This is the only thing that links an invitation to the identity that
    // eventually signs in, because the Neon Auth id does not exist yet.
    email: text("email").notNull(),

    rol: roleEnum("rol").notNull(),

    estado: invitacionEstadoEnum("estado").notNull().default("pendiente"),

    invitadaPorId: text("invitada_por_id")
      .notNull()
      .references(() => users.id),

    // Set when the invitation is accepted. This is what makes a double accept
    // detectable rather than a second Usuario.
    usuarioId: text("usuario_id").references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    aceptadaAt: timestamp("aceptada_at", { withTimezone: true }),
    revocadaAt: timestamp("revocada_at", { withTimezone: true }),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // At most one live invitation per email, enforced by the database rather
    // than by a read-then-write in the service. Partial, so a revoked or
    // accepted invitation does not block inviting the same person again.
    uniqueIndex("invitacion_email_pendiente_key")
      .on(t.email)
      .where(sql`${t.estado} = 'pendiente'`),

    // The pending-invitations screen filters by estado.
    index("invitacion_estado_idx").on(t.estado),
  ]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const invitacionRelations = relations(invitacion, ({ one }) => ({
  invitadaPor: one(users, {
    fields: [invitacion.invitadaPorId],
    references: [users.id],
    relationName: "invitacionInvitadaPor",
  }),
  usuario: one(users, {
    fields: [invitacion.usuarioId],
    references: [users.id],
    relationName: "invitacionUsuario",
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────

export type InvitacionRow = typeof invitacion.$inferSelect;
export type NewInvitacionRow = typeof invitacion.$inferInsert;
