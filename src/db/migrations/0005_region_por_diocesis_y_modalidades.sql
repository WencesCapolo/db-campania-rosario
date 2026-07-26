-- ─────────────────────────────────────────────────────────────────────────────
-- Región deja de ser de la Provincia y pasa a ser de la Diócesis/Localidad.
--
-- The Campaña's pastoral regions do not follow provincial borders. Santa Fe
-- spans two — Reconquista is NEA, Rosario and Rafaela are CENTRO — and Buenos
-- Aires spans two, with the conurbano in BS. AS and San Nicolás, La Plata, Mar
-- del Plata, Bahía Blanca, Azul, 9 de Julio and Mercedes in R. PAM. One Región
-- per Provincia was a guess made before the Campaña's own list existed, and the
-- list disagrees with it in eight places.
--
-- The order below matters and is the reason this file is hand-written:
-- drizzle-kit generated the ADD and the DROP with nothing in between, which
-- would have discarded every Región in the database before anything read them.
-- The column arrives nullable, is backfilled from the Provincia it is moving
-- off, and only then becomes NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "diocesis_localidad" ADD COLUMN "region" "region";--> statement-breakpoint

UPDATE "diocesis_localidad" AS d
   SET "region" = p."region"
  FROM "provincia" AS p
 WHERE p."id" = d."provincia_id";--> statement-breakpoint

ALTER TABLE "diocesis_localidad" ALTER COLUMN "region" SET NOT NULL;--> statement-breakpoint

CREATE INDEX "diocesis_localidad_region_idx" ON "diocesis_localidad" USING btree ("region");--> statement-breakpoint

DROP INDEX "provincia_region_idx";--> statement-breakpoint

ALTER TABLE "provincia" DROP COLUMN "region";--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- Las Modalidades de la Campaña.
--
-- The enum held four values, and only two of them were real: JOV and FAM. INF
-- and ADU were placeholders from before anybody had the Campaña's list of
-- apostolates, and that list — sixteen of them — contains neither.
--
-- Unlike the legacy `inactiva` Estado, which is kept precisely because real
-- records carry it, these two are removed outright. The difference is that
-- `inactiva` describes something somebody actually chose about an image, while
-- INF and ADU describe an apostolate structure that never existed.
--
-- So this refuses to run rather than guessing. A Peregrina carrying INF or ADU
-- has a Código with those letters written on the physical image, and silently
-- reassigning it to the nearest new Modalidad would make the database disagree
-- with the object on the shelf. If this raises, the rows have to be looked at by
-- somebody who knows which apostolate each image really belongs to.
--
-- The type is recreated rather than altered because Postgres cannot remove a
-- value from an enum. Note this is CREATE TYPE and not ALTER TYPE ... ADD VALUE,
-- so it does not hit the restriction that a newly added value cannot be used in
-- the transaction that adds it.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "public"."peregrina" ALTER COLUMN "modalidad" SET DATA TYPE text;--> statement-breakpoint

DO $$
DECLARE
  huerfanas integer;
BEGIN
  SELECT count(*) INTO huerfanas
    FROM "peregrina"
   WHERE "modalidad" IN ('INF', 'ADU');

  IF huerfanas > 0 THEN
    RAISE EXCEPTION
      'Hay % Peregrina(s) con Modalidad INF o ADU. Esas Modalidades no existen en la Campaña y esta migración no las reasigna sola, porque el Código viejo está escrito en la imagen. Corregilas a una de las 16 Modalidades reales y volvé a correr la migración.',
      huerfanas;
  END IF;
END $$;--> statement-breakpoint

DROP TYPE "public"."modalidad";--> statement-breakpoint

CREATE TYPE "public"."modalidad" AS ENUM('MIS', 'FAM', 'MAT', 'TRA', 'RIE', 'DUL', 'JOV', 'NVI', 'SAL', 'SER', 'TAX', 'HPR', 'CEN', 'SOR', 'SAC', 'VOC');--> statement-breakpoint

ALTER TABLE "public"."peregrina" ALTER COLUMN "modalidad" SET DATA TYPE "public"."modalidad" USING "modalidad"::"public"."modalidad";
