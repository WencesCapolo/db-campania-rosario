import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { TEST_DATABASE_URL } from "./connection";

/**
 * Runs once for the whole suite: drop the public schema and replay every
 * migration onto it.
 *
 * Replaying rather than pushing is deliberate. It means the tests exercise the
 * same migration files production does, so a migration that is wrong fails
 * here rather than on deploy.
 */
export async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });

  try {
    await assertReachable(pool);

    // A clean slate every run — no leftovers from an older schema.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");

    await migrate(drizzle(pool), { migrationsFolder: "./src/db/migrations" });
  } finally {
    await pool.end();
  }
}

async function assertReachable(pool: Pool): Promise<void> {
  try {
    await pool.query("select 1");
  } catch (cause) {
    throw new Error(
      `No se pudo conectar a la base de datos de prueba en ${redact(TEST_DATABASE_URL)}.\n` +
        `Levantala con:  pnpm test:db:up\n` +
        `Ver docs/TESTING.md.`,
      { cause }
    );
  }
}

function redact(url: string): string {
  return url.replace(/\/\/[^@]*@/, "//***@");
}
