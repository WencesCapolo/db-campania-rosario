import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "@/test/connection";

/**
 * The free-text migration, tested against the real migration SQL.
 *
 * This one suite does not go through a service, because the thing under test
 * *is* a SQL file: it runs once, against production data, and there is no
 * second chance. It applies 0000, seeds the messy free-text values a real
 * spreadsheet-era database contains, applies 0001, and asserts on the result.
 *
 * Each case gets a throwaway database, because a migration cannot be run twice
 * against the same schema.
 */

const MIGRACION_INICIAL = "./src/db/migrations/0000_boring_rockslide.sql";
const MIGRACION_TERRITORIO =
  "./src/db/migrations/0001_territorio_como_datos_de_referencia.sql";

const creados: string[] = [];
const abiertos: Pool[] = [];

afterEach(async () => {
  // Close every pool before dropping, or DROP ... WITH (FORCE) kills live
  // connections and pg raises an unhandled error that outlives the test.
  while (abiertos.length) {
    const pool = abiertos.pop();
    await pool?.end().catch(() => {});
  }

  const admin = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    while (creados.length) {
      const nombre = creados.pop();
      await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
});

let contador = 0;

/** A fresh database with migration 0000 applied and nothing else. */
async function baseDePruebaPreMigracion(): Promise<Pool> {
  contador += 1;
  const nombre = `campania_migracion_${process.pid}_${contador}`;

  const admin = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await admin.end();
  }
  creados.push(nombre);

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, `/${nombre}$1`),
  });
  abiertos.push(pool);
  await ejecutar(pool, MIGRACION_INICIAL);
  return pool;
}

async function ejecutar(pool: Pool, ruta: string): Promise<void> {
  const sql = await readFile(ruta, "utf8");
  for (const sentencia of sql.split("--> statement-breakpoint")) {
    if (sentencia.trim()) await pool.query(sentencia);
  }
}

async function sembrarUsuario(pool: Pool): Promise<string> {
  const id = "usuario-migracion";
  await pool.query(
    `insert into users (id, role) values ($1, 'asesor_nacional')
     on conflict (id) do nothing`,
    [id]
  );
  return id;
}

interface PeregrinaLibre {
  codigo: string;
  region: string;
  provincia: string;
  diocesisLocalidad: string;
}

async function sembrarPeregrinas(
  pool: Pool,
  filas: PeregrinaLibre[]
): Promise<void> {
  const creadaPor = await sembrarUsuario(pool);
  let n = 0;
  for (const fila of filas) {
    n += 1;
    await pool.query(
      `insert into peregrina
         (id, codigo, codigo_num, tipo, estado, region, provincia,
          diocesis_localidad, modalidad, created_by_id)
       values (gen_random_uuid()::text, $1, $2, 'peregrina', 'activa', $3, $4, $5, 'JOV', $6)`,
      [
        fila.codigo,
        n,
        fila.region,
        fila.provincia,
        fila.diocesisLocalidad,
        creadaPor,
      ]
    );
  }
}

describe("migración de territorio de texto libre a datos de referencia", () => {
  it("mapea mayúsculas, tildes y espacios sobrantes a un único registro", async () => {
    const pool = await baseDePruebaPreMigracion();

    // The same two places, spelled five ways, as a real spreadsheet would.
    await sembrarPeregrinas(pool, [
      { codigo: "A 1", region: "CENTRO", provincia: "Córdoba", diocesisLocalidad: "Villa María" },
      { codigo: "A 2", region: "CENTRO", provincia: "córdoba", diocesisLocalidad: "villa maria" },
      { codigo: "A 3", region: "CENTRO", provincia: "CORDOBA", diocesisLocalidad: "VILLA MARIA " },
      { codigo: "A 4", region: "CENTRO", provincia: "  Cordoba  ", diocesisLocalidad: " Villa María" },
      { codigo: "A 5", region: "CENTRO", provincia: "Córdoba", diocesisLocalidad: "Río Cuarto" },
    ]);

    await ejecutar(pool, MIGRACION_TERRITORIO);

    const { rows: provincias } = await pool.query(
      "select nombre, region from provincia"
    );
    expect(provincias).toHaveLength(1);
    // The accented spelling survives, not whichever row happened to be first.
    expect(provincias[0]).toEqual({ nombre: "Córdoba", region: "CENTRO" });

    const { rows: diocesis } = await pool.query(
      "select nombre from diocesis_localidad order by nombre"
    );
    expect(diocesis.map((d) => d.nombre)).toEqual(["Río Cuarto", "Villa María"]);

    // Nothing lost its territory.
    const { rows: sinTerritorio } = await pool.query(
      "select count(*)::int as n from peregrina where diocesis_localidad_id is null"
    );
    expect(sinTerritorio[0].n).toBe(0);

    const { rows: resueltas } = await pool.query(
      `select p.codigo, d.nombre as diocesis, pr.nombre as provincia, pr.region
         from peregrina p
         join diocesis_localidad d on d.id = p.diocesis_localidad_id
         join provincia pr on pr.id = d.provincia_id
        order by p.codigo`
    );
    expect(resueltas.map((r) => r.diocesis)).toEqual([
      "Villa María",
      "Villa María",
      "Villa María",
      "Villa María",
      "Río Cuarto",
    ]);
    expect(new Set(resueltas.map((r) => r.provincia))).toEqual(
      new Set(["Córdoba"])
    );

  });

  it("distingue Diócesis homónimas en Provincias distintas", async () => {
    const pool = await baseDePruebaPreMigracion();

    await sembrarPeregrinas(pool, [
      { codigo: "B 1", region: "CENTRO", provincia: "Córdoba", diocesisLocalidad: "San Martín" },
      { codigo: "B 2", region: "CUYO", provincia: "Mendoza", diocesisLocalidad: "San Martín" },
    ]);

    await ejecutar(pool, MIGRACION_TERRITORIO);

    const { rows } = await pool.query(
      "select count(*)::int as n from diocesis_localidad"
    );
    expect(rows[0].n).toBe(2);

  });

  it("aborta e informa cuando una Provincia aparece en dos Regiones", async () => {
    const pool = await baseDePruebaPreMigracion();

    // Exactly the contradiction free text allows and reference data forbids.
    await sembrarPeregrinas(pool, [
      { codigo: "C 1", region: "R. PAT", provincia: "Neuquén", diocesisLocalidad: "Zapala" },
      { codigo: "C 2", region: "NOA", provincia: "neuquen", diocesisLocalidad: "Zapala" },
    ]);

    await expect(ejecutar(pool, MIGRACION_TERRITORIO)).rejects.toThrow(
      /aparecen en más de una región/
    );

    // Reported, not resolved by guesswork — and nothing was dropped.
    const { rows } = await pool.query(
      "select count(*)::int as n from peregrina"
    );
    expect(rows[0].n).toBe(2);

  });

  it("migra Misioneros junto con Peregrinas, compartiendo los registros", async () => {
    const pool = await baseDePruebaPreMigracion();
    const creadoPor = await sembrarUsuario(pool);

    await sembrarPeregrinas(pool, [
      { codigo: "D 1", region: "CENTRO", provincia: "Córdoba", diocesisLocalidad: "Villa María" },
    ]);
    await pool.query(
      `insert into misionero
         (id, nombre, apellido, estado, region, provincia, diocesis_localidad, created_by_id)
       values (gen_random_uuid()::text, 'María', 'Pérez', 'activo',
               'CENTRO', 'CORDOBA', 'villa maría', $1)`,
      [creadoPor]
    );

    await ejecutar(pool, MIGRACION_TERRITORIO);

    const { rows } = await pool.query(
      `select (select diocesis_localidad_id from peregrina) as de_peregrina,
              (select diocesis_localidad_id from misionero) as de_misionero,
              (select count(*)::int from diocesis_localidad) as cuantas`
    );
    expect(rows[0].cuantas).toBe(1);
    expect(rows[0].de_peregrina).toBe(rows[0].de_misionero);

  });

  it("una Diócesis/Localidad que solo aparece en un Misionero también se crea", async () => {
    const pool = await baseDePruebaPreMigracion();
    const creadoPor = await sembrarUsuario(pool);

    await pool.query(
      `insert into misionero
         (id, nombre, apellido, estado, region, provincia, diocesis_localidad, created_by_id)
       values (gen_random_uuid()::text, 'Juan', 'Gómez', 'activo',
               'NEA', 'Chaco', 'Resistencia', $1)`,
      [creadoPor]
    );

    await ejecutar(pool, MIGRACION_TERRITORIO);

    const { rows } = await pool.query(
      `select d.nombre as diocesis, pr.nombre as provincia, pr.region
         from misionero m
         join diocesis_localidad d on d.id = m.diocesis_localidad_id
         join provincia pr on pr.id = d.provincia_id`
    );
    expect(rows[0]).toEqual({
      diocesis: "Resistencia",
      provincia: "Chaco",
      region: "NEA",
    });

  });

  it("no falla sobre una base vacía", async () => {
    const pool = await baseDePruebaPreMigracion();

    await ejecutar(pool, MIGRACION_TERRITORIO);

    const { rows } = await pool.query(
      "select count(*)::int as n from provincia"
    );
    expect(rows[0].n).toBe(0);

  });
});
