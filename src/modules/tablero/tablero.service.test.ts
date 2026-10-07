import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "./tablero.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { MatrimonioService } from "@/modules/misionero/matrimonio.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * Las cifras del tablero, contra una composición conocida.
 *
 * Lo que se prueba acá es la agregación y nada más. Un test sobre el marcado de
 * un gráfico pasaría con las cifras equivocadas, que es precisamente el único
 * error que este PRD no puede permitirse: es el entregable más visible para
 * quienes autorizaron el proyecto y el menos valioso si los números están mal.
 *
 * La composición está escrita una vez, abajo, y cada expectativa se lee contra
 * ella. Nada se calcula dos veces — un test que derive el número esperado de la
 * misma fuente que el código bajo prueba no prueba nada.
 */

let territorio: TerritorioDePrueba;
let referente: CurrentUser;
let asesor: CurrentUser;
let peregrinas: {
  asignadaVieja: string;
  libreNunca: string;
  auxiliarReciente: string;
  extraviada: string;
  otraDiocesis: string;
  otraProvincia: string;
};

/**
 * Cuatro imágenes en Villa María, una en Río Cuarto (misma Provincia, otra
 * Región) y una en Zapala (otra Provincia). Dos Misioneros con imagen y uno sin
 * ninguna.
 *
 * Deliberadamente asimétrico: Villa María es CENTRO y Río Cuarto es CUYO aunque
 * las dos son Córdoba, así que un desglose que agrupara recorriendo la Provincia
 * las colapsaría en una fila y este fixture lo delata.
 */
beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();

  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  asesor = await crearActor({ rol: "asesor_nacional" });

  const m1 = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    apellido: "Álvarez",
    anioConsagracion: 2012,
  });
  const m2 = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    apellido: "Benítez",
  });
  // Cabrera no tiene ninguna imagen: el filtro por quién la tiene da cero.
  await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    apellido: "Cabrera",
  });

  const asignadaVieja = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    modalidad: "JOV",
  });
  const libreNunca = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    modalidad: "JOV",
  });
  const auxiliarReciente = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    modalidad: "FAM",
    tipo: "auxiliar",
  });
  const extraviada = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    modalidad: "JOV",
  });
  const otraDiocesis = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.rioCuarto.id,
    createdById: asesor.id,
    modalidad: "JOV",
  });
  const otraProvincia = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.zapala.id,
    createdById: asesor.id,
    modalidad: "MAT",
  });

  peregrinas = {
    asignadaVieja: asignadaVieja.id,
    libreNunca: libreNunca.id,
    auxiliarReciente: auxiliarReciente.id,
    extraviada: extraviada.id,
    otraDiocesis: otraDiocesis.id,
    otraProvincia: otraProvincia.id,
  };

  await PeregrinaService.update(referente, libreNunca.id, {
    estado: "en_reparacion",
  });

  // La imagen que lleva 400 días en las mismas manos: se asigna y se corrige la
  // fecha de apertura, que es la única manera de fabricar antigüedad sin tocar
  // la base por fuera del servicio.
  const vieja = await AsignacionService.asignar(referente, {
    peregrinaId: asignadaVieja.id,
    tenedor: { tipo: "persona", id: m1.id },
    nota: null,
  });
  await AsignacionService.corregir(referente, {
    asignacionId: vieja.id,
    abiertaAt: haceDias(400),
  });

  await AsignacionService.asignar(referente, {
    peregrinaId: auxiliarReciente.id,
    tenedor: { tipo: "persona", id: m2.id },
    nota: null,
  });

  // Extraviada *con* su Asignación abierta: marcarla extraviada no cierra el
  // período, y eso es lo que conserva el nombre del último Misionero.
  await AsignacionService.asignar(referente, {
    peregrinaId: extraviada.id,
    tenedor: { tipo: "persona", id: m1.id },
    nota: null,
  });
  await PeregrinaService.update(referente, extraviada.id, {
    estado: "extraviada",
  });
});

function haceDias(dias: number): Date {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

describe("las cifras de un rol territorial", () => {
  it("cuenta su Diócesis y nada más — historias 1 y 6", async () => {
    const tablero = await TableroService.resumen(referente);

    expect(tablero.vista).toBe("diocesana");
    expect(tablero.totalPeregrinas).toBe(4);
  });

  it("desglosa por Estado — historia 2", async () => {
    const { porEstado } = await TableroService.resumen(referente);

    expect(ordenar(porEstado, "estado")).toEqual([
      { estado: "activa", total: 2 },
      { estado: "en_reparacion", total: 1 },
      { estado: "extraviada", total: 1 },
    ]);
  });

  it("desglosa por Modalidad — historia 7", async () => {
    const { porModalidad } = await TableroService.resumen(referente);

    expect(ordenar(porModalidad, "modalidad")).toEqual([
      { modalidad: "FAM", total: 1 },
      { modalidad: "JOV", total: 3 },
    ]);
  });

  it("desglosa las imágenes que alguien tiene por año de consagración", async () => {
    const { porConsagracion } = await TableroService.resumen(referente);

    // Álvarez se consagró en 2012 y tiene dos; Benítez no tiene año cargado y
    // tiene una. La libre y la que está en reparación sin nadie no cuentan.
    expect(porConsagracion).toEqual([
      { desde: 2010, total: 2 },
      { desde: null, total: 1 },
    ]);
  });

  it("no recibe el desglose nacional: sería una fila con su propio nombre", async () => {
    const tablero = await TableroService.resumen(referente);

    expect(tablero.porProvincia).toBeNull();
    expect(tablero.porDiocesis).toBeNull();
  });
});

describe("las cifras de un Asesor Nacional", () => {
  it("cuenta el país entero", async () => {
    const tablero = await TableroService.resumen(asesor);

    expect(tablero.vista).toBe("nacional");
    expect(tablero.totalPeregrinas).toBe(6);
  });

  it("compara Diócesis, la más grande primero", async () => {
    const { porDiocesis } = await TableroService.resumen(asesor);

    expect(porDiocesis?.[0]).toEqual({
      diocesisLocalidadId: territorio.villaMaria.id,
      nombre: "Villa María",
      provincia: "Córdoba",
      total: 4,
    });
    expect(porDiocesis).toHaveLength(3);
  });

  it("desglosa por Provincia, la más grande primero", async () => {
    const { porProvincia } = await TableroService.resumen(asesor);

    expect(porProvincia).toEqual([
      { provinciaId: territorio.cordoba.id, nombre: "Córdoba", total: 5 },
      { provinciaId: territorio.neuquen.id, nombre: "Neuquén", total: 1 },
    ]);
  });
});

describe("las cifras derivadas", () => {
  it("cuenta las que no tiene nadie ahora — historia 4", async () => {
    const tablero = await TableroService.resumen(referente);

    // Sólo la que está en reparación: las otras tres están en manos de alguien,
    // incluida la extraviada, cuyo período sigue abierto a propósito.
    expect(tablero.sinTenencia).toBe(1);
  });

});

describe("un Matrimonio es un Tenedor y no dos personas — ADR 0010", () => {
  /*
   * La mitad silenciosa de la lectura polimórfica: una cifra que sólo mira
   * `misionero_id` no falla, cuenta menos. La casa desaparece de la cifra que
   * existe para contarla.
   */
  beforeEach(async () => {
    const pareja = await MatrimonioService.create(referente, {
      nombreA: "Rosa",
      apellidoA: "Benegas",
      nombreB: "Luis",
      apellidoB: "Cardozo",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const delMatrimonio = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
      modalidad: "MAT",
    });

    await AsignacionService.asignar(referente, {
      peregrinaId: delMatrimonio.id,
      tenedor: { tipo: "matrimonio", id: pareja.id },
      nota: null,
    });
  });

  it("un hogar cuenta una vez por año de consagración, el más antiguo", async () => {
    const consagrados = await MatrimonioService.create(referente, {
      nombreA: "Elena",
      apellidoA: "Duarte",
      anioConsagracionA: 2003,
      nombreB: "Pablo",
      apellidoB: "Duarte",
      anioConsagracionB: 1997,
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const imagen = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
      modalidad: "MAT",
    });
    await AsignacionService.asignar(referente, {
      peregrinaId: imagen.id,
      tenedor: { tipo: "matrimonio", id: consagrados.id },
      nota: null,
    });

    const { porConsagracion } = await TableroService.resumen(referente);

    // La pareja de arriba no tiene años cargados y suma a la fila sin año.
    expect(porConsagracion).toEqual([
      { desde: 1995, total: 1 },
      { desde: 2010, total: 2 },
      { desde: null, total: 2 },
    ]);
  });

});

describe("los filtros", () => {
  it("se combinan — historia 17", async () => {
    const tablero = await TableroService.resumen(referente, {
      modalidad: "JOV",
      estado: "activa",
    });

    expect(tablero.totalPeregrinas).toBe(1);
    expect(tablero.porEstado).toEqual([{ estado: "activa", total: 1 }]);
  });

  it("un cero legítimo es un cero, no una falla", async () => {
    const tablero = await TableroService.resumen(referente, {
      modalidad: "FAM",
      estado: "extraviada",
    });

    expect(tablero.totalPeregrinas).toBe(0);
    expect(tablero.porEstado).toEqual([]);
    expect(tablero.porModalidad).toEqual([]);
  });

  it("filtra por tenencia", async () => {
    const libres = await TableroService.resumen(referente, {
      tenencia: "libre",
    });
    const asignadas = await TableroService.resumen(referente, {
      tenencia: "asignada",
    });

    expect(libres.totalPeregrinas).toBe(1);
    expect(asignadas.totalPeregrinas).toBe(3);
  });

  it("filtra por Identificación, sin distinguir mayúsculas", async () => {
    const dto = await PeregrinaService.getById(
      referente,
      peregrinas.asignadaVieja,
    );
    const tablero = await TableroService.resumen(referente, {
      identificacion: dto.identificacion.toLowerCase(),
    });

    expect(tablero.totalPeregrinas).toBe(1);
  });

  it("filtra por quién la tiene, por apellido y sin distinguir mayúsculas", async () => {
    // Álvarez tiene dos: la vieja y la extraviada. Benítez tiene la auxiliar.
    const alvarez = await TableroService.resumen(referente, {
      misionero: "álVAREZ",
    });
    const benitez = await TableroService.resumen(referente, {
      misionero: "Benítez",
    });

    expect(alvarez.totalPeregrinas).toBe(2);
    expect(benitez.totalPeregrinas).toBe(1);
  });

  it("toma el nombre completo, en cualquiera de los dos órdenes", async () => {
    const nombreApellido = await TableroService.resumen(referente, {
      misionero: "María Álvarez",
    });
    const apellidoNombre = await TableroService.resumen(referente, {
      misionero: "Álvarez María",
    });

    expect(nombreApellido.totalPeregrinas).toBe(2);
    expect(apellidoNombre.totalPeregrinas).toBe(2);
  });

  it("un Misionero sin ninguna imagen da cero, no todas", async () => {
    // Cabrera existe y no tiene nada. El error que esto vigila es un `or` mal
    // armado o una condición que se cae del `where`: cualquiera de los dos
    // devolvería el territorio entero, que se lee como "las tiene todas".
    const tablero = await TableroService.resumen(referente, {
      misionero: "Cabrera",
    });

    expect(tablero.totalPeregrinas).toBe(0);
  });

  it("un Asesor Nacional filtra por Diócesis y por Región", async () => {
    const porDiocesis = await TableroService.resumen(asesor, {
      diocesisLocalidadId: territorio.rioCuarto.id,
    });
    const porRegion = await TableroService.resumen(asesor, {
      region: "R. PAT",
    });

    expect(porDiocesis.totalPeregrinas).toBe(1);
    expect(porRegion.totalPeregrinas).toBe(1);
  });

});

/** Ordena por una clave para que la expectativa no dependa del plan de la query. */
function ordenar<T extends Record<K, string>, K extends string>(
  filas: T[],
  clave: K,
): T[] {
  return [...filas].sort((a, b) => a[clave].localeCompare(b[clave]));
}
