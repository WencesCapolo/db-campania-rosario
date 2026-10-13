import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "@/test/connection";

/**
 * Año de consagración → Fecha de consagración, against the real SQL — ADR 0013.
 *
 * Like the other migration suites, this one does not go through a service: the
 * thing under test is a file that runs once, against production data. A fresh
 * database gets every migration up to 0009, a Misionero with a year and one
 * without, then 0010 and 0011.
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
  const nombre = `campania_consagracion_${process.pid}`;
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

describe("la migración del Año a la Fecha de consagración", () => {
  it("un año pasa al primero de enero, y la falta de año sigue siendo falta", async () => {
    const pool = await baseHasta("0009_numeracion_anterior.sql");

    await pool.query(`insert into users (id, role) values ('u', 'asesor_nacional')`);
    const { rows: prov } = await pool.query(
      `insert into provincia (id, nombre, abreviatura)
       values ('p', 'Córdoba', 'CBA') returning id`
    );
    await pool.query(
      `insert into diocesis_localidad (id, nombre, provincia_id, region)
       values ('d', 'Villa María', $1, 'CENTRO')`,
      [prov[0].id]
    );
    await pool.query(
      `insert into misionero (id, nombre, apellido, diocesis_localidad_id, created_by_id, anio_consagracion)
       values ('con', 'Ana', 'Álvarez', 'd', 'u', 1998),
              ('sin', 'Juan', 'Benítez', 'd', 'u', null)`
    );

    const [aditiva, quitar] = (await migraciones()).filter(
      (f) => f > "0009_numeracion_anterior.sql"
    );
    expect(aditiva).toBe("0010_fecha_de_consagracion.sql");
    expect(quitar).toBe("0011_sin_anio_de_consagracion.sql");
    await ejecutar(pool, aditiva!);
    await ejecutar(pool, quitar!);

    const { rows } = await pool.query(
      `select id, to_char(fecha_consagracion, 'YYYY-MM-DD') as fecha, email
       from misionero order by id`
    );
    expect(rows).toEqual([
      { id: "con", fecha: "1998-01-01", email: null },
      { id: "sin", fecha: null, email: null },
    ]);

    const { rows: columnas } = await pool.query(
      `select column_name from information_schema.columns
       where table_name = 'misionero' and column_name = 'anio_consagracion'`
    );
    expect(columnas).toEqual([]);
  });
});
