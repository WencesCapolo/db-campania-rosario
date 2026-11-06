import { beforeEach, describe, expect, it } from "vitest";
import { MisioneroService } from "./misionero.service";
import { MatrimonioService } from "./matrimonio.service";
import { createMisioneroSchema } from "./misionero.types";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import {
  crearActor,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ValidacionError } from "@/lib/errors";

let territorio: TerritorioDePrueba;
let actor: CurrentUser;
let asesor: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  actor = await crearActor({ rol: "responsable_diocesano" });
  asesor = await crearActor({ rol: "asesor_nacional" });
});

const juan = {
  nombre: "Juan",
  apellido: "Gómez",
  telefono: null,
  centroTipo: null,
  centroNombre: null,
  fechaConsagracion: null,
};

describe("el territorio de un Misionero", () => {
  it("se elige una vez, y la Provincia y la Región salen de esa Diócesis", async () => {
    const creado = await MisioneroService.create(actor, {
      ...juan,
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    expect(creado.diocesisLocalidad.nombre).toBe("Río Cuarto");
    expect(creado.provincia).toBe("Córdoba");
    // CUYO, not CENTRO — and the fixture makes them differ on purpose. Río
    // Cuarto and Villa María are both in Córdoba and in different Regiones,
    // because that is the shape the Campaña's real list has (Santa Fe spans
    // NEA and CENTRO). A Región read off the Provincia would say CENTRO here.
    expect(creado.region).toBe("CUYO");
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

  it("tampoco se puede mover un Misionero a una Diócesis/Localidad dada de baja", async () => {
    const creado = await MisioneroService.create(asesor, {
      ...juan,
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.chosMalal.id
    );

    await expect(
      MisioneroService.update(asesor, creado.id, {
        diocesisLocalidadId: territorio.chosMalal.id,
      })
    ).rejects.toThrow(/dada de baja/);

    const releido = await MisioneroService.getById(asesor, creado.id);
    expect(releido.diocesisLocalidad.id).toBe(territorio.villaMaria.id);
  });

  it("un renombre de territorio se ve al releer el Misionero", async () => {
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
});

// ── ADR 0013: email, Fecha de consagración, y corregir después ──────────────

describe("el email y la Fecha de consagración de un Misionero", () => {
  it("se guardan al cargarlo, el email en minúsculas", async () => {
    const parsed = createMisioneroSchema.parse({
      nombre: "Ana",
      apellido: "Álvarez",
      email: " Ana@Ejemplo.COM ",
      fechaConsagracion: "1998-10-18",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const ana = await MisioneroService.create(asesor, parsed);

    expect(ana.email).toBe("ana@ejemplo.com");
    expect(ana.fechaConsagracion).toBe("1998-10-18");
  });

  it("se corrigen después, y null los borra", async () => {
    const ana = await MisioneroService.create(asesor, {
      nombre: "Ana",
      apellido: "Álvarez",
      email: "ana@ejemplo.com",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const corregida = await MisioneroService.update(asesor, ana.id, {
      apellido: "Benítez",
      email: null,
      fechaConsagracion: "2001-05-02",
    });

    expect(corregida.apellido).toBe("Benítez");
    expect(corregida.email).toBeNull();
    expect(corregida.fechaConsagracion).toBe("2001-05-02");
  });
});

describe("un Misionero casado", () => {
  async function pareja() {
    return MatrimonioService.create(asesor, {
      nombreA: "Ana",
      apellidoA: "Álvarez",
      emailA: "ana@ejemplo.com",
      nombreB: "Juan",
      apellidoB: "Benítez",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
  }

  it("corrige sus datos propios desde su ficha", async () => {
    const { misioneroA } = await pareja();

    const corregida = await MisioneroService.update(asesor, misioneroA.id, {
      telefono: "353 555 0100",
    });

    expect(corregida.telefono).toBe("353 555 0100");
    expect(corregida.email).toBe("ana@ejemplo.com");
  });

  it("no se muda solo: el territorio es de la casa", async () => {
    const { misioneroA } = await pareja();

    await expect(
      MisioneroService.update(asesor, misioneroA.id, {
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(ValidacionError);
  });

  it("la ficha sabe de qué matrimonio es", async () => {
    const casa = await pareja();

    expect(await MisioneroService.matrimonioActivo(asesor, casa.misioneroB.id)).toBe(
      casa.id
    );
  });
});
