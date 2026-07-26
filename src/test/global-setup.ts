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

    await crearNeonAuthDePrueba(pool);
  } finally {
    await pool.end();
  }
}

/**
 * A stand-in for `neon_auth.users_sync`.
 *
 * Neon owns and migrates that schema (ADR 0002), so it is deliberately absent
 * from our migrations — which would leave the suite unable to exercise the join
 * that puts emails on the user-management screen, or the "identity with no
 * Usuario" warning. So the harness creates the shape Neon publishes, and the
 * tests run the same SQL production will.
 *
 * Kept in step with `src/db/schema/neon-auth.ts` by hand. If a query starts
 * failing here for a missing column, that is the file to compare against.
 */
async function crearNeonAuthDePrueba(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS neon_auth CASCADE");
  await pool.query("CREATE SCHEMA neon_auth");
  await pool.query(`
    create table neon_auth.users_sync (
      id          text primary key,
      name        text,
      email       text,
      created_at  timestamptz default now(),
      updated_at  timestamptz,
      deleted_at  timestamptz,
      raw_json    jsonb
    )
  `);
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
