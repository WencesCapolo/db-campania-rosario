CREATE TYPE "public"."invitacion_estado" AS ENUM('pendiente', 'aceptada', 'revocada');--> statement-breakpoint
CREATE TABLE "invitacion" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"rol" "role" NOT NULL,
	"diocesis_localidad_id" text,
	"estado" "invitacion_estado" DEFAULT 'pendiente' NOT NULL,
	"invitada_por_id" text NOT NULL,
	"usuario_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"aceptada_at" timestamp with time zone,
	"revocada_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "baja_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_diocesis_localidad_id_diocesis_localidad_id_fk" FOREIGN KEY ("diocesis_localidad_id") REFERENCES "public"."diocesis_localidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_invitada_por_id_users_id_fk" FOREIGN KEY ("invitada_por_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitacion_email_pendiente_key" ON "invitacion" USING btree ("email") WHERE "invitacion"."estado" = 'pendiente';--> statement-breakpoint
CREATE INDEX "invitacion_estado_idx" ON "invitacion" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "invitacion_diocesis_localidad_idx" ON "invitacion" USING btree ("diocesis_localidad_id");--> statement-breakpoint
CREATE INDEX "users_diocesis_localidad_idx" ON "users" USING btree ("diocesis_localidad_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
-- Nothing above changes a single existing row: the table is new and both
-- additions are nullable. What *does* change is who these rows let in.
--
-- Until now a `responsable_diocesano` or `referente_local` with no
-- Diócesis/Localidad was treated as unscoped, which is the leak issue #2 closes.
-- From here they fail closed: their next sign-in is refused with an explanation,
-- and an Asesor Nacional assigns the territory. Rows created by the old
-- first-login default (rol `referente_local`, `created_by_id` null, no territory)
-- were never provisioned by anyone and are exactly the accounts that should stop
-- working.
--
-- This reports them rather than deciding for the installation. Guessing a
-- territory would put somebody else's records in front of the wrong person, and
-- deleting the rows would break the `created_by_id` behind every Peregrina they
-- registered.
do $$
declare
  sin_territorio int;
  autoprovistos int;
begin
  select count(*) into sin_territorio
    from users
   where role in ('responsable_diocesano', 'referente_local')
     and diocesis_localidad_id is null;

  select count(*) into autoprovistos
    from users
   where role = 'referente_local'
     and created_by_id is null
     and diocesis_localidad_id is null;

  if sin_territorio > 0 then
    raise notice
      'Autorización territorial: % usuario(s) de rol territorial no tienen Diócesis/Localidad y su acceso queda suspendido hasta que se les asigne una. % de ellos parecen creados por el autoaprovisionamiento anterior.',
      sin_territorio, autoprovistos;
  end if;
end $$;
