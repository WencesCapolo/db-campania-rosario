"use client";

import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { useState } from "react";
import Campo from "./Campo";
import Boton from "./Boton";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";
import { createMisioneroSchema } from "@/modules/misionero/misionero.types";

/**
 * Avisar al salir del campo — story 15, asserted as behaviour.
 *
 * The story is about *timing*, so the test is about timing too: what is on screen
 * before the field is left, what is on screen after, and what happens to it when
 * the value changes underneath. None of that is observable below the browser,
 * which is why it is here and not in the node project.
 *
 * The schema is the real `createMisioneroSchema` — the one the router parses. A
 * test with its own three-line schema would prove the hook works and prove nothing
 * about whether the message somebody reads on blur is the message the server would
 * have given them.
 *
 * The form is a stand-in for `CrearMisioneroForm` rather than the form itself: that
 * component calls a server action, which cannot be reached from a browser test. The
 * wiring it shares with this one — `error`, `onBlur`, `onChange` — is the part
 * under test, and the real screen is checked by the same three assertions by hand.
 */

function FormularioDePrueba() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const validacion = useValidacionAlSalir(createMisioneroSchema);

  return (
    <main>
      <h1>Cargar un Misionero</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <Campo
          etiqueta="Nombre"
          value={nombre}
          error={validacion.error("nombre")}
          onChange={(e) => {
            setNombre(e.target.value);
            validacion.alEscribir("nombre");
          }}
          onBlur={(e) => validacion.alSalir("nombre", e.target.value)}
        />

        <Campo
          etiqueta="Apellido"
          value={apellido}
          error={validacion.error("apellido")}
          onChange={(e) => {
            setApellido(e.target.value);
            validacion.alEscribir("apellido");
          }}
          onBlur={(e) => validacion.alSalir("apellido", e.target.value)}
        />

        <Boton type="submit">Guardar</Boton>
      </form>
    </main>
  );
}

describe("la validación al salir del campo", () => {
  it("no dice nada mientras el campo está en uso", async () => {
    const pantalla = await render(<FormularioDePrueba />);

    const nombre = pantalla.getByRole("textbox", { name: "Nombre" });
    await userEvent.click(nombre);
    // Typed rather than filled: `fill` sets the value in one go, and a keystroke
    // is what this assertion is about — the message must not appear mid-word.
    await userEvent.type(nombre, "M");

    // "El nombre es obligatorio" after the first letter is an accusation, and by
    // the third letter it is already wrong. Nothing is announced until the person
    // declares the field finished by leaving it.
    await expect.element(pantalla.getByRole("alert")).not.toBeInTheDocument();
  });

  it("avisa en el campo, en castellano, al salir de él", async () => {
    const pantalla = await render(<FormularioDePrueba />);

    // Tab out of an untouched required field: the moment story 15 is about.
    await userEvent.click(pantalla.getByRole("textbox", { name: "Nombre" }));
    await userEvent.tab();

    // The exact message from `createMisioneroSchema`, so what is read here is what
    // the router would have answered — one rule, one wording.
    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("El nombre es obligatorio.");

    const nombre = await pantalla
      .getByRole("textbox", { name: "Nombre" })
      .element();
    expect(nombre.getAttribute("aria-invalid")).toBe("true");
    // Bound to the field rather than floating below it, which is what makes it
    // reachable at all for somebody who arrives at the input later.
    expect(nombre.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("un campo por vez, y no ocho al final", async () => {
    const pantalla = await render(<FormularioDePrueba />);

    await userEvent.click(pantalla.getByRole("textbox", { name: "Nombre" }));
    await userEvent.tab();

    // Focus is now in Apellido, which is also empty and also required — and is
    // deliberately silent, because it has not been left yet. This is the whole
    // difference from validating on submit.
    await expect
      .element(pantalla.getByRole("textbox", { name: "Nombre" }))
      .toHaveAttribute("aria-invalid", "true");
    await expect
      .element(pantalla.getByRole("textbox", { name: "Apellido" }))
      .not.toHaveAttribute("aria-invalid");
  });

  it("escribir borra el aviso, y salir vuelve a decidir", async () => {
    const pantalla = await render(<FormularioDePrueba />);
    const nombre = pantalla.getByRole("textbox", { name: "Nombre" });

    await userEvent.click(nombre);
    await userEvent.tab();
    await expect.element(nombre).toHaveAttribute("aria-invalid", "true");

    // Asserted per field rather than on `role="alert"`: the two fields refuse in
    // the same shape, and a global query cannot tell "Nombre's message went" from
    // "Apellido's arrived" — which is exactly what happens here, because clicking
    // back into Nombre leaves the empty Apellido.
    await userEvent.type(nombre, "María");
    await expect.element(nombre).not.toHaveAttribute("aria-invalid");

    // And leaving the field again decides afresh, this time in the person's favour.
    await userEvent.tab();
    await expect.element(nombre).not.toHaveAttribute("aria-invalid");
  });

  it("cada campo se queja de sí mismo", async () => {
    const pantalla = await render(<FormularioDePrueba />);

    await userEvent.click(pantalla.getByRole("textbox", { name: "Apellido" }));
    await userEvent.tab();

    // "El nombre es obligatorio." under the Apellido box is a message about the
    // wrong box, and it is what a single shared schema for both halves of a name
    // produces. The wording follows the field.
    const apellido = await pantalla
      .getByRole("textbox", { name: "Apellido" })
      .element();
    const idError = (apellido.getAttribute("aria-describedby") ?? "").trim();
    expect(document.getElementById(idError)?.textContent).toContain(
      "El apellido es obligatorio."
    );
  });
});
