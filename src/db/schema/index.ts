// ── Barrel: re-export every table, relation, enum, and type ──────────────────
// Drizzle's `db` client imports this as `* as schema` so all tables are
// available for relational queries. Add new schema files here as they are created.
//
// A name must not be exported from two modules: `export *` makes a duplicated
// name ambiguous and it silently vanishes from the schema object.

// Territorio first: it is the independent entity everything else references.
export * from "@/modules/territorio/territorio.schema";
export * from "./users";
// Misionero, then Peregrina: the direction between them reversed in issue #3.
// Charge is expressed by Asignaciones, so peregrina carries the denormalised
// `misioneroActualId` and misionero carries nothing.
export * from "@/modules/misionero/misionero.schema";
export * from "@/modules/peregrina/peregrina.schema";
// Asignacion depends on both, and on users.
export * from "@/modules/asignacion/asignacion.schema";
// Invitacion depends on users and territorio, so it comes last.
export * from "@/modules/invitacion/invitacion.schema";
