import { beforeEach, describe, expect, it } from "vitest";
import { TableroService } from "@/modules/tablero/tablero.service";
import { PeregrinaService } from "./peregrina.service";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import {
  crearActor,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";

let territorio: TerritorioDePrueba;
let actor: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  actor = await crearActor({ rol: "asesor_nacional" });
});

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

  it("agrupa el tablero por Provincia a través de la Diócesis", async () => {
    for (const diocesis of [
      territorio.villaMaria,
      territorio.rioCuarto,
      territorio.zapala,
    ]) {
      await PeregrinaService.create(actor, {
        tipo: "peregrina",
        modalidad: "JOV",
        diocesisLocalidadId: diocesis.id,
      });
    }

    const { porProvincia } = await TableroService.resumen(actor);

    // Villa María y Río Cuarto son Córdoba; Zapala es Neuquén. La imagen no
    // guarda su Provincia: sale de la Diócesis (ADR 0005).
    expect(porProvincia?.map(({ nombre, total }) => ({ nombre, total }))).toEqual([
      { nombre: "Córdoba", total: 2 },
      { nombre: "Neuquén", total: 1 },
    ]);
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

  it("no se le genera Código a una imagen dada de baja", async () => {
    const vieja = await registrarVieja("7");
    await PeregrinaService.darDeBaja(actor, vieja.id);

    await expect(
      PeregrinaService.generarCodigo(actor, vieja.id)
    ).rejects.toThrow(/dada de baja/);
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
