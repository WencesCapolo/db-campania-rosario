import { beforeEach, describe, expect, it } from "vitest";
import { TerritorioService } from "./territorio.service";
import {
  crearActor,
  crearDiocesisLocalidad,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

describe("las listas de selección", () => {
  it("un Asesor Nacional ve todo el país", async () => {
    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);

    expect(lista.map((d) => d.nombre).sort()).toEqual([
      "Chos Malal",
      "Río Cuarto",
      "Villa María",
      "Zapala",
    ]);
  });
  it("no ofrece una Diócesis/Localidad dada de baja", async () => {
    const baja = await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.chosMalal.id
    );
    expect(baja.deBaja).toBe(true);

    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);

    expect(lista.map((d) => d.nombre)).not.toContain("Chos Malal");
  });
});

describe("renombrar una Provincia", () => {
  it("renombrar una Provincia no cambia su abreviatura", async () => {
    const provincia = await TerritorioService.renombrarProvincia(asesor, {
      id: territorio.cordoba.id,
      nombre: "Córdoba Capital",
    });

    expect(provincia.nombre).toBe("Córdoba Capital");
    expect(provincia.abreviatura).toBe("CBA");
  });
});

describe("dar de baja un territorio en uso", () => {
  it("se rechaza mientras una Peregrina lo referencia, y dice cuántas", async () => {
    await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
    });

    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(asesor, territorio.villaMaria.id)
    ).rejects.toThrow(/1 Peregrina/);
  });

  it("se rechaza mientras un Misionero lo referencia", async () => {
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.rioCuarto.id,
      createdById: asesor.id,
    });

    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(asesor, territorio.rioCuarto.id)
    ).rejects.toThrow(/1 Misionero/);
  });

  it("se acepta cuando nada lo referencia", async () => {
    const baja = await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );

    expect(baja.deBaja).toBe(true);
  });

  it("rechaza dar de baja una Provincia cuyas Diócesis están en uso", async () => {
    await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.zapala.id,
      createdById: asesor.id,
    });

    await expect(
      TerritorioService.darDeBajaProvincia(asesor, territorio.neuquen.id)
    ).rejects.toThrow(/todavía la usan/);
  });

  it("informa el uso antes de cambiar nada — historia de usuario 10", async () => {
    await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
    });
    await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
    });
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
    });

    const uso = await TerritorioService.usoDeDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );

    expect(uso).toEqual({ peregrinas: 2, misioneros: 1 });
  });
});

describe("autorización de escritura", () => {
  const entradaProvincia = {
    nombre: "Santa Fe",
    abreviatura: "SFE",
    region: "CENTRO",
  } as const;

  it("un admin puede crear una Provincia", async () => {
    const admin = await crearActor({ rol: "admin" });

    const creada = await TerritorioService.crearProvincia(admin, entradaProvincia);

    expect(creada.nombre).toBe("Santa Fe");
  });

  it("un Dirigente Joven NO puede crear una Diócesis/Localidad", async () => {
    const dirigente = await crearActor({ rol: "dirigente_joven" });

    await expect(
      TerritorioService.crearDiocesisLocalidad(dirigente, {
        nombre: "Alta Gracia",
        provinciaId: territorio.cordoba.id,
        region: "CENTRO",
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Responsable Diocesano NO puede renombrar ni dar de baja un territorio", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    await expect(
      TerritorioService.editarDiocesisLocalidad(responsable, {
        id: territorio.villaMaria.id,
        nombre: "Villa Maria Nueva",
        region: "NOA",
      })
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(
        responsable,
        territorio.villaMaria.id
      )
    ).rejects.toThrow(NoAutorizadoError);

    // And the list is genuinely untouched, not merely reported as refused.
    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);
    const sinCambios = lista.find((d) => d.id === territorio.villaMaria.id);
    expect(sinCambios?.nombre).toBe("Villa María");
    expect(sinCambios?.region).toBe("CENTRO");
  });
});

describe("crear y renombrar territorio", () => {
  it("un Asesor Nacional agrega una Diócesis/Localidad y queda disponible el mismo día", async () => {
    const creada = await TerritorioService.crearDiocesisLocalidad(asesor, {
      nombre: "Alta Gracia",
      provinciaId: territorio.cordoba.id,
      region: "CENTRO",
    });

    expect(creada.provincia.nombre).toBe("Córdoba");
    expect(creada.region).toBe("CENTRO");

    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);
    expect(lista.map((d) => d.nombre)).toContain("Alta Gracia");
  });

  it("rechaza una Diócesis/Localidad duplicada en la misma Provincia, ignorando tildes y mayúsculas", async () => {
    await expect(
      TerritorioService.crearDiocesisLocalidad(asesor, {
        nombre: "  villa maria ",
        provinciaId: territorio.cordoba.id,
        region: "CENTRO",
      })
    ).rejects.toThrow(/Ya existe/);
  });

  it("acepta el mismo nombre de Diócesis/Localidad en otra Provincia", async () => {
    const creada = await TerritorioService.crearDiocesisLocalidad(asesor, {
      nombre: "Villa María",
      provinciaId: territorio.neuquen.id,
      region: "R. PAT",
    });

    expect(creada.provincia.nombre).toBe("Neuquén");
  });

  it("rechaza una Provincia duplicada", async () => {
    await expect(
      TerritorioService.crearProvincia(asesor, {
        nombre: "cordoba",
        abreviatura: "CDA",
      })
    ).rejects.toThrow(/Ya existe/);
  });

  it("el renombre se propaga a donde el nombre se muestre", async () => {
    await TerritorioService.editarDiocesisLocalidad(asesor, {
      id: territorio.villaMaria.id,
      nombre: "Villa María del Río Seco",
      region: "CENTRO",
    });

    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);
    const nombres = lista.map((d) => d.nombre);

    expect(nombres).toContain("Villa María del Río Seco");
    expect(nombres).not.toContain("Villa María");
  });

  it("no permite agregar una Diócesis/Localidad a una Provincia dada de baja", async () => {
    await TerritorioService.darDeBajaProvincia(asesor, territorio.neuquen.id);

    await expect(
      TerritorioService.crearDiocesisLocalidad(asesor, {
        nombre: "Junín de los Andes",
        provinciaId: territorio.neuquen.id,
        region: "R. PAT",
      })
    ).rejects.toThrow(/dada de baja/);
  });
});

describe("la Región es de la Diócesis, no de la Provincia", () => {
  /**
   * The Campaña's own list is the reason this changed. Santa Fe holds
   * Reconquista in NEA and Rosario in CENTRO; Buenos Aires holds the conurbano
   * in BS. AS and La Plata in R. PAM. Región used to be a column on Provincia,
   * which made those pairs impossible to represent and filed eight real
   * Diócesis under the wrong Región.
   */
  it("dos Diócesis de la misma Provincia pueden estar en Regiones distintas", async () => {
    const santaFe = await TerritorioService.crearProvincia(asesor, {
      nombre: "Santa Fe",
      abreviatura: "SFE",
    });

    const reconquista = await TerritorioService.crearDiocesisLocalidad(asesor, {
      nombre: "Reconquista",
      provinciaId: santaFe.id,
      region: "NEA",
    });
    const rosario = await TerritorioService.crearDiocesisLocalidad(asesor, {
      nombre: "Arq. Rosario",
      provinciaId: santaFe.id,
      region: "CENTRO",
    });

    expect(reconquista.region).toBe("NEA");
    expect(rosario.region).toBe("CENTRO");
    expect(reconquista.provincia.id).toBe(rosario.provincia.id);
  });

  it("la Región elegida sobrevive a la lectura", async () => {
    const nueva = await crearDiocesisLocalidad({
      nombre: "San Martín de los Andes",
      provinciaId: territorio.neuquen.id,
      region: "R. PAT",
    });

    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);
    const resuelta = lista.find((d) => d.id === nueva.id);

    expect(resuelta?.provincia.nombre).toBe("Neuquén");
    expect(resuelta?.region).toBe("R. PAT");
  });
});
