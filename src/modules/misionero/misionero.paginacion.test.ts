import { beforeEach, describe, expect, it } from "vitest";
import { MisioneroService } from "./misionero.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import { FILAS_POR_PAGINA } from "@/lib/paginacion";
import { NoAutorizadoError } from "@/lib/errors";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * La paginación del listado de Misioneros — story 23.
 *
 * The interesting difference from the Peregrina list is the ordering. A Código is
 * unique; apellido and nombre are not, and a parish full of Gómez is the normal
 * case rather than a contrived one. Ordering by a tie plus an `offset` is how a
 * person appears on two pages and their sibling on none — so the tiebreaker is
 * asserted with twenty-five people who share a name exactly.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

const CUANTOS = FILAS_POR_PAGINA + 5;

async function sembrarHomonimos(
  cuantos: number,
  diocesisLocalidadId: string
): Promise<void> {
  for (let i = 0; i < cuantos; i += 1) {
    await crearMisioneroDirecto({
      diocesisLocalidadId,
      createdById: asesor.id,
      nombre: "María",
      apellido: "Gómez",
    });
  }
}

async function idsDeTodasLasPaginas(
  actor: CurrentUser,
  filtros = {}
): Promise<string[]> {
  const primera = await MisioneroService.listPagina(actor, filtros, 1);
  const ids = primera.filas.map((m) => m.id);

  for (let n = 2; n <= primera.paginas; n += 1) {
    const pagina = await MisioneroService.listPagina(actor, filtros, n);
    ids.push(...pagina.filas.map((m) => m.id));
  }

  return ids;
}

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

describe("un apellido repetido no rompe las páginas", () => {
  it("veinticinco homónimos aparecen una vez cada uno", async () => {
    await sembrarHomonimos(CUANTOS, territorio.villaMaria.id);

    const ids = await idsDeTodasLasPaginas(asesor);

    // Nombre and apellido are identical for all of them, so the whole assertion
    // rests on the `id` tiebreaker. Without it the planner is free to return a
    // different order per query and the offset skips people silently.
    expect(ids).toHaveLength(CUANTOS);
    expect(new Set(ids).size).toBe(CUANTOS);
  });
});

describe("el total es del conjunto, no de la página", () => {
  it("cuenta a todos mientras devuelve una página", async () => {
    await sembrarHomonimos(CUANTOS, territorio.villaMaria.id);

    const pagina = await MisioneroService.listPagina(asesor, {}, 1);

    expect(pagina.total).toBe(CUANTOS);
    expect(pagina.filas).toHaveLength(FILAS_POR_PAGINA);
    expect(pagina.paginas).toBe(2);
  });

  it("la búsqueda por nombre cuenta lo que la búsqueda encuentra", async () => {
    await sembrarHomonimos(CUANTOS, territorio.villaMaria.id);
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
      nombre: "Ana",
      apellido: "Quiroga",
    });

    const pagina = await MisioneroService.listPagina(asesor, { q: "quiroga" }, 1);

    // The count and the rows come from one predicate. `contarTotal` takes only the
    // territorial filters, so a total taken from it would have said 26 and offered
    // a second page of nobody.
    expect(pagina.total).toBe(1);
    expect(pagina.paginas).toBe(1);
    expect(pagina.filas).toHaveLength(1);
    expect(pagina.filas[0]?.apellido).toBe("Quiroga");
  });

  it("una página que no existe se recorta a la última", async () => {
    await sembrarHomonimos(CUANTOS, territorio.villaMaria.id);

    const pedida = await MisioneroService.listPagina(asesor, {}, 40);

    expect(pedida.pagina).toBe(2);
    expect(pedida.filas).toHaveLength(CUANTOS - FILAS_POR_PAGINA);
  });
});

describe("el alcance sobrevive a la paginación", () => {
  it("un Referente Local no alcanza otra Diócesis en ninguna página", async () => {
    await sembrarHomonimos(CUANTOS, territorio.villaMaria.id);
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.rioCuarto.id,
      createdById: asesor.id,
      nombre: "Jorge",
      apellido: "Ledesma",
    });

    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const primera = await MisioneroService.listPagina(referente, {}, 1);
    const ids = await idsDeTodasLasPaginas(referente);

    // Asserted as a negative: Ledesma is in neither the total nor any page. A
    // Misionero record carries a name and a telephone number, which is the leak
    // ADR 0001 exists for.
    expect(primera.total).toBe(CUANTOS);
    expect(ids).toHaveLength(CUANTOS);

    const buscado = await MisioneroService.listPagina(
      referente,
      { q: "ledesma" },
      1
    );
    expect(buscado).toMatchObject({ total: 0, filas: [] });
  });

  it("un filtro territorial fuera del alcance se rechaza", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      MisioneroService.listPagina(
        referente,
        { diocesisLocalidadId: territorio.rioCuarto.id },
        1
      )
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un rol territorial sin territorio se rechaza antes de contar", async () => {
    const sinTerritorio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: null,
    });

    await expect(
      MisioneroService.listPagina(sinTerritorio, {}, 1)
    ).rejects.toThrow(NoAutorizadoError);
  });
});
