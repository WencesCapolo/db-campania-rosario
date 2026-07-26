import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import {
  crearActor,
  crearActorDeSistema,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

/**
 * La matriz de alcance para Peregrina — el requisito no negociable del issue #2.
 *
 * Cada rol, contra cada lectura y cada escritura, con las dos mitades: lo propio
 * vuelve y lo ajeno no se ve. **La mitad negativa es la prueba.** Una prueba de
 * que un Responsable Diocesano ve su Diócesis pasa igual si ve las de todos.
 *
 * Hay dos "ajenos" a propósito, y la diferencia importa:
 *
 *  - Río Cuarto está en la **misma Provincia** que Villa María. Es la vecina, y
 *    tiene que ser invisible: los datos se acotan a la Diócesis/Localidad,
 *    aunque las *listas de selección* lleguen hasta la Provincia. Si esta prueba
 *    pasara, el alcance sería provincial y no diocesano.
 *  - Zapala está en otra Provincia y otra Región. Es el caso obvio.
 */

let territorio: TerritorioDePrueba;
let sistema: CurrentUser;

let admin: CurrentUser;
let asesor: CurrentUser;
let diocesano: CurrentUser;
let referente: CurrentUser;

let propia: { id: string };
let vecina: { id: string };
let ajena: { id: string };

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  sistema = await crearActorDeSistema();

  admin = await crearActor({ rol: "admin" });
  asesor = await crearActor({ rol: "asesor_nacional" });
  diocesano = await crearActor({
    rol: "responsable_diocesano",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });

  propia = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: sistema.id,
  });
  vecina = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.rioCuarto.id,
    createdById: sistema.id,
  });
  ajena = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.zapala.id,
    createdById: sistema.id,
  });
});

describe("lecturas de los roles nacionales", () => {
  it("un Asesor Nacional ve el país entero", async () => {
    const lista = await PeregrinaService.listAll(asesor);

    expect(lista.map((p) => p.id).sort()).toEqual(
      [propia.id, vecina.id, ajena.id].sort()
    );
  });

  it("un admin ve el país entero", async () => {
    const lista = await PeregrinaService.listAll(admin);

    expect(lista).toHaveLength(3);
  });

  it("el Actor de sistema no tiene restricción territorial — historia 18", async () => {
    const lista = await PeregrinaService.listAll(sistema);

    expect(lista).toHaveLength(3);
  });

  it("un Asesor Nacional cuenta el país entero en el tablero", async () => {
    const { byRegion } = await PeregrinaService.dashboardStats(asesor);

    expect(
      [...byRegion].sort((a, b) => a.region.localeCompare(b.region))
    ).toEqual([
      { region: "CENTRO", count: 2 },
      { region: "R. PAT", count: 1 },
    ]);
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("lecturas de %s", (_rol, obtenerActor) => {
  it("ve la Peregrina de su Diócesis y NO ve la vecina ni la de otra Región", async () => {
    const lista = await PeregrinaService.listAll(obtenerActor());
    const ids = lista.map((p) => p.id);

    expect(ids).toEqual([propia.id]);
    expect(ids).not.toContain(vecina.id);
    expect(ids).not.toContain(ajena.id);
  });

  it("puede leer la propia por id", async () => {
    const leida = await PeregrinaService.getById(obtenerActor(), propia.id);

    expect(leida.id).toBe(propia.id);
  });

  it("NO puede leer por id la de la Diócesis vecina, aun estando en su Provincia", async () => {
    await expect(
      PeregrinaService.getById(obtenerActor(), vecina.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede leer por id la de otra Región", async () => {
    await expect(
      PeregrinaService.getById(obtenerActor(), ajena.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("filtrar por estado no amplía el alcance", async () => {
    const lista = await PeregrinaService.listByEstado(obtenerActor(), "activa");

    expect(lista.map((p) => p.id)).toEqual([propia.id]);
  });

  it("filtrar por modalidad no amplía el alcance", async () => {
    const lista = await PeregrinaService.listByModalidad(obtenerActor(), "JOV");

    expect(lista.map((p) => p.id)).toEqual([propia.id]);
  });

  it("pedir su propia Región devuelve sólo su Diócesis, no la Región completa", async () => {
    const lista = await PeregrinaService.listByRegion(obtenerActor(), "CENTRO");

    expect(lista.map((p) => p.id)).toEqual([propia.id]);
  });

  it("pedir otra Región devuelve nada, no todo", async () => {
    const lista = await PeregrinaService.listByRegion(obtenerActor(), "R. PAT");

    expect(lista).toEqual([]);
  });

  it("el tablero cuenta sólo su territorio", async () => {
    const { byEstado, byRegion } = await PeregrinaService.dashboardStats(
      obtenerActor()
    );

    expect(byEstado).toEqual([{ estado: "activa", count: 1 }]);
    expect(byRegion).toEqual([{ region: "CENTRO", count: 1 }]);
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("escrituras de %s", (_rol, obtenerActor) => {
  it("puede modificar la de su propia Diócesis", async () => {
    const modificada = await PeregrinaService.update(
      obtenerActor(),
      propia.id,
      { estado: "inactiva" }
    );

    expect(modificada.estado).toBe("inactiva");
  });

  it("NO puede modificar la de la Diócesis vecina, y el registro queda intacto", async () => {
    await expect(
      PeregrinaService.update(obtenerActor(), vecina.id, { estado: "inactiva" })
    ).rejects.toThrow(NoAutorizadoError);

    const sinCambios = await PeregrinaService.getById(asesor, vecina.id);
    expect(sinCambios.estado).toBe("activa");
  });

  it("NO puede modificar la de otra Región", async () => {
    await expect(
      PeregrinaService.update(obtenerActor(), ajena.id, { estado: "inactiva" })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede eliminar una ajena, y el registro sigue existiendo", async () => {
    await expect(
      PeregrinaService.delete(obtenerActor(), ajena.id)
    ).rejects.toThrow(NoAutorizadoError);

    await expect(
      PeregrinaService.getById(asesor, ajena.id)
    ).resolves.toBeTruthy();
  });

  it("puede registrar en su propia Diócesis", async () => {
    const creada = await PeregrinaService.create(obtenerActor(), {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(creada.diocesisLocalidad.nombre).toBe("Villa María");
  });

  it("NO puede registrar en la Diócesis vecina, aunque la vea en el selector", async () => {
    await expect(
      PeregrinaService.create(obtenerActor(), {
        tipo: "peregrina",
        modalidad: "FAM",
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede mover una propia fuera de su territorio", async () => {
    await expect(
      PeregrinaService.update(obtenerActor(), propia.id, {
        diocesisLocalidadId: territorio.zapala.id,
      })
    ).rejects.toThrow(NoAutorizadoError);

    // Ni a medias: sigue donde estaba.
    const sinMover = await PeregrinaService.getById(obtenerActor(), propia.id);
    expect(sinMover.diocesisLocalidad.nombre).toBe("Villa María");
  });
});

describe("escrituras de un Asesor Nacional", () => {
  it("puede modificar cualquier registro del país", async () => {
    const modificada = await PeregrinaService.update(asesor, ajena.id, {
      estado: "inactiva",
    });

    expect(modificada.estado).toBe("inactiva");
  });

  it("puede mover un registro entre Provincias", async () => {
    const movida = await PeregrinaService.update(asesor, propia.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(movida.region).toBe("R. PAT");
  });

  it("puede eliminar cualquier registro del país", async () => {
    await PeregrinaService.delete(asesor, ajena.id);

    expect(await PeregrinaService.listAll(asesor)).toHaveLength(2);
  });
});

describe("un rol territorial sin territorio falla cerrado", () => {
  it("no ve nada en lugar de verlo todo", async () => {
    const sinTerritorio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: null,
    });

    // Lo importante es que no devuelva las tres. Un null que se leyera como
    // "sin restricción" es exactamente la fuga que el issue #2 cierra.
    await expect(PeregrinaService.listAll(sinTerritorio)).rejects.toThrow(
      NoAutorizadoError
    );
    await expect(
      PeregrinaService.getById(sinTerritorio, propia.id)
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      PeregrinaService.create(sinTerritorio, {
        tipo: "peregrina",
        modalidad: "JOV",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("lo dice en castellano y nombra el próximo paso", async () => {
    const sinTerritorio = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: null,
    });

    await expect(PeregrinaService.listAll(sinTerritorio)).rejects.toThrow(
      /no tiene una Diócesis\/Localidad asignada/
    );
  });
});
