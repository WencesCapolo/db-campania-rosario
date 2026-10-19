import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import CampoDeBusqueda from "./CampoDeBusqueda";
import { useBusquedaEnVivo } from "@/lib/busqueda-en-vivo";
import { violacionesDeAxe } from "@/test/accesibilidad";

/**
 * Buscar mientras se escribe, sin botón (ADR 0015).
 *
 * Lo que se prueba es lo que no se ve: cuántas veces se va al servidor y qué
 * queda en la dirección. Una letra por pedido serían ocho pedidos para
 * «Martínez»; `push` en vez de `replace` haría que «Atrás» deshaga la búsqueda
 * letra por letra; y quedarse en la página 4 de una búsqueda más angosta es una
 * pantalla vacía que dice que nadie coincide.
 */

const replace = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ replace }),
}));

function Lista({ q }: { q: string }) {
  const busqueda = useBusquedaEnVivo({
    clave: "q",
    enLaDireccion: q,
    destino: "/misionero",
  });
  return <CampoDeBusqueda etiqueta="Buscar por nombre" {...busqueda} />;
}

const direccionOriginal = window.location.href;

beforeEach(() => {
  replace.mockReset();
  // Otra página y otro filtro ya puestos: la búsqueda vuelve a la primera y deja
  // el filtro como está.
  history.replaceState(null, "", "?pagina=4&imagen=sin");
});

afterEach(() => {
  history.replaceState(null, "", direccionOriginal);
});

describe("CampoDeBusqueda", () => {
  it("busca cuando se deja de escribir, una sola vez, en la página 1", async () => {
    const pantalla = await render(<Lista q="" />);

    await userEvent.type(
      pantalla.getByRole("searchbox", { name: "Buscar por nombre" }),
      "gomez",
    );
    // Todavía dentro de la pausa: nada salió, y el campo lo dice.
    expect(replace).not.toHaveBeenCalled();
    await expect
      .element(pantalla.getByText("Buscando…"))
      .toBeInTheDocument();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
    expect(replace).toHaveBeenCalledWith("/misionero?imagen=sin&q=gomez", {
      scroll: false,
    });
  });

  it("Enter busca enseguida, y el ✕ borra", async () => {
    history.replaceState(null, "", "?pagina=4&imagen=sin&q=gomez");
    const pantalla = await render(<Lista q="gomez" />);
    const campo = pantalla.getByRole("searchbox", { name: "Buscar por nombre" });

    await userEvent.fill(campo, "perez");
    await userEvent.keyboard("{Enter}");
    // El router está simulado, así que la dirección no se mueve sola.
    expect(replace).toHaveBeenCalledWith("/misionero?imagen=sin&q=perez", {
      scroll: false,
    });

    await pantalla.getByRole("button", { name: "Borrar la búsqueda" }).click();
    expect(replace).toHaveBeenLastCalledWith("/misionero?imagen=sin", {
      scroll: false,
    });
    await expect.element(campo).toHaveValue("");
  });

  it("no tiene violaciones de axe mientras busca", async () => {
    const pantalla = await render(<Lista q="" />);
    await userEvent.fill(
      pantalla.getByRole("searchbox", { name: "Buscar por nombre" }),
      "go",
    );
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
