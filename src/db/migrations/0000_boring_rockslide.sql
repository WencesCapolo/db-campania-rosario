CREATE TYPE "public"."role" AS ENUM('admin', 'asesor_nacional', 'responsable_diocesano', 'referente_local');--> statement-breakpoint
CREATE TYPE "public"."modalidad" AS ENUM('JOV', 'FAM', 'INF', 'ADU');--> statement-breakpoint
CREATE TYPE "public"."peregrina_estado" AS ENUM('activa', 'inactiva');--> statement-breakpoint
CREATE TYPE "public"."peregrina_tipo" AS ENUM('peregrina', 'auxiliar');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('NOA', 'CENTRO', 'CUYO', 'NEA', 'BS. AS', 'R. PAM', 'R. PAT');--> statement-breakpoint
CREATE TYPE "public"."centro_tipo" AS ENUM('santuario', 'ermita', 'parroquia');--> statement-breakpoint
CREATE TYPE "public"."misionero_estado" AS ENUM('activo', 'inactivo');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "role" DEFAULT 'referente_local' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peregrina" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"codigo_num" integer NOT NULL,
	"tipo" "peregrina_tipo" DEFAULT 'peregrina' NOT NULL,
	"estado" "peregrina_estado" DEFAULT 'activa' NOT NULL,
	"region" "region" NOT NULL,
	"provincia" text NOT NULL,
	"diocesis_localidad" text NOT NULL,
	"modalidad" "modalidad" NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peregrina_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "misionero" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"telefono" text,
	"estado" "misionero_estado" DEFAULT 'activo' NOT NULL,
	"region" "region" NOT NULL,
	"provincia" text NOT NULL,
	"diocesis_localidad" text NOT NULL,
	"peregrina_id" text,
	"centro_tipo" "centro_tipo",
	"centro_nombre" text,
	"anio_consagracion" integer,
	"resumenes_anuales" text DEFAULT '{}',
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misionero" ADD CONSTRAINT "misionero_peregrina_id_peregrina_id_fk" FOREIGN KEY ("peregrina_id") REFERENCES "public"."peregrina"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misionero" ADD CONSTRAINT "misionero_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;