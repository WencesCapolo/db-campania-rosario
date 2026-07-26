import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "@/test/connection";

/**
 * The Asignación backfill, tested against the real migration SQL — user story 20.
 *
 * Like the territory suite, this one does not go through a service, because the
 * thing under test *is* a SQL file: it runs once, against production data, and
 * there is no second chance. Each case gets a throwaway database, applies every
 * migration up to the one before, seeds the shape a real installation has, then
 * applies 0003 and asserts.
 *
 * What is being proved is narrow and load-bearing: every existing link becomes
 * exactly one open Asignación, none is dropped, each is attributed to the record's
 * creator and dated from its creation timestamp — and a Peregrina that the old
 * schema let two Misioneros claim at once still ends with one open period.
 */

const HASTA_0002 = [
  "./src/db/migrations/0000_boring_rockslide.sql",
  "./src/db/migrations/0001_territorio_como_datos_de_referencia.sql",
  "./src/db/migrations/0002_autorizacion_e_invitaciones.sql",
];
const MIGRACION_ASIGNACION =
  "./src/db/migrations/0003_asignacion_historial_y_baja_logica.sql";
const MIGRACION_DROP =
  "./src/db/migrations/0004_retirar_puntero_de_misionero_a_peregrina.sql";

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

/** A fresh database with every migration up to 0002 applied, and nothing else. */
async function baseDePruebaPreMigracion(): Promise<Pool> {
  contador += 1;
  const nombre = `campania_asignacion_${process.pid}_${contador}`;

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
  for (const ruta of HASTA_0002) await ejecutar(pool, ruta);
  return pool;
}

async function ejecutar(pool: Pool, ruta: string): Promise<void> {
  const sql = await readFile(ruta, "utf8");
  for (const sentencia of sql.split("--> statement-breakpoint")) {
    if (sentencia.trim()) await pool.query(sentencia);
  }
}

// ── Fixtures, in the post-0002 shape a real installation has ──────────────────

interface Mundo {
  usuarioA: string;
  usuarioB: string;
  diocesisId: string;
}

async function sembrarMundo(pool: Pool): Promise<Mundo> {
  const { rows: prov } = await pool.query(
    `insert into provincia (id, nombre, abreviatura, region)
     values (gen_random_uuid()::text, 'Córdoba', 'CBA', 'CENTRO') returning id`
  );
  const { rows: dio } = await pool.query(
    `insert into diocesis_localidad (id, nombre, provincia_id)
     values (gen_random_uuid()::text, 'Villa María', $1) returning id`,
    [prov[0].id]
  );

  for (const [id, rol] of [
    ["usuario-a", "referente_local"],
    ["usuario-b", "asesor_nacional"],
  ] as const) {
    await pool.query(`insert into users (id, role) values ($1, $2)`, [id, rol]);
  }

  return { usuarioA: "usuario-a", usuarioB: "usuario-b", diocesisId: dio[0].id };
}

async function sembrarPeregrina(
  pool: Pool,
  mundo: Mundo,
  codigo: string
): Promise<string> {
  const { rows } = await pool.query(
    `insert into peregrina
       (id, codigo, codigo_num, tipo, estado, diocesis_localidad_id, modalidad, created_by_id)
     values (gen_random_uuid()::text, $1, $2, 'peregrina', 'activa', $3, 'JOV', $4)
     returning id`,
    [codigo, codigo.length, mundo.diocesisId, mundo.usuarioA]
  );
  return rows[0].id;
}

async function sembrarMisionero(
  pool: Pool,
  mundo: Mundo,
  opts: {
    apellido: string;
    peregrinaId?: string | null;
    creadoPor?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<string> {
  const { rows } = await pool.query(
    `insert into misionero
       (id, nombre, apellido, estado, diocesis_localidad_id, peregrina_id,
        created_by_id, created_at, updated_at)
     values (gen_random_uuid()::text, 'María', $1, 'activo', $2, $3, $4,
             coalesce($5::timestamptz, now()), coalesce($6::timestamptz, now()))
     returning id`,
    [
      opts.apellido,
      mundo.diocesisId,
      opts.peregrinaId ?? null,
      opts.creadoPor ?? mundo.usuarioA,
      opts.createdAt ?? null,
      opts.updatedAt ?? null,
    ]
  );
  return rows[0].id;
}

// ── Casos ─────────────────────────────────────────────────────────────────────

describe("migración de los enlaces Misionero→Peregrina a Asignaciones", () => {
  it("cada enlace se convierte en exactamente una Asignación abierta, atribuida a quien creó el registro y fechada en su creación", async () => {
    const pool = await baseDePruebaPreMigracion();
    const mundo = await sembrarMundo(pool);

    const unaPeregrina = await sembrarPeregrina(pool, mundo, "CBA JOV 0001");
    const otraPeregrina = await sembrarPeregrina(pool, mundo, "CBA JOV 0002");

    const conCargo = await sembrarMisionero(pool, mundo, {
      apellido: "Pérez",
      peregrinaId: unaPeregrina,
      creadoPor: mundo.usuarioB,
      createdAt: "2023-03-04T12:00:00Z",
    });
    await sembrarMisionero(pool, mundo, {
      apellido: "Gómez",
      peregrinaId: otraPeregrina,
    });
    // Un Misionero sin Peregrina no genera historia: no la tuvo nunca.
    await sembrarMisionero(pool, mundo, { apellido: "Sosa", peregrinaId: null });

    await ejecutar(pool, MIGRACION_ASIGNACION);

    const { rows: totales } = await pool.query(
      `select count(*)::int as todas,
              count(*) filter (where cerrada_at is null)::int as abiertas
         from asignacion`
    );
    expect(totales[0]).toEqual({ todas: 2, abiertas: 2 });

    const { rows } = await pool.query(
      `select a.misionero_id, a.registrada_por_id, a.abierta_at, a.cerrada_at,
              a.nota_apertura, p.codigo
         from asignacion a
         join peregrina p on p.id = a.peregrina_id
        where a.misionero_id = $1`,
      [conCargo]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo).toBe("CBA JOV 0001");
    // Attributed to the record's creator, not to whoever ran the migration.
    expect(rows[0].registrada_por_id).toBe(mundo.usuarioB);
    expect(rows[0].abierta_at.toISOString()).toBe("2023-03-04T12:00:00.000Z");
    expect(rows[0].cerrada_at).toBeNull();
    // The note says where the date came from, because the old pointer did not
    // record one and a bare date would read as evidence.
    expect(rows[0].nota_apertura).toMatch(/creación del registro del Misionero/);
  });

  it("deja la tenencia actual de la Peregrina apuntando al Misionero de la Asignación abierta", async () => {
    const pool = await baseDePruebaPreMigracion();
    const mundo = await sembrarMundo(pool);

    const peregrinaId = await sembrarPeregrina(pool, mundo, "CBA JOV 0001");
    const misioneroId = await sembrarMisionero(pool, mundo, {
      apellido: "Pérez",
      peregrinaId,
    });
    // Una Peregrina que nadie tenía queda sin tenencia, no con una inventada.
    await sembrarPeregrina(pool, mundo, "CBA JOV 0002");

    await ejecutar(pool, MIGRACION_ASIGNACION);

    const { rows } = await pool.query(
      `select codigo, misionero_actual_id from peregrina order by codigo`
    );
    expect(rows).toEqual([
      { codigo: "CBA JOV 0001", misionero_actual_id: misioneroId },
      { codigo: "CBA JOV 0002", misionero_actual_id: null },
    ]);
  });

  it("una Peregrina que figuraba a cargo de dos Misioneros conserva los dos enlaces y queda con una sola Asignación abierta", async () => {
    const pool = await baseDePruebaPreMigracion();
    const mundo = await sembrarMundo(pool);

    // El esquema anterior no tenía restricción de unicidad, así que esto pasaba.
    const peregrinaId = await sembrarPeregrina(pool, mundo, "CBA JOV 0001");
    const viejo = await sembrarMisionero(pool, mundo, {
      apellido: "Antigua",
      peregrinaId,
      createdAt: "2021-01-01T00:00:00Z",
      updatedAt: "2021-01-01T00:00:00Z",
    });
    const reciente = await sembrarMisionero(pool, mundo, {
      apellido: "Reciente",
      peregrinaId,
      createdAt: "2024-06-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
    });

    await ejecutar(pool, MIGRACION_ASIGNACION);

    // Ninguno se descartó: un enlace que existió es evidencia, aunque sus fechas
    // no lo sean.
    const { rows } = await pool.query(
      `select misionero_id, cerrada_at, nota_cierre
         from asignacion where peregrina_id = $1`,
      [peregrinaId]
    );
    expect(rows).toHaveLength(2);

    const abiertas = rows.filter((r) => r.cerrada_at === null);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].misionero_id).toBe(reciente);

    const cerradas = rows.filter((r) => r.cerrada_at !== null);
    expect(cerradas[0].misionero_id).toBe(viejo);
    // Cerrada con una explicación, no con un período inventado.
    expect(cerradas[0].nota_cierre).toMatch(/más de un Misionero/);

    const { rows: tenencia } = await pool.query(
      `select misionero_actual_id from peregrina where id = $1`,
      [peregrinaId]
    );
    expect(tenencia[0].misionero_actual_id).toBe(reciente);
  });

  it("el índice único impide una segunda Asignación abierta después de migrar", async () => {
    const pool = await baseDePruebaPreMigracion();
    const mundo = await sembrarMundo(pool);

    const peregrinaId = await sembrarPeregrina(pool, mundo, "CBA JOV 0001");
    await sembrarMisionero(pool, mundo, { apellido: "Pérez", peregrinaId });
    const otro = await sembrarMisionero(pool, mundo, { apellido: "Gómez" });

    await ejecutar(pool, MIGRACION_ASIGNACION);

    // La invariante queda en la base, no sólo en el servicio.
    await expect(
      pool.query(
        `insert into asignacion (id, peregrina_id, misionero_id, registrada_por_id)
         values (gen_random_uuid()::text, $1, $2, $3)`,
        [peregrinaId, otro, mundo.usuarioA]
      )
    ).rejects.toThrow(/asignacion_peregrina_abierta_key/);
  });

  it("no falla sobre una base sin enlaces, y 0004 retira el puntero", async () => {
    const pool = await baseDePruebaPreMigracion();
    await sembrarMundo(pool);

    await ejecutar(pool, MIGRACION_ASIGNACION);
    await ejecutar(pool, MIGRACION_DROP);

    const { rows } = await pool.query(
      `select count(*)::int as n from asignacion`
    );
    expect(rows[0].n).toBe(0);

    const { rows: columnas } = await pool.query(
      `select count(*)::int as n
         from information_schema.columns
        where table_name = 'misionero' and column_name = 'peregrina_id'`
    );
    expect(columnas[0].n).toBe(0);
  });

  it("los Estados nuevos existen y el legado sigue siendo legible", async () => {
    const pool = await baseDePruebaPreMigracion();
    const mundo = await sembrarMundo(pool);

    // Un registro que alguien marcó inactiva por algún motivo. La migración no lo
    // reescribe: hacerlo afirmaría algo que nadie sabe.
    await pool.query(
      `insert into peregrina
         (id, codigo, codigo_num, tipo, estado, diocesis_localidad_id, modalidad, created_by_id)
       values (gen_random_uuid()::text, 'CBA JOV 0009', 9, 'peregrina', 'inactiva', $1, 'JOV', $2)`,
      [mundo.diocesisId, mundo.usuarioA]
    );

    await ejecutar(pool, MIGRACION_ASIGNACION);

    const { rows: valores } = await pool.query(
      `select enumlabel from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = 'peregrina_estado'
        order by e.enumsortorder`
    );
    expect(valores.map((v) => v.enumlabel)).toEqual([
      "activa",
      "inactiva",
      "en_reparacion",
      "extraviada",
    ]);

    const { rows } = await pool.query(
      `select estado from peregrina where codigo = 'CBA JOV 0009'`
    );
    expect(rows[0].estado).toBe("inactiva");
  });
});
