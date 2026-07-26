import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  diocesisLocalidad,
  provincia,
} from "@/modules/territorio/territorio.schema";
import {
  DIOCESIS_SEED,
  PROVINCIAS_SEED,
} from "@/modules/territorio/territorio.reference";
import {
  asegurarActorDeSistema,
} from "@/lib/authorization/actor-de-sistema";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * Seeds the 24 Provincias with the abbreviations Códigos are built from.
 *
 * Idempotent and non-destructive: a Provincia that already exists keeps its
 * name and its Región, because a real installation's mapping came from its own
 * data and is more trustworthy than the best-effort table shipped here. Only
 * the abbreviation is corrected, and only where the existing one was the
 * three-letter placeholder migration 0001 invented.
 *
 * Takes the Actor it runs as, like every other write in the codebase. A seed is
 * genuinely unscoped work, and ADR 0001 asks that this be visible at the call
 * site rather than implied by a missing argument — hence `ACTOR_DE_SISTEMA`
 * spelled out below instead of no argument at all.
 *
 * Run with: pnpm db:seed
 */
export async function seedTerritorio(actor: CurrentUser): Promise<{
  creadas: number;
  actualizadas: number;
  diocesis: number;
  actorId: string;
}> {
  let creadas = 0;
  let actualizadas = 0;

  for (const p of PROVINCIAS_SEED) {
    const [row] = await db
      .insert(provincia)
      .values({ nombre: p.nombre, abreviatura: p.abreviatura })
      .onConflictDoNothing()
      .returning();

    if (row) {
      creadas += 1;
      continue;
    }

    // Already there. Correct only a placeholder abbreviation, and only if the
    // real one is not already taken by another Provincia.
    const [corregida] = await db
      .update(provincia)
      .set({ abreviatura: p.abreviatura, updatedAt: new Date() })
      .where(
        sql`territorio_normalizar(${provincia.nombre}) = territorio_normalizar(${p.nombre})
            and ${provincia.abreviatura} <> ${p.abreviatura}
            and not exists (
              select 1 from ${provincia} otra
               where otra.abreviatura = ${p.abreviatura}
            )`
      )
      .returning();

    if (corregida) actualizadas += 1;
  }

  const diocesis = await seedDiocesis();

  return { creadas, actualizadas, diocesis, actorId: actor.id };
}

/**
 * The Diócesis and Localidades, hung off the Provincias just seeded.
 *
 * Idempotent in the same way and for the same reason: an installation that
 * already has territories keeps them exactly as they are, including any Región
 * somebody corrected in the app. This only ever fills in what is missing, so
 * running it twice is a no-op and running it on a live database cannot
 * overwrite local knowledge with the contents of a spreadsheet.
 *
 * Names are matched through `territorio_normalizar`, the same SQL function
 * migration 0001 uses, so "Córdoba" and "Cordoba " are one Provincia.
 */
async function seedDiocesis(): Promise<number> {
  let creadas = 0;

  for (const d of DIOCESIS_SEED) {
    const [prov] = await db
      .select({ id: provincia.id })
      .from(provincia)
      .where(
        sql`territorio_normalizar(${provincia.nombre}) = territorio_normalizar(${d.provincia})`
      )
      .limit(1);

    if (!prov) {
      throw new Error(
        `El seed de Diócesis nombra la Provincia «${d.provincia}», que no está en la base. Revisá PROVINCIAS_SEED.`
      );
    }

    const [row] = await db
      .insert(diocesisLocalidad)
      .values({ nombre: d.nombre, provinciaId: prov.id, region: d.region })
      .onConflictDoNothing()
      .returning();

    if (row) creadas += 1;
  }

  return creadas;
}

// Executed directly: pnpm db:seed
if (process.argv[1]?.endsWith("territorio.ts")) {
  asegurarActorDeSistema()
    .then(seedTerritorio)
    .then(({ creadas, actualizadas, diocesis, actorId }) => {
      console.log(
        `Territorio: ${creadas} Provincias creadas, ${actualizadas} abreviaturas corregidas, ` +
          `${diocesis} Diócesis/Localidades creadas (como «${actorId}»).`
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
