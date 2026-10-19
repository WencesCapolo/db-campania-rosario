import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "@/test/connection";

/**
 * Las bajas de antes de ADR 0013 pasan a Estado Extraviada — 0012.
 *
 * Like the other migration suites, this one does not go through a service: the
 * thing under test is a file that runs once, against production data. A fresh
 * database gets every migration up to 0011, an image de baja still «Activa»,
 * one de baja already Extraviada and one in the inventario, then 0012.
 */

const DIRECTORIO = "./src/db/migrations";

const creados: string[] = [];
const abiertos: Pool[] = [];

afterEach(async () => {
  while (abiertos.length) await abiertos.pop()?.end().catch(() => {});

  const admin = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    while (creados.length) {
      await admin.query(`DROP DATABASE IF EXISTS "${creados.pop()}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
});

async function migraciones(): Promise<string[]> {
  return (await readdir(DIRECTORIO)).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
}

async function ejecutar(pool: Pool, archivo: string): Promise<void> {
  const sql = await readFile(`${DIRECTORIO}/${archivo}`, "utf8");
  for (const sentencia of sql.split("--> statement-breakpoint")) {
    if (sentencia.trim()) await pool.query(sentencia);
  }
}

async function baseHasta(ultima: string): Promise<Pool> {
  const nombre = `campania_bajas_${process.pid}`;
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
  for (const archivo of await migraciones()) {
    if (archivo > ultima) break;
    await ejecutar(pool, archivo);
  }
  return pool;
}

describe("la migración de las bajas a Extraviada", () => {
  it("sólo cambia las bajas que no decían Extraviada", async () => {
    const pool = await baseHasta("0011_sin_anio_de_consagracion.sql");

    await pool.query(`insert into users (id, role) values ('u', 'asesor_nacional')`);
    await pool.query(
      `insert into provincia (id, nombre, abreviatura) values ('p', 'Córdoba', 'CBA')`
    );
    await pool.query(
      `insert into diocesis_localidad (id, nombre, provincia_id, region)
       values ('d', 'Villa María', 'p', 'CENTRO')`
    );
    await pool.query(
      `insert into peregrina (id, codigo, codigo_num, modalidad, estado, baja_at, diocesis_localidad_id, created_by_id)
       values ('vieja', 'CBA JOV 0023', 23, 'JOV', 'activa', now(), 'd', 'u'),
              ('nueva', 'CBA JOV 0024', 24, 'JOV', 'extraviada', now(), 'd', 'u'),
              ('enInventario', 'CBA JOV 0025', 25, 'JOV', 'en_reparacion', null, 'd', 'u')`
    );

    const [archivo] = (await migraciones()).filter(
      (f) => f > "0011_sin_anio_de_consagracion.sql"
    );
    expect(archivo).toBe("0012_bajas_extraviadas.sql");
    await ejecutar(pool, archivo!);

    const { rows } = await pool.query(
      `select id, estado, baja_at is not null as de_baja from peregrina order by id`
    );
    expect(rows).toEqual([
      { id: "enInventario", estado: "en_reparacion", de_baja: false },
      { id: "nueva", estado: "extraviada", de_baja: true },
      { id: "vieja", estado: "extraviada", de_baja: true },
    ]);
  });
});
