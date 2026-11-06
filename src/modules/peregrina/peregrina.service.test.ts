import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "@/modules/tablero/tablero.service";
import { PeregrinaService } from "./peregrina.service";
import { createPeregrinaSchema } from "./peregrina.types";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError, ValidacionError } from "@/lib/errors";

let territorio: TerritorioDePrueba;
let actor: CurrentUser;
let responsable: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  actor = await crearActor({ rol: "asesor_nacional" });
  responsable = await crearActor({ rol: "responsable_diocesano" });
});

function nueva(quien: CurrentUser, extra: { numero?: number } = {}) {
  return PeregrinaService.create(quien, {
    tipo: "peregrina",
    modalidad: "JOV",
    diocesisLocalidadId: territorio.villaMaria.id,
    ...extra,
  });
}

function misionero() {
  return crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
  });
}

describe("generación del Código", () => {
  it("toma la abreviatura de los datos de referencia, no de un mapa en el código", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    // "CBA" lives on the Provincia record for Córdoba.
    expect(creada.codigo).toBe("CBA JOV 0001");
  });

  it("sigue la secuencia por par Provincia + Modalidad", async () => {
    const codigos: string[] = [];

    for (const diocesis of [territorio.villaMaria, territorio.rioCuarto]) {
      for (let vez = 0; vez < 2; vez += 1) {
        const creada = await PeregrinaService.create(actor, {
          tipo: "peregrina",
          modalidad: "JOV",
          diocesisLocalidadId: diocesis.id,
        });
        codigos.push(creada.identificacion);
      }
    }

    // Both Diócesis are in Córdoba, so they share one sequence — the número
    // runs per Provincia, not per Diócesis.
    expect(codigos).toEqual([
      "CBA JOV 0001",
      "CBA JOV 0002",
      "CBA JOV 0003",
      "CBA JOV 0004",
    ]);
  });

  it("cuenta por separado cada Modalidad dentro de una misma Provincia", async () => {
    const jov = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const fam = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(jov.codigo).toBe("CBA JOV 0001");
    expect(fam.codigo).toBe("CBA FAM 0001");
  });

  it("cuenta por separado cada Provincia", async () => {
    const cba = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const neu = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(cba.codigo).toBe("CBA JOV 0001");
    expect(neu.codigo).toBe("NEU JOV 0001");
  });

  it("no regenera el Código cuando cambia el territorio", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const movida = await PeregrinaService.update(actor, creada.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    // The Código is written on the image. Moving the image does not repaint it.
    expect(movida.codigo).toBe("CBA JOV 0001");
    expect(movida.region).toBe("R. PAT");
  });

  it("el número que sigue saltea el Código que se llevó una imagen que se mudó", async () => {
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const segunda = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await PeregrinaService.update(actor, segunda.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    // "CBA JOV 0002" is still written on the image now in Neuquén.
    const tercera = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    expect(tercera.codigo).toBe("CBA JOV 0003");
  });

  it("un renombre de Provincia no toca los Códigos existentes", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await TerritorioService.renombrarProvincia(actor, {
      id: territorio.cordoba.id,
      nombre: "Córdoba Capital",
    });

    const releida = await PeregrinaService.getById(actor, creada.id);

    expect(releida.codigo).toBe("CBA JOV 0001");
    expect(releida.provincia).toBe("Córdoba Capital");
  });
});

describe("el territorio de una Peregrina", () => {
  it("llega resuelto con nombres completos, no abreviaturas", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "MAT",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(creada.diocesisLocalidad.nombre).toBe("Zapala");
    expect(creada.provincia).toBe("Neuquén");
    expect(creada.region).toBe("R. PAT");
  });

  it("no se puede crear una Peregrina en una Diócesis/Localidad inexistente", async () => {
    await expect(
      PeregrinaService.create(actor, {
        tipo: "peregrina",
        modalidad: "JOV",
        diocesisLocalidadId: "no-existe",
      })
    ).rejects.toThrow(/No existe esa Diócesis\/Localidad/);
  });

  it("no se puede crear una Peregrina en una Diócesis/Localidad dada de baja", async () => {
    await TerritorioService.darDeBajaDiocesisLocalidad(
      actor,
      territorio.chosMalal.id
    );

    await expect(
      PeregrinaService.create(actor, {
        tipo: "peregrina",
        modalidad: "JOV",
        diocesisLocalidadId: territorio.chosMalal.id,
      })
    ).rejects.toThrow(/dada de baja/);
  });

  it("tampoco se puede mover una Peregrina a una Diócesis/Localidad dada de baja", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await TerritorioService.darDeBajaDiocesisLocalidad(
      actor,
      territorio.chosMalal.id
    );

    await expect(
      PeregrinaService.update(actor, creada.id, {
        diocesisLocalidadId: territorio.chosMalal.id,
      })
    ).rejects.toThrow(/dada de baja/);

    const releida = await PeregrinaService.getById(actor, creada.id);
    expect(releida.diocesisLocalidad.id).toBe(territorio.villaMaria.id);
  });
});

describe("la Numeración anterior — ADR 0012", () => {
  async function registrarVieja(numeracionAnterior: string) {
    return PeregrinaService.create(actor, {
      numeracionAnterior,
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
  }

  it("registra la imagen por lo que ya tiene escrito, sin generarle un Código", async () => {
    const vieja = await registrarVieja("Peregrina 7 - Villa María");

    expect(vieja.codigo).toBeNull();
    expect(vieja.numeracionAnterior).toBe("Peregrina 7 - Villa María");
    expect(vieja.identificacion).toBe("Peregrina 7 - Villa María");
  });

  it("no gasta un número: la siguiente nueva sigue siendo la 0001", async () => {
    await registrarVieja("7");

    const nueva = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(nueva.codigo).toBe("CBA JOV 0001");
  });

  it("se puede repetir: dos imágenes con la misma numeración anterior", async () => {
    const una = await registrarVieja("12");
    const otra = await registrarVieja("12");

    expect(una.id).not.toBe(otra.id);
  });

  it("generarle el Código lo toma de la secuencia y conserva la numeración anterior", async () => {
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const vieja = await registrarVieja("7");

    const conCodigo = await PeregrinaService.generarCodigo(actor, vieja.id);

    expect(conCodigo.codigo).toBe("CBA JOV 0002");
    expect(conCodigo.identificacion).toBe("CBA JOV 0002");
    expect(conCodigo.numeracionAnterior).toBe("7");
  });

  it("toma la Provincia y la Modalidad de ahora, no las del alta", async () => {
    const vieja = await registrarVieja("7");
    await PeregrinaService.update(actor, vieja.id, {
      modalidad: "FAM",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const conCodigo = await PeregrinaService.generarCodigo(actor, vieja.id);

    expect(conCodigo.codigo).toBe("NEU FAM 0001");
  });

  it("no se regenera: una imagen con Código no recibe otro", async () => {
    const vieja = await registrarVieja("7");
    await PeregrinaService.generarCodigo(actor, vieja.id);

    await expect(
      PeregrinaService.generarCodigo(actor, vieja.id)
    ).rejects.toThrow(/ya tiene el Código CBA JOV 0001/);
  });

  it("se la sigue encontrando por la numeración anterior después de tener Código", async () => {
    const vieja = await registrarVieja("Rosario-12");
    await PeregrinaService.generarCodigo(actor, vieja.id);

    const porAnterior = await PeregrinaService.listFiltradas(actor, {
      identificacion: "rosario-12",
    });
    const porCodigo = await PeregrinaService.listFiltradas(actor, {
      identificacion: "cba jov 0001",
    });

    expect(porAnterior.map((p) => p.id)).toEqual([vieja.id]);
    expect(porCodigo.map((p) => p.id)).toEqual([vieja.id]);
  });

  it("las listas mezclan las dos rotulaciones en un solo orden, por Identificación", async () => {
    const nueva = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const vieja = await registrarVieja("A-1");

    const lista = await PeregrinaService.listFiltradas(actor, {});

    // "A-1" antes que "CBA JOV 0001": un solo orden, no las viejas al final.
    expect(lista.map((p) => p.id)).toEqual([vieja.id, nueva.id]);
  });
});

// ── ADR 0013: el número del Código, tipeado; editar; borrar ─────────────────

describe("el número del Código, tipeado", () => {
  it("arma el Código con la Provincia, la Modalidad y el número escrito", async () => {
    const creada = await nueva(actor, { numero: 42 });

    expect(creada.codigo).toBe("CBA JOV 0042");
    expect(creada.codigoNum).toBe(42);
  });

  it("no exige que siga al anterior: el 7 entra después del 42", async () => {
    await nueva(actor, { numero: 42 });
    const siete = await nueva(actor, { numero: 7 });

    expect(siete.codigo).toBe("CBA JOV 0007");
  });

  it("sin número, se le da el siguiente al más alto", async () => {
    await nueva(actor, { numero: 42 });
    const siguiente = await nueva(actor);

    expect(siguiente.codigo).toBe("CBA JOV 0043");
  });

  it("rechaza un Código que ya existe, y lo nombra", async () => {
    await nueva(actor, { numero: 42 });

    const intento = nueva(actor, { numero: 42 });
    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/CBA JOV 0042/);
  });

  it("el mismo número en otra Modalidad u otra Provincia no es el mismo Código", async () => {
    await nueva(actor, { numero: 42 });

    const fam = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
      numero: 42,
    });
    const neu = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
      numero: 42,
    });

    expect(fam.codigo).toBe("CBA FAM 0042");
    expect(neu.codigo).toBe("NEU JOV 0042");
  });

  it("cuenta las de otra Diócesis de la misma Provincia", async () => {
    // Río Cuarto también es Córdoba: comparte la secuencia, y el Código es único.
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.rioCuarto.id,
      numero: 9,
    });

    await expect(nueva(responsable, { numero: 9 })).rejects.toThrow(ConflictoError);
  });

  it("se le puede tipear a una imagen vieja al ponerle su Código", async () => {
    const vieja = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
      numeracionAnterior: "Peregrina 7",
    });

    const conCodigo = await PeregrinaService.generarCodigo(actor, vieja.id, 77);

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
    const creada = await nueva(actor, { numero: 1 });

    const editada = await PeregrinaService.update(actor, creada.id, {
      modalidad: "FAM",
      numero: 3,
    });

    expect(editada.codigo).toBe("CBA FAM 0003");
  });

  it("sin tocar el número, el Código queda como está escrito", async () => {
    const creada = await nueva(actor, { numero: 1 });

    const editada = await PeregrinaService.update(actor, creada.id, {
      modalidad: "FAM",
    });

    expect(editada.codigo).toBe("CBA JOV 0001");
    expect(editada.modalidad).toBe("FAM");
  });

  it("rechaza un número que ya es el Código de otra", async () => {
    await nueva(actor, { numero: 1 });
    const otra = await nueva(actor, { numero: 2 });

    await expect(
      PeregrinaService.update(actor, otra.id, { numero: 1 })
    ).rejects.toThrow(/CBA JOV 0001/);
  });

  it("volver a poner su propio número no es un duplicado", async () => {
    const creada = await nueva(actor, { numero: 1 });

    const editada = await PeregrinaService.update(actor, creada.id, {
      numero: 1,
    });

    expect(editada.codigo).toBe("CBA JOV 0001");
  });

  it("no la deja sin Código ni numeración anterior", async () => {
    const creada = await nueva(actor, { numero: 1 });

    await expect(
      PeregrinaService.update(actor, creada.id, { numero: null })
    ).rejects.toThrow(ValidacionError);
  });

  it("le saca el Código si le queda la numeración anterior", async () => {
    const creada = await nueva(actor, { numero: 1 });

    const editada = await PeregrinaService.update(actor, creada.id, {
      numero: null,
      numeracionAnterior: "Rosario-12",
    });

    expect(editada.codigo).toBeNull();
    expect(editada.identificacion).toBe("Rosario-12");
  });

  it("guarda la Fecha de consagración, y la borra con null", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
      numeracionAnterior: "7",
      fechaConsagracion: "1998-10-18",
    });
    expect(creada.fechaConsagracion).toBe("1998-10-18");

    const sinFecha = await PeregrinaService.update(actor, creada.id, {
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
  it("borra también la que tuvo historial, y la que alguien tiene ahora", async () => {
    const ana = await misionero();
    const devuelta = await nueva(responsable);
    await AsignacionService.asignar(responsable, {
      peregrinaId: devuelta.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });
    await AsignacionService.devolver(responsable, {
      peregrinaId: devuelta.id,
      notaCierre: null,
    });
    const enCasa = await nueva(responsable);
    await AsignacionService.asignar(responsable, {
      peregrinaId: enCasa.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });

    await PeregrinaService.borrar(responsable, devuelta.id);
    await PeregrinaService.borrar(responsable, enCasa.id);

    for (const id of [devuelta.id, enCasa.id]) {
      await expect(PeregrinaService.getById(actor, id)).rejects.toThrow(/No existe/);
    }
    // Su historial se fue con ella: la ficha de Ana ya no la nombra.
    const historial = await AsignacionService.historialDeMisionero(responsable, ana.id);
    expect(historial).toEqual([]);
  });

  it("libera su Código: se puede volver a cargar con el mismo número", async () => {
    const creada = await nueva(actor, { numero: 8 });
    await PeregrinaService.borrar(actor, creada.id);

    const otra = await nueva(actor, { numero: 8 });
    expect(otra.codigo).toBe("CBA JOV 0008");
  });
});

// ── ADR 0014: Extraviada es un Estado, y una Peregrina no tiene baja ───────

describe("Extraviada es un Estado", () => {
  it("una extraviada que nadie tiene sigue en el listado y en su filtro", async () => {
    const perdida = await nueva(responsable, { numero: 23 });
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    const todas = await PeregrinaService.listPagina(responsable, {});
    const extraviadas = await PeregrinaService.listPagina(responsable, {
      estado: "extraviada",
    });

    expect(todas.filas.map((p) => p.id)).toContain(perdida.id);
    expect(extraviadas.filas.map((p) => p.id)).toEqual([perdida.id]);
    expect(extraviadas.total).toBe(1);
  });

  it("el tablero cuenta las mismas extraviadas que la lista", async () => {
    const a = await nueva(actor, { numero: 23 });
    await nueva(actor, { numero: 24 });
    await PeregrinaService.update(actor, a.id, { estado: "extraviada" });

    const tablero = await TableroService.resumen(actor, { estado: "extraviada" });
    const lista = await PeregrinaService.listPagina(actor, { estado: "extraviada" });

    expect(tablero.totalPeregrinas).toBe(1);
    expect(lista.total).toBe(1);
  });

  it("su Código sigue ocupado, y la negativa dice cómo encontrarla", async () => {
    const perdida = await nueva(responsable, { numero: 23 });
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    const intento = nueva(responsable, { numero: 23 });
    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/CBA JOV 0023.*buscala por su Código/);
  });
});

describe("el uso de un territorio", () => {
  it("cuenta cada Peregrina, extraviada o no, hasta que se la mueve o se la borra", async () => {
    const ana = await misionero();
    await MisioneroService.darDeBaja(responsable, ana.id);
    const perdida = await nueva(responsable, { numero: 23 });
    await PeregrinaService.update(responsable, perdida.id, { estado: "extraviada" });

    expect(
      await TerritorioService.usoDeDiocesisLocalidad(actor, territorio.villaMaria.id),
    ).toEqual({ peregrinas: 1, misioneros: 0 });
    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(actor, territorio.villaMaria.id),
    ).rejects.toThrow();

    await PeregrinaService.borrar(responsable, perdida.id);

    const retirada = await TerritorioService.darDeBajaDiocesisLocalidad(
      actor,
      territorio.villaMaria.id,
    );
    expect(retirada.deBaja).toBe(true);
  });
});
