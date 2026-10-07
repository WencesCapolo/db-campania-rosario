-- ─────────────────────────────────────────────────────────────────────────────
-- Dos rotulaciones — ADR 0012.
--
-- Images labelled before the Campaña's format carry a Numeración anterior,
-- typed as it reads, and no Código until somebody gives them one. Every row
-- already here has a Código and its número, so both checks hold on arrival and
-- nothing needs backfilling.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "peregrina" ALTER COLUMN "codigo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peregrina" ALTER COLUMN "codigo_num" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "numeracion_anterior" text;--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_tiene_identificacion" CHECK (num_nonnulls("peregrina"."codigo", "peregrina"."numeracion_anterior") >= 1);--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_codigo_con_numero" CHECK (("peregrina"."codigo" is null) = ("peregrina"."codigo_num" is null));
