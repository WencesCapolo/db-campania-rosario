import { beforeEach, describe, expect, it, vi } from "vitest";
import { TableroService } from "./tablero.service";
import { umbralDeDiasEstancada } from "./tablero.types";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
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
let misioneros: { m1: string; m2: string; libre: string };
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
  });
  const m2 = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    apellido: "Benítez",
  });
  const libre = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    apellido: "Cabrera",
  });
  misioneros = { m1: m1.id, m2: m2.id, libre: libre.id };

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
    misioneroId: m1.id,
    nota: null,
  });
  await AsignacionService.corregir(referente, {
    asignacionId: vieja.id,
    abiertaAt: haceDias(400),
  });

  await AsignacionService.asignar(referente, {
    peregrinaId: auxiliarReciente.id,
    misioneroId: m2.id,
    nota: null,
  });

  // Extraviada *con* su Asignación abierta: marcarla extraviada no cierra el
  // período, y eso es lo que conserva el nombre del último Misionero.
  await AsignacionService.asignar(referente, {
    peregrinaId: extraviada.id,
    misioneroId: m1.id,
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
    expect(tablero.totalMisioneros).toBe(3);
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

  it("desglosa por Tipo — historia 16", async () => {
    const { porTipo } = await TableroService.resumen(referente);

    expect(ordenar(porTipo, "tipo")).toEqual([
      { tipo: "auxiliar", total: 1 },
      { tipo: "peregrina", total: 3 },
    ]);
  });

  it("no recibe el desglose nacional: sería una fila con su propio nombre", async () => {
    const tablero = await TableroService.resumen(referente);

    expect(tablero.porRegion).toBeNull();
    expect(tablero.porDiocesis).toBeNull();
    expect(tablero.crecimiento).toBeNull();
  });
});

describe("las cifras de un Asesor Nacional", () => {
  it("cuenta el país entero", async () => {
    const tablero = await TableroService.resumen(asesor);

    expect(tablero.vista).toBe("nacional");
    expect(tablero.totalPeregrinas).toBe(6);
  });

  it("desglosa por Región recorriendo el territorio — historias 10 y 11", async () => {
    const { porRegion } = await TableroService.resumen(asesor);

    expect(ordenar(porRegion ?? [], "region")).toEqual([
      // Villa María es CENTRO y Río Cuarto es CUYO, y las dos son Córdoba.
      { region: "CENTRO", total: 4 },
      { region: "CUYO", total: 1 },
      { region: "R. PAT", total: 1 },
    ]);
  });

  it("compara Diócesis, la más grande primero", async () => {
    const { porDiocesis } = await TableroService.resumen(asesor);

    expect(porDiocesis?.[0]).toEqual({
      diocesisLocalidadId: territorio.villaMaria.id,
      nombre: "Villa María",
      total: 4,
    });
    expect(porDiocesis).toHaveLength(3);
  });

  it("muestra el crecimiento por mes de alta — historia 12", async () => {
    const { crecimiento } = await TableroService.resumen(asesor);
    const mesActual = new Date().toISOString().slice(0, 7);

    expect(crecimiento).toEqual([{ mes: mesActual, total: 6 }]);
  });
});

describe("las cifras derivadas", () => {
  it("cuenta las que no tiene nadie ahora — historia 4", async () => {
    const tablero = await TableroService.resumen(referente);

    // Sólo la que está en reparación: las otras tres están en manos de alguien,
    // incluida la extraviada, cuyo período sigue abierto a propósito.
    expect(tablero.sinTenencia).toBe(1);
  });

  it("«nunca asignada» no es lo mismo que «libre ahora»", async () => {
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrinas.auxiliarReciente,
      notaCierre: null,
    });

    const tablero = await TableroService.resumen(referente);

    // Dos libres, pero una de ellas ya estuvo en manos de alguien.
    expect(tablero.sinTenencia).toBe(2);
    expect(tablero.nuncaAsignadas?.total).toBe(1);
    expect(tablero.nuncaAsignadas?.filas.map((f) => f.id)).toEqual([
      peregrinas.libreNunca,
    ]);
  });

  it("lista las Extraviadas con su último Misionero — historia 9", async () => {
    const { extraviadas } = await TableroService.resumen(referente);

    expect(extraviadas?.total).toBe(1);
    expect(extraviadas?.filas[0]?.id).toBe(peregrinas.extraviada);
    expect(extraviadas?.filas[0]?.ultimoMisionero).toMatchObject({
      id: misioneros.m1,
      apellido: "Álvarez",
    });
  });

  it("lista los Misioneros sin ninguna imagen — historia 5", async () => {
    const { misionerosSinPeregrina } = await TableroService.resumen(referente);

    expect(misionerosSinPeregrina.total).toBe(1);
    expect(misionerosSinPeregrina.filas[0]?.id).toBe(misioneros.libre);
  });

  it("un Misionero con dos imágenes no aparece como libre", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrinas.libreNunca,
      misioneroId: misioneros.libre,
      nota: null,
    });

    const { misionerosSinPeregrina } = await TableroService.resumen(referente);

    expect(misionerosSinPeregrina.total).toBe(0);
  });

  it("lista las que no cambiaron de manos hace mucho — historia 8", async () => {
    const { estancadas, umbralDeDiasEstancada: umbral } =
      await TableroService.resumen(referente);

    expect(umbral).toBe(180);
    expect(estancadas.total).toBe(1);
    expect(estancadas.filas[0]).toMatchObject({
      peregrinaId: peregrinas.asignadaVieja,
      misioneroApellido: "Álvarez",
    });
    expect(estancadas.filas[0]?.dias).toBeGreaterThanOrEqual(399);
  });
});

describe("el umbral de «estancada», en sus bordes", () => {
  it("incluye lo que lo alcanza y excluye lo que no", async () => {
    const dentro = await AsignacionService.listarEstancadas(referente, 400);
    const justoAfuera = await AsignacionService.listarEstancadas(
      referente,
      401,
    );

    expect(dentro.map((f) => f.peregrinaId)).toEqual([
      peregrinas.asignadaVieja,
    ]);
    expect(justoAfuera).toEqual([]);
  });

  it("con un umbral bajo aparece también la recién asignada", async () => {
    const todas = await AsignacionService.listarEstancadas(referente, 0);

    expect(todas).toHaveLength(3);
  });

  it("es configurable, porque la Campaña todavía no eligió el número", async () => {
    vi.stubEnv("TABLERO_DIAS_ESTANCADA", "30");
    expect(umbralDeDiasEstancada()).toBe(30);

    // Un valor sin sentido no apaga la tarjeta: vuelve al de siempre.
    vi.stubEnv("TABLERO_DIAS_ESTANCADA", "seis meses");
    expect(umbralDeDiasEstancada()).toBe(180);

    vi.unstubAllEnvs();
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
    // Y el resto del tablero sigue siendo un tablero: las cifras que no dependen
    // de imágenes no se van a cero porque el filtro no dejó ninguna.
    expect(tablero.totalMisioneros).toBe(3);
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

  it("filtra por Código, sin distinguir mayúsculas", async () => {
    const dto = await PeregrinaService.getById(
      referente,
      peregrinas.asignadaVieja,
    );
    const tablero = await TableroService.resumen(referente, {
      codigo: dto.codigo.toLowerCase(),
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

  it("las tarjetas que contradirían el filtro se apagan en lugar de ignorarlo", async () => {
    const tablero = await TableroService.resumen(referente, {
      estado: "activa",
    });

    // Pedir «activas» y ver una tarjeta de Extraviadas al lado es la confusión
    // que la historia 18 existe para evitar.
    expect(tablero.extraviadas).toBeNull();

    const conExtraviadas = await TableroService.resumen(referente, {
      estado: "extraviada",
    });
    expect(conExtraviadas.extraviadas?.total).toBe(1);
  });

  it("los filtros de imagen no se aplican a las personas", async () => {
    const tablero = await TableroService.resumen(referente, {
      modalidad: "FAM",
    });

    // Un Misionero no tiene Modalidad. Contar 1 acá sería inventar una relación
    // que la Campaña no registra.
    expect(tablero.totalMisioneros).toBe(3);
  });
});

/** Ordena por una clave para que la expectativa no dependa del plan de la query. */
function ordenar<T extends Record<K, string>, K extends string>(
  filas: T[],
  clave: K,
): T[] {
  return [...filas].sort((a, b) => a[clave].localeCompare(b[clave]));
}
