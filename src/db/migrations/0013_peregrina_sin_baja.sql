-- ─────────────────────────────────────────────────────────────────────────────
-- Una Peregrina no tiene baja — ADR 0014.
--
-- Extraviada es un Estado y la imagen sigue en el inventario; lo que deja de
-- existir se borra. Sin la columna, las que estaban de baja vuelven a las
-- listas tal como están: 0012 ya les puso Estado Extraviada. El índice del
-- tablero deja de ser parcial, porque ya no hay filas que excluir.
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX "peregrina_baja_idx";--> statement-breakpoint
DROP INDEX "peregrina_activas_por_territorio_idx";--> statement-breakpoint
CREATE INDEX "peregrina_por_territorio_idx" ON "peregrina" USING btree ("diocesis_localidad_id","estado","modalidad","tipo");--> statement-breakpoint
ALTER TABLE "peregrina" DROP COLUMN "baja_at";