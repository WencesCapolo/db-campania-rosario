// Drizzle schema entry point for drizzle-kit (CLI tool).
// Uses relative paths only — drizzle-kit runs in plain Node and cannot
// resolve @/ TypeScript path aliases.
export * from "../modules/territorio/territorio.schema";
export * from "./schema/users";
export * from "../modules/peregrina/peregrina.schema";
export * from "../modules/misionero/misionero.schema";
