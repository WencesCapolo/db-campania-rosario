import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import { TableroService } from "@/modules/tablero/tablero.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError } from "@/lib/errors";

/**
 * Las marcadas como extraviadas, encontrables — ADR 0013.
 *
 * Una imagen marcada como extraviada sale de todas las listas pero su Código
 * sigue ocupado. En producción eso dejó a alguien con «ya hay una Peregrina con
 * el Código CAB JOV 0023» y ninguna pantalla donde verla. Ahora la negativa dice
 * que está marcada, y el filtro «Inventario» la muestra.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;
let referente: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
});

function nueva(
  actor: CurrentUser,
  numero: number,
  diocesisLocalidadId = territorio.villaMaria.id,
) {
  return PeregrinaService.create(actor, {
    tipo: "peregrina",
    modalidad: "JOV",
    diocesisLocalidadId,
    numero,
  });
}

async function marcada(
  numero: number,
  diocesisLocalidadId = territorio.villaMaria.id,
) {
  const p = await nueva(asesor, numero, diocesisLocalidadId);
  await PeregrinaService.darDeBaja(asesor, p.id);
  return p;
}

describe("un Código que ya es de una imagen marcada como extraviada", () => {
  it("la negativa dice que está marcada y dónde encontrarla", async () => {
    await marcada(23);

    const intento = nueva(referente, 23);
    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(
      /CBA JOV 0023 ya existe y está marcada como extraviada/,
    );
    await expect(intento).rejects.toThrow(/Marcadas como extraviadas/);
  });

  it("al editar, también", async () => {
    await marcada(23);
    const otra = await nueva(referente, 24);

    await expect(
      PeregrinaService.update(referente, otra.id, { numero: 23 }),
    ).rejects.toThrow(/marcada como extraviada/);
  });

  it("de otro territorio, la negativa no dice nada más que el Código", async () => {
    // Río Cuarto también es Córdoba: mismo Código, otra Diócesis.
    await marcada(23, territorio.rioCuarto.id);

    const intento = nueva(referente, 23);
    await expect(intento).rejects.toThrow(/Ya hay una Peregrina con el Código CBA JOV 0023/);
    await expect(intento).rejects.not.toThrow(/extraviada/);
  });

  it("una que está en el inventario sigue con la frase de siempre", async () => {
    await nueva(asesor, 23);

    await expect(nueva(referente, 23)).rejects.toThrow(/Revisá el número/);
  });
});

describe("el filtro «Inventario: Marcadas como extraviadas»", () => {
  it("muestra sólo las marcadas, con un total del mismo predicado", async () => {
    const perdida = await marcada(23);
    await nueva(asesor, 24);

    const pagina = await PeregrinaService.listPagina(referente, {
      inventario: "marcadas",
    });

    expect(pagina.filas.map((p) => p.id)).toEqual([perdida.id]);
    expect(pagina.filas[0]?.deBaja).toBe(true);
    expect(pagina.filas[0]?.estado).toBe("extraviada");
    expect(pagina.total).toBe(1);
  });

  it("sin el filtro, siguen afuera", async () => {
    await marcada(23);
    const enInventario = await nueva(asesor, 24);

    const pagina = await PeregrinaService.listPagina(referente, {});

    expect(pagina.filas.map((p) => p.id)).toEqual([enInventario.id]);
  });

  it("un Referente no ve las marcadas de otro territorio", async () => {
    await marcada(23, territorio.rioCuarto.id);
    await marcada(23, territorio.zapala.id);

    const pagina = await PeregrinaService.listPagina(referente, {
      inventario: "marcadas",
    });

    expect(pagina.filas).toEqual([]);
    expect(pagina.total).toBe(0);
  });

  it("el tablero cuenta las mismas filas que la lista", async () => {
    await marcada(23);
    await marcada(25);
    await nueva(asesor, 24);

    const tablero = await TableroService.resumen(asesor, {
      inventario: "marcadas",
    });

    expect(tablero.totalPeregrinas).toBe(2);
  });
});

describe("eliminar una imagen marcada como extraviada", () => {
  it("la borra con su historial, y su Código vuelve a quedar libre", async () => {
    const ana = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });
    const perdida = await nueva(referente, 23);
    await AsignacionService.asignar(referente, {
      peregrinaId: perdida.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: perdida.id,
      notaCierre: null,
    });
    await PeregrinaService.darDeBaja(referente, perdida.id);

    await PeregrinaService.eliminar(referente, perdida.id);

    await expect(PeregrinaService.getById(asesor, perdida.id)).rejects.toThrow(
      /No existe/,
    );
    const historial = await AsignacionService.historialDeMisionero(
      referente,
      ana.id,
    );
    expect(historial).toEqual([]);
    const pagina = await PeregrinaService.listPagina(referente, {
      inventario: "marcadas",
    });
    expect(pagina.total).toBe(0);

    const otraVez = await nueva(referente, 23);
    expect(otraVez.codigo).toBe("CBA JOV 0023");
  });

  it("un Referente no elimina una marcada de otro territorio", async () => {
    const ajena = await marcada(23, territorio.rioCuarto.id);

    await expect(PeregrinaService.eliminar(referente, ajena.id)).rejects.toThrow();
    const sigue = await PeregrinaService.getById(asesor, ajena.id);
    expect(sigue.deBaja).toBe(true);
  });
});
