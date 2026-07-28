import { sql } from "drizzle-orm";
import { db } from "@/db";
import { asegurarActorDeSistema } from "@/lib/authorization/actor-de-sistema";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import type { CurrentUser } from "@/modules/user/user.types";
import type { Modalidad } from "@/modules/peregrina/peregrina.schema";

/**
 * Datos de prueba, para poder mirar las pantallas.
 *
 * Nada de esto es real y nada de esto toca lo real. Todo cuelga de una Provincia
 * inventada — «Prueba», abreviatura `TST` — con tres Diócesis en tres Regiones
 * distintas, así que:
 *
 *  - Los Códigos que se generan son `TST JOV 0001` y compañía. Las secuencias de
 *    las 24 Provincias verdaderas no se mueven, y eso es lo importante: un
 *    número de Código se consume para siempre — `nextCodigoNum` cuenta también
 *    las bajas, a propósito, porque un Código va escrito en una imagen física y
 *    reutilizar un número acabaría en dos estatuas con el mismo. Sembrar sobre
 *    Santa Fe habría dejado a la primera imagen real de Rosario empezando en
 *    0004.
 *  - Se borra entero con `pnpm db:seed:prueba:borrar`.
 *
 * Va por los **servicios** y no por inserts a mano. Es más lento y es el punto:
 * los Códigos los compone `PeregrinaService`, las Asignaciones respetan la
 * invariante de un período abierto por Peregrina, y las tenencias quedan
 * derivadas en la misma transacción que las abre. Datos sembrados por fuera de
 * las reglas mienten sobre las pantallas que se querían mirar.
 *
 * Corre como `ACTOR_DE_SISTEMA` (ADR 0001), que es lo que hace visible que un
 * seed es trabajo genuinamente sin alcance territorial.
 *
 *   pnpm db:seed:prueba          # sembrar
 *   pnpm db:seed:prueba:borrar   # borrar todo lo sembrado
 */

const PROVINCIA = { nombre: "Prueba", abreviatura: "TST" } as const;

const DIOCESIS = [
  { nombre: "Prueba Centro", region: "CENTRO" },
  { nombre: "Prueba Norte", region: "NOA" },
  { nombre: "Prueba Sur", region: "R. PAT" },
] as const;

/** Nueve personas, repartidas desigualmente: un territorio grande y dos chicos. */
const MISIONEROS = [
  { nombre: "Ana", apellido: "Álvarez", diocesis: 0, telefono: "351 555 0001" },
  { nombre: "Beatriz", apellido: "Benítez", diocesis: 0, telefono: "351 555 0002" },
  { nombre: "Carlos", apellido: "Cabrera", diocesis: 0, telefono: null },
  { nombre: "Dora", apellido: "Díaz", diocesis: 0, telefono: "351 555 0004" },
  { nombre: "Elena", apellido: "Espinosa", diocesis: 1, telefono: "387 555 0005" },
  { nombre: "Fabián", apellido: "Fernández", diocesis: 1, telefono: null },
  { nombre: "Gloria", apellido: "Gómez", diocesis: 1, telefono: "387 555 0007" },
  { nombre: "Hugo", apellido: "Herrera", diocesis: 2, telefono: "299 555 0008" },
  { nombre: "Irma", apellido: "Ibarra", diocesis: 2, telefono: null },
] as const;

/**
 * Dieciocho imágenes, deliberadamente desparejas por Modalidad y por Diócesis:
 * un tablero donde todas las barras miden lo mismo no muestra si el desglose
 * funciona.
 */
const PEREGRINAS: {
  modalidad: Modalidad;
  tipo: "peregrina" | "auxiliar";
  diocesis: number;
}[] = [
  { modalidad: "JOV", tipo: "peregrina", diocesis: 0 },
  { modalidad: "JOV", tipo: "peregrina", diocesis: 0 },
  { modalidad: "JOV", tipo: "peregrina", diocesis: 0 },
  { modalidad: "JOV", tipo: "auxiliar", diocesis: 0 },
  { modalidad: "FAM", tipo: "peregrina", diocesis: 0 },
  { modalidad: "FAM", tipo: "peregrina", diocesis: 0 },
  { modalidad: "MAT", tipo: "peregrina", diocesis: 0 },
  { modalidad: "MIS", tipo: "peregrina", diocesis: 0 },
  { modalidad: "JOV", tipo: "peregrina", diocesis: 1 },
  { modalidad: "JOV", tipo: "peregrina", diocesis: 1 },
  { modalidad: "FAM", tipo: "peregrina", diocesis: 1 },
  { modalidad: "FAM", tipo: "auxiliar", diocesis: 1 },
  { modalidad: "SAL", tipo: "peregrina", diocesis: 1 },
  { modalidad: "DUL", tipo: "peregrina", diocesis: 1 },
  { modalidad: "JOV", tipo: "peregrina", diocesis: 2 },
  { modalidad: "MAT", tipo: "peregrina", diocesis: 2 },
  { modalidad: "TAX", tipo: "peregrina", diocesis: 2 },
  { modalidad: "CEN", tipo: "auxiliar", diocesis: 2 },
];

const DIA = 24 * 60 * 60 * 1000;

export async function seedPrueba(actor: CurrentUser): Promise<void> {
  const existente = (
    await TerritorioService.listarProvincias(actor)
  ).find((p) => p.abreviatura === PROVINCIA.abreviatura);

  if (existente) {
    throw new Error(
      "La Provincia «Prueba» ya existe. Borrá lo sembrado antes de volver a " +
        "sembrar: pnpm db:seed:prueba:borrar"
    );
  }

  const provincia = await TerritorioService.crearProvincia(actor, PROVINCIA);
  console.log(`Provincia ${provincia.nombre} (${provincia.abreviatura})`);

  const diocesis = [];
  for (const d of DIOCESIS) {
    diocesis.push(
      await TerritorioService.crearDiocesisLocalidad(actor, {
        nombre: d.nombre,
        provinciaId: provincia.id,
        region: d.region,
      })
    );
  }
  console.log(`${diocesis.length} Diócesis/Localidades`);

  const misioneros = [];
  for (const m of MISIONEROS) {
    misioneros.push(
      await MisioneroService.create(actor, {
        nombre: m.nombre,
        apellido: m.apellido,
        telefono: m.telefono,
        diocesisLocalidadId: diocesis[m.diocesis]!.id,
        centroTipo: null,
        centroNombre: null,
        anioConsagracion: null,
      })
    );
  }
  console.log(`${misioneros.length} Misioneros`);

  const peregrinas = [];
  for (const p of PEREGRINAS) {
    peregrinas.push(
      await PeregrinaService.create(actor, {
        tipo: p.tipo,
        modalidad: p.modalidad,
        diocesisLocalidadId: diocesis[p.diocesis]!.id,
      })
    );
  }
  console.log(`${peregrinas.length} Peregrinas, de ${peregrinas[0]!.codigo} en adelante`);

  // ── Tenencias ───────────────────────────────────────────────────────────────
  //
  // Las cuatro situaciones que el tablero distingue, y que son fáciles de
  // confundir en una sola: en manos de alguien, devuelta (libre pero usada),
  // nunca entregada, y extraviada — que conserva su Asignación abierta a
  // propósito, porque es lo que guarda el nombre del último Misionero.
  const enManos: [number, number][] = [
    [0, 0],
    [1, 1],
    [2, 1],
    [4, 3],
    [6, 0],
    [8, 4],
    [9, 5],
    [10, 6],
    [14, 7],
    [15, 8],
  ];

  for (const [imagen, persona] of enManos) {
    await AsignacionService.asignar(actor, {
      peregrinaId: peregrinas[imagen]!.id,
      misioneroId: misioneros[persona]!.id,
      nota: null,
    });
  }

  // Dos que fueron y volvieron: libres ahora, pero no «nunca entregadas».
  for (const imagen of [5, 11]) {
    await AsignacionService.asignar(actor, {
      peregrinaId: peregrinas[imagen]!.id,
      misioneroId: misioneros[2]!.id,
      nota: null,
    });
    await AsignacionService.devolver(actor, {
      peregrinaId: peregrinas[imagen]!.id,
      notaCierre: "Devuelta al centro.",
    });
  }

  // Una que pasó de mano en mano, para que el historial tenga tres eslabones.
  await AsignacionService.entregar(actor, {
    peregrinaId: peregrinas[0]!.id,
    misioneroId: misioneros[1]!.id,
    notaCierre: "Pasa a la próxima familia.",
    nota: null,
  });

  // ── Estados ─────────────────────────────────────────────────────────────────
  for (const imagen of [3, 12]) {
    await PeregrinaService.update(actor, peregrinas[imagen]!.id, {
      estado: "en_reparacion",
    });
  }

  // Las extraviadas están *en manos de alguien* en el registro, y así queda: el
  // período sigue abierto y por eso la tarjeta puede decir quién la tenía.
  for (const imagen of [8, 15]) {
    await PeregrinaService.update(actor, peregrinas[imagen]!.id, {
      estado: "extraviada",
    });
  }

  // ── Antigüedad ──────────────────────────────────────────────────────────────
  //
  // Tres imágenes que llevan más de medio año en las mismas manos, para que la
  // tarjeta «Sin cambiar de manos» tenga algo que mostrar. Se corrige la fecha
  // de apertura con `corregir`, que es la única manera de fabricar antigüedad
  // sin escribir la tabla por fuera del servicio — y deja su marca de corrección,
  // que es exactamente lo que haría un Referente arreglando una fecha mal puesta.
  const antiguedades: [number, number][] = [
    [6, 420],
    [9, 260],
    [14, 190],
  ];

  for (const [imagen, dias] of antiguedades) {
    const historial = await AsignacionService.historialDePeregrina(
      actor,
      peregrinas[imagen]!.id
    );
    const abierta = historial.find((a) => a.abierta);
    if (!abierta) continue;

    await AsignacionService.corregir(actor, {
      asignacionId: abierta.id,
      abiertaAt: new Date(Date.now() - dias * DIA),
    });
  }

  /*
   * Y las altas repartidas en seis meses, para que «Altas por mes» sea una serie
   * y no una sola barra.
   *
   * Esto sí es SQL directo, y es la única cosa acá que no pasa por un servicio:
   * `created_at` es un campo de auditoría y no hay — ni debería haber — una
   * manera de moverlo desde la aplicación. Es aceptable en un seed de prueba
   * porque la alternativa es una serie de un mes que no muestra nada, y no es
   * aceptable en ningún otro lugar.
   */
  await db.execute(sql`
    update peregrina
       set created_at = now() - make_interval(days => (codigo_num % 6) * 31)
     where diocesis_localidad_id in (
       select id from diocesis_localidad where provincia_id = ${provincia.id}
     )
  `);

  console.log("\nListo. Entrá a /tablero.");
  console.log("Para borrar todo esto: pnpm db:seed:prueba:borrar");
}

/**
 * Borra lo sembrado, y sólo lo sembrado.
 *
 * El único borrado físico del repositorio, y merece la excepción por lo que
 * *no* es: no hay historia que preservar acá, porque nada de esto pasó. La
 * regla de baja lógica existe para que una Asignación siga resolviendo a un
 * Código y a un nombre reales — y estos no lo son.
 *
 * Va por Provincia, así que no puede alcanzar un registro verdadero ni por
 * error: si la Provincia «Prueba» no está, no borra nada.
 */
export async function borrarPrueba(): Promise<void> {
  const [prov] = (
    await db.execute(sql`
      select id from provincia where abreviatura = ${PROVINCIA.abreviatura}
    `)
  ).rows as { id: string }[];

  if (!prov) {
    console.log("No hay nada sembrado: la Provincia «Prueba» no existe.");
    return;
  }

  const enPrueba = sql`
    select id from diocesis_localidad where provincia_id = ${prov.id}
  `;

  // En orden de dependencia: las Asignaciones apuntan a las Peregrinas, y las
  // Peregrinas apuntan a los Misioneros por el puntero denormalizado.
  await db.execute(sql`
    delete from asignacion
     where peregrina_id in (
       select id from peregrina where diocesis_localidad_id in (${enPrueba})
     )
  `);
  await db.execute(
    sql`delete from peregrina where diocesis_localidad_id in (${enPrueba})`
  );
  await db.execute(
    sql`delete from misionero where diocesis_localidad_id in (${enPrueba})`
  );
  await db.execute(sql`delete from diocesis_localidad where provincia_id = ${prov.id}`);
  await db.execute(sql`delete from provincia where id = ${prov.id}`);

  console.log("Borrado: Provincia «Prueba» y todo lo que colgaba de ella.");
}

async function main() {
  const borrar = process.argv.includes("--borrar");

  if (borrar) {
    await borrarPrueba();
  } else {
    const actor = await asegurarActorDeSistema();
    await seedPrueba(actor);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
