import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import type { User, NewUser, Role } from "./user.schema";

/**
 * UserRepository
 *
 * Responsibility: raw database access for the `users` table.
 * No business logic. No permission checks.
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

  static async findAll(): Promise<User[]> {
    return db.select().from(users);
  }

  static async findByRole(role: Role): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  /**
   * Upsert — called after Neon Auth creates the auth record.
   * If the user already exists we leave their role intact.
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

  static async updateRole(id: string, role: Role): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!row) throw new Error(`User not found: ${id}`);
    return row;
  }

  static async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
}
