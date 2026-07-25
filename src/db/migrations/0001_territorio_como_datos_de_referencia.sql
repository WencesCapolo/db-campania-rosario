-- Territorio como datos de referencia.
--
-- Drizzle generated the DDL; the backfill between the ADD COLUMNs and the DROP
-- COLUMNs is written by hand, because the generated version would have dropped
-- every Peregrina's and Misionero's territory on the floor.
--
-- Order matters: create the reference tables, derive their rows from the
-- free-text values already in the data, point the records at them, refuse to
-- continue if anything is left unresolved, and only then drop the old columns.

-- ── Normalisation ─────────────────────────────────────────────────────────────
-- "Córdoba", "córdoba" and "Cordoba " are one place. Trim, fold case, strip
-- accents. Spelled out with translate() rather than the unaccent extension so
-- the migration does not depend on an extension being installed.

CREATE OR REPLACE FUNCTION territorio_normalizar(valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    upper(btrim(coalesce(valor, ''))),
    'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'AAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;
--> statement-breakpoint

-- ── Reference tables ──────────────────────────────────────────────────────────

CREATE TABLE "provincia" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"abreviatura" text NOT NULL,
	"region" "region" NOT NULL,
	"baja_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diocesis_localidad" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"provincia_id" text NOT NULL,
	"baja_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diocesis_localidad" ADD CONSTRAINT "diocesis_localidad_provincia_id_provincia_id_fk" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provincia_nombre_key" ON "provincia" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "provincia_abreviatura_key" ON "provincia" USING btree ("abreviatura");--> statement-breakpoint
CREATE INDEX "provincia_region_idx" ON "provincia" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "diocesis_localidad_provincia_nombre_key" ON "diocesis_localidad" USING btree ("provincia_id","nombre");--> statement-breakpoint
CREATE INDEX "diocesis_localidad_provincia_idx" ON "diocesis_localidad" USING btree ("provincia_id");--> statement-breakpoint

-- ── New columns, nullable for now ─────────────────────────────────────────────
-- They become NOT NULL further down, once every row has a value.

ALTER TABLE "users" ADD COLUMN "diocesis_localidad_id" text;--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "diocesis_localidad_id" text;--> statement-breakpoint
ALTER TABLE "misionero" ADD COLUMN "diocesis_localidad_id" text;--> statement-breakpoint

-- ── Backfill ──────────────────────────────────────────────────────────────────
-- The Provincias are derived from the data rather than from a hardcoded list,
-- so the mapping cannot be wrong: every existing row already carries both its
-- región and its provincia. The full 24-provincia reference list, with the
-- abbreviations Códigos are built from, is seeded separately.

DO $$
DECLARE
  contradictorias text;
  huerfanas text;
BEGIN
  -- Every (región, provincia) pair anyone ever typed, on either table.
  CREATE TEMP TABLE territorio_origen ON COMMIT DROP AS
  SELECT region, provincia, diocesis_localidad FROM peregrina
  UNION
  SELECT region, provincia, diocesis_localidad FROM misionero;

  -- A provincia that appears under two different regiones cannot be resolved
  -- to one reference record. Report it instead of picking a winner.
  SELECT string_agg(DISTINCT format('%s (%s)', provincia, regiones), '; ')
    INTO contradictorias
    FROM (
      SELECT min(btrim(provincia)) AS provincia,
             string_agg(DISTINCT region::text, ' / ') AS regiones
        FROM territorio_origen
       GROUP BY territorio_normalizar(provincia)
      HAVING count(DISTINCT region) > 1
    ) AS c;

  IF contradictorias IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede migrar el territorio: estas provincias aparecen en más de una región y hay que corregirlas a mano antes de reintentar: %',
      contradictorias;
  END IF;

  -- One Provincia per distinct normalised name.
  --
  -- Which of the five spellings becomes the display name is decided, not left
  -- to whichever row the planner reached first: prefer the one with the most
  -- accented characters ("Córdoba" over "Cordoba"), then one that is not
  -- shouting ("Córdoba" over "CÓRDOBA"), then the longest, then C-collation
  -- order so the result is reproducible.
  --
  -- The abbreviation is provisional; the seed corrects it where it knows better.
  INSERT INTO provincia (id, nombre, abreviatura, region)
  SELECT gen_random_uuid()::text,
         nombre,
         abreviatura,
         region
    FROM (
      SELECT DISTINCT ON (territorio_normalizar(provincia))
             btrim(provincia) AS nombre,
             upper(substr(territorio_normalizar(provincia), 1, 3)) AS abreviatura,
             region
        FROM territorio_origen
       ORDER BY territorio_normalizar(provincia),
                octet_length(btrim(provincia)) - length(btrim(provincia)) DESC,
                (btrim(provincia) <> upper(btrim(provincia))) DESC,
                length(btrim(provincia)) DESC,
                btrim(provincia) COLLATE "C"
    ) AS p
   ON CONFLICT DO NOTHING;

  -- One Diócesis/Localidad per distinct normalised name within a Provincia,
  -- with the same tie-break.
  INSERT INTO diocesis_localidad (id, nombre, provincia_id)
  SELECT gen_random_uuid()::text, d.nombre, d.provincia_id
    FROM (
      SELECT DISTINCT ON (pr.id, territorio_normalizar(o.diocesis_localidad))
             btrim(o.diocesis_localidad) AS nombre,
             pr.id AS provincia_id
        FROM territorio_origen o
        JOIN provincia pr
          ON territorio_normalizar(pr.nombre) = territorio_normalizar(o.provincia)
       ORDER BY pr.id,
                territorio_normalizar(o.diocesis_localidad),
                octet_length(btrim(o.diocesis_localidad))
                  - length(btrim(o.diocesis_localidad)) DESC,
                (btrim(o.diocesis_localidad) <> upper(btrim(o.diocesis_localidad))) DESC,
                length(btrim(o.diocesis_localidad)) DESC,
                btrim(o.diocesis_localidad) COLLATE "C"
    ) AS d
   ON CONFLICT DO NOTHING;

  -- Point the records at their reference record.
  UPDATE peregrina p
     SET diocesis_localidad_id = dl.id
    FROM diocesis_localidad dl
    JOIN provincia pr ON pr.id = dl.provincia_id
   WHERE territorio_normalizar(pr.nombre) = territorio_normalizar(p.provincia)
     AND territorio_normalizar(dl.nombre) = territorio_normalizar(p.diocesis_localidad);

  UPDATE misionero m
     SET diocesis_localidad_id = dl.id
    FROM diocesis_localidad dl
    JOIN provincia pr ON pr.id = dl.provincia_id
   WHERE territorio_normalizar(pr.nombre) = territorio_normalizar(m.provincia)
     AND territorio_normalizar(dl.nombre) = territorio_normalizar(m.diocesis_localidad);

  -- Nothing is allowed to be dropped silently.
  SELECT string_agg(DISTINCT descripcion, '; ')
    INTO huerfanas
    FROM (
      SELECT format('Peregrina %s → %s, %s', codigo, provincia, diocesis_localidad) AS descripcion
        FROM peregrina WHERE diocesis_localidad_id IS NULL
      UNION ALL
      SELECT format('Misionero %s %s → %s, %s', nombre, apellido, provincia, diocesis_localidad)
        FROM misionero WHERE diocesis_localidad_id IS NULL
    ) AS h;

  IF huerfanas IS NOT NULL THEN
    RAISE EXCEPTION
      'No se puede migrar el territorio: estos registros no resolvieron a una Diócesis/Localidad: %',
      huerfanas;
  END IF;
END $$;
--> statement-breakpoint

-- ── Now that every row has a territory, lock the columns down ─────────────────

ALTER TABLE "peregrina" ALTER COLUMN "diocesis_localidad_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "misionero" ALTER COLUMN "diocesis_localidad_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_diocesis_localidad_id_diocesis_localidad_id_fk" FOREIGN KEY ("diocesis_localidad_id") REFERENCES "public"."diocesis_localidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_diocesis_localidad_id_diocesis_localidad_id_fk" FOREIGN KEY ("diocesis_localidad_id") REFERENCES "public"."diocesis_localidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misionero" ADD CONSTRAINT "misionero_diocesis_localidad_id_diocesis_localidad_id_fk" FOREIGN KEY ("diocesis_localidad_id") REFERENCES "public"."diocesis_localidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "peregrina_diocesis_localidad_idx" ON "peregrina" USING btree ("diocesis_localidad_id");--> statement-breakpoint
CREATE INDEX "peregrina_estado_idx" ON "peregrina" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "peregrina_modalidad_idx" ON "peregrina" USING btree ("modalidad");--> statement-breakpoint
CREATE INDEX "misionero_diocesis_localidad_idx" ON "misionero" USING btree ("diocesis_localidad_id");--> statement-breakpoint
CREATE INDEX "misionero_estado_idx" ON "misionero" USING btree ("estado");--> statement-breakpoint

-- ── The free-text columns have served their purpose ───────────────────────────

ALTER TABLE "peregrina" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "peregrina" DROP COLUMN "provincia";--> statement-breakpoint
ALTER TABLE "peregrina" DROP COLUMN "diocesis_localidad";--> statement-breakpoint
ALTER TABLE "misionero" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "misionero" DROP COLUMN "provincia";--> statement-breakpoint
ALTER TABLE "misionero" DROP COLUMN "diocesis_localidad";
