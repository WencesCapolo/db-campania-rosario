// Drizzle schema entry point for drizzle-kit (CLI tool).
// Uses relative paths only — drizzle-kit runs in plain Node and cannot
// resolve @/ TypeScript path aliases.
//
// Order follows the one-way import chain, which reversed between misionero and
// peregrina in issue #3: charge is an Asignación now, so peregrina holds the
// denormalised pointer and misionero holds nothing.
export * from "../modules/territorio/territorio.schema";
export * from "./schema/users";
export * from "../modules/misionero/misionero.schema";
export * from "../modules/peregrina/peregrina.schema";
export * from "../modules/asignacion/asignacion.schema";
export * from "../modules/invitacion/invitacion.schema";
