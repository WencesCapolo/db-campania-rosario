import { sql } from "drizzle-orm";
import { db } from "@/db";
import { provincia } from "@/modules/territorio/territorio.schema";
import { PROVINCIAS_SEED } from "@/modules/territorio/territorio.reference";

/**
 * Seeds the 24 Provincias with the abbreviations Códigos are built from.
 *
 * Idempotent and non-destructive: a Provincia that already exists keeps its
 * name and its Región, because a real installation's mapping came from its own
 * data and is more trustworthy than the best-effort table shipped here. Only
 * the abbreviation is corrected, and only where the existing one was the
 * three-letter placeholder migration 0001 invented.
 *
 * Run with: pnpm db:seed
 */
export async function seedTerritorio(): Promise<{
  creadas: number;
  actualizadas: number;
}> {
  let creadas = 0;
  let actualizadas = 0;

  for (const p of PROVINCIAS_SEED) {
    const [row] = await db
      .insert(provincia)
      .values({ nombre: p.nombre, abreviatura: p.abreviatura, region: p.region })
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

  return { creadas, actualizadas };
}

// Executed directly: pnpm db:seed
if (process.argv[1]?.endsWith("territorio.ts")) {
  seedTerritorio()
    .then(({ creadas, actualizadas }) => {
      console.log(
        `Territorio: ${creadas} Provincias creadas, ${actualizadas} abreviaturas corregidas.`
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
