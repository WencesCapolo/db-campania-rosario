import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "@/modules/tablero/tablero.service";
import { MisioneroService } from "./misionero.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError } from "@/lib/errors";

/**
 * Baja lógica de un Misionero — historias 12 a 15.
 *
 * Nada se destruye nunca, y estas pruebas son el motivo: borrar un Misionero
 * destruiría el registro de lo que tuvo a cargo, que es justamente la historia que
 * este issue existe para conservar. Así que se prueban las dos mitades — que
 * desaparece de las listas activas y que sigue resolviendo por nombre dentro del
 * historial — porque cada una sola es la mitad equivocada.
 */

let territorio: TerritorioDePrueba;
let referente: CurrentUser;
let asesor: CurrentUser;

let peregrina: { id: string; codigo: string };
let ana: { id: string };

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();

  asesor = await crearActor({ rol: "asesor_nacional" });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });

  peregrina = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
  });
  ana = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    nombre: "Ana",
    apellido: "Álvarez",
  });
});

describe("no se puede dar de baja a alguien que todavía tiene una Peregrina", () => {
  it("se rechaza y el mensaje nombra el Código pendiente — historias 13 y 14", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const intento = MisioneroService.darDeBaja(referente, ana.id);

    await expect(intento).rejects.toThrow(ConflictoError);
    // La imagen está físicamente con esa persona. Saber cuál es la diferencia
    // entre un rechazo y una instrucción.
    await expect(intento).rejects.toThrow(new RegExp(peregrina.codigo));
    await expect(intento).rejects.toThrow(/Ana Álvarez/);

    // Y sigue activa: el rechazo no dejó nada a medias.
    const sigue = await MisioneroService.getById(referente, ana.id);
    expect(sigue.deBaja).toBe(false);
  });

  it("nombra las dos cuando tiene dos", async () => {
    const otra = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });

    for (const p of [peregrina, otra]) {
      await AsignacionService.asignar(referente, {
        peregrinaId: p.id,
        misioneroId: ana.id,
        nota: null,
      });
    }

    const intento = MisioneroService.darDeBaja(referente, ana.id);
    await expect(intento).rejects.toThrow(new RegExp(peregrina.codigo));
    await expect(intento).rejects.toThrow(new RegExp(otra.codigo));
  });

  it("se puede una vez registrada la devolución", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });

    const deBaja = await MisioneroService.darDeBaja(referente, ana.id);
    expect(deBaja.deBaja).toBe(true);
  });

  it("también se puede después de pasarla a otro Misionero", async () => {
    const beto = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
      apellido: "Benítez",
    });

    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.entregar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      notaCierre: null,
      nota: null,
    });

    await expect(
      MisioneroService.darDeBaja(referente, ana.id)
    ).resolves.toMatchObject({ deBaja: true });
    // Beto ahora la tiene, así que a él no.
    await expect(MisioneroService.darDeBaja(referente, beto.id)).rejects.toThrow(
      ConflictoError
    );
  });

  it("una imagen que se fue a otro territorio sigue frenando la baja, sin filtrar su Código", async () => {
    // El guard es a propósito sin alcance: una Peregrina puede mudarse de Diócesis
    // mientras el Misionero la sigue teniendo en su casa, y un guard que se
    // equivoca del lado permisivo no es un guard. Pero nombrar un Código de otro
    // territorio confirmaría un registro que este Actor no puede leer.
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await PeregrinaService.update(asesor, peregrina.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    const intento = MisioneroService.darDeBaja(referente, ana.id);

    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/de otro territorio/);
    await expect(intento).rejects.not.toThrow(new RegExp(peregrina.codigo));
  });
});

describe("un Misionero dado de baja", () => {
  beforeEach(async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: "Entregada en la jornada diocesana.",
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });
    await MisioneroService.darDeBaja(referente, ana.id);
  });

  it("desaparece de las listas activas — historia 12", async () => {
    expect(await MisioneroService.listAll(referente)).toEqual([]);
    expect(await MisioneroService.search(referente, "Álvarez")).toEqual([]);
    expect(await MisioneroService.listByRegion(referente, "CENTRO")).toEqual([]);
    expect(await MisioneroService.listFiltrados(referente, {})).toEqual([]);

    // Y sale de las cifras: alguien que dejó la Campaña no es capacidad ociosa.
    const tablero = await TableroService.resumen(referente);
    expect(tablero.totalMisioneros).toBe(0);
    expect(tablero.misionerosSinPeregrina.total).toBe(0);
  });

  it("sigue resolviendo por nombre dentro del historial — historia 15", async () => {
    // Ésta es la razón de que la baja sea lógica. Si el borrado fuera físico, la
    // entrada del historial sería una fila de ids ilegibles.
    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );

    expect(historial).toHaveLength(1);
    expect(historial[0].misionero.nombre).toBe("Ana");
    expect(historial[0].misionero.apellido).toBe("Álvarez");
    expect(historial[0].misionero.deBaja).toBe(true);
    expect(historial[0].notaApertura).toBe("Entregada en la jornada diocesana.");
  });

  it("su propio historial sigue leyéndose", async () => {
    const historial = await AsignacionService.historialDeMisionero(
      referente,
      ana.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].peregrina.codigo).toBe(peregrina.codigo);
  });

  it("no puede recibir una Peregrina nueva", async () => {
    await expect(
      AsignacionService.asignar(referente, {
        peregrinaId: peregrina.id,
        misioneroId: ana.id,
        nota: null,
      })
    ).rejects.toThrow(/está dado de baja/);
  });

  it("se lo puede reactivar, y vuelve a las listas", async () => {
    const reactivado = await MisioneroService.reactivar(referente, ana.id);
    expect(reactivado.deBaja).toBe(false);

    const lista = await MisioneroService.listAll(referente);
    expect(lista.map((m) => m.id)).toEqual([ana.id]);
  });

  it("darlo de baja dos veces lo dice, en lugar de fingir que funcionó", async () => {
    await expect(MisioneroService.darDeBaja(referente, ana.id)).rejects.toThrow(
      /ya estaba dado de baja/
    );
  });

  it("reactivar a quien no estaba de baja también lo dice", async () => {
    await MisioneroService.reactivar(referente, ana.id);
    await expect(MisioneroService.reactivar(referente, ana.id)).rejects.toThrow(
      /no estaba dado de baja/
    );
  });
});
