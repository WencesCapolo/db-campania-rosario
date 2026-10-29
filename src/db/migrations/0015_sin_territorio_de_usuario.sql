-- ─────────────────────────────────────────────────────────────────────────────
-- Ningún Usuario lleva territorio — el paso aparte que ADR 0016 dejó anotado.
--
-- La 0014 ya dejó las dos columnas en null en los Usuarios y en las Invitaciones
-- pendientes; ahora se van, con su índice y su clave foránea. Las Invitaciones
-- aceptadas o revocadas pueden todavía nombrar una Diócesis/Localidad: ese dato
-- se pierde, y es a sabiendas — ningún rol lleva territorio, y una Invitación
-- cerrada no se vuelve a leer por él.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "users" DROP CONSTRAINT "users_diocesis_localidad_id_diocesis_localidad_id_fk";
--> statement-breakpoint
ALTER TABLE "invitacion" DROP CONSTRAINT "invitacion_diocesis_localidad_id_diocesis_localidad_id_fk";
--> statement-breakpoint
DROP INDEX "users_diocesis_localidad_idx";--> statement-breakpoint
DROP INDEX "invitacion_diocesis_localidad_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "diocesis_localidad_id";--> statement-breakpoint
ALTER TABLE "invitacion" DROP COLUMN "diocesis_localidad_id";