import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import Barras from "./Barras";
import {
  contrasteDelTexto,
  tamanioDelObjetivo,
  violacionesDeAxe,
} from "@/test/accesibilidad";

/**
 * El gráfico del tablero, medido.
 *
 * Las cifras se prueban en el seam del servicio; acá se prueba lo único que un
 * test de servicio no puede ver, y que es la mitad de lo que el PRD pide del
 * gráfico: que cada valor esté escrito, que la categoría esté escrita, y que nada
 * de eso dependa del color.
 *
 * Las tres afirmaciones son mecánicas y no estéticas:
 *
 *  - **El valor está en el texto.** Si estuviera sólo en el largo de la barra,
 *    habría que estimarlo contra un eje — historia 22, y el eje ni existe.
 *  - **No hay leyenda.** La categoría está en la fila. Una leyenda es una tabla
 *    de búsqueda entre siete colores y siete nombres, y para uno de cada doce
 *    varones algunos de esos colores son el mismo color (historia 23).
 *  - **El color no codifica nada.** Todas las barras son la misma tinta, así que
 *    no hay información que se pierda al no distinguirlas. Eso se verifica
 *    comparando el relleno de las barras entre sí: si alguna vez alguien las
 *    pinta por categoría, este test falla.
 */

const BARRAS = [
  { etiqueta: "Activa", valor: 12, href: "/peregrina?estado=activa" },
  { etiqueta: "En reparación", valor: 3, href: "/peregrina?estado=en_reparacion" },
  { etiqueta: "Extraviada", valor: 1, href: "/peregrina?estado=extraviada" },
];

describe("Barras", () => {
  it("escribe el valor de cada fila, no sólo su largo", async () => {
    const pantalla = await render(
      <Barras
        titulo="Por Estado"
        barras={BARRAS}
        unidad={{ singular: "imagen", plural: "imágenes" }}
      />
    );

    await expect
      .element(pantalla.getByText("12 imágenes"))
      .toBeInTheDocument();
    // Y en singular cuando corresponde: «1 imágenes» es la clase de detalle que
    // hace que alguien deje de confiar en la pantalla.
    await expect.element(pantalla.getByText("1 imagen")).toBeInTheDocument();
  });

  it("nombra la categoría en la fila, sin leyenda", async () => {
    const pantalla = await render(<Barras titulo="Por Estado" barras={BARRAS} />);

    for (const barra of BARRAS) {
      await expect
        .element(pantalla.getByRole("link", { name: new RegExp(barra.etiqueta) }))
        .toBeInTheDocument();
    }
  });

  it("no codifica la categoría en el color", async () => {
    const pantalla = await render(<Barras titulo="Por Estado" barras={BARRAS} />);
    const contenedor = await pantalla
      .getByRole("heading", { name: "Por Estado" })
      .element();

    const rects = Array.from(
      contenedor.closest("section")!.querySelectorAll("rect")
    );
    expect(rects).toHaveLength(BARRAS.length);

    const rellenos = new Set(rects.map((r) => getComputedStyle(r).fill));
    expect(rellenos.size).toBe(1);
  });

  it("la barra es proporcional a la fila más grande", async () => {
    const pantalla = await render(<Barras titulo="Por Estado" barras={BARRAS} />);
    const contenedor = await pantalla
      .getByRole("heading", { name: "Por Estado" })
      .element();

    const anchos = Array.from(
      contenedor.closest("section")!.querySelectorAll("rect")
    ).map((r) => Number(r.getAttribute("width")));

    // 12 es el máximo, así que su barra es el 100% y las otras su proporción.
    expect(anchos[0]).toBe(100);
    expect(anchos[1]).toBeCloseTo((3 / 12) * 100, 5);
  });

  it("cada fila que lleva a algún lado es un objetivo de 48px", async () => {
    const pantalla = await render(<Barras titulo="Por Estado" barras={BARRAS} />);

    for (const barra of BARRAS) {
      const enlace = await pantalla
        .getByRole("link", { name: new RegExp(barra.etiqueta) })
        .element();
      expect(tamanioDelObjetivo(enlace).alto).toBeGreaterThanOrEqual(48);
      expect(contrasteDelTexto(enlace)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("una fila sin destino no es un enlace que no lleva a nada", async () => {
    const pantalla = await render(
      <Barras
        titulo="Altas por mes"
        barras={[{ etiqueta: "julio 2026", valor: 4 }]}
      />
    );

    await expect
      .element(pantalla.getByText("julio 2026"))
      .toBeInTheDocument();
    expect(
      pantalla.container.querySelectorAll("a").length,
      "un objetivo que no hace nada es peor que ningún objetivo"
    ).toBe(0);
  });

  it("dice que no hay nada en lugar de dibujar un gráfico vacío", async () => {
    const pantalla = await render(<Barras titulo="Por Región" barras={[]} />);

    await expect
      .element(pantalla.getByText(/Todavía no hay nada que contar/))
      .toBeInTheDocument();
    expect(pantalla.container.querySelectorAll("rect").length).toBe(0);
  });

  it("no tiene violaciones de axe", async () => {
    const pantalla = await render(
      <Barras
        titulo="Por Estado"
        barras={BARRAS}
        unidad={{ singular: "imagen", plural: "imágenes" }}
      />
    );

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
