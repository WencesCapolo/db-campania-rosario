import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import {
  crearActor,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import { FILAS_POR_PAGINA } from "@/lib/paginacion";
import type { CurrentUser } from "@/modules/user/user.types";
import type { PeregrinaDTO } from "./peregrina.types";

/**
 * La paginación del listado — story 23 of the interface issue.
 *
 * What is worth testing here is not "does it slice an array". It is the three ways
 * a paginated list lies:
 *
 *  - **A row on two pages, or on none.** An `order by` that ties plus an `offset`
 *    does exactly that, and it is invisible on page one. Asserted by reading every
 *    page and comparing the concatenation against the whole set.
 *  - **A total that is the page size.** The figure in the header is the count of
 *    everything matching, from an aggregate; if it ever comes from `filas.length`
 *    the list says "20 imágenes" forever.
 *  - **A page past the end answered with nothing.** It is clamped to the last.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

/** Enough to need three pages, so a middle page exists to get wrong. */
const CUANTAS = FILAS_POR_PAGINA * 2 + 5;

async function sembrar(
  cuantas: number,
  diocesisLocalidadId: string
): Promise<void> {
  for (let i = 0; i < cuantas; i += 1) {
    await crearPeregrinaDirecta({
      diocesisLocalidadId,
      createdById: asesor.id,
      modalidad: i % 5 === 0 ? "FAM" : "JOV",
    });
  }
}

async function todasLasPaginas(
  actor: CurrentUser,
  filtros = {}
): Promise<PeregrinaDTO[]> {
  const primera = await PeregrinaService.listPagina(actor, filtros, 1);
  const filas = [...primera.filas];

  for (let n = 2; n <= primera.paginas; n += 1) {
    const pagina = await PeregrinaService.listPagina(actor, filtros, n);
    filas.push(...pagina.filas);
  }

  return filas;
}

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

describe("las páginas cubren el listado exactamente una vez", () => {
  it("ninguna fila se repite ni se pierde entre páginas", async () => {
    await sembrar(CUANTAS, territorio.villaMaria.id);

    const paginadas = await todasLasPaginas(asesor);
    const completas = await PeregrinaService.listFiltradas(asesor, {});

    // Same rows, same order — the unpaginated read is the definition, and the
    // pages are only allowed to be a partition of it. An `order by` that ties
    // shows one Código twice here and drops another entirely.
    expect(paginadas.map((p) => p.codigo)).toEqual(
      completas.map((p) => p.codigo)
    );
    expect(new Set(paginadas.map((p) => p.id)).size).toBe(CUANTAS);
  });

  it("las páginas llenas están llenas y la última tiene el resto", async () => {
    await sembrar(CUANTAS, territorio.villaMaria.id);

    const primera = await PeregrinaService.listPagina(asesor, {}, 1);
    const ultima = await PeregrinaService.listPagina(asesor, {}, 3);

    expect(primera.paginas).toBe(3);
    expect(primera.filas).toHaveLength(FILAS_POR_PAGINA);
    expect(ultima.filas).toHaveLength(CUANTAS - FILAS_POR_PAGINA * 2);
  });
});

describe("el total es del conjunto, no de la página", () => {
  it("cuenta todo lo que coincide mientras devuelve una página", async () => {
    await sembrar(CUANTAS, territorio.villaMaria.id);

    const pagina = await PeregrinaService.listPagina(asesor, {}, 1);

    // The figure in the header. `filas.length` would make it 20 for a Diócesis
    // with 45 images, which is the mistake the previous dashboard was built on.
    expect(pagina.total).toBe(CUANTAS);
    expect(pagina.filas.length).toBeLessThan(pagina.total);
  });

  it("el total sigue a los filtros, y las páginas con él", async () => {
    await sembrar(CUANTAS, territorio.villaMaria.id);

    const fam = await PeregrinaService.listPagina(
      asesor,
      { modalidad: "FAM" },
      1
    );

    // Every fifth seeded image is FAM. A total that ignored the filter would
    // offer three pages of which two came back empty.
    const esperadas = Math.ceil(CUANTAS / 5);
    expect(fam.total).toBe(esperadas);
    expect(fam.paginas).toBe(1);
    expect(fam.filas).toHaveLength(esperadas);
    expect(fam.filas.every((p) => p.modalidad === "FAM")).toBe(true);
  });

  it("un listado vacío tiene una página, no cero", async () => {
    const vacio = await PeregrinaService.listPagina(asesor, {}, 1);

    // "Página 1 de 0" would be the heading of the empty state. An empty listado
    // still has a first page: it is the page that says nothing matched.
    expect(vacio).toMatchObject({ total: 0, paginas: 1, pagina: 1, filas: [] });
  });
});

describe("una página que no existe", () => {
  it("se recorta a la última en lugar de devolver nada", async () => {
    await sembrar(CUANTAS, territorio.villaMaria.id);

    const pedida = await PeregrinaService.listPagina(asesor, {}, 99);
    const ultima = await PeregrinaService.listPagina(asesor, {}, 3);

    // A bookmark taken before rows were given de baja. Answering it with an empty
    // list reads as "there is nothing here", which is a lie about the data.
    expect(pedida.pagina).toBe(3);
    expect(pedida.filas.map((p) => p.codigo)).toEqual(
      ultima.filas.map((p) => p.codigo)
    );
  });
});

