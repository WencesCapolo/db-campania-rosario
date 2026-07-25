import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// .env.local wins where it exists; .env is the fallback. dotenv never
// overwrites an already-set key, so the order matters.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Neon exposes a pooled and a direct URL, and migrations want the direct one.
// Anywhere else — a local Postgres, CI — there is only one URL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
    throw new Error(
        "Falta DATABASE_URL (o DATABASE_URL_UNPOOLED) para drizzle-kit. Ver docs/TESTING.md."
    );
}

export default {
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "postgresql",
    dbCredentials: { url },
    // Ignore Neon Auth's managed schema — do not touch it
    schemaFilter: ["public"],
    verbose: true,
    strict: true,
} satisfies Config;
