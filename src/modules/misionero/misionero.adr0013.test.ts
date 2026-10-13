import { beforeEach, describe, expect, it } from "vitest";
import { MisioneroService } from "./misionero.service";
import { MatrimonioService } from "./matrimonio.service";
import { createMisioneroSchema } from "./misionero.types";
import {
  crearActor,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ValidacionError } from "@/lib/errors";

/**
 * ADR 0013 del lado de las personas: la Fecha de consagración reemplaza al año,
 * el email es opcional, y los datos de un Misionero se corrigen después.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

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

  it("el esquema rechaza un email que no es un email", () => {
    const r = createMisioneroSchema.safeParse({
      nombre: "Ana",
      apellido: "Álvarez",
      email: "ana-arroba-ejemplo",
      diocesisLocalidadId: "x",
    });
    expect(r.success).toBe(false);
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
