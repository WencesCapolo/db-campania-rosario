import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Drizzle client — single instance for the whole app.
 * Import as: import { db } from "@/db";
 *
 * Requires env var: DATABASE_URL
 *
 * Two drivers, one schema. Neon's WebSocket pool is what runs in production; the
 * test suite runs against a real local Postgres (see docs/TESTING.md), so a
 * non-Neon connection string selects node-postgres instead. `db` is the same
 * Drizzle interface either way — no repository knows or cares which one it got.
 *
 * The Neon side used to be the HTTP driver, which is a single round trip per
 * statement and **throws on `db.transaction`**. Issue #3 needs one: handing a
 * Peregrina on closes one Asignación and opens another, and a crash between the
 * two would leave an image with no holder on record. That would have passed the
 * suite — node-postgres supports transactions — and failed in production, which
 * is the worst shape a bug can have. `neon-serverless` speaks the real Postgres
 * protocol over a WebSocket and supports them, at the cost of a connection
 * handshake the HTTP driver did not need. We are on the Node runtime, not the
 * edge, so that cost is a pool's worth and not a request's.
 */

const connectionString =
  process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

function isNeon(url: string): boolean {
  return url.includes(".neon.tech") || url.includes(".neon.build");
}

export const db = isNeon(connectionString)
  ? drizzleNeon(new NeonPool({ connectionString }), { schema })
  : drizzlePg(new Pool({ connectionString }), { schema });
