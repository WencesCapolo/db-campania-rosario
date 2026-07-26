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
 * A stand-in for `neon_auth."user"`.
 *
 * Neon owns and migrates that schema (ADR 0002), so it is deliberately absent
 * from our migrations — which would leave the suite unable to exercise the join
 * that puts emails on the user-management screen, or the "identity with no
 * Usuario" warning. So the harness creates the shape Neon publishes, and the
 * tests run the same SQL production will.
 *
 * That last sentence was false until this was fixed. The stand-in described
 * `users_sync`, the older Neon Auth (Stack) table, and so did
 * `src/db/schema/neon-auth.ts` — while the actual Managed Better Auth project
 * has `user`, with camelCase column names. The two agreed with each other, the
 * suite passed, and every authenticated page in production threw
 * `relation "neon_auth.users_sync" does not exist`.
 *
 * The column names are quoted deliberately: Better Auth creates them camelCase,
 * and an unquoted `createdAt` in DDL would fold to `createdat` and reintroduce
 * exactly the same class of mismatch this comment exists to describe.
 *
 * `id` is `uuid` for the same reason, and it is the more dangerous half: our own
 * `users.id` is `text`, Postgres has no implicit `uuid = text`, and a `text`
 * column here would have made every join across the boundary pass in the suite
 * and fail in production with `operator does not exist: uuid = text`. The cast
 * that makes it work lives in `identidadIdComoTexto`.
 *
 * Kept in step with `src/db/schema/neon-auth.ts` by hand. If a query starts
 * failing here for a missing column, compare against that file — and against a
 * real Neon project, because this file agreeing with that one is not evidence.
 */
async function crearNeonAuthDePrueba(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS neon_auth CASCADE");
  await pool.query("CREATE SCHEMA neon_auth");
  await pool.query(`
    create table neon_auth."user" (
      id              uuid primary key,
      name            text,
      email           text,
      "emailVerified" boolean default false,
      image           text,
      "createdAt"     timestamptz default now(),
      "updatedAt"     timestamptz,
      role            text,
      banned          boolean default false,
      "banReason"     text,
      "banExpires"    timestamptz
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
