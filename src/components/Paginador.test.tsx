import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import Paginador from "./Paginador";
import { tamanioDelObjetivo, violacionesDeAxe } from "@/test/accesibilidad";

/**
 * El paginador, medido en un teléfono.
 *
 * Story 23 asks for long lists in manageable pages, and stories 3 and 6 decide
 * what the control may look like: a thumb-sized target that looks like a control
 * before it is touched. A strip of nine page numbers meets neither, which is why
 * this is two directions and a sentence — and why the assertion here is about
 * sizes and names rather than about markup.
 *
 * The viewport is 390px, from the config. That is where two buttons and a line of
 * text either fit or wrap, and where a 20px number in a row of nine is unhittable.
 */

const href = (n: number) => `/peregrina?pagina=${n}`;

describe("el paginador", () => {
  it("no aparece cuando hay una sola página", async () => {
    const pantalla = await render(
      <Paginador
        pagina={1}
        paginas={1}
        total={7}
        porPagina={20}
        unidad="imágenes"
        href={href}
      />
    );

    // A control that can do nothing is noise on a screen whose users are asked to
    // read every word on it.
    expect(pantalla.container.textContent).toBe("");
  });

  it("dice dónde está y qué filas son, no sólo el número de página", async () => {
    const pantalla = await render(
      <Paginador
        pagina={2}
        paginas={3}
        total={45}
        porPagina={20}
        unidad="imágenes"
        href={href}
      />
    );

    // "Página 2 de 3" alone leaves somebody unsure whether they have already seen
    // a Código. The range answers it.
    const texto = pantalla.container.textContent ?? "";
    expect(texto).toContain("Página");
    expect(texto).toContain("2");
    expect(texto).toContain("de 3");
    expect(texto).toContain("imágenes 21–40 de 45");
  });

  it("las dos direcciones son enlaces y llegan al piso de 48px", async () => {
    const pantalla = await render(
      <Paginador
        pagina={2}
        paginas={3}
        total={45}
        porPagina={20}
        unidad="imágenes"
        href={href}
      />
    );

    // Anchors, so a middle click opens a new tab and the target shows in the
    // status bar: moving page is navigation, and the element follows from that.
    const anterior = await pantalla
      .getByRole("link", { name: "Ir a la página 1" })
      .element();
    const siguiente = await pantalla
      .getByRole("link", { name: "Ir a la página 3" })
      .element();

    expect(anterior.getAttribute("href")).toBe("/peregrina?pagina=1");
    expect(siguiente.getAttribute("href")).toBe("/peregrina?pagina=3");
    expect(tamanioDelObjetivo(anterior).alto).toBeGreaterThanOrEqual(48);
    expect(tamanioDelObjetivo(siguiente).alto).toBeGreaterThanOrEqual(48);
  });

  it("la dirección agotada sigue en pantalla, deshabilitada", async () => {
    const pantalla = await render(
      <Paginador
        pagina={1}
        paginas={3}
        total={45}
        porPagina={20}
        unidad="imágenes"
        href={href}
      />
    );

    // It stays rather than disappearing: removing it slides "Siguiente" under the
    // thumb that was aiming at "Anterior", which is how somebody ends up two pages
    // from where they meant to be. Disabled, so it is announced as unavailable.
    const botones = pantalla.container.querySelectorAll("button[disabled]");
    expect(botones).toHaveLength(1);
    expect(botones[0]?.textContent).toContain("Anterior");

    await expect
      .element(pantalla.getByRole("link", { name: "Ir a la página 2" }))
      .toBeInTheDocument();
  });

  it("es una región con nombre, no dos botones sueltos", async () => {
    const pantalla = await render(
      <main>
        <h1>Peregrinas</h1>
        <Paginador
          pagina={2}
          paginas={3}
          total={45}
          porPagina={20}
          unidad="imágenes"
          href={href}
        />
      </main>
    );

    // A `nav` with an accessible name, so somebody using a screen reader can jump
    // to it instead of walking the whole list to find out how to leave the page.
    await expect
      .element(pantalla.getByRole("navigation", { name: "Paginación" }))
      .toBeInTheDocument();

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
