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
    const result = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // "CBA" lives on the Provincia record for Córdoba.
    expect(result.data.codigo).toBe("CBA JOV 0001");
  });

  it("sigue la secuencia por par Provincia + Modalidad", async () => {
    const codigos: string[] = [];

    for (const diocesis of [territorio.villaMaria, territorio.rioCuarto]) {
      for (let vez = 0; vez < 2; vez += 1) {
        const result = await PeregrinaService.create(actor, {
          tipo: "peregrina",
          modalidad: "JOV",
          diocesisLocalidadId: diocesis.id,
        });
        if (result.ok) codigos.push(result.data.codigo);
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

    expect(jov.ok && jov.data.codigo).toBe("CBA JOV 0001");
    expect(fam.ok && fam.data.codigo).toBe("CBA FAM 0001");
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

    expect(cba.ok && cba.data.codigo).toBe("CBA JOV 0001");
    expect(neu.ok && neu.data.codigo).toBe("NEU JOV 0001");
  });

  it("no regenera el Código cuando cambia el territorio", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    expect(creada.ok).toBe(true);
    if (!creada.ok) return;

    const movida = await PeregrinaService.update(actor, creada.data.id, {
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(movida.ok).toBe(true);
    if (!movida.ok) return;
    // The Código is written on the image. Moving the image does not repaint it.
    expect(movida.data.codigo).toBe("CBA JOV 0001");
    expect(movida.data.region).toBe("R. PAT");
  });

  it("un renombre de Provincia no toca los Códigos existentes", async () => {
    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    if (!creada.ok) return;

    await TerritorioService.renombrarProvincia(actor, {
      id: territorio.cordoba.id,
      nombre: "Córdoba Capital",
    });

    const releida = await PeregrinaService.getById(creada.data.id);

    expect(releida.codigo).toBe("CBA JOV 0001");
    expect(releida.provincia).toBe("Córdoba Capital");
  });
});

describe("el territorio de una Peregrina", () => {
  it("llega resuelto con nombres completos, no abreviaturas", async () => {
    const result = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "INF",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.diocesisLocalidad.nombre).toBe("Zapala");
    expect(result.data.provincia).toBe("Neuquén");
    expect(result.data.region).toBe("R. PAT");
  });

  it("no se puede crear una Peregrina en una Diócesis/Localidad inexistente", async () => {
    const result = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: "no-existe",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("No existe esa Diócesis/Localidad");
  });

  it("no se puede crear una Peregrina en una Diócesis/Localidad dada de baja", async () => {
    await TerritorioService.darDeBajaDiocesisLocalidad(
      actor,
      territorio.chosMalal.id
    );

    const result = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.chosMalal.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("dada de baja");
  });

  it("agrupa el tablero por Región recorriendo el territorio", async () => {
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });
    await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const { byRegion } = await PeregrinaService.dashboardStats();

    expect(
      [...byRegion].sort((a, b) => a.region.localeCompare(b.region))
    ).toEqual([
      { region: "CENTRO", count: 2 },
      { region: "R. PAT", count: 1 },
    ]);
  });
});
