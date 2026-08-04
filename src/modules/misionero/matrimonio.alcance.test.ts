import { beforeEach, describe, expect, it } from "vitest";
import { MatrimonioService } from "./matrimonio.service";
import { MisioneroService } from "./misionero.service";
import { MatrimonioRepository } from "./matrimonio.repository";
import { MisioneroRepository } from "./misionero.repository";
import { derivarAlcance } from "@/lib/authorization/alcance";
import { NoAutorizadoError, NoEncontradoError } from "@/lib/errors";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import type { TenedorDTO } from "./matrimonio.types";

/**
 * El Matrimonio: un Tenedor, no dos personas — ADR 0010.
 *
 * Two suites in one file, because they fail the same way. The territorial half
 * is the one CLAUDE.md §7 says must never be skipped: a Matrimonio has no
 * territory column, so its scope is spouse A's, and a leg of the union that
 * forgot to apply it would expose a household from another Diócesis.
 *
 * The other half is the mitigation ADR 0010 asks for by name. A read that joins
 * the misionero leg and forgets the matrimonio leg returns **fewer rows and no
 * error** — a couple simply vanishes from a list. Silence is the failure mode,
 * and silence needs a test rather than a reviewer.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

function etiquetas(filas: TenedorDTO[]): string[] {
  return filas.map((f) =>
    f.tipo === "persona"
      ? `${f.persona.apellido}, ${f.persona.nombre}`
      : `${f.matrimonio.misioneroA.apellido}, ${f.matrimonio.misioneroA.nombre}` +
        ` y ${f.matrimonio.misioneroB.apellido}, ${f.matrimonio.misioneroB.nombre}`
  );
}

async function crearAlvarezBenitez(diocesisLocalidadId: string) {
  return MatrimonioService.create(asesor, {
    nombreA: "Ana",
    apellidoA: "Álvarez",
    anioConsagracionA: 1998,
    nombreB: "Juan",
    apellidoB: "Benítez",
    anioConsagracionB: 2001,
    diocesisLocalidadId,
    telefonoA: "353-555-0100",
  });
}

/**
 * The couple the *ordering* assertions use, and its surnames are plain ASCII on
 * purpose.
 *
 * The suite's Postgres is `postgres:17-alpine`, and musl has no locale data, so
 * `en_US.utf8` collates byte by byte: "Álvarez" sorts after "Zárate" there and
 * before it under glibc. That is a property of the container and not of this
 * feature — the pre-existing `/misionero` order has always had it — so the rows
 * are ordered here with names the two collations agree about, and the accented
 * pair above is kept for the search, which is where accents actually matter.
 */
async function crearBenegasCardozo(diocesisLocalidadId: string) {
  return MatrimonioService.create(asesor, {
    nombreA: "Rosa",
    apellidoA: "Benegas",
    nombreB: "Luis",
    apellidoB: "Cardozo",
    diocesisLocalidadId,
  });
}

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

describe("un matrimonio se entra de una vez", () => {
  it("crea dos Misioneros y un Matrimonio, con el mismo territorio", async () => {
    const pareja = await crearAlvarezBenitez(territorio.villaMaria.id);

    expect(pareja.misioneroA.apellido).toBe("Álvarez");
    expect(pareja.misioneroB.apellido).toBe("Benítez");

    // The invariant everything downstream leans on: the couple's Alcance, its
    // Región and its place in the listado are all read off spouse A, and that is
    // only well defined because both spouses carry the same Diócesis.
    expect(pareja.misioneroA.diocesisLocalidad.id).toBe(
      pareja.misioneroB.diocesisLocalidad.id
    );

    // Each spouse keeps their own año — two people are consecrated in two
    // different years, which is why the couple could not be one row.
    expect(pareja.misioneroA.anioConsagracion).toBe(1998);
    expect(pareja.misioneroB.anioConsagracion).toBe(2001);

    // A number each, both optional. Here only the first was given, which is the
    // common case: somebody has one number written down for the household.
    expect(pareja.misioneroA.telefono).toBe("353-555-0100");
    expect(pareja.misioneroB.telefono).toBeNull();
  });

  it("un territorio fuera del alcance se rechaza", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      MatrimonioService.create(referente, {
        nombreA: "Ana",
        apellidoA: "Álvarez",
        nombreB: "Juan",
        apellidoB: "Benítez",
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("el listado colapsa el hogar en una fila", () => {
  it("la pareja aparece una vez y ninguno de los dos por separado", async () => {
    await crearBenegasCardozo(territorio.villaMaria.id);
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
      nombre: "Carla",
      apellido: "Zarate",
    });

    const pagina = await MisioneroService.listPagina(asesor, {}, 1);

    // Two Misioneros and one individual make **two** rows, sorted by spouse A's
    // apellido like any other. Neither Benegas nor Cardozo appears alone.
    expect(pagina.total).toBe(2);
    expect(etiquetas(pagina.filas)).toEqual([
      "Benegas, Rosa y Cardozo, Luis",
      "Zarate, Carla",
    ]);
  });

  it("la cifra vale lo mismo que las filas que hay detrás del enlace", async () => {
    await crearAlvarezBenitez(territorio.villaMaria.id);

    const alcance = derivarAlcance(asesor, "prueba");
    const total = await MisioneroRepository.contarTotal(alcance, {});
    const porRegion = await MisioneroRepository.contarPorRegion(alcance, {});
    const porEstado = await MisioneroRepository.contarPorEstado(alcance, {});

    // Two people, one Tenedor. A figure that counted the spouses would say two
    // and the list behind it would show one.
    expect(total).toBe(1);
    expect(porRegion).toEqual([{ region: "CENTRO", total: 1 }]);
    expect(porEstado).toEqual([{ estado: "activo", total: 1 }]);
  });

  it("buscar por cualquiera de los dos apellidos encuentra el hogar", async () => {
    await crearAlvarezBenitez(territorio.villaMaria.id);

    for (const termino of ["álvarez", "BENÍTEZ", "juan", "ana"]) {
      const pagina = await MisioneroService.listPagina(
        asesor,
        { q: termino },
        1
      );
      expect(pagina.total, termino).toBe(1);
      expect(etiquetas(pagina.filas), termino).toEqual([
        "Álvarez, Ana y Benítez, Juan",
      ]);
    }
  });

  it("dar de baja el Matrimonio devuelve a los dos a la lista", async () => {
    const pareja = await crearBenegasCardozo(territorio.villaMaria.id);

    await MatrimonioService.baja(asesor, pareja.id);

    const pagina = await MisioneroService.listPagina(asesor, {}, 1);

    // No code does this on purpose: the roster's `not exists (active marriage)`
    // clause simply stops matching them.
    expect(pagina.total).toBe(2);
    expect(etiquetas(pagina.filas)).toEqual(["Benegas, Rosa", "Cardozo, Luis"]);
  });
});

describe("el alcance sobrevive a la unión", () => {
  it("un Referente Local no ve el hogar de otra Diócesis por ninguna pata", async () => {
    await crearAlvarezBenitez(territorio.rioCuarto.id);
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
      nombre: "Carla",
      apellido: "Zárate",
    });

    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const pagina = await MisioneroService.listPagina(referente, {}, 1);
    expect(pagina.total).toBe(1);
    expect(etiquetas(pagina.filas)).toEqual(["Zárate, Carla"]);

    // Asserted as a negative too: neither surname reaches across the border, and
    // neither does the count behind the tablero's card.
    const buscado = await MisioneroService.listPagina(
      referente,
      { q: "benítez" },
      1
    );
    expect(buscado).toMatchObject({ total: 0, filas: [] });

    const alcance = derivarAlcance(referente, "prueba");
    expect(await MisioneroRepository.contarTotal(alcance, {})).toBe(1);
  });

  it("leer un Matrimonio ajeno se rechaza, y uno inexistente se distingue", async () => {
    const pareja = await crearAlvarezBenitez(territorio.rioCuarto.id);

    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(MatrimonioService.get(referente, pareja.id)).rejects.toThrow(
      NoAutorizadoError
    );
    await expect(
      MatrimonioService.get(referente, "no-existe")
    ).rejects.toThrow(NoEncontradoError);
  });
});

describe("deMisionero — el guardia de «casado nunca solo»", () => {
  it("encuentra el Matrimonio desde cualquiera de los dos esposos", async () => {
    const pareja = await crearAlvarezBenitez(territorio.villaMaria.id);
    const alcance = derivarAlcance(asesor, "prueba");

    for (const esposo of [pareja.misioneroA, pareja.misioneroB]) {
      const encontrado = await MatrimonioRepository.deMisionero(
        alcance,
        esposo.id
      );
      // Keying on `misionero_a_id` alone is the bug the feature exists to kill:
      // the spouse the image was not filed under was invisible to every guard.
      expect(encontrado?.id).toBe(pareja.id);
    }
  });

  it("una persona soltera y un Matrimonio dado de baja no cuentan", async () => {
    const soltera = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
    });
    const pareja = await crearAlvarezBenitez(territorio.villaMaria.id);
    const alcance = derivarAlcance(asesor, "prueba");

    expect(
      await MatrimonioRepository.deMisionero(alcance, soltera.id)
    ).toBeNull();

    await MatrimonioService.baja(asesor, pareja.id);
    expect(
      await MatrimonioRepository.deMisionero(alcance, pareja.misioneroA.id)
    ).toBeNull();
  });
});
