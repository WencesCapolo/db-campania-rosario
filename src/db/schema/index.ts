// ── Barrel: re-export every table, relation, enum, and type ──────────────────
// Drizzle's `db` client imports this as `* as schema` so all tables are
// available for relational queries. Add new schema files here as they are created.

export * from "./users";
// Peregrina and Misionero schemas live in the module layer to keep the
// module-folder convention. We re-export them here so the Drizzle client
// has a single complete schema object.
export * from "@/modules/peregrina/peregrina.schema";
export * from "@/modules/misionero/misionero.schema";