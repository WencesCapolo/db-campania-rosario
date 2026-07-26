ALTER TYPE "public"."peregrina_estado" ADD VALUE 'en_reparacion';--> statement-breakpoint
ALTER TYPE "public"."peregrina_estado" ADD VALUE 'extraviada';--> statement-breakpoint
CREATE TABLE "asignacion" (
	"id" text PRIMARY KEY NOT NULL,
	"peregrina_id" text NOT NULL,
	"misionero_id" text NOT NULL,
	"abierta_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_at" timestamp with time zone,
	"registrada_por_id" text NOT NULL,
	"cerrada_por_id" text,
	"nota_apertura" text,
	"nota_cierre" text,
	"corregida_at" timestamp with time zone,
	"corregida_por_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "misionero" DROP CONSTRAINT "misionero_peregrina_id_peregrina_id_fk";
--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "misionero_actual_id" text;--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "baja_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "misionero" ADD COLUMN "baja_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_peregrina_id_peregrina_id_fk" FOREIGN KEY ("peregrina_id") REFERENCES "public"."peregrina"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_misionero_id_misionero_id_fk" FOREIGN KEY ("misionero_id") REFERENCES "public"."misionero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_registrada_por_id_users_id_fk" FOREIGN KEY ("registrada_por_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_cerrada_por_id_users_id_fk" FOREIGN KEY ("cerrada_por_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_corregida_por_id_users_id_fk" FOREIGN KEY ("corregida_por_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asignacion_peregrina_abierta_key" ON "asignacion" USING btree ("peregrina_id") WHERE "asignacion"."cerrada_at" is null;--> statement-breakpoint
CREATE INDEX "asignacion_peregrina_idx" ON "asignacion" USING btree ("peregrina_id");--> statement-breakpoint
CREATE INDEX "asignacion_misionero_idx" ON "asignacion" USING btree ("misionero_id");--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_misionero_actual_id_misionero_id_fk" FOREIGN KEY ("misionero_actual_id") REFERENCES "public"."misionero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "peregrina_baja_idx" ON "peregrina" USING btree ("baja_at");--> statement-breakpoint
CREATE INDEX "peregrina_misionero_actual_idx" ON "peregrina" USING btree ("misionero_actual_id");--> statement-breakpoint
CREATE INDEX "misionero_baja_idx" ON "misionero" USING btree ("baja_at");--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Historia — user story 20.
--
-- Everything above is additive. This part is not: it turns each existing
-- Misionero→Peregrina link into the first entry of a chain of custody, and it
-- runs once against production data with no second chance. Hence the shape 0001
-- established — add, backfill, *verify*, and only then drop, with the drop in the
-- next file so the backfill still has the column to read.
--
-- Two things the old pointer could not tell us, and this refuses to invent:
--
--  * When the period began. The Misionero record's `created_at` is the best
--    evidence that exists, so it is used and the note says so.
--  * Whether a Peregrina that several Misioneros pointed at was really held by
--    all of them. The old schema had no unique constraint, so that happened. The
--    invariant allows one open period, so the most recently updated Misionero
--    keeps theirs open and the rest are recorded as closed with a note saying
--    the period is unknown — kept rather than dropped, because a link that
--    existed is evidence even when its dates are not.
--
-- The enum values added at the top of this file are deliberately not used here:
-- a new enum value cannot be used in the transaction that adds it, and Drizzle
-- wraps each migration file in one.
INSERT INTO "asignacion"
  ("id", "peregrina_id", "misionero_id", "abierta_at", "cerrada_at",
   "registrada_por_id", "nota_apertura", "nota_cierre")
SELECT gen_random_uuid()::text,
       e."peregrina_id",
       e."misionero_id",
       e."created_at",
       CASE WHEN e."prioridad" = 1 THEN NULL ELSE e."created_at" END,
       e."created_by_id",
       'Abierta por la migración. El registro anterior sólo guardaba quién tenía la imagen, no desde cuándo: la fecha es la de creación del registro del Misionero.',
       CASE WHEN e."prioridad" = 1 THEN NULL ELSE
         'Cerrada por la migración: la Peregrina figuraba a cargo de más de un Misionero a la vez, y el registro anterior no permitía saber en qué período. Corregila si conocés las fechas.'
       END
  FROM (
    SELECT m."id" AS "misionero_id",
           m."peregrina_id",
           m."created_at",
           m."created_by_id",
           row_number() OVER (
             PARTITION BY m."peregrina_id"
             ORDER BY m."updated_at" DESC, m."created_at" DESC, m."id" DESC
           ) AS "prioridad"
      FROM "misionero" m
     WHERE m."peregrina_id" IS NOT NULL
  ) e;
--> statement-breakpoint
-- The denormalised pointer, derived from the open Asignación exactly as the
-- service will derive it from here on. Never written independently.
UPDATE "peregrina" p
   SET "misionero_actual_id" = a."misionero_id"
  FROM "asignacion" a
 WHERE a."peregrina_id" = p."id"
   AND a."cerrada_at" IS NULL;
--> statement-breakpoint
-- Verify before the next file drops the column this read from. An exception here
-- rolls the file back, which is the point: a half-migrated history is worse than
-- an unmigrated one, because nobody can tell which half is missing.
do $$
declare
  enlaces int;
  creadas int;
  abiertas int;
  con_tenencia int;
  duplicadas int;
begin
  select count(*) into enlaces from misionero where peregrina_id is not null;
  select count(*) into creadas from asignacion;
  select count(*) into abiertas from asignacion where cerrada_at is null;
  select count(*) into con_tenencia from peregrina where misionero_actual_id is not null;

  if creadas <> enlaces then
    raise exception
      'Migración de Asignaciones: había % enlace(s) Misionero→Peregrina y se crearon % Asignación(es). No se migra una historia a medias.',
      enlaces, creadas;
  end if;

  if con_tenencia <> abiertas then
    raise exception
      'Migración de Asignaciones: % Asignación(es) abiertas contra % Peregrina(s) con tenencia actual. El puntero desnormalizado no coincide con las Asignaciones abiertas.',
      abiertas, con_tenencia;
  end if;

  select count(*) into duplicadas
    from (
      select peregrina_id
        from misionero
       where peregrina_id is not null
    group by peregrina_id
      having count(*) > 1
    ) d;

  if duplicadas > 0 then
    raise notice
      'Migración de Asignaciones: % Peregrina(s) figuraban a cargo de más de un Misionero. Quedó abierta la Asignación del Misionero actualizado más recientemente; las demás se cerraron con una nota que lo explica. Conviene revisarlas.',
      duplicadas;
  end if;

  raise notice
    'Migración de Asignaciones: % enlace(s) migrados, % Asignación(es) abiertas.',
    enlaces, abiertas;
end $$;