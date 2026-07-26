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
  // A Referente Local now has to *have* a territory — a lower rol without one is
  // refused rather than treated as country-wide. Córdoba, so the Neuquén
  // fixtures stay out of reach and the scoping suite has something to prove.
  actor = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.rioCuarto.id,
  });
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
    const creado = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    expect(creado.diocesisLocalidad.nombre).toBe("Río Cuarto");
    expect(creado.provincia).toBe("Córdoba");
    expect(creado.region).toBe("CENTRO");
  });

  it("no se puede registrar un Misionero en una Diócesis/Localidad inexistente", async () => {
    await expect(
      MisioneroService.create(actor, {
        ...juan,
        diocesisLocalidadId: "no-existe",
      })
    ).rejects.toThrow(/No existe esa Diócesis\/Localidad/);
  });

  it("no se puede registrar un Misionero en una Diócesis/Localidad dada de baja", async () => {
    const asesor = await crearActor({ rol: "asesor_nacional" });
    await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.chosMalal.id
    );

    await expect(
      MisioneroService.create(asesor, {
        ...juan,
        diocesisLocalidadId: territorio.chosMalal.id,
      })
    ).rejects.toThrow(/dada de baja/);
  });

  it("un renombre de territorio se ve al releer el Misionero", async () => {
    const asesor = await crearActor({ rol: "asesor_nacional" });
    const creado = await MisioneroService.create(asesor, {
      ...juan,
      diocesisLocalidadId: territorio.zapala.id,
    });

    await TerritorioService.renombrarDiocesisLocalidad(asesor, {
      id: territorio.zapala.id,
      nombre: "Zapala Centro",
    });

    const releido = await MisioneroService.getById(asesor, creado.id);

    expect(releido.diocesisLocalidad.nombre).toBe("Zapala Centro");
  });

  it("busca por Diócesis/Localidad ignorando mayúsculas", async () => {
    const asesor = await crearActor({ rol: "asesor_nacional" });
    await MisioneroService.create(asesor, {
      ...juan,
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const encontrados = await MisioneroService.search(asesor, "villa mar");

    expect(encontrados).toHaveLength(1);
    expect(encontrados[0]?.apellido).toBe("Gómez");
  });
});
