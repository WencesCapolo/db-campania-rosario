CREATE TABLE "matrimonio" (
	"id" text PRIMARY KEY NOT NULL,
	"misionero_a_id" text NOT NULL,
	"misionero_b_id" text NOT NULL,
	"estado" "misionero_estado" DEFAULT 'activo' NOT NULL,
	"telefono" text,
	"centro_tipo" "centro_tipo",
	"centro_nombre" text,
	"baja_at" timestamp with time zone,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asignacion" ALTER COLUMN "misionero_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peregrina" ADD COLUMN "matrimonio_actual_id" text;--> statement-breakpoint
ALTER TABLE "asignacion" ADD COLUMN "matrimonio_id" text;--> statement-breakpoint
ALTER TABLE "matrimonio" ADD CONSTRAINT "matrimonio_misionero_a_id_misionero_id_fk" FOREIGN KEY ("misionero_a_id") REFERENCES "public"."misionero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrimonio" ADD CONSTRAINT "matrimonio_misionero_b_id_misionero_id_fk" FOREIGN KEY ("misionero_b_id") REFERENCES "public"."misionero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matrimonio" ADD CONSTRAINT "matrimonio_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matrimonio_misionero_a_idx" ON "matrimonio" USING btree ("misionero_a_id");--> statement-breakpoint
CREATE INDEX "matrimonio_misionero_b_idx" ON "matrimonio" USING btree ("misionero_b_id");--> statement-breakpoint
CREATE INDEX "matrimonio_baja_idx" ON "matrimonio" USING btree ("baja_at");--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_matrimonio_actual_id_matrimonio_id_fk" FOREIGN KEY ("matrimonio_actual_id") REFERENCES "public"."matrimonio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_matrimonio_id_matrimonio_id_fk" FOREIGN KEY ("matrimonio_id") REFERENCES "public"."matrimonio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "peregrina_matrimonio_actual_idx" ON "peregrina" USING btree ("matrimonio_actual_id");--> statement-breakpoint
CREATE INDEX "asignacion_matrimonio_idx" ON "asignacion" USING btree ("matrimonio_id");--> statement-breakpoint
ALTER TABLE "peregrina" ADD CONSTRAINT "peregrina_un_solo_tenedor_actual" CHECK (num_nonnulls("peregrina"."misionero_actual_id", "peregrina"."matrimonio_actual_id") <= 1);--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_un_solo_tenedor" CHECK (num_nonnulls("asignacion"."misionero_id", "asignacion"."matrimonio_id") = 1);