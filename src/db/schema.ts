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
// A Matrimonio is two Misioneros and one Tenedor — ADR 0010. It sits here rather
// than in a module of its own because asignacion and peregrina both point at it,
// so it has to be upstream of them.
export * from "../modules/misionero/matrimonio.schema";
export * from "../modules/peregrina/peregrina.schema";
export * from "../modules/asignacion/asignacion.schema";
export * from "../modules/invitacion/invitacion.schema";
