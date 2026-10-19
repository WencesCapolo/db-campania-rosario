import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import { createPeregrinaSchema } from "./peregrina.types";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError, NoAutorizadoError, ValidacionError } from "@/lib/errors";

/**
 * ADR 0013 — el número del Código se puede tipear, la imagen tiene Fecha de
 * consagración, una imagen se puede eliminar con su historial, y la baja se
 * llama Extraviada.
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

function nueva(actor: CurrentUser, extra: { numero?: number } = {}) {
  return PeregrinaService.create(actor, {
    tipo: "peregrina",
    modalidad: "JOV",
    diocesisLocalidadId: territorio.villaMaria.id,
    ...extra,
  });
}

describe("el número del Código, tipeado", () => {
  it("arma el Código con la Provincia, la Modalidad y el número escrito", async () => {
    const creada = await nueva(asesor, { numero: 42 });

    expect(creada.codigo).toBe("CBA JOV 0042");
    expect(creada.codigoNum).toBe(42);
  });

  it("no exige que siga al anterior: el 7 entra después del 42", async () => {
    await nueva(asesor, { numero: 42 });
    const siete = await nueva(asesor, { numero: 7 });

    expect(siete.codigo).toBe("CBA JOV 0007");
  });

  it("sin número, se le da el siguiente al más alto", async () => {
    await nueva(asesor, { numero: 42 });
    const siguiente = await nueva(asesor);

    expect(siguiente.codigo).toBe("CBA JOV 0043");
  });

  it("rechaza un Código que ya existe, y lo nombra", async () => {
    await nueva(asesor, { numero: 42 });

    const intento = nueva(asesor, { numero: 42 });
    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/CBA JOV 0042/);
  });

  it("el mismo número en otra Modalidad u otra Provincia no es el mismo Código", async () => {
    await nueva(asesor, { numero: 42 });

    const fam = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
      numero: 42,
    });
    const neu = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
      numero: 42,
    });

    expect(fam.codigo).toBe("CBA FAM 0042");
    expect(neu.codigo).toBe("NEU JOV 0042");
  });

  it("cuenta también las imágenes extraviadas: su Código sigue escrito", async () => {
    const perdida = await nueva(asesor, { numero: 5 });
    await PeregrinaService.update(asesor, perdida.id, { estado: "extraviada" });

    await expect(nueva(asesor, { numero: 5 })).rejects.toThrow(/CBA JOV 0005/);
  });

  it("cuenta las de otro territorio, aunque el Referente no las vea", async () => {
    // Río Cuarto también es Córdoba: comparte la secuencia, y el Código es único.
    await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.rioCuarto.id,
      numero: 9,
    });

    await expect(nueva(referente, { numero: 9 })).rejects.toThrow(ConflictoError);
  });

  it("se le puede tipear a una imagen vieja al ponerle su Código", async () => {
    const vieja = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
      numeracionAnterior: "Peregrina 7",
    });

    const conCodigo = await PeregrinaService.generarCodigo(asesor, vieja.id, 77);

    expect(conCodigo.codigo).toBe("CBA JOV 0077");
    expect(conCodigo.numeracionAnterior).toBe("Peregrina 7");
  });

  it("el esquema rechaza un número de cinco cifras, y uno que no es entero", () => {
    const base = {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: "x",
    };
    expect(createPeregrinaSchema.safeParse({ ...base, numero: 10000 }).success).toBe(false);
    expect(createPeregrinaSchema.safeParse({ ...base, numero: 1.5 }).success).toBe(false);
    expect(createPeregrinaSchema.safeParse({ ...base, numero: Number.NaN }).success).toBe(false);
  });
});

describe("editar una Peregrina", () => {
  it("un número nuevo rearma el Código con la Modalidad que queda", async () => {
    const creada = await nueva(asesor, { numero: 1 });

    const editada = await PeregrinaService.update(asesor, creada.id, {
      modalidad: "FAM",
      numero: 3,
    });

    expect(editada.codigo).toBe("CBA FAM 0003");
  });

  it("sin tocar el número, el Código queda como está escrito", async () => {
    const creada = await nueva(asesor, { numero: 1 });

    const editada = await PeregrinaService.update(asesor, creada.id, {
      modalidad: "FAM",
    });

    expect(editada.codigo).toBe("CBA JOV 0001");
    expect(editada.modalidad).toBe("FAM");
  });

  it("rechaza un número que ya es el Código de otra", async () => {
    await nueva(asesor, { numero: 1 });
    const otra = await nueva(asesor, { numero: 2 });

    await expect(
      PeregrinaService.update(asesor, otra.id, { numero: 1 })
    ).rejects.toThrow(/CBA JOV 0001/);
  });

  it("volver a poner su propio número no es un duplicado", async () => {
    const creada = await nueva(asesor, { numero: 1 });

    const editada = await PeregrinaService.update(asesor, creada.id, {
      numero: 1,
    });

    expect(editada.codigo).toBe("CBA JOV 0001");
  });

  it("no la deja sin Código ni numeración anterior", async () => {
    const creada = await nueva(asesor, { numero: 1 });

    await expect(
      PeregrinaService.update(asesor, creada.id, { numero: null })
    ).rejects.toThrow(ValidacionError);
  });

  it("le saca el Código si le queda la numeración anterior", async () => {
    const creada = await nueva(asesor, { numero: 1 });

    const editada = await PeregrinaService.update(asesor, creada.id, {
      numero: null,
      numeracionAnterior: "Rosario-12",
    });

    expect(editada.codigo).toBeNull();
    expect(editada.identificacion).toBe("Rosario-12");
  });

  it("guarda la Fecha de consagración, y la borra con null", async () => {
    const creada = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
      numeracionAnterior: "7",
      fechaConsagracion: "1998-10-18",
    });
    expect(creada.fechaConsagracion).toBe("1998-10-18");

    const sinFecha = await PeregrinaService.update(asesor, creada.id, {
      fechaConsagracion: null,
    });
    expect(sinFecha.fechaConsagracion).toBeNull();
  });

  it("el esquema rechaza una fecha en el futuro, y una que no existe", () => {
    const base = { tipo: "peregrina", modalidad: "JOV", diocesisLocalidadId: "x" };
    expect(
      createPeregrinaSchema.safeParse({ ...base, fechaConsagracion: "2999-01-01" }).success
    ).toBe(false);
    expect(
      createPeregrinaSchema.safeParse({ ...base, fechaConsagracion: "1998-13-40" }).success
    ).toBe(false);
  });
});

describe("borrar una Peregrina", () => {
  it("borra la que nunca estuvo a cargo de nadie", async () => {
    const creada = await nueva(referente);

    await PeregrinaService.borrar(referente, creada.id);

    await expect(PeregrinaService.getById(asesor, creada.id)).rejects.toThrow(
      /No existe/
    );
  });

  it("borra también la que tuvo historial, y la que alguien tiene ahora", async () => {
    const ana = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });
    const devuelta = await nueva(referente);
    await AsignacionService.asignar(referente, {
      peregrinaId: devuelta.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: devuelta.id,
      notaCierre: null,
    });
    const enCasa = await nueva(referente);
    await AsignacionService.asignar(referente, {
      peregrinaId: enCasa.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });

    await PeregrinaService.borrar(referente, devuelta.id);
    await PeregrinaService.borrar(referente, enCasa.id);

    for (const id of [devuelta.id, enCasa.id]) {
      await expect(PeregrinaService.getById(asesor, id)).rejects.toThrow(/No existe/);
    }
    // Su historial se fue con ella: la ficha de Ana ya no la nombra.
    const historial = await AsignacionService.historialDeMisionero(referente, ana.id);
    expect(historial).toEqual([]);
  });

  it("un Referente no elimina una imagen de otro territorio", async () => {
    const ajena = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    await expect(PeregrinaService.borrar(referente, ajena.id)).rejects.toThrow(
      NoAutorizadoError
    );
    const sigue = await PeregrinaService.getById(asesor, ajena.id);
    expect(sigue.id).toBe(ajena.id);
  });

  it("libera su Código: se puede volver a cargar con el mismo número", async () => {
    const creada = await nueva(asesor, { numero: 8 });
    await PeregrinaService.borrar(asesor, creada.id);

    const otra = await nueva(asesor, { numero: 8 });
    expect(otra.codigo).toBe("CBA JOV 0008");
  });
});
