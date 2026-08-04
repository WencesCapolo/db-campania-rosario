import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import CopiarEnlaceDeInvitacion from "./CopiarEnlaceDeInvitacion";
import { violacionesDeAxe, tamanioDelObjetivo } from "@/test/accesibilidad";

/**
 * El control de copiar, en la pantalla de Usuarios.
 *
 * Lo único que puede salir mal en toda esta mitad de la feature es cómo se codifica
 * una dirección de correo adentro de una dirección web —— no hay servicio, no hay
 * repositorio y no hay esquema que tocar. Así que eso es lo que se afirma, y se
 * afirma sobre el control renderizado y no sobre la función sola: la función ya
 * tiene su prueba al lado del formulario de entrar, y lo que falta saber es que la
 * pantalla la use en vez de armar el enlace con un `+`.
 */

const BUZON = "parroquia+rosario@villamaria.org";

describe("el Enlace de invitación que ofrece la pantalla", () => {
  it("lleva el Buzón codificado y el origen de este navegador", async () => {
    const pantalla = await render(<CopiarEnlaceDeInvitacion buzon={BUZON} />);

    // El origen lo pone un efecto, porque en el servidor no existe. Lo que se
    // espera es el enlace entero, absoluto: es lo que se pega en un WhatsApp,
    // donde una ruta relativa no es nada.
    await expect
      .element(pantalla.getByText(/\/auth\/sign-in\?buzon=/))
      .toHaveTextContent(
        `${window.location.origin}/auth/sign-in?buzon=parroquia%2Brosario%40villamaria.org`,
      );
  });

  it("dice que no da acceso por sí solo", async () => {
    const pantalla = await render(<CopiarEnlaceDeInvitacion buzon={BUZON} />);

    // Historia 26. Quien invita tiene que poder mandarlo por donde sea sin pensar
    // en quién más lo ve, y eso se sabe leyendo la pantalla o no se sabe.
    await expect
      .element(pantalla.getByText(/No da acceso por sí solo/))
      .toBeVisible();
  });

  it("el botón cumple los 48 px y no tiene violaciones de axe", async () => {
    const pantalla = await render(<CopiarEnlaceDeInvitacion buzon={BUZON} />);

    const boton = pantalla.container.querySelector("button")!;
    expect(tamanioDelObjetivo(boton).alto).toBeGreaterThanOrEqual(48);
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
