import { beforeEach, describe, expect, it } from "vitest";
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
        codigos.push(creada.codigo);
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

  it("agrupa el tablero por Región recorriendo el territorio", async () => {
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

    const { byRegion } = await PeregrinaService.dashboardStats(actor);

    expect(
      [...byRegion].sort((a, b) => a.region.localeCompare(b.region))
    ).toEqual([
      // Three Regiones from two Provincias: Villa María is CENTRO and Río
      // Cuarto is CUYO, though both are in Córdoba. Grouping through the
      // Provincia would collapse these two into one row of 2.
      { region: "CENTRO", count: 1 },
      { region: "CUYO", count: 1 },
      { region: "R. PAT", count: 1 },
    ]);
  });
});
