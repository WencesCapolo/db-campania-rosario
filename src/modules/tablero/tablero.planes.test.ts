import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import { AsignacionRepository } from "@/modules/asignacion/asignacion.repository";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import { FILAS_POR_PAGINA } from "@/lib/paginacion";
import { matrimonio } from "@/modules/misionero/matrimonio.schema";
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

/**
 * Trescientos hogares, seiscientas de las cuatro mil personas.
 *
 * La pata de Matrimonios de la unión tiene que tener filas o esto mide una
 * `union all` con un lado vacío, que el planner resuelve de una manera que no
 * es la de producción: un `not exists` contra una tabla vacía es gratis, y el
 * lado de las parejas desaparece del plan. Con cero Matrimonios este archivo
 * afirmaría que el listado colapsado es rápido sin haber medido nunca lo que lo
 * hizo colapsado.
 *
 * La proporción es una estimación de la Campaña — muchos más individuos que
 * parejas — y está acá para que se pueda discutir en un solo lugar.
 */
const MATRIMONIOS = 300;

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

  /*
   * Los cónyuges se toman de a pares `(j, j+6)` porque el paso es la cantidad
   * de Diócesis: los dos caen en la misma, que es la invariante de la que
   * cuelga todo lo demás — un Matrimonio no tiene territorio propio, usa el del
   * cónyuge A, y eso sólo está bien definido si los dos comparten Diócesis
   * (ADR 0010). El corrimiento `k % DIOCESIS` reparte los hogares por las seis
   * en lugar de amontonarlos en la primera, que es justamente la que el
   * `alcance` de estas pruebas mira.
   */
  const parejas: string[] = [];
  const esConyuge = new Set<string>();

  const filasDeMatrimonio = Array.from({ length: MATRIMONIOS }, (_, k) => {
    const a = 12 * k + (k % DIOCESIS);
    const b = a + DIOCESIS;
    esConyuge.add(misioneros[a]!);
    esConyuge.add(misioneros[b]!);
    return {
      misioneroAId: misioneros[a]!,
      misioneroBId: misioneros[b]!,
      estado: "activo" as const,
      createdById: actor.id,
      // Uno de cada diez hogares terminó. Sus dos cónyuges vuelven a la pata de
      // individuos sin que nada los mueva, que es lo que el `not exists` del
      // roster hace por sí solo, y el índice parcial tiene algo que excluir.
      bajaAt: k % 10 === 0 ? new Date() : null,
    };
  });

  const insertadas = await db
    .insert(matrimonio)
    .values(filasDeMatrimonio)
    .returning({ id: matrimonio.id });
  parejas.push(...insertadas.map((f) => f.id));

  // Quien está en un Matrimonio activo nunca tiene una imagen a nombre propio
  // (ADR 0010), así que los Tenedores individuales son los que quedan afuera.
  const individuales = misioneros.filter((id) => !esConyuge.has(id));

  for (let desde = 0; desde < PEREGRINAS; desde += LOTE) {
    await db.insert(peregrina).values(
      Array.from({ length: LOTE }, (_, j) => {
        const i = desde + j;
        // Dos de cada tres están en manos de alguien, y una de cada cinco de
        // ésas está en las de un hogar: el puntero polimórfico tiene que tener
        // filas de los dos lados o las lecturas cruzadas se miden con la pata de
        // Matrimonios vacía, que es el falso verde que ADR 0010 describe.
        const enManos = i % 3 !== 0;
        const deUnHogar = enManos && i % 15 === 1;
        return {
          codigo: `VOL ${MODALIDADES[i % 5]} ${String(i).padStart(5, "0")}`,
          codigoNum: i,
          tipo: i % 7 === 0 ? ("auxiliar" as const) : ("peregrina" as const),
          estado: ESTADOS[i % 5]!,
          modalidad: MODALIDADES[i % 5]!,
          diocesisLocalidadId: diocesis[i % DIOCESIS]!,
          misioneroActualId:
            enManos && !deUnHogar
              ? individuales[i % individuales.length]!
              : null,
          matrimonioActualId: deUnHogar ? parejas[i % parejas.length]! : null,
          // Una de cada veinte está dada de baja, que es lo que los índices
          // parciales dejan afuera.
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
  // `asignacion_un_solo_tenedor` exige exactamente uno de los dos punteros, así
  // que las dos columnas se escriben como un `case` sobre la misma condición y
  // no como dos expresiones independientes que podrían coincidir.
  await db.execute(sql`
    insert into asignacion (id, peregrina_id, misionero_id, matrimonio_id, abierta_at, cerrada_at, registrada_por_id)
    select gen_random_uuid()::text,
           p.id,
           case when p.matrimonio_actual_id is null
                then coalesce(p.misionero_actual_id, m.id) end,
           p.matrimonio_actual_id,
           now() - make_interval(days => 900 + (p.codigo_num % 100) + (v * 200)),
           now() - make_interval(days => 800 + (p.codigo_num % 100) + (v * 200)),
           ${actor.id}
      from peregrina p
      cross join generate_series(0, 1) as v
      join misionero m on m.id = (select id from misionero limit 1)
  `);

  await db.execute(sql`
    insert into asignacion (id, peregrina_id, misionero_id, matrimonio_id, abierta_at, registrada_por_id)
    select gen_random_uuid()::text,
           p.id,
           p.misionero_actual_id,
           p.matrimonio_actual_id,
           now() - make_interval(days => (p.codigo_num % 500)),
           ${actor.id}
      from peregrina p
     where p.misionero_actual_id is not null
        or p.matrimonio_actual_id is not null
  `);

  // Sin estadísticas el planner adivina, y un plan basado en una adivinanza no
  // dice nada sobre producción.
  await db.execute(sql`analyze peregrina`);
  await db.execute(sql`analyze misionero`);
  await db.execute(sql`analyze matrimonio`);
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
    // La cifra de Tenedores es una `union all` desde el Matrimonio, y las dos
    // patas entran por el mismo índice de territorio: la de individuos para
    // filtrar, la de parejas a través del cónyuge A, que es de donde una pareja
    // saca su Diócesis por no tener columna propia.
    expect.soft(personas).toContain("misionero_diocesis_localidad_idx");
    // Y el `not exists (matrimonio activo)` de la pata individual entra por los
    // dos índices que `matrimonio` trae, uno por cónyuge. Están nombrados acá
    // porque ésa es la regla del ADR 0007: un índice existe porque el planner lo
    // elige, y éstos son los dos que lo hacen.
    expect.soft(personas).toContain("matrimonio_misionero_a_idx");
    expect.soft(personas).toContain("matrimonio_misionero_b_idx");
    // `matrimonio` sí se recorre entera, y está bien: son trescientas filas
    // contra cuatro mil personas, y un índice sobre una tabla que entra en una
    // página es más lento. Se dice acá para que nadie lo «arregle».
  });

  it("los listados ordenados tampoco recorren la tabla", async () => {
    const disponibles = await explicar(() =>
      PeregrinaRepository.findDisponibles(alcance)
    );

    // El listado colapsado es lo que `/misionero` carga, y lo carga **paginado**
    // (`listPagina`, ADR 0008). Se mide así y no sin paginar porque la lectura
    // ahora son tres consultas y las dos últimas dependen de cuántas filas trajo
    // la primera: pedir la Diócesis entera mide una pantalla que no existe.
    const gente = await planes(() =>
      MisioneroRepository.findFiltrados(
        alcance,
        {},
        {},
        { limit: FILAS_POR_PAGINA, offset: 0 }
      )
    );
    const [union, ...hidrataciones] = gente;

    expect.soft(disponibles).not.toContain("Seq Scan on peregrina");

    // La unión: las dos patas entran por el índice del territorio y **ordenan**,
    // que es el mismo resultado que antes del Matrimonio. Se escribieron dos
    // índices compuestos para que saliera ya ordenado y el planner no eligió
    // ninguno, así que se borraron; la unión no los resucitó — no hay índice que
    // pueda dar el orden de dos tablas a la vez.
    expect.soft(union).toContain("misionero_diocesis_localidad_idx");
    expect.soft(union).toContain("Sort Key: misionero.apellido");
    expect.soft(union).not.toContain("Seq Scan on misionero");

    // La hidratación: veinte claves primarias, y el planner entra por
    // `misionero_pkey`. Esto es lo que la paginación compra y la razón de que se
    // mida paginado — pidiendo la Diócesis entera son quinientos ids, más del
    // diez por ciento de la tabla, y ahí el planner elige recorrerla, que es la
    // decisión correcta y no una regresión. La unión de arriba sigue sin
    // recorrerla en los dos casos, y ésa es la consulta que este archivo cuida.
    for (const plan of hidrataciones) {
      expect.soft(plan).not.toContain("Seq Scan on misionero");
    }
  });

  it("las listas cruzadas no recorren la historia", async () => {
    const estancadas = await explicar(() =>
      AsignacionRepository.findPeregrinasEstancadas(alcance, 180)
    );
    const sinPeregrina = await planes(() =>
      AsignacionRepository.findTenedoresSinPeregrina(alcance)
    );
    const [personasLibres, parejasLibres] = sinPeregrina;

    // `asignacion` es la tabla que crece sin techo: una imagen acumula una fila
    // por cada mano que pasó. Estas preguntas son sobre los períodos abiertos,
    // que son una minoría, y por eso el índice es parcial.
    expect.soft(estancadas).toContain("asignacion_abiertas_por_fecha_idx");
    // La pata de personas de «manos libres» entra por el **mismo** índice, que
    // es lo interesante: al ser parcial sobre `cerrada_at is null`, sirve como
    // conjunto de las filas abiertas y no sólo como orden por fecha. Por eso el
    // índice equivalente por Misionero se escribió y se borró — no agregaba nada.
    expect.soft(personasLibres).toContain("asignacion_abiertas_por_fecha_idx");
    expect.soft(personasLibres).toContain("matrimonio_misionero_a_idx");

    // Y la de parejas **no** entra por ahí: entra por `asignacion_matrimonio_idx`,
    // que es el índice que el Matrimonio trajo. Vale la pena decirlo en voz alta
    // porque es exactamente la forma que se descartó del lado del Misionero — un
    // índice sobre la columna del Tenedor. Del lado del Misionero el planner no
    // lo eligió nunca y se borró; de este lado lo elige, y esta línea es la
    // medición que lo justifica (ADR 0007).
    expect.soft(parejasLibres).toContain("asignacion_matrimonio_idx");

    expect.soft(estancadas).not.toContain("Seq Scan on asignacion");
    for (const plan of sinPeregrina) {
      expect.soft(plan).not.toContain("Seq Scan on asignacion");
    }

    // Lo que **no** se exige, y es un resultado medido y no una omisión: el plan
    // de estancadas recorre `misionero` tres veces —el Tenedor individual y los
    // dos cónyuges— porque los tres joins son `left` desde ADR 0010 y el planner
    // los resuelve con hash sobre la tabla entera. A cuatro mil personas contra
    // mil filas abiertas ésa es su elección, y sigue siéndolo con un índice
    // disponible: `misionero_pkey` existe y no lo usa. No se agrega nada. Si
    // alguna vez deja de servir, la evidencia que lo diga es este plan.
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
 * Corre la consulta del repositorio, captura **todo** el SQL que emitió y
 * devuelve un plan por consulta.
 *
 * El cliente se intercepta en lugar de reescribir la consulta a mano, que es la
 * única manera de que este archivo hable de producción: un `EXPLAIN` sobre SQL
 * copiado prueba que la copia usa el índice.
 *
 * Plural desde el Matrimonio. Una lectura de repositorio dejó de ser una
 * consulta: `findFiltrados` resuelve primero *qué* Tenedores y en qué orden —
 * la unión — y después hidrata esas filas por clave primaria, en dos tablas.
 * Quedarse con la última, que es lo que este ayudante hacía, medía la
 * hidratación y llamaba a eso «el plan del listado».
 */
async function planes(consulta: () => Promise<unknown>): Promise<string[]> {
  const cliente = db.$client as {
    query: (...args: unknown[]) => Promise<unknown>;
  };
  const original = cliente.query.bind(cliente);

  const capturadas: { texto: string; valores: unknown[] }[] = [];

  cliente.query = async (...args: unknown[]) => {
    const primero = args[0];

    // Drizzle pasa `{ text, rowMode }` como primer argumento y los parámetros
    // como segundo, no dentro del objeto. Leerlos de `config.values` deja el
    // array vacío y el `explain` falla con «there is no parameter $1», que es una
    // forma sutil de no medir nada.
    let texto: string | undefined;
    if (typeof primero === "string") texto = primero;
    else if (primero && typeof primero === "object" && "text" in primero) {
      texto = (primero as { text: string }).text;
    }

    let valores: unknown[] = [];
    if (Array.isArray(args[1])) valores = args[1];
    else if (primero && typeof primero === "object" && "values" in primero) {
      valores = (primero as { values?: unknown[] }).values ?? [];
    }

    if (texto) capturadas.push({ texto, valores });

    return original(...args);
  };

  try {
    await consulta();
  } finally {
    cliente.query = original;
  }

  if (!capturadas.length) throw new Error("No se capturó ninguna consulta");

  const explicadas: string[] = [];
  for (const { texto, valores } of capturadas) {
    const plan = (await original(`explain (format text) ${texto}`, valores)) as {
      rows: Record<string, string>[];
    };
    explicadas.push(plan.rows.map((fila) => Object.values(fila)[0]).join("\n"));
  }
  return explicadas;
}

/**
 * Las consultas de una lectura, como un solo texto.
 *
 * Para las lecturas que siguen siendo una sola consulta, que son casi todas.
 * Una lectura que emite varias se afirma con `planes`, consulta por consulta,
 * porque «el listado no recorre la tabla» y «la hidratación de veinte ids no
 * recorre la tabla» son dos afirmaciones y una sola las confundiría.
 */
async function explicar(consulta: () => Promise<unknown>): Promise<string> {
  return (await planes(consulta)).join("\n\n");
}
