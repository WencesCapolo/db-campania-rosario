import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import FormularioDeBuzon from "./FormularioDeBuzon";
import {
  violacionesDeAxe,
  focalizables,
  tamanioDelObjetivo,
} from "@/test/accesibilidad";
import {
  destinoAbsoluto,
  enlaceDeInvitacion,
  leerBuzon,
} from "@/lib/auth/buzon";

/**
 * La pantalla de entrar, que es un campo y un botón.
 *
 * Este es el único archivo que esta feature agrega a la suite, y la razón es que no
 * hay ningún servicio nuevo: entrar por el Buzón no cambió `InvitacionService` ni
 * su repositorio ni el esquema, así que las costuras que ya existen —— quién puede
 * invitar a quién, el par rol/territorio, aceptar dos veces, una invitación
 * revocada —— siguen siendo la red que dice que ADR 0003 no se movió de lugar. Lo
 * que no tenía dónde comprobarse es lo de acá: el contrato del `?buzon=` y la
 * pantalla que lo lee, que sólo existen en el navegador.
 *
 * `pedirEnlace` entra por prop en lugar de mockearse el cliente de auth. No es
 * comodidad: la llamada al proveedor es de la página, y lo que este archivo tiene
 * que probar es que se llame con la dirección que la persona ve escrita —— que es
 * exactamente lo que un espía contesta.
 */

const pedirEnlace = vi.fn();

beforeEach(() => {
  pedirEnlace.mockReset().mockResolvedValue(undefined);
});

const DESTINO = "/dashboard";

async function montar(buzonInicial = "") {
  return await render(
    <FormularioDeBuzon
      buzonInicial={buzonInicial}
      destino={DESTINO}
      pedirEnlace={pedirEnlace}
    />,
  );
}

describe("el contrato de la dirección", () => {
  it("compone el Enlace de invitación con el Buzón codificado", () => {
    // Un `+` en un Gmail es válido y es lo que rompe una concatenación a mano:
    // sin codificar llega al otro lado como un espacio, y la dirección deja de
    // emparejar con la Invitación.
    const enlace = enlaceDeInvitacion(
      "https://campania.example",
      "parroquia+rosario@gmail.com",
    );

    expect(enlace).toBe(
      "https://campania.example/auth/sign-in?buzon=parroquia%2Brosario%40gmail.com",
    );
  });

  it("lo vuelve a leer entero, y da vuelta lo que escribió", () => {
    const enlace = enlaceDeInvitacion(
      "https://campania.example",
      "parroquia+rosario@gmail.com",
    );

    expect(leerBuzon(new URL(enlace).searchParams)).toBe(
      "parroquia+rosario@gmail.com",
    );
  });

  it("sin origen queda relativo, que es lo que puede dibujar el servidor", () => {
    expect(enlaceDeInvitacion(null, "buzon@ejemplo.com")).toBe(
      "/auth/sign-in?buzon=buzon%40ejemplo.com",
    );
  });

  it("el destino viaja absoluto, con el dominio desde donde se pidió", () => {
    // El enlace lo abre un correo, así que quien resuelve la vuelta es el
    // servidor de auth, que vive en el dominio de Neon: `/dashboard` a secas
    // apunta a una pantalla que allá no existe. Y el dominio no está escrito a
    // mano en ningún lado, porque el desplegado y el de la rama son distintos.
    expect(
      destinoAbsoluto("https://db-campania-rosario.vercel.app", "/dashboard"),
    ).toBe("https://db-campania-rosario.vercel.app/dashboard");

    expect(destinoAbsoluto("http://localhost:3000", "/dashboard")).toBe(
      "http://localhost:3000/dashboard",
    );
  });

  it("sin parámetro devuelve vacío y no null", () => {
    // Vacío porque de acá sale el valor inicial de un campo controlado: un `null`
    // lo vuelve no controlado en el primer render.
    expect(leerBuzon(new URLSearchParams(""))).toBe("");
  });
});

describe("la pantalla de entrar", () => {
  it("llega con el Buzón escrito cuando la dirección lo trae", async () => {
    const pantalla = await montar("parroquia@villamaria.org");

    await expect
      .element(pantalla.getByLabelText("Correo del Buzón"))
      .toHaveValue("parroquia@villamaria.org");
  });

  it("llega vacío cuando la dirección no lo trae", async () => {
    const pantalla = await montar();

    await expect
      .element(pantalla.getByLabelText("Correo del Buzón"))
      .toHaveValue("");
  });

  it("pide el enlace para el Buzón que está escrito", async () => {
    const pantalla = await montar("parroquia@villamaria.org");

    await pantalla.getByRole("button", { name: "Mandarme el enlace" }).click();

    expect(pedirEnlace).toHaveBeenCalledWith(
      "parroquia@villamaria.org",
      DESTINO,
    );
  });

  it("dice a dónde fue el enlace, y que dura y se gasta", async () => {
    const pantalla = await montar("parroquia@villamaria.org");

    await pantalla.getByRole("button", { name: "Mandarme el enlace" }).click();

    // `status` y no `alert`: es una confirmación, y anunciarla como alerta corta
    // al lector de pantalla en la mitad de otra frase.
    const aviso = pantalla.getByRole("status");
    await expect.element(aviso).toHaveTextContent("parroquia@villamaria.org");
    await expect.element(aviso).toHaveTextContent("una hora");
    await expect.element(aviso).toHaveTextContent("una sola vez");
  });

  it("no manda nada cuando la dirección no es una dirección", async () => {
    const pantalla = await montar();

    await userEvent.fill(
      pantalla.getByLabelText("Correo del Buzón"),
      "parroquia arroba gmail",
    );
    await pantalla.getByRole("button", { name: "Mandarme el enlace" }).click();

    expect(pedirEnlace).not.toHaveBeenCalled();
    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("no parece un correo");
  });

  it("cuando el pedido falla lo dice y deja volver a intentar", async () => {
    pedirEnlace.mockRejectedValue(new Error("500"));
    const pantalla = await montar("parroquia@villamaria.org");

    await pantalla.getByRole("button", { name: "Mandarme el enlace" }).click();

    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("Probá de nuevo");
    // El botón sigue ahí: un error sin reintento es una pantalla muerta.
    await expect
      .element(pantalla.getByRole("button", { name: "Mandarme el enlace" }))
      .toBeEnabled();
  });

  it("se recorre entera con el teclado", async () => {
    const pantalla = await montar();

    // El campo y el botón, en ese orden y sin nada en el medio. Es toda la
    // pantalla: si el recorrido tuviera un paso más, sobraría.
    const recorrido = focalizables(pantalla.container);
    expect(recorrido.map((e) => e.tagName)).toEqual(["INPUT", "BUTTON"]);

    // Sin Buzón en la dirección hay algo que tipear, así que el campo ya está
    // enfocado y el primer Tab va al botón.
    expect(document.activeElement).toBe(recorrido[0]);
    await userEvent.tab();
    expect(document.activeElement).toBe(recorrido[1]);
  });

  it("con el Buzón ya escrito no se roba el foco", async () => {
    // Enfocar abre el teclado del teléfono encima del botón, que es lo único que
    // hay que apretar cuando la dirección ya trajo el Buzón.
    const pantalla = await montar("parroquia@villamaria.org");

    expect(document.activeElement).not.toBe(
      pantalla.container.querySelector("input"),
    );
  });

  it("el campo y el botón cumplen los 48 px, y el cuerpo son 18 px", async () => {
    const pantalla = await montar();

    for (const control of focalizables(pantalla.container)) {
      expect(tamanioDelObjetivo(control).alto).toBeGreaterThanOrEqual(48);
    }

    const campo = pantalla.container.querySelector("input")!;
    expect(getComputedStyle(campo).fontSize).toBe("18px");
  });

  it("no tiene violaciones de axe, ni al llegar ni con el error puesto", async () => {
    const pantalla = await montar();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    await userEvent.fill(
      pantalla.getByLabelText("Correo del Buzón"),
      "no es un correo",
    );
    await pantalla.getByRole("button", { name: "Mandarme el enlace" }).click();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
