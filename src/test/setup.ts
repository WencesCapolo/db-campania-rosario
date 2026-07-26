import { beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Every test starts from an empty database — including neon_auth, whose
 * users_sync stand-in the global setup creates. An identity left behind by an
 * earlier test would make an invitation refuse as a duplicate.
 *
 * Truncating beats wrapping each test in a rolled-back transaction here,
 * because services call the shared `db` client directly and have no way to
 * receive a transaction handle. Truncate is blunt, but it keeps the service
 * as the only seam — which is the whole point of the suite.
 */
beforeEach(async () => {
  await db.execute(sql`
    do $$
    declare
      tablas text;
    begin
      select string_agg(format('%I.%I', schemaname, tablename), ', ')
        into tablas
        from pg_tables
       where schemaname in ('public', 'neon_auth');

      if tablas is not null then
        execute 'truncate table ' || tablas || ' restart identity cascade';
      end if;
    end $$;
  `);
});
