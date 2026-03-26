import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default {
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        // Use the direct (non-pooled) URL for migrations
        url: process.env.DATABASE_URL_UNPOOLED!,
    },
    // Ignore Neon Auth's managed schema — do not touch it
    schemaFilter: ["public"],
    verbose: true,
    strict: true,
} satisfies Config;