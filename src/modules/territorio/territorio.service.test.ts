import { beforeEach, describe, expect, it } from "vitest";
import { TerritorioService } from "./territorio.service";
import { REGIONES } from "./territorio.schema";
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

describe("resolución de territorio", () => {
  it("resuelve una Diócesis/Localidad a su Provincia y su Región", async () => {
    const resuelta = await TerritorioService.obtenerDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );

    expect(resuelta).not.toBeNull();
    expect(resuelta?.nombre).toBe("Villa María");
    expect(resuelta?.provincia.nombre).toBe("Córdoba");
    expect(resuelta?.region).toBe("CENTRO");
  });

  it("resuelve una Diócesis de otra Región a esa otra Región", async () => {
    // The whole point of deriving Región by traversal: it cannot disagree.
    const resuelta = await TerritorioService.obtenerDiocesisLocalidad(
      asesor,
      territorio.zapala.id
    );

    expect(resuelta?.provincia.nombre).toBe("Neuquén");
    expect(resuelta?.region).toBe("R. PAT");
  });

  it("devuelve null para una Diócesis/Localidad que no existe", async () => {
    expect(
      await TerritorioService.obtenerDiocesisLocalidad(asesor, "no-existe")
    ).toBeNull();
  });
});

describe("las listas de selección respetan el territorio del Actor", () => {
  it("un Asesor Nacional ve todo el país", async () => {
    const lista = await TerritorioService.listarDiocesisLocalidades(asesor);

    expect(lista.map((d) => d.nombre).sort()).toEqual([
      "Chos Malal",
      "Río Cuarto",
      "Villa María",
      "Zapala",
    ]);
  });

  it("un Responsable Diocesano ve su Provincia y NO ve las demás", async () => {
    const responsable = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const lista = await TerritorioService.listarDiocesisLocalidades(responsable);
    const nombres = lista.map((d) => d.nombre);

    expect(nombres.sort()).toEqual(["Río Cuarto", "Villa María"]);
    // The negative half is the test.
    expect(nombres).not.toContain("Zapala");
    expect(nombres).not.toContain("Chos Malal");
  });

  it("un Referente Local ve su Provincia y NO ve las demás", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const lista = await TerritorioService.listarDiocesisLocalidades(referente);
    const nombres = lista.map((d) => d.nombre);

    expect(nombres.sort()).toEqual(["Chos Malal", "Zapala"]);
    expect(nombres).not.toContain("Villa María");
    expect(nombres).not.toContain("Río Cuarto");
  });

  it("pedir explícitamente otra Provincia no amplía el alcance", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const lista = await TerritorioService.listarDiocesisLocalidades(referente, {
      provinciaId: territorio.cordoba.id,
    });

    expect(lista).toEqual([]);
  });

  it("un Referente Local ve solo su propia Provincia en la lista de Provincias", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const provincias = await TerritorioService.listarProvincias(referente);

    expect(provincias.map((p) => p.nombre)).toEqual(["Córdoba"]);
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

describe("una Región no es editable", () => {
  it("expone las siete Regiones de la Campaña, iguales para todo Actor", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(TerritorioService.listarRegiones(asesor)).toEqual([
      "NOA",
      "CENTRO",
      "CUYO",
      "NEA",
      "BS. AS",
      "R. PAM",
      "R. PAT",
    ]);
    expect(TerritorioService.listarRegiones(referente)).toEqual(REGIONES);
  });

  it("no ofrece ningún método para crear, renombrar o dar de baja una Región", () => {
    // Región is structure, not reference data. The absence is the guarantee, so
    // it is asserted rather than left to a reviewer to notice.
    const superficie = Object.getOwnPropertyNames(TerritorioService);
    const escrituraDeRegion = superficie.filter(
      (m) => /region/i.test(m) && !/^listar/.test(m)
    );

    expect(escrituraDeRegion).toEqual([]);
  });

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

  it("un Asesor Nacional puede crear una Provincia", async () => {
    const creada = await TerritorioService.crearProvincia(asesor, entradaProvincia);

    expect(creada.nombre).toBe("Santa Fe");
  });

  it("un admin puede crear una Provincia", async () => {
    const admin = await crearActor({ rol: "admin" });

    const creada = await TerritorioService.crearProvincia(admin, entradaProvincia);

    expect(creada.nombre).toBe("Santa Fe");
  });

  it("un Responsable Diocesano NO puede crear una Provincia", async () => {
    const responsable = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      TerritorioService.crearProvincia(responsable, entradaProvincia)
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      TerritorioService.crearProvincia(responsable, entradaProvincia)
    ).rejects.toThrow(/No tenés permisos/);
  });

  it("un Referente Local NO puede crear una Diócesis/Localidad", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      TerritorioService.crearDiocesisLocalidad(referente, {
        nombre: "Alta Gracia",
        provinciaId: territorio.cordoba.id,
        region: "CENTRO",
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Responsable Diocesano NO puede renombrar ni dar de baja un territorio", async () => {
    const responsable = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      TerritorioService.renombrarDiocesisLocalidad(responsable, {
        id: territorio.villaMaria.id,
        nombre: "Villa Maria Nueva",
      })
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      TerritorioService.darDeBajaDiocesisLocalidad(
        responsable,
        territorio.villaMaria.id
      )
    ).rejects.toThrow(NoAutorizadoError);

    // And the list is genuinely untouched, not merely reported as refused.
    const sinCambios = await TerritorioService.obtenerDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );
    expect(sinCambios?.nombre).toBe("Villa María");
    expect(sinCambios?.deBaja).toBe(false);
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
    await TerritorioService.renombrarDiocesisLocalidad(asesor, {
      id: territorio.villaMaria.id,
      nombre: "Villa María del Río Seco",
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

describe("resolver texto libre sobre datos de referencia", () => {
  it.each([
    ["Córdoba", "Villa María"],
    ["córdoba", "villa maría"],
    ["CORDOBA", "VILLA MARIA"],
    ["  Cordoba  ", "  Villa Maria  "],
    ["Cordoba", "Villa María"],
  ])("mapea «%s / %s» al registro correcto", async (prov, dioc) => {
    const encontrada = await TerritorioService.buscarPorNombre(asesor, {
      provincia: prov,
      diocesisLocalidad: dioc,
    });

    expect(encontrada.id).toBe(territorio.villaMaria.id);
    expect(encontrada.provincia.nombre).toBe("Córdoba");
    expect(encontrada.region).toBe("CENTRO");
  });

  it("informa una Provincia desconocida por su nombre en vez de descartarla", async () => {
    await expect(
      TerritorioService.buscarPorNombre(asesor, {
        provincia: "Provincia Inventada",
        diocesisLocalidad: "Villa María",
      })
    ).rejects.toThrow(/Provincia Inventada/);
  });

  it("informa una Diócesis/Localidad desconocida por su nombre y su Provincia", async () => {
    await expect(
      TerritorioService.buscarPorNombre(asesor, {
        provincia: "Córdoba",
        diocesisLocalidad: "Pueblo Que No Existe",
      })
    ).rejects.toThrow(/Pueblo Que No Existe.*Córdoba/);
  });

  it("no cruza Provincias: una Diócesis real bajo la Provincia equivocada no resuelve", async () => {
    await expect(
      TerritorioService.buscarPorNombre(asesor, {
        provincia: "Neuquén",
        diocesisLocalidad: "Villa María",
      })
    ).rejects.toThrow(/No existe la Diócesis\/Localidad/);
  });

  it("no inventa registros al no encontrar coincidencia", async () => {
    const antes = await TerritorioService.listarDiocesisLocalidades(asesor);

    await TerritorioService.buscarPorNombre(asesor, {
      provincia: "Córdoba",
      diocesisLocalidad: "Pueblo Que No Existe",
    }).catch(() => null);

    const despues = await TerritorioService.listarDiocesisLocalidades(asesor);
    expect(despues).toHaveLength(antes.length);
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

    const resuelta = await TerritorioService.obtenerDiocesisLocalidad(
      asesor,
      nueva.id
    );

    expect(resuelta?.region).toBe("R. PAT");
  });
});
