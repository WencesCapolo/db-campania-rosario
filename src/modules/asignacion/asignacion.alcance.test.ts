import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "@/modules/tablero/tablero.service";
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
import type { Tenedor } from "@/modules/misionero/matrimonio.types";
import { nombreDeTenedor } from "@/lib/formato";
import { NoAutorizadoError } from "@/lib/errors";

/** Una persona, vista como la fila del listado que es. */
function comoTenedor(m: { id: string }): Tenedor {
  return { tipo: "persona", id: m.id };
}

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
      tenedor: { tipo: "persona", id: misionero.id },
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
    const tablero = await TableroService.resumen(asesor);
    // Tres imágenes en manos de alguien: total menos las que no tiene nadie.
    expect(tablero.totalPeregrinas - tablero.sinTenencia).toBe(3);
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
    const tablero = await TableroService.resumen(obtenerActor());
    expect(tablero.totalPeregrinas - tablero.sinTenencia).toBe(1);
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

  it("los Tenedores con alguna imagen son sólo los de su Diócesis", async () => {
    // El filtro «sólo los que tienen alguna» del listado. En Río Cuarto hay
    // alguien teniendo la vecina, así que la mitad negativa tiene algo que ver:
    // si el scope fuera provincial, esa persona aparecería acá.
    const conImagen = await AsignacionService.listarTenedoresConPeregrina(
      obtenerActor()
    );

    expect(conImagen.map((t) => t.id)).toEqual([misioneroPropio.id]);
    expect(conImagen.map(nombreDeTenedor).join(" ")).not.toContain(
      "DeRioCuarto"
    );
  });

  it("las dos mitades del filtro parten su territorio y no se solapan", async () => {
    // `misioneroVecino` no tiene ninguna, pero es de Río Cuarto: no está en
    // ninguna de las dos listas. La única persona de Villa María es la que tiene
    // la propia, así que «sin» vuelve vacía — y eso es la partición, no un cero
    // por haber mirado el territorio equivocado.
    const [conImagen, sinImagen] = await Promise.all([
      AsignacionService.listarTenedoresConPeregrina(obtenerActor()),
      AsignacionService.listarTenedoresSinPeregrina(obtenerActor()),
    ]);

    const libre = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: sistema.id,
      apellido: "Libre",
    });

    expect(conImagen.map((t) => t.id)).toEqual([misioneroPropio.id]);
    expect(sinImagen).toEqual([]);
    expect(
      await AsignacionService.listarTenedoresSinPeregrina(obtenerActor())
    ).toMatchObject([{ tipo: "persona", id: libre.id }]);
  });

  it("tener una imagen de otro territorio cuenta como tenerla", async () => {
    // La misma asimetría que la columna «¿Tiene imagen?»: la Peregrina se movió de
    // Diócesis y sigue en la misma casa, así que quien la tiene no está libre. Se
    // prueba en las dos listas, porque el error cómodo es que aparezca en ambas.
    const deZapala = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.zapala.id,
      createdById: sistema.id,
    });
    const suyo = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: sistema.id,
      apellido: "ConUnaDeZapala",
    });
    await AsignacionService.asignar(asesor, {
      peregrinaId: deZapala.id,
      tenedor: { tipo: "persona", id: suyo.id },
      nota: null,
    });

    const [conImagen, sinImagen] = await Promise.all([
      AsignacionService.listarTenedoresConPeregrina(obtenerActor()),
      AsignacionService.listarTenedoresSinPeregrina(obtenerActor()),
    ]);

    expect(conImagen.map((t) => t.id)).toContain(suyo.id);
    expect(sinImagen.map((t) => t.id)).not.toContain(suyo.id);
  });

  it("las tenencias de una página de Tenedores no dicen nada de un Misionero vecino", async () => {
    // La columna «¿Tiene imagen?» del listado, con un id ajeno mezclado entre los
    // propios: la fila del vecino vuelve vacía y no con su Peregrina, así que
    // pasar ids de otra Diócesis no enseña si esa persona tiene una imagen.
    //
    // El vecino tiene una de verdad primero, que si no la mitad negativa de esta
    // prueba pasaría por no haber nada que ver.
    await AsignacionService.entregar(asesor, {
      peregrinaId: vecina.id,
      tenedor: { tipo: "persona", id: misioneroVecino.id },
      notaCierre: null,
      nota: null,
    });

    const tenencias = await AsignacionService.tenenciasDeTenedores(
      obtenerActor(),
      [comoTenedor(misioneroPropio), comoTenedor(misioneroVecino)]
    );

    const propio = tenencias.find(
      (t) => t.tenedor.id === misioneroPropio.id
    );
    expect(propio?.peregrinas.map((p) => p.codigo)).toEqual([propia.codigo]);

    const vecino = tenencias.find((t) => t.tenedor.id === misioneroVecino.id);
    expect(vecino).toEqual({
      tenedor: comoTenedor(misioneroVecino),
      peregrinas: [],
      ajenas: 0,
    });
    expect(JSON.stringify(tenencias)).not.toContain(vecina.codigo);
  });

  it("una imagen de otro territorio en manos de alguien suyo se cuenta y no se nombra", async () => {
    // Una Peregrina de Zapala que tiene un Misionero de Villa María: puede pasar
    // porque la imagen se mueve de Diócesis mientras sigue en la misma casa.
    // Decir «Ninguna» sería mentir en la dirección cómoda — el Misionero no está
    // libre — y decir el Código sería confirmar un registro de otro territorio.
    const deZapala = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.zapala.id,
      createdById: sistema.id,
    });
    await AsignacionService.asignar(asesor, {
      peregrinaId: deZapala.id,
      tenedor: { tipo: "persona", id: misioneroPropio.id },
      nota: null,
    });

    const [tenencia] = await AsignacionService.tenenciasDeTenedores(
      obtenerActor(),
      [comoTenedor(misioneroPropio)]
    );

    expect(tenencia.peregrinas.map((p) => p.codigo)).toEqual([propia.codigo]);
    expect(tenencia.ajenas).toBe(1);
    expect(JSON.stringify(tenencia)).not.toContain(deZapala.codigo);
  });
});

describe("las tenencias de una página de Tenedores, para un rol nacional", () => {
  it("un Asesor Nacional ve el Código de cualquiera de las dos Diócesis", async () => {
    await AsignacionService.entregar(asesor, {
      peregrinaId: vecina.id,
      tenedor: { tipo: "persona", id: misioneroVecino.id },
      notaCierre: null,
      nota: null,
    });

    const tenencias = await AsignacionService.tenenciasDeTenedores(asesor, [
      comoTenedor(misioneroPropio),
      comoTenedor(misioneroVecino),
    ]);

    expect(
      tenencias.map((t) => t.peregrinas.map((p) => p.codigo)).flat()
    ).toEqual(expect.arrayContaining([propia.codigo, vecina.codigo]));
    expect(tenencias.every((t) => t.ajenas === 0)).toBe(true);
  });

  it("sin Tenedores no hay pregunta, y la lista vuelve vacía", async () => {
    expect(await AsignacionService.tenenciasDeTenedores(asesor, [])).toEqual([]);
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
      tenedor: { tipo: "persona", id: otro.id },
      notaCierre: null,
      nota: null,
    });

    expect(abierta.tenedor.id).toBe(otro.id);
  });

  it("NO puede asignar una Peregrina de la Diócesis vecina, aunque la vea en el selector", async () => {
    await AsignacionService.devolver(asesor, {
      peregrinaId: vecina.id,
      notaCierre: null,
    });

    await expect(
      AsignacionService.asignar(obtenerActor(), {
        peregrinaId: vecina.id,
        tenedor: { tipo: "persona", id: misioneroPropio.id },
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("NO puede entregar una Peregrina de otra Región, y el registro queda intacto", async () => {
    await expect(
      AsignacionService.entregar(obtenerActor(), {
        peregrinaId: ajena.id,
        tenedor: { tipo: "persona", id: misioneroPropio.id },
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
        tenedor: { tipo: "persona", id: misioneroVecino.id },
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);

    const tenencia = await AsignacionService.tenenciaActual(
      obtenerActor(),
      propia.id
    );
    expect(tenencia?.tenedor.id).toBe(misioneroPropio.id);
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
        tenedor: { tipo: "persona", id: misioneroPropio.id },
        nota: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});
