import { db } from "@/db";
import { users } from "@/db/schema/users";
import { usersSync } from "@/db/schema/neon-auth";
import { and, asc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import type { User, NewUser, Role } from "./user.schema";
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
 * A Usuario as the management screen needs it: the application row, the identity
 * Neon Auth holds for it, and the territory resolved.
 *
 * `identidad` is null when the application row has no matching identity — an
 * orphan, which ADR 0002 says the screen must surface rather than hide. The
 * territory is null for the two country-wide rols.
 */
export interface UsuarioConIdentidad {
  usuario: User;
  identidad: { email: string | null; name: string | null } | null;
  diocesis: DiocesisLocalidadRow | null;
  provincia: ProvinciaRow | null;
}

/** Emails are compared case-insensitively; Neon Auth does not normalise them. */
const emailNormalizado = sql<string>`lower(trim(${usersSync.email}))`;

function conIdentidad() {
  return db
    .select({
      usuario: users,
      identidad: { email: usersSync.email, name: usersSync.name },
      diocesis: diocesisLocalidad,
      provincia,
    })
    .from(users)
    .leftJoin(usersSync, eq(usersSync.id, users.id))
    .leftJoin(diocesisLocalidad, eq(diocesisLocalidad.id, users.diocesisLocalidadId))
    .leftJoin(provincia, eq(provincia.id, diocesisLocalidad.provinciaId));
}

function condicionDeAlcance(alcance: Alcance) {
  return alcance.tipo === "nacional"
    ? undefined
    : eq(users.diocesisLocalidadId, alcance.diocesisLocalidadId);
}

/**
 * UserRepository
 *
 * Responsibility: raw database access for the `users` table, plus the read-only
 * join onto Neon Auth's synced identities. No business logic, no permission
 * checks. Excludes rows given de baja unless asked otherwise.
 */
export class UserRepository {
  static async findById(id: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row;
  }

  static async getById(id: string): Promise<User> {
    const row = await UserRepository.findById(id);
    if (!row) throw new Error(`User not found: ${id}`);
    return row;
  }

  /**
   * The application row behind an email, found through the identity table.
   *
   * There is no email column on `users` — the email lives in `neon_auth`, which
   * Neon owns (ADR 0002), and duplicating it here would give us two answers to
   * the same question. Used to refuse inviting somebody who already has access.
   */
  static async findPorEmail(email: string): Promise<User | undefined> {
    const [row] = await db
      .select({ usuario: users })
      .from(users)
      .innerJoin(usersSync, eq(usersSync.id, users.id))
      .where(eq(emailNormalizado, email.trim().toLowerCase()))
      .limit(1);
    return row?.usuario;
  }

  /**
   * One Usuario, but only if the given scope can reach them.
   *
   * The scope is part of the lookup rather than something the caller checks
   * afterwards: a row that comes back is a row this Actor may act on, and
   * `undefined` covers both "does not exist" and "not yours" — which is what the
   * service wants, because telling those two apart is itself a disclosure.
   */
  static async findConIdentidadById(
    alcance: Alcance,
    id: string,
    opts: { incluirBajas?: boolean } = {}
  ): Promise<UsuarioConIdentidad | undefined> {
    const filtros = [
      eq(users.id, id),
      opts.incluirBajas ? undefined : isNull(users.bajaAt),
      condicionDeAlcance(alcance),
    ].filter((f) => f !== undefined);

    const [row] = await conIdentidad()
      .where(and(...filtros))
      .limit(1);
    return row;
  }

  static async findAllConIdentidad(
    alcance: Alcance,
    opts: { incluirBajas?: boolean } = {}
  ): Promise<UsuarioConIdentidad[]> {
    const filtros = [
      opts.incluirBajas ? undefined : isNull(users.bajaAt),
      condicionDeAlcance(alcance),
    ].filter((f) => f !== undefined);

    return conIdentidad()
      .where(filtros.length ? and(...filtros) : undefined)
      .orderBy(asc(users.role), asc(users.createdAt));
  }

  static async findByRole(role: Role): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(and(eq(users.role, role), isNull(users.bajaAt)));
  }

  /**
   * Identities Neon Auth knows about that have no application row — user story
   * 17. A half-finished provisioning, or somebody who signed in and was refused.
   *
   * Excludes identities Neon has marked deleted: those are gone, not pending.
   */
  static async findIdentidadesSinUsuario(): Promise<
    { id: string; email: string | null; name: string | null; createdAt: Date | null }[]
  > {
    return db
      .select({
        id: usersSync.id,
        email: usersSync.email,
        name: usersSync.name,
        createdAt: usersSync.createdAt,
      })
      .from(usersSync)
      .leftJoin(users, eq(users.id, usersSync.id))
      .where(and(isNull(users.id), isNull(usersSync.deletedAt)))
      .orderBy(asc(usersSync.createdAt));
  }

  /**
   * Upsert — called when an invitation is accepted at first sign-in.
   * If the row already exists we leave it exactly as it is, rol included.
   */
  static async upsert(data: NewUser): Promise<User> {
    const [row] = await db
      .insert(users)
      .values(data)
      .onConflictDoNothing({ target: users.id })
      .returning();
    // If onConflictDoNothing fired, row is undefined — fetch the existing one
    return row ?? UserRepository.getById(data.id);
  }

  static async create(data: NewUser): Promise<User> {
    const [row] = await db.insert(users).values(data).returning();
    if (!row) throw new Error("Failed to insert user");
    return row;
  }

  static async update(
    id: string,
    data: Partial<Pick<User, "role" | "diocesisLocalidadId" | "bajaAt">>
  ): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row;
  }

  /**
   * Soft delete. There is no hard delete: every Peregrina and Misionero carries
   * `createdById` as a foreign key, and an Asignación history that stops
   * resolving to a name is worse than a row nobody uses.
   */
  static async darDeBaja(id: string): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ bajaAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.bajaAt)))
      .returning();
    return row;
  }

  static async reactivar(id: string): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ bajaAt: null, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNotNull(users.bajaAt)))
      .returning();
    return row;
  }
}
