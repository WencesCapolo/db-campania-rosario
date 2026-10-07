import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import Columnas from "./Columnas";
import { violacionesDeAxe } from "@/test/accesibilidad";

/**
 * Las columnas del año de consagración, medidas.
 *
 * Las mismas tres afirmaciones que Barras, por las mismas razones: el valor está
 * escrito, el rótulo está escrito, y el color no codifica nada.
 */

const UNIDAD = { singular: "imagen", plural: "imágenes" };
const COLUMNAS = [
  { etiqueta: "2005 a 2009", arriba: "2005", abajo: "–09", valor: 4 },
  { etiqueta: "2010 a 2014", arriba: "2010", abajo: "–14", valor: 12 },
  { etiqueta: "2015 a 2019", arriba: "2015", abajo: "–19", valor: 1 },
];

describe("Columnas", () => {
  it("cada columna se lee entera, con su valor y su unidad", async () => {
    const pantalla = await render(
      <Columnas columnas={COLUMNAS} unidad={UNIDAD} />
    );

    await expect
      .element(pantalla.getByText("2010 a 2014: 12 imágenes"))
      .toBeInTheDocument();
    await expect
      .element(pantalla.getByText("2015 a 2019: 1 imagen"))
      .toBeInTheDocument();
  });

  it("la columna más alta es la del valor más grande, y todas son la misma tinta", async () => {
    const pantalla = await render(
      <Columnas columnas={COLUMNAS} unidad={UNIDAD} />
    );
    const rects = Array.from(pantalla.container.querySelectorAll("rect"));

    expect(rects.map((r) => Number(r.getAttribute("height")))).toEqual([
      (4 / 12) * 100,
      100,
      (1 / 12) * 100,
    ]);
    expect(new Set(rects.map((r) => getComputedStyle(r).fill)).size).toBe(1);
  });

  it("no tiene violaciones de axe", async () => {
    const pantalla = await render(
      <Columnas columnas={COLUMNAS} unidad={UNIDAD} />
    );

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
