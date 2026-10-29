-- ─────────────────────────────────────────────────────────────────────────────
-- Un Buzón por función, no por territorio — ADR 0016.
--
-- `referente_local` desaparece y su lugar en el enum lo toma `dirigente_joven`.
-- Un RENAME y no un DROP/CREATE: deja el mismo enum que el snapshot, pero no
-- falla si quedara una fila con el valor viejo, y no hace falta reescribir las
-- columnas. Renombrar no es agregar, así que el valor nuevo se puede usar en
-- esta misma transacción.
--
-- Los cuatro rols cubren el país, así que ninguno lleva territorio: se limpia en
-- los Usuarios y en las Invitaciones pendientes. En producción no había ninguna
-- fila de estos dos rols al escribir esto (2026-10-29).
--
-- El default `referente_local` se va con el valor: un Usuario no recibe nunca un
-- rol por omisión (ADR 0003), y todo alta viene de una Invitación que lo nombra.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."role" RENAME VALUE 'referente_local' TO 'dirigente_joven';--> statement-breakpoint
UPDATE "users" SET "diocesis_localidad_id" = NULL WHERE "diocesis_localidad_id" IS NOT NULL;--> statement-breakpoint
UPDATE "invitacion" SET "diocesis_localidad_id" = NULL WHERE "diocesis_localidad_id" IS NOT NULL AND "estado" = 'pendiente';
