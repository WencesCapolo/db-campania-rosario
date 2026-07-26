import { beforeEach, describe, expect, it } from "vitest";
import { MisioneroService } from "./misionero.service";
import {
  crearActor,
  crearActorDeSistema,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

/**
 * La matriz de alcance para Misionero.
 *
 * Este es el módulo donde la fuga era concreta: un Misionero lleva nombre y
 * teléfono, incluso de las ramas más chicas de la Campaña, y hasta el issue #2
 * cualquier Usuario autenticado podía listarlos todos. Las búsquedas tienen su
 * propio caso: un buscador que ignore el alcance devuelve gente de otra
 * Provincia con sólo escribir un apellido común.
 *
 * Como en Peregrina, "vecina" es otra Diócesis de la **misma** Provincia, y tiene
 * que ser invisible: el dato se acota a la Diócesis aunque el selector llegue
 * hasta la Provincia.
 */

let territorio: TerritorioDePrueba;
let sistema: CurrentUser;

let asesor: CurrentUser;
let diocesano: CurrentUser;
let referente: CurrentUser;

let propio: { id: string };
let vecino: { id: string };
let ajeno: { id: string };

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  sistema = await crearActorDeSistema();

  asesor = await crearActor({ rol: "asesor_nacional" });
  diocesano = await crearActor({
    rol: "responsable_diocesano",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });

  propio = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: sistema.id,
    nombre: "Ana",
    apellido: "Gómez",
  });
  vecino = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.rioCuarto.id,
    createdById: sistema.id,
    nombre: "Beto",
    apellido: "Gómez",
  });
  ajeno = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.zapala.id,
    createdById: sistema.id,
    nombre: "Carla",
    apellido: "Gómez",
  });
});

describe("lecturas de un Asesor Nacional", () => {
  it("ve el país entero", async () => {
    const lista = await MisioneroService.listAll(asesor);

    expect(lista.map((m) => m.id).sort()).toEqual(
      [propio.id, vecino.id, ajeno.id].sort()
    );
  });

  it("busca en el país entero", async () => {
    const encontrados = await MisioneroService.search(asesor, "Gómez");

    expect(encontrados).toHaveLength(3);
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("lecturas de %s", (_rol, obtenerActor) => {
  it("ve el Misionero de su Diócesis y NO los de otras", async () => {
    const lista = await MisioneroService.listAll(obtenerActor());
    const ids = lista.map((m) => m.id);

    expect(ids).toEqual([propio.id]);
    expect(ids).not.toContain(vecino.id);
    expect(ids).not.toContain(ajeno.id);
  });

  it("una búsqueda por apellido común no filtra datos de otro territorio", async () => {
    const encontrados = await MisioneroService.search(obtenerActor(), "Gómez");

    expect(encontrados.map((m) => m.nombre)).toEqual(["Ana"]);
  });

  it("buscar el nombre de una Diócesis ajena no la trae", async () => {
    const encontrados = await MisioneroService.search(obtenerActor(), "Zapala");

    expect(encontrados).toEqual([]);
  });

  it("una búsqueda vacía tampoco amplía el alcance", async () => {
    const encontrados = await MisioneroService.search(obtenerActor(), "   ");

    expect(encontrados.map((m) => m.id)).toEqual([propio.id]);
  });

  it("NO puede leer por id el de la Diócesis vecina", async () => {
    await expect(
      MisioneroService.getById(obtenerActor(), vecino.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("el teléfono de un Misionero ajeno no llega por ninguna lectura", async () => {
    const listado = await MisioneroService.listAll(obtenerActor());
    const buscado = await MisioneroService.search(obtenerActor(), "Carla");

    expect([...listado, ...buscado].map((m) => m.id)).not.toContain(ajeno.id);
  });

  it("el tablero cuenta sólo su territorio", async () => {
    const porEstado = await MisioneroService.dashboardStats(obtenerActor());

    expect(porEstado).toEqual([{ estado: "activo", count: 1 }]);
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("escrituras de %s", (_rol, obtenerActor) => {
  it("puede modificar el de su propia Diócesis", async () => {
    const modificado = await MisioneroService.update(obtenerActor(), propio.id, {
      telefono: "351 555 0000",
    });

    expect(modificado.telefono).toBe("351 555 0000");
  });

  it("NO puede modificar uno ajeno, y el registro queda intacto", async () => {
    await expect(
      MisioneroService.update(obtenerActor(), ajeno.id, {
        telefono: "299 555 0000",
      })
    ).rejects.toThrow(NoAutorizadoError);

    const sinCambios = await MisioneroService.getById(asesor, ajeno.id);
    expect(sinCambios.telefono).toBeNull();
  });

  it("NO puede agregar un resumen anual a uno ajeno", async () => {
    await expect(
      MisioneroService.addResumenAnual(obtenerActor(), {
        misioneroId: vecino.id,
        year: 2025,
        resumen: "Un año de trabajo que no es el suyo.",
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede dar de baja uno ajeno, y el registro sigue activo", async () => {
    await expect(
      MisioneroService.darDeBaja(obtenerActor(), ajeno.id)
    ).rejects.toThrow(NoAutorizadoError);

    const intacto = await MisioneroService.getById(asesor, ajeno.id);
    expect(intacto.deBaja).toBe(false);
  });

  it("NO puede registrar en la Diócesis vecina", async () => {
    await expect(
      MisioneroService.create(obtenerActor(), {
        nombre: "Nuevo",
        apellido: "Misionero",
        telefono: null,
        centroTipo: null,
        centroNombre: null,
        anioConsagracion: null,
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede mover uno propio fuera de su territorio", async () => {
    await expect(
      MisioneroService.update(obtenerActor(), propio.id, {
        diocesisLocalidadId: territorio.chosMalal.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("escrituras de un Asesor Nacional", () => {
  it("puede modificar cualquier Misionero del país", async () => {
    const modificado = await MisioneroService.update(asesor, ajeno.id, {
      telefono: "299 555 0000",
    });

    expect(modificado.telefono).toBe("299 555 0000");
  });

  it("puede agregar un resumen anual a cualquiera", async () => {
    const conResumen = await MisioneroService.addResumenAnual(asesor, {
      misioneroId: ajeno.id,
      year: 2025,
      resumen: "Un año entero de peregrinación.",
    });

    expect(conResumen.resumenesAnuales["2025"]).toContain("peregrinación");
  });
});
