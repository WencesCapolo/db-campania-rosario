import { beforeEach, describe, expect, it } from "vitest";
import { AsignacionService } from "./asignacion.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError, ValidacionError } from "@/lib/errors";

/**
 * El historial de Asignaciones — la invariante y lo que se acumula alrededor.
 *
 * La invariante es todo el diseño: **una Peregrina tiene como máximo una
 * Asignación abierta**. Se prueba de los dos lados. Que asignar una imagen que ya
 * tiene alguien se rechace, que pasarla cierre exactamente una y abra exactamente
 * una, y que la cuenta de abiertas sea uno de punta a punta.
 *
 * La otra mitad — que la base de datos también la sostenga — está más abajo, y no
 * es la misma prueba: una que sólo maneja el servicio prueba el servicio, no la
 * restricción.
 */

let territorio: TerritorioDePrueba;
let referente: CurrentUser;
let otroReferente: CurrentUser;

let peregrina: { id: string; codigo: string };
let ana: { id: string };
let beto: { id: string };
let carla: { id: string };

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();

  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  // Un segundo login del mismo territorio: los Referentes Locales comparten uno
  // por territorio, así que esto es lo que de verdad pasa cuando "otra persona"
  // registra algo.
  otroReferente = await crearActor({
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
  beto = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    nombre: "Beto",
    apellido: "Benítez",
  });
  carla = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    nombre: "Carla",
    apellido: "Castro",
  });
});

async function abiertas(actor: CurrentUser, peregrinaId: string) {
  const historial = await AsignacionService.historialDePeregrina(
    actor,
    peregrinaId
  );
  return historial.filter((a) => a.abierta);
}

// ── La invariante ─────────────────────────────────────────────────────────────

describe("la invariante: una sola Asignación abierta por Peregrina", () => {
  it("asignar una Peregrina que ya tiene alguien se rechaza, y dice quién la tiene", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const intento = AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      nota: null,
    });

    await expect(intento).rejects.toThrow(ConflictoError);
    // El rechazo sirve para hacer la llamada siguiente, no sólo para negarse.
    await expect(intento).rejects.toThrow(/Ana Álvarez/);

    // Y no cerró la de Ana por las suyas.
    const abierta = await abiertas(referente, peregrina.id);
    expect(abierta).toHaveLength(1);
    expect(abierta[0].misionero.id).toBe(ana.id);
  });

  it("pasarla a otro cierra exactamente una y abre exactamente una", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const { cerrada, abierta } = await AsignacionService.entregar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      notaCierre: "Devuelta en la peregrinación diocesana.",
      nota: "Entregada en la misma jornada.",
    });

    expect(cerrada.misionero.id).toBe(ana.id);
    expect(cerrada.abierta).toBe(false);
    expect(cerrada.cerradaAt).not.toBeNull();
    expect(abierta.misionero.id).toBe(beto.id);
    expect(abierta.abierta).toBe(true);

    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    expect(historial).toHaveLength(2);
    expect(historial.filter((a) => a.abierta)).toHaveLength(1);
  });

  it("la cuenta de abiertas es uno de punta a punta de una cadena de tres", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);

    await AsignacionService.entregar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      notaCierre: null,
      nota: null,
    });
    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);

    await AsignacionService.entregar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: carla.id,
      notaCierre: null,
      nota: null,
    });
    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);

    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    // Y la cadena quedó en orden, que es la pregunta que alguien hace primero.
    expect(historial.map((a) => a.misionero.id)).toEqual([
      ana.id,
      beto.id,
      carla.id,
    ]);
  });

  it("la base de datos también la sostiene: dos asignaciones simultáneas dejan una sola abierta", async () => {
    // Las dos llamadas leen "no la tiene nadie" antes de que ninguna escriba, así
    // que el índice único parcial es lo único que decide. Una prueba que sólo
    // maneja el servicio prueba el servicio, no la restricción.
    const resultados = await Promise.allSettled([
      AsignacionService.asignar(referente, {
        peregrinaId: peregrina.id,
        misioneroId: ana.id,
        nota: null,
      }),
      AsignacionService.asignar(otroReferente, {
        peregrinaId: peregrina.id,
        misioneroId: beto.id,
        nota: null,
      }),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const rechazada = resultados.find((r) => r.status === "rejected");
    expect(rechazada?.status).toBe("rejected");
    if (rechazada?.status === "rejected") {
      // Y el que pierde recibe una explicación, no "algo falló al guardar".
      expect(rechazada.reason).toBeInstanceOf(ConflictoError);
    }

    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);
  });

  it("pasarla al mismo Misionero que ya la tiene se rechaza sin tocar nada", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    await expect(
      AsignacionService.entregar(referente, {
        peregrinaId: peregrina.id,
        misioneroId: ana.id,
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(ValidacionError);

    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].abierta).toBe(true);
  });

  it("pasar una que no tiene nadie se rechaza y nombra la operación correcta", async () => {
    await expect(
      AsignacionService.entregar(referente, {
        peregrinaId: peregrina.id,
        misioneroId: ana.id,
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(/no está a cargo de nadie/);
  });
});

// ── Devolución ────────────────────────────────────────────────────────────────

describe("devolver", () => {
  it("cierra la Asignación y la Peregrina queda sin ninguna abierta — historia 3", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const cerrada = await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: "Quedó en la casa diocesana.",
    });

    expect(cerrada.abierta).toBe(false);
    expect(cerrada.notaCierre).toBe("Quedó en la casa diocesana.");
    expect(await abiertas(referente, peregrina.id)).toHaveLength(0);

    // Y una imagen guardada centralmente no es una imagen que nunca tuvo dueño:
    // el historial sigue ahí.
    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    expect(historial).toHaveLength(1);

    // La tenencia actual queda vacía, y el puntero desnormalizado con ella.
    expect(await AsignacionService.tenenciaActual(referente, peregrina.id)).toBeNull();
    const dto = await PeregrinaService.getById(referente, peregrina.id);
    expect(dto.tenenciaActual).toBeNull();
  });

  it("devolver una que no tiene nadie se rechaza", async () => {
    await expect(
      AsignacionService.devolver(referente, {
        peregrinaId: peregrina.id,
        notaCierre: null,
      })
    ).rejects.toThrow(/no hay nada que devolver/);
  });

  it("después de devolver se la puede asignar de nuevo", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });

    const nueva = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      nota: null,
    });

    expect(nueva.abierta).toBe(true);
    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);
  });
});

// ── Lo que el historial guarda ────────────────────────────────────────────────

describe("lo que queda registrado", () => {
  it("cada entrada atribuye el territorio que la registró, no una persona — historia 5", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    // Los Referentes Locales comparten un login por territorio, así que esto
    // resuelve a un lugar. Ninguna copia puede sugerir responsabilidad individual.
    expect(abierta.registradaPor.usuarioId).toBe(referente.id);
    expect(abierta.registradaPor.diocesisLocalidad).toBe("Villa María");
    expect(abierta.cerradaPor).toBeNull();

    const { cerrada } = await AsignacionService.entregar(otroReferente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      notaCierre: null,
      nota: null,
    });
    expect(cerrada.registradaPor.usuarioId).toBe(referente.id);
    expect(cerrada.cerradaPor?.usuarioId).toBe(otroReferente.id);
  });

  it("guarda la nota de apertura y la de cierre por separado — historia 11", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: "Entregada en la peregrinación diocesana.",
    });

    const cerrada = await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: "Volvió con el marco roto.",
    });

    expect(cerrada.notaApertura).toBe("Entregada en la peregrinación diocesana.");
    expect(cerrada.notaCierre).toBe("Volvió con el marco roto.");
  });

  it("cuenta cuánto tiempo estuvo a cargo, sin decidir qué es mucho — historia 18", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    expect(abierta.diasEnCargo).toBe(0);

    // Se corrige la fecha de entrega a hace cuarenta días: el servicio devuelve el
    // intervalo y la pantalla decide dónde está el límite.
    const hace40 = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const corregida = await AsignacionService.corregir(referente, {
      asignacionId: abierta.id,
      abiertaAt: hace40,
    });

    expect(corregida.diasEnCargo).toBe(40);
    expect(corregida.abierta).toBe(true);
  });

  it("un Misionero puede tener varias Peregrinas a la vez", async () => {
    // Contestado con la Campaña el 2026-07-25: la invariante acota el lado de la
    // Peregrina y nada más.
    const otra = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });

    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.asignar(referente, {
      peregrinaId: otra.id,
      misioneroId: ana.id,
      nota: null,
    });

    const historial = await AsignacionService.historialDeMisionero(
      referente,
      ana.id
    );
    expect(historial.filter((a) => a.abierta)).toHaveLength(2);
  });

  it("el historial de un Misionero trae todas las Peregrinas que tuvo — historia 7", async () => {
    const otra = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });

    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });
    await AsignacionService.asignar(referente, {
      peregrinaId: otra.id,
      misioneroId: ana.id,
      nota: null,
    });

    const historial = await AsignacionService.historialDeMisionero(
      referente,
      ana.id
    );
    expect(historial).toHaveLength(2);
    expect(new Set(historial.map((a) => a.peregrina.codigo))).toEqual(
      new Set([peregrina.codigo, otra.codigo])
    );
  });

  it("lista las Peregrinas que nunca tuvo nadie, y no las que volvieron — historia 19", async () => {
    const nunca = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });

    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });

    const idle = await AsignacionService.listarNuncaAsignadas(referente);

    // "Nunca asignada" y "hoy no está asignada" son dos preguntas distintas.
    expect(idle.map((p) => p.id)).toEqual([nunca.id]);
  });
});

// ── Estados ───────────────────────────────────────────────────────────────────

describe("estados de la Peregrina", () => {
  it("marcarla extraviada deja la Asignación abierta y el último Misionero a la vista — historias 6 y 10", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const extraviada = await PeregrinaService.update(referente, peregrina.id, {
      estado: "extraviada",
    });
    expect(extraviada.estado).toBe("extraviada");

    // La tentación es cerrarla. Cerrarla borra la respuesta a "quién la tenía",
    // que es exactamente lo que se necesita saber.
    const sigueAbierta = await abiertas(referente, peregrina.id);
    expect(sigueAbierta).toHaveLength(1);
    expect(sigueAbierta[0].misionero.id).toBe(ana.id);

    const tenencia = await AsignacionService.tenenciaActual(
      referente,
      peregrina.id
    );
    expect(tenencia?.misionero.nombre).toBe("Ana");
    expect(extraviada.tenenciaActual?.misioneroId).toBe(ana.id);
  });

  it("en reparación es un estado distinto de no estar en uso — historia 9", async () => {
    const enReparacion = await PeregrinaService.update(referente, peregrina.id, {
      estado: "en_reparacion",
    });

    expect(enReparacion.estado).toBe("en_reparacion");
    // Y sigue en el inventario activo: reparar no es dar de baja.
    const lista = await PeregrinaService.listAll(referente);
    expect(lista.map((p) => p.id)).toContain(peregrina.id);
  });

  it("el estado no dice nada sobre la tenencia y viceversa", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await PeregrinaService.update(referente, peregrina.id, {
      estado: "en_reparacion",
    });

    // Devolverla no cambia el estado…
    const devuelta = await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });
    expect(devuelta.abierta).toBe(false);
    expect(
      (await PeregrinaService.getById(referente, peregrina.id)).estado
    ).toBe("en_reparacion");
  });
});

// ── Correcciones ──────────────────────────────────────────────────────────────

describe("corregir una Asignación — historia 17", () => {
  it("cambia el Misionero de una entrada abierta y actualiza la tenencia", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const corregida = await AsignacionService.corregir(referente, {
      asignacionId: abierta.id,
      misioneroId: beto.id,
      notaApertura: "Se había cargado a la persona equivocada.",
    });

    expect(corregida.misionero.id).toBe(beto.id);
    // La corrección es visible: no queda como si siempre hubiera sido Beto.
    expect(corregida.corregidaAt).not.toBeNull();
    expect(corregida.corregidaPor?.usuarioId).toBe(referente.id);

    const dto = await PeregrinaService.getById(referente, peregrina.id);
    expect(dto.tenenciaActual?.misioneroId).toBe(beto.id);

    // Y sigue habiendo una sola abierta: corregir no duplica.
    expect(await abiertas(referente, peregrina.id)).toHaveLength(1);
  });

  it("es una edición y no un borrado: la entrada sigue en el historial", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    await AsignacionService.corregir(referente, {
      asignacionId: abierta.id,
      notaApertura: "Corregida.",
    });

    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].id).toBe(abierta.id);
  });

  it("rechaza una devolución anterior a la entrega", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    await expect(
      AsignacionService.corregir(referente, {
        asignacionId: abierta.id,
        cerradaAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      })
    ).rejects.toThrow(/anterior a la de entrega/);
  });

  it("rechaza una entrega en el futuro: una Asignación registra lo que ya pasó", async () => {
    const abierta = await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    await expect(
      AsignacionService.corregir(referente, {
        asignacionId: abierta.id,
        abiertaAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
    ).rejects.toThrow(/no puede estar en el futuro/);
  });

  it("una entrada cerrada puede nombrar a un Misionero dado de baja; una abierta no", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    const { cerrada, abierta } = await AsignacionService.entregar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: beto.id,
      notaCierre: null,
      nota: null,
    });

    await MisioneroService.darDeBaja(referente, carla.id);

    // Un período cerrado puede perfectamente nombrar a alguien que ya se fue: eso
    // es lo que la historia es.
    const corregida = await AsignacionService.corregir(referente, {
      asignacionId: cerrada.id,
      misioneroId: carla.id,
    });
    expect(corregida.misionero.deBaja).toBe(true);

    // Uno abierto no: tendría una imagen a cargo y no aparecería en ninguna lista.
    await expect(
      AsignacionService.corregir(referente, {
        asignacionId: abierta.id,
        misioneroId: carla.id,
      })
    ).rejects.toThrow(/está dado de baja/);
  });
});
