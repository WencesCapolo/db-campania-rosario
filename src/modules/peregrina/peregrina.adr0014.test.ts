import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import { TableroService } from "@/modules/tablero/tablero.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError } from "@/lib/errors";

/**
 * ADR 0014 — una Peregrina no tiene baja.
 *
 * Extraviada es un Estado: la imagen se perdió por ahora, la tenga alguien o
 * no, y sigue en todas las listas. Borrar es que deja de existir, con su
 * historial. Antes había una tercera cosa, «marcada como extraviada», que la
 * sacaba de todas las listas sin liberar su Código, y en producción dejó a
 * alguien con un Código ocupado por una imagen que no podía ver.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;
let responsable: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
  responsable = await crearActor({ rol: "responsable_diocesano" });
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

async function misionero() {
  return crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
  });
}

describe("Extraviada es un Estado", () => {
  it("una extraviada que nadie tiene sigue en el listado y en su filtro", async () => {
    const perdida = await nueva(responsable, 23);
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    const todas = await PeregrinaService.listPagina(responsable, {});
    const extraviadas = await PeregrinaService.listPagina(responsable, {
      estado: "extraviada",
    });

    expect(todas.filas.map((p) => p.id)).toContain(perdida.id);
    expect(extraviadas.filas.map((p) => p.id)).toEqual([perdida.id]);
    expect(extraviadas.total).toBe(1);
  });

  it("una extraviada a cargo de alguien conserva a quien la tuvo", async () => {
    const ana = await misionero();
    const perdida = await nueva(responsable, 23);
    await AsignacionService.asignar(responsable, {
      peregrinaId: perdida.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });

    const cambiada = await PeregrinaService.update(responsable, perdida.id, {
      estado: "extraviada",
    });

    expect(cambiada.estado).toBe("extraviada");
    expect(cambiada.tenenciaActual?.id).toBe(ana.id);
  });

  it("el tablero cuenta las mismas extraviadas que la lista", async () => {
    const a = await nueva(asesor, 23);
    await nueva(asesor, 24);
    await PeregrinaService.update(asesor, a.id, { estado: "extraviada" });

    const tablero = await TableroService.resumen(asesor, { estado: "extraviada" });
    const lista = await PeregrinaService.listPagina(asesor, { estado: "extraviada" });

    expect(tablero.totalPeregrinas).toBe(1);
    expect(lista.total).toBe(1);
  });
  it("su Código sigue ocupado, y la negativa dice cómo encontrarla", async () => {
    const perdida = await nueva(responsable, 23);
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    const intento = nueva(responsable, 23);
    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/CBA JOV 0023.*buscala por su Código/);
  });
});

describe("borrar una Peregrina", () => {
  it("se va con su historial, y su Código vuelve a quedar libre", async () => {
    const ana = await misionero();
    const borrada = await nueva(responsable, 23);
    await AsignacionService.asignar(responsable, {
      peregrinaId: borrada.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });
    await AsignacionService.devolver(responsable, {
      peregrinaId: borrada.id,
      notaCierre: null,
    });

    await PeregrinaService.borrar(responsable, borrada.id);

    await expect(PeregrinaService.getById(asesor, borrada.id)).rejects.toThrow(
      /No existe/,
    );
    expect(await AsignacionService.historialDeMisionero(responsable, ana.id)).toEqual(
      [],
    );
    const otraVez = await nueva(responsable, 23);
    expect(otraVez.codigo).toBe("CBA JOV 0023");
  });
});

describe("el uso de un territorio", () => {
  it("cuenta cada Peregrina, extraviada o no, hasta que se la mueve o se la borra", async () => {
    const ana = await misionero();
    await MisioneroService.darDeBaja(responsable, ana.id);
    const perdida = await nueva(responsable, 23);
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    expect(
      await TerritorioService.usoDeDiocesisLocalidad(asesor, territorio.villaMaria.id),
    ).toEqual({ peregrinas: 1, misioneros: 0 });
    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(asesor, territorio.villaMaria.id),
    ).rejects.toThrow();

    await PeregrinaService.borrar(responsable, perdida.id);

    const retirada = await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id,
    );
    expect(retirada.deBaja).toBe(true);
  });
});
