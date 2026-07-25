import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Drizzle client — single instance for the whole app.
 * Import as: import { db } from "@/db";
 *
 * Requires env var: DATABASE_URL
 *
 * Two drivers, one schema. Neon's HTTP driver is what runs in production; it
 * speaks to Neon over https and cannot talk to a plain Postgres. The test
 * suite runs against a real local Postgres (see docs/TESTING.md), so a
 * non-Neon connection string selects the node-postgres driver instead.
 * `db` is the same Drizzle interface either way — no repository knows or
 * cares which one it got.
 */

const connectionString =
  process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

function isNeon(url: string): boolean {
  return url.includes(".neon.tech") || url.includes(".neon.build");
}

export const db = isNeon(connectionString)
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzlePg(new Pool({ connectionString }), { schema });
