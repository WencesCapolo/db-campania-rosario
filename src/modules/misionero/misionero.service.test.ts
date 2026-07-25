import { beforeEach, describe, expect, it } from "vitest";
import { MisioneroService } from "./misionero.service";
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
  actor = await crearActor({ rol: "referente_local" });
});

const juan = {
  nombre: "Juan",
  apellido: "Gómez",
  telefono: null,
  centroTipo: null,
  centroNombre: null,
  anioConsagracion: null,
};

describe("el territorio de un Misionero", () => {
  it("se elige una vez y la Provincia y la Región se derivan", async () => {
    const result = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.diocesisLocalidad.nombre).toBe("Río Cuarto");
    expect(result.data.provincia).toBe("Córdoba");
    expect(result.data.region).toBe("CENTRO");
  });

  it("no se puede registrar un Misionero en una Diócesis/Localidad inexistente", async () => {
    const result = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: "no-existe",
    });

    expect(result.ok).toBe(false);
  });

  it("no se puede registrar un Misionero en una Diócesis/Localidad dada de baja", async () => {
    const asesor = await crearActor({ rol: "asesor_nacional" });
    await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.chosMalal.id
    );

    const result = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.chosMalal.id,
    });

    expect(result.ok).toBe(false);
  });

  it("un renombre de territorio se ve al releer el Misionero", async () => {
    const asesor = await crearActor({ rol: "asesor_nacional" });
    const creado = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.zapala.id,
    });
    if (!creado.ok) return;

    await TerritorioService.renombrarDiocesisLocalidad(asesor, {
      id: territorio.zapala.id,
      nombre: "Zapala Centro",
    });

    const releido = await MisioneroService.getById(creado.data.id);

    expect(releido.diocesisLocalidad.nombre).toBe("Zapala Centro");
  });

  it("busca por Diócesis/Localidad ignorando mayúsculas", async () => {
    await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const encontrados = await MisioneroService.search("villa mar");

    expect(encontrados).toHaveLength(1);
    expect(encontrados[0]?.apellido).toBe("Gómez");
  });
});
