import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "./tablero.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { NoAutorizadoError } from "@/lib/errors";
import {
  crearActor,
  crearActorDeSistema,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * El alcance territorial del tablero — la mitad negativa.
 *
 * Que un Responsable Diocesano vea su Diócesis pasa igual de bien cuando ve la de
 * todos, así que cada caso de acá afirma lo que **no** aparece. Es el mismo
 * criterio que la matriz de las historias 13 y 20, con un agregado propio del
 * tablero: los filtros llegan de la barra de direcciones, y esa es la única
 * superficie del sistema donde alguien puede *pedir* otro territorio en lugar de
 * simplemente no tenerlo.
 */

let territorio: TerritorioDePrueba;
let sistema: CurrentUser;
let asesor: CurrentUser;
let admin: CurrentUser;
let diocesano: CurrentUser;
let referente: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  sistema = await crearActorDeSistema();

  asesor = await crearActor({ rol: "asesor_nacional" });
  admin = await crearActor({ rol: "admin" });
  diocesano = await crearActor({
    rol: "responsable_diocesano",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });

  // Una imagen y un Misionero por Diócesis, en tres Diócesis de dos Provincias.
  for (const diocesis of [
    territorio.villaMaria,
    territorio.rioCuarto,
    territorio.zapala,
  ]) {
    await crearPeregrinaDirecta({
      diocesisLocalidadId: diocesis.id,
      createdById: sistema.id,
    });
    await crearMisioneroDirecto({
      diocesisLocalidadId: diocesis.id,
      createdById: sistema.id,
    });
  }
});

describe.each([
  ["un Asesor Nacional", () => asesor],
  ["un admin", () => admin],
  ["el Actor de sistema", () => sistema],
])("%s", (_rol, obtenerActor) => {
  it("cuenta el país entero", async () => {
    const tablero = await TableroService.resumen(obtenerActor());

    expect(tablero.totalPeregrinas).toBe(3);
    expect(tablero.totalMisioneros).toBe(3);
    expect(tablero.vista).toBe("nacional");
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("%s", (_rol, obtenerActor) => {
  it("cuenta su Diócesis, y las otras dos no están en ninguna cifra", async () => {
    const tablero = await TableroService.resumen(obtenerActor());

    expect(tablero.totalPeregrinas).toBe(1);
    expect(tablero.totalMisioneros).toBe(1);
    expect(tablero.vista).toBe("diocesana");
  });

  it("las listas del tablero tampoco incluyen registros ajenos", async () => {
    const tablero = await TableroService.resumen(obtenerActor());

    expect(tablero.nuncaAsignadas?.total).toBe(1);
    expect(tablero.misionerosSinPeregrina.total).toBe(1);
  });

  it("pedir otra Diócesis por la URL se rechaza, no se ignora", async () => {
    // Ignorarlo silenciosamente sería peor que rechazarlo: la pantalla mostraría
    // las cifras de Villa María rotuladas «Río Cuarto».
    await expect(
      TableroService.resumen(obtenerActor(), {
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("pedir otra Provincia por la URL también se rechaza", async () => {
    await expect(
      TableroService.resumen(obtenerActor(), {
        diocesisLocalidadId: territorio.zapala.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("pedir su propia Diócesis es válido y no cambia nada", async () => {
    const tablero = await TableroService.resumen(obtenerActor(), {
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(tablero.totalPeregrinas).toBe(1);
  });

  it("pedir otra Región devuelve cero, que es la respuesta honesta", async () => {
    // Una Región no es una unidad de alcance: una Diócesis pertenece a una sola,
    // así que la intersección es vacía y no hay nada que revelar.
    const tablero = await TableroService.resumen(obtenerActor(), {
      region: "R. PAT",
    });

    expect(tablero.totalPeregrinas).toBe(0);
  });

  it("las listas cruzadas también se rechazan con un territorio ajeno", async () => {
    await expect(
      AsignacionService.listarMisionerosSinPeregrina(obtenerActor(), {
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);

    await expect(
      AsignacionService.listarEstancadas(obtenerActor(), 30, {
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("un rol territorial sin territorio", () => {
  it("no ve un tablero vacío: se lo rechaza", async () => {
    // Falla cerrado. Un tablero de ceros diría «tu Campaña está vacía», que es
    // una respuesta a una pregunta que este Actor no tiene permiso de hacer.
    const sinTerritorio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: null,
    });

    await expect(TableroService.resumen(sinTerritorio)).rejects.toThrow(
      NoAutorizadoError
    );
  });
});
