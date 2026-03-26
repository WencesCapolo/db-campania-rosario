import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle client — single instance for the whole app.
 * Import as: import { db } from "@/db";
 *
 * Requires env var: DATABASE_URL (Neon connection string)
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
