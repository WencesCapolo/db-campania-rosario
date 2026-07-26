import { beforeEach, describe, expect, it } from "vitest";
import { AsignacionService } from "./asignacion.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  crearActor,
  crearActorDeSistema,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

/**
 * La matriz de alcance para Asignación, extendiendo la del issue #2.
 *
 * Una Asignación no tiene territorio propio: se acota a través del de su
 * Peregrina, porque la Peregrina es la cosa que vive en algún lado. Eso hace que
 * esta matriz sea la que puede fallar distinto de las otras dos, y por eso existe
 * aparte.
 *
 * Hay dos "ajenos" a propósito, y la diferencia importa:
 *
 *  - Río Cuarto está en la **misma Provincia** que Villa María. Es la vecina, y
 *    tiene que ser invisible: los datos se acotan a la Diócesis/Localidad, aunque
 *    las *listas de selección* lleguen hasta la Provincia. Si esta prueba pasara,
 *    el alcance sería provincial y no diocesano.
 *  - Zapala está en otra Provincia y otra Región. Es el caso obvio.
 *
 * **La mitad negativa es la prueba.** Que un Referente vea su propio historial
 * pasa igual si ve el de todos.
 */

let territorio: TerritorioDePrueba;
let sistema: CurrentUser;

let admin: CurrentUser;
let asesor: CurrentUser;
let diocesano: CurrentUser;
let referente: CurrentUser;

let propia: { id: string; codigo: string };
let vecina: { id: string; codigo: string };
let ajena: { id: string; codigo: string };

let misioneroPropio: { id: string };
let misioneroVecino: { id: string };

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

  misioneroPropio = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: sistema.id,
    apellido: "Propio",
  });
  misioneroVecino = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.rioCuarto.id,
    createdById: sistema.id,
    apellido: "Vecino",
  });

  // Cada Peregrina con una Asignación abierta, hecha por quien puede hacerla.
  for (const [peregrinaId, diocesisId, apellido] of [
    [propia.id, territorio.villaMaria.id, "Propio"],
    [vecina.id, territorio.rioCuarto.id, "DeRioCuarto"],
    [ajena.id, territorio.zapala.id, "DeZapala"],
  ] as const) {
    const misionero =
      apellido === "Propio"
        ? misioneroPropio
        : await crearMisioneroDirecto({
            diocesisLocalidadId: diocesisId,
            createdById: sistema.id,
            apellido,
          });
    await AsignacionService.asignar(asesor, {
      peregrinaId,
      misioneroId: misionero.id,
      nota: null,
    });
  }
});

// ── Lecturas ──────────────────────────────────────────────────────────────────

describe("lecturas de los roles nacionales", () => {
  it("un Asesor Nacional lee el historial de cualquier Peregrina del país", async () => {
    for (const p of [propia, vecina, ajena]) {
      const historial = await AsignacionService.historialDePeregrina(asesor, p.id);
      expect(historial).toHaveLength(1);
    }
  });

  it("un admin también", async () => {
    const historial = await AsignacionService.historialDePeregrina(admin, ajena.id);
    expect(historial).toHaveLength(1);
  });

  it("el tablero de un Asesor Nacional cuenta el país entero", async () => {
    const { abiertas } = await AsignacionService.dashboardStats(asesor);
    expect(abiertas).toBe(3);
  });
});

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("lecturas de %s", (_rol, obtenerActor) => {
  it("lee el historial de la Peregrina de su Diócesis", async () => {
    const historial = await AsignacionService.historialDePeregrina(
      obtenerActor(),
      propia.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].peregrina.codigo).toBe(propia.codigo);
  });

  it("NO lee el historial de la Diócesis vecina, aun estando en su Provincia", async () => {
    await expect(
      AsignacionService.historialDePeregrina(obtenerActor(), vecina.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO lee el historial de otra Región", async () => {
    await expect(
      AsignacionService.historialDePeregrina(obtenerActor(), ajena.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un historial que no puede ver se rechaza, no vuelve vacío", async () => {
    // Una lista vacía diría "esa Peregrina existe y no tiene historial", que es
    // una afirmación sobre otro territorio. El rechazo no dice ninguna de las dos.
    const intento = AsignacionService.historialDePeregrina(
      obtenerActor(),
      ajena.id
    );
    await expect(intento).rejects.toThrow(NoAutorizadoError);
    await expect(intento).rejects.not.toEqual([]);
  });

  it("NO lee la tenencia actual de una Peregrina ajena", async () => {
    await expect(
      AsignacionService.tenenciaActual(obtenerActor(), vecina.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO lee el historial de un Misionero de la Diócesis vecina", async () => {
    await expect(
      AsignacionService.historialDeMisionero(obtenerActor(), misioneroVecino.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("el tablero cuenta sólo su territorio", async () => {
    const { abiertas } = await AsignacionService.dashboardStats(obtenerActor());
    expect(abiertas).toBe(1);
  });

  it("las Peregrinas nunca asignadas son sólo las suyas", async () => {
    const nunca = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: sistema.id,
    });
    await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.rioCuarto.id,
      createdById: sistema.id,
    });

    const idle = await AsignacionService.listarNuncaAsignadas(obtenerActor());
    expect(idle.map((p) => p.id)).toEqual([nunca.id]);
  });
});

// ── Escrituras ────────────────────────────────────────────────────────────────

describe.each([
  ["un Responsable Diocesano", () => diocesano],
  ["un Referente Local", () => referente],
])("escrituras de %s", (_rol, obtenerActor) => {
  it("puede registrar una entrega dentro de su territorio", async () => {
    const otro = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: sistema.id,
      apellido: "Otro",
    });

    const { abierta } = await AsignacionService.entregar(obtenerActor(), {
      peregrinaId: propia.id,
      misioneroId: otro.id,
      notaCierre: null,
      nota: null,
    });

    expect(abierta.misionero.id).toBe(otro.id);
  });

  it("NO puede asignar una Peregrina de la Diócesis vecina, aunque la vea en el selector", async () => {
    await AsignacionService.devolver(asesor, {
      peregrinaId: vecina.id,
      notaCierre: null,
    });

    await expect(
      AsignacionService.asignar(obtenerActor(), {
        peregrinaId: vecina.id,
        misioneroId: misioneroPropio.id,
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede entregar una Peregrina de otra Región, y el registro queda intacto", async () => {
    await expect(
      AsignacionService.entregar(obtenerActor(), {
        peregrinaId: ajena.id,
        misioneroId: misioneroPropio.id,
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);

    const historial = await AsignacionService.historialDePeregrina(
      asesor,
      ajena.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].abierta).toBe(true);
  });

  it("NO puede devolver una Peregrina ajena", async () => {
    await expect(
      AsignacionService.devolver(obtenerActor(), {
        peregrinaId: vecina.id,
        notaCierre: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede pasar una Peregrina propia a un Misionero de la Diócesis vecina", async () => {
    // Los dos extremos se controlan: si no, podría empujar la imagen al territorio
    // de al lado y perderla de vista en el mismo movimiento.
    await expect(
      AsignacionService.entregar(obtenerActor(), {
        peregrinaId: propia.id,
        misioneroId: misioneroVecino.id,
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);

    const tenencia = await AsignacionService.tenenciaActual(
      obtenerActor(),
      propia.id
    );
    expect(tenencia?.misionero.id).toBe(misioneroPropio.id);
  });

  it("NO puede corregir una Asignación ajena", async () => {
    const [ajenaAsignacion] = await AsignacionService.historialDePeregrina(
      asesor,
      ajena.id
    );

    await expect(
      AsignacionService.corregir(obtenerActor(), {
        asignacionId: ajenaAsignacion.id,
        notaApertura: "No es mía.",
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede leer una Asignación ajena por id", async () => {
    const [ajenaAsignacion] = await AsignacionService.historialDePeregrina(
      asesor,
      ajena.id
    );

    await expect(
      AsignacionService.getById(obtenerActor(), ajenaAsignacion.id)
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("una Peregrina que se muda se lleva su historial", () => {
  it("cambia de Diócesis y su cadena de custodia cambia de alcance con ella", async () => {
    // Es la consecuencia deliberada de acotar la Asignación por el territorio de
    // su Peregrina: la cadena de custodia pertenece a la imagen, no a quien hizo
    // el trámite. Un Referente puede perder de vista Asignaciones que su propio
    // territorio registró, si un Asesor Nacional mueve la imagen.
    const antes = await AsignacionService.historialDePeregrina(
      referente,
      propia.id
    );
    expect(antes).toHaveLength(1);

    await AsignacionService.devolver(referente, {
      peregrinaId: propia.id,
      notaCierre: null,
    });
    await PeregrinaService.update(asesor, propia.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    await expect(
      AsignacionService.historialDePeregrina(referente, propia.id)
    ).rejects.toThrow(NoAutorizadoError);

    // Y sigue completo para quien sí puede verlo: nada se perdió, cambió de manos.
    const despues = await AsignacionService.historialDePeregrina(
      asesor,
      propia.id
    );
    expect(despues).toHaveLength(1);
  });
});

describe("un rol territorial sin territorio falla cerrado", () => {
  it("no ve ningún historial en lugar de verlos todos", async () => {
    const sinTerritorio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: null,
    });

    await expect(
      AsignacionService.historialDePeregrina(sinTerritorio, propia.id)
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      AsignacionService.listarNuncaAsignadas(sinTerritorio)
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      AsignacionService.asignar(sinTerritorio, {
        peregrinaId: propia.id,
        misioneroId: misioneroPropio.id,
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});
