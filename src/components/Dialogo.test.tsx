import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import Dialogo from "./Dialogo";
import { focalizables, violacionesDeAxe } from "@/test/accesibilidad";

/**
 * `Dialogo`, in a real browser, because everything it is for is a platform
 * behaviour.
 *
 * This component's whole argument is that `showModal()` already does focus
 * trapping, Escape, focus restoration, scroll locking and the `dialog` role, and
 * that a hand-rolled modal gets several of them wrong without anybody noticing.
 * That argument is only worth making if somebody checks it: jsdom implements
 * `<dialog>` shallowly enough that a focus-trap test would pass against a plain
 * `div`, which is the failure mode these tests exist to catch.
 *
 * The Escape-versus-confirm distinction is the reason this file was written first.
 * The platform fires one `close` event for both, so a caller treating every close
 * as a confirmation lets the Escape key confirm a destructive action — and
 * `ConfirmarAccion` is built on this. It was untested until now.
 */

function Sujeto({ alCerrar }: { alCerrar?: (cancelado: boolean) => void }) {
  return (
    <>
      <button type="button">Antes</button>

      <Dialogo
        titulo="¿Dar de baja esta imagen?"
        alCerrar={alCerrar}
        disparador={(control) => (
          <button type="button" onClick={control.abrir}>
            Abrir el diálogo
          </button>
        )}
      >
        {(control) => (
          <>
            <p>Se puede volver a dar de alta.</p>
            <button type="button" onClick={control.cerrar}>
              Sí, dar de baja
            </button>
            <button type="button" onClick={control.cancelar}>
              No, volver
            </button>
          </>
        )}
      </Dialogo>

      <button type="button">Después</button>
    </>
  );
}

function dialogo(): HTMLDialogElement {
  const d = document.querySelector("dialog");
  if (!d) throw new Error("No hay ningún <dialog> en el documento");
  return d;
}

describe("Dialogo", () => {
  it("no está en el flujo hasta que se abre", async () => {
    const pantalla = await render(<Sujeto />);

    expect(dialogo().open).toBe(false);
    // A closed <dialog> is `display: none`, so the buttons inside it are in the
    // DOM and reachable by neither eye nor keyboard. `focalizables` asks the
    // browser rather than the selector, which is the only way to tell.
    expect(focalizables(dialogo())).toHaveLength(0);

    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();
    expect(dialogo().open).toBe(true);
  });

  it("mueve el foco adentro al abrirse y lo devuelve al disparador", async () => {
    const pantalla = await render(<Sujeto />);
    const disparador = pantalla.getByRole("button", {
      name: "Abrir el diálogo",
    });

    await disparador.click();
    // The browser's own doing, not ours: showModal() puts focus on the first
    // focusable thing inside. If this ever fails it means somebody added focus
    // management of their own on top of it.
    expect(dialogo().contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");

    expect(dialogo().open).toBe(false);
    // Focus restoration is what makes Escape usable rather than merely possible.
    // Without it the caret lands on <body> and the next Tab starts from the top
    // of the page, which on a phone means scrolling back to where you were.
    expect(document.activeElement).toBe(await disparador.element());
  });

  it("atrapa el Tab: nada de afuera es alcanzable mientras está abierto", async () => {
    const pantalla = await render(<Sujeto />);
    const afuera = [
      await pantalla.getByRole("button", { name: "Antes" }).element(),
      await pantalla.getByRole("button", { name: "Después" }).element(),
    ];

    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();

    const adentro = focalizables(dialogo());
    expect(adentro).toHaveLength(2);

    // Tab all the way round and one step past, so the wrap is included.
    const paradas: Element[] = [];
    for (let i = 0; i < adentro.length + 1; i++) {
      await userEvent.keyboard("{Tab}");
      if (document.activeElement) paradas.push(document.activeElement);
    }

    // Chromium's wrap goes through <body> before coming back inside, which is
    // why this asserts what was *not* reached rather than that every stop was in
    // the dialog. Body is not a control; the two buttons behind the backdrop are,
    // and those are the ones that must stay unreachable.
    expect(paradas.filter((p) => afuera.some((a) => a === p))).toEqual([]);

    // And the cycle closes: the step past the last control comes back to the
    // first one inside, not onward through the page.
    expect(paradas.at(-1)).toBe(adentro[0]);
  });

  it("Escape es una cancelación, no una confirmación", async () => {
    const alCerrar = vi.fn();
    const pantalla = await render(<Sujeto alCerrar={alCerrar} />);

    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();
    await userEvent.keyboard("{Escape}");

    // The whole point. The platform gives one `close` event for Escape and for
    // close(), and a component that could not tell them apart would let a
    // keystroke give a Peregrina de baja.
    expect(alCerrar).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("«No, volver» y Escape son el mismo evento", async () => {
    const alCerrar = vi.fn();
    const pantalla = await render(<Sujeto alCerrar={alCerrar} />);

    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();
    await pantalla.getByRole("button", { name: "No, volver" }).click();

    expect(alCerrar).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("confirmar se distingue de cancelar", async () => {
    const alCerrar = vi.fn();
    const pantalla = await render(<Sujeto alCerrar={alCerrar} />);

    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();
    await pantalla.getByRole("button", { name: "Sí, dar de baja" }).click();

    expect(alCerrar).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("no queda «confirmado» pegado al reabrirse", async () => {
    const alCerrar = vi.fn();
    const pantalla = await render(<Sujeto alCerrar={alCerrar} />);
    const disparador = pantalla.getByRole("button", {
      name: "Abrir el diálogo",
    });

    await disparador.click();
    await pantalla.getByRole("button", { name: "Sí, dar de baja" }).click();
    expect(alCerrar).toHaveBeenLastCalledWith(false);

    // showModal() resets returnValue to the empty string as part of its own
    // steps, which is why this file never clears it by hand. If that ever stops
    // being true, a dialog reopened after a confirmation would report the next
    // Escape as a confirmation too.
    await disparador.click();
    await userEvent.keyboard("{Escape}");
    expect(alCerrar).toHaveBeenLastCalledWith(true);
  });

  it("se anuncia con la pregunta que está haciendo", async () => {
    const pantalla = await render(<Sujeto />);
    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();

    // The accessible name is the question, not the word "dialog": aria-labelledby
    // points at the <h2>. Somebody using a screen reader hears what they are
    // being asked before they hear the buttons.
    await expect
      .element(pantalla.getByRole("dialog", { name: "¿Dar de baja esta imagen?" }))
      .toBeInTheDocument();
  });

  it("no tiene violaciones de axe abierto", async () => {
    const pantalla = await render(<Sujeto />);
    await pantalla.getByRole("button", { name: "Abrir el diálogo" }).click();

    expect(await violacionesDeAxe(document.body)).toEqual([]);
  });
});
