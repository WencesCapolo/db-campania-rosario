import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import { AsignacionRepository } from "@/modules/asignacion/asignacion.repository";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import type { Modalidad, PeregrinaEstado } from "@/modules/peregrina/peregrina.schema";
import {
  crearActor,
  crearDiocesisLocalidad,
  crearProvincia,
} from "@/test/factories";
import type { Alcance } from "@/lib/authorization/alcance";

/**
 * Los planes de las consultas del tablero, con volumen.
 *
 * El PRD pide esto explícitamente y por una razón concreta: estas consultas
 * corren en **cada carga** del tablero, y una regresión que las convierta en un
 * recorrido de tabla completa no rompe ningún test — sólo hace la pantalla más
 * lenta a medida que la Campaña crece, que es exactamente cuando nadie está
 * mirando. Un índice que existe pero que el planner no elige no sirve de nada, y
 * la única forma de saberlo es preguntarle al planner.
 *
 * Cómo se prueba el SQL de verdad y no una copia: se intercepta el cliente para
 * capturar el texto y los parámetros que el repositorio realmente emite, y se
 * explica *eso*. Una consulta escrita a mano en este archivo probaría que la
 * consulta escrita a mano usa el índice.
 *
 * Este archivo es la excepción declarada a «un solo seam»: lo que está bajo
 * prueba es un plan de ejecución, y un servicio no tiene plan.
 */

/*
 * El volumen se siembra en `beforeEach` y no en `beforeAll`, porque el harness
 * trunca todas las tablas antes de cada test (ver `src/test/setup.ts`). Sembrar
 * una vez daría planes sobre una tabla vacía, que es lo que este archivo existe
 * para no hacer: con doscientas filas el recorrido completo *es* el plan
 * correcto y la medición no dice nada sobre producción.
 *
 * De ahí también el tamaño: suficiente para que el planner prefiera un índice, y
 * chico como para pagarlo nueve veces. Las inserciones son por lotes de mil.
 */
const PEREGRINAS = 12_000;
const MISIONEROS = 4_000;
const DIOCESIS = 6;

const ESTADOS: PeregrinaEstado[] = [
  "activa",
  "activa",
  "activa",
  "en_reparacion",
  "extraviada",
];
const MODALIDADES: Modalidad[] = ["JOV", "FAM", "MAT", "MIS", "SAL"];

let alcance: Alcance;
const alcanceNacional: Alcance = { tipo: "nacional" };

beforeEach(async () => {
  const provincia = await crearProvincia({
    nombre: "Volumen",
    abreviatura: "VOL",
  });
  const actor = await crearActor({ rol: "asesor_nacional" });

  const diocesis: string[] = [];
  for (let i = 0; i < DIOCESIS; i += 1) {
    const d = await crearDiocesisLocalidad({
      nombre: `Diócesis ${i}`,
      provinciaId: provincia.id,
      region: i % 2 === 0 ? "CENTRO" : "CUYO",
    });
    diocesis.push(d.id);
  }

  const LOTE = 1_000;

  const misioneros: string[] = [];
  for (let desde = 0; desde < MISIONEROS; desde += LOTE) {
    const filas = await db
      .insert(misionero)
      .values(
        Array.from({ length: LOTE }, (_, j) => {
          const i = desde + j;
          return {
            nombre: `Misionero ${i}`,
            apellido: `Apellido ${String(i).padStart(5, "0")}`,
            estado: "activo" as const,
            diocesisLocalidadId: diocesis[i % DIOCESIS]!,
            createdById: actor.id,
            // Uno de cada diez ya dejó la Campaña, para que el índice parcial
            // tenga algo que excluir.
            bajaAt: i % 10 === 0 ? new Date() : null,
          };
        })
      )
      .returning({ id: misionero.id });
    misioneros.push(...filas.map((f) => f.id));
  }

  for (let desde = 0; desde < PEREGRINAS; desde += LOTE) {
    await db.insert(peregrina).values(
      Array.from({ length: LOTE }, (_, j) => {
        const i = desde + j;
        return {
          codigo: `VOL ${MODALIDADES[i % 5]} ${String(i).padStart(5, "0")}`,
          codigoNum: i,
          tipo: i % 7 === 0 ? ("auxiliar" as const) : ("peregrina" as const),
          estado: ESTADOS[i % 5]!,
          modalidad: MODALIDADES[i % 5]!,
          diocesisLocalidadId: diocesis[i % DIOCESIS]!,
          // Dos de cada tres están en manos de alguien; una de cada veinte está
          // dada de baja, que es lo que los índices parciales dejan afuera.
          misioneroActualId: i % 3 === 0 ? null : misioneros[i % MISIONEROS]!,
          bajaAt: i % 20 === 0 ? new Date() : null,
          createdById: actor.id,
        };
      })
    );
  }

  // Un período abierto por cada imagen que está en manos de alguien, con fechas
  // repartidas: las tarjetas de «estancadas» y de «Misioneros libres» preguntan
  // por la tabla de Asignaciones, y con esa tabla vacía el plan correcto es un
  // recorrido y la medición no mide nada.
  // Historia cerrada para todas, y un período abierto sólo para las que están en
  // manos de alguien — que es la proporción real: una imagen acumula tantas
  // Asignaciones como manos pasó, y a lo sumo una está abierta. Con todas las
  // filas abiertas el índice parcial cubriría la tabla entera y el planner haría
  // bien en ignorarlo, lo que mediría un fixture y no producción.
  await db.execute(sql`
    insert into asignacion (id, peregrina_id, misionero_id, abierta_at, cerrada_at, registrada_por_id)
    select gen_random_uuid()::text,
           p.id,
           coalesce(p.misionero_actual_id, m.id),
           now() - make_interval(days => 900 + (p.codigo_num % 100) + (v * 200)),
           now() - make_interval(days => 800 + (p.codigo_num % 100) + (v * 200)),
           ${actor.id}
      from peregrina p
      cross join generate_series(0, 1) as v
      join misionero m on m.id = (select id from misionero limit 1)
  `);

  await db.execute(sql`
    insert into asignacion (id, peregrina_id, misionero_id, abierta_at, registrada_por_id)
    select gen_random_uuid()::text,
           p.id,
           p.misionero_actual_id,
           now() - make_interval(days => (p.codigo_num % 500)),
           ${actor.id}
      from peregrina p
     where p.misionero_actual_id is not null
  `);

  // Sin estadísticas el planner adivina, y un plan basado en una adivinanza no
  // dice nada sobre producción.
  await db.execute(sql`analyze peregrina`);
  await db.execute(sql`analyze misionero`);
  await db.execute(sql`analyze asignacion`);

  alcance = { tipo: "diocesis", diocesisLocalidadId: diocesis[0]! };
});

describe("los planes del tablero, con volumen", () => {
  /*
   * Un test por grupo y no uno por consulta, con `expect.soft`: el fixture son
   * doce mil imágenes y treinta mil Asignaciones, y el harness lo trunca antes de
   * cada test. Nueve tests serían nueve siembras y un minuto de suite para
   * responder tres preguntas. `soft` mantiene lo que un test por consulta daba
   * gratis — que un plan roto no esconda a los otros ocho.
   */

  it("las agregaciones entran por un índice y no por la tabla", async () => {
    const porEstado = await explicar(() =>
      PeregrinaRepository.contarPorEstado(alcance, {})
    );
    const porModalidad = await explicar(() =>
      PeregrinaRepository.contarPorModalidad(alcance, {})
    );
    const totalFiltrado = await explicar(() =>
      PeregrinaRepository.contarTotal(alcance, {
        estado: "activa",
        modalidad: "JOV",
      })
    );
    const listado = await explicar(() =>
      PeregrinaRepository.findFiltradas(alcance, { estado: "activa" })
    );
    const libres = await explicar(() =>
      PeregrinaRepository.contarSinTenencia(alcance, {})
    );
    const personas = await explicar(() =>
      MisioneroRepository.contarTotal(alcance, {})
    );

    // El desglose por Estado y por Modalidad es la razón del índice compuesto:
    // el predicado selectivo es el territorio y la columna que se agrupa viene
    // en el mismo índice.
    expect.soft(porEstado).toContain("peregrina_activas_por_territorio_idx");
    expect.soft(porModalidad).toContain("peregrina_activas_por_territorio_idx");
    expect.soft(totalFiltrado).toContain("peregrina_activas_por_territorio_idx");

    // Lo que se le exige a todas: ninguna carga del tablero recorre una tabla
    // entera para responder por una Diócesis.
    for (const plan of [
      porEstado,
      porModalidad,
      totalFiltrado,
      listado,
      libres,
    ]) {
      expect.soft(plan).not.toContain("Seq Scan on peregrina");
    }
    expect.soft(personas).not.toContain("Seq Scan on misionero");
  });

  it("los listados ordenados tampoco recorren la tabla", async () => {
    const disponibles = await explicar(() =>
      PeregrinaRepository.findDisponibles(alcance)
    );
    const gente = await explicar(() =>
      MisioneroRepository.findFiltrados(alcance, {})
    );

    // Acá no se exige un índice por nombre, y eso es un resultado y no una
    // omisión: los dos planes entran por el índice del territorio y **ordenan**.
    // Se escribieron dos índices compuestos para que salieran ya ordenados y el
    // planner no eligió ninguno, así que se borraron. Lo que sigue siendo cierto,
    // y lo que se verifica, es que ninguno lee la tabla entera.
    expect.soft(disponibles).not.toContain("Seq Scan on peregrina");
    expect.soft(gente).not.toContain("Seq Scan on misionero");
  });

  it("las listas cruzadas no recorren la historia", async () => {
    const estancadas = await explicar(() =>
      AsignacionRepository.findPeregrinasEstancadas(alcance, 180)
    );
    const sinPeregrina = await explicar(() =>
      AsignacionRepository.findMisionerosSinPeregrina(alcance)
    );

    // `asignacion` es la tabla que crece sin techo: una imagen acumula una fila
    // por cada mano que pasó. Estas dos preguntas son sobre los períodos
    // abiertos, que son una minoría, y por eso los índices son parciales.
    expect.soft(estancadas).toContain("asignacion_abiertas_por_fecha_idx");
    // Y la de los Misioneros libres entra por el **mismo** índice, que es lo
    // interesante: al ser parcial sobre `cerrada_at is null`, sirve como conjunto
    // de las filas abiertas y no sólo como orden por fecha. Por eso el índice
    // equivalente por Misionero se escribió y se borró — no agregaba nada.
    expect.soft(sinPeregrina).toContain("asignacion_abiertas_por_fecha_idx");
    expect.soft(estancadas).not.toContain("Seq Scan on asignacion");
    expect.soft(sinPeregrina).not.toContain("Seq Scan on asignacion");
  });

  it("el desglose nacional recorre la tabla, y está bien que lo haga", async () => {
    // Contar el país entero agrupando por Región *es* leer la tabla entera. Un
    // índice acá sería más lento, y exigirlo convertiría este archivo en una
    // regla de estilo en lugar de una medición.
    const plan = await explicar(() =>
      PeregrinaRepository.contarPorRegion(alcanceNacional, {})
    );

    expect(plan).toContain("Aggregate");
  });
});

/**
 * Corre la consulta del repositorio, captura el SQL que emitió y devuelve el
 * plan de *ese* SQL.
 *
 * El cliente se intercepta en lugar de reescribir la consulta a mano, que es la
 * única manera de que este archivo hable de producción: un `EXPLAIN` sobre SQL
 * copiado prueba que la copia usa el índice.
 */
async function explicar(consulta: () => Promise<unknown>): Promise<string> {
  const cliente = db.$client as {
    query: (...args: unknown[]) => Promise<unknown>;
  };
  const original = cliente.query.bind(cliente);

  let texto: string | undefined;
  let valores: unknown[] = [];

  cliente.query = async (...args: unknown[]) => {
    const primero = args[0];

    // Drizzle pasa `{ text, rowMode }` como primer argumento y los parámetros
    // como segundo, no dentro del objeto. Leerlos de `config.values` deja el
    // array vacío y el `explain` falla con «there is no parameter $1», que es una
    // forma sutil de no medir nada.
    if (typeof primero === "string") texto = primero;
    else if (primero && typeof primero === "object" && "text" in primero) {
      texto = (primero as { text: string }).text;
    }

    if (Array.isArray(args[1])) valores = args[1];
    else if (primero && typeof primero === "object" && "values" in primero) {
      valores = (primero as { values?: unknown[] }).values ?? [];
    }

    return original(...args);
  };

  try {
    await consulta();
  } finally {
    cliente.query = original;
  }

  if (!texto) throw new Error("No se capturó ninguna consulta");

  const plan = (await original(`explain (format text) ${texto}`, valores)) as {
    rows: Record<string, string>[];
  };

  return plan.rows.map((fila) => Object.values(fila)[0]).join("\n");
}
