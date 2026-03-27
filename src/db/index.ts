import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle client — single instance for the whole app.
 * Import as: import { db } from "@/db";
 *
 * Requires env var: DATABASE_URL (Neon connection string)
 */
const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
