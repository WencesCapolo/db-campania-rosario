-- ─────────────────────────────────────────────────────────────────────────────
-- Fecha de consagración, y el email del Misionero — ADR 0013.
--
-- The additive half. A Misionero's consagración was a year; it becomes a day,
-- and every year already recorded becomes the first of January of that year,
-- so nothing typed is lost and the tablero's distribution by year reads the
-- same. 0011 drops the old column once this has run.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "misionero" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "misionero" ADD COLUMN "fecha_consagracion" date;--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "fecha_consagracion" date;--> statement-breakpoint
UPDATE "misionero" SET "fecha_consagracion" = make_date("anio_consagracion", 1, 1) WHERE "anio_consagracion" IS NOT NULL;
