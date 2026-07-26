import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import ConfirmarAccion from "./ConfirmarAccion";
import { violacionesDeAxe } from "@/test/accesibilidad";

/**
 * La confirmación destructiva, recorrida sólo con el teclado.
 *
 * The requirement is keyboard-only traversal of the destructive-confirmation flow:
 * focus enters the dialog, Escape closes it, focus returns to the trigger. It is
 * worth testing here rather than only on `Dialogo` because this is the component
 * where getting it wrong has a consequence — the button behind it gives a
 * Peregrina, a Misionero or a Usuario de baja.
 *
 * The assertion that matters most is a negative one: **Escape must not run the
 * action.** The platform fires the same `close` event for Escape and for
 * `close()`, so a version of this component that treated every close as a
 * confirmation would give records de baja by keystroke, and it would look
 * completely correct to anybody testing with a mouse.
 *
 * `next/navigation` is mocked because `router.refresh()` is the one thing here that
 * needs a Next runtime, and it is not what is under test. The action is a spy: what
 * this component owes is that the right thing is called at the right moment and
 * that a refusal is shown rather than swallowed — whether the Actor may do it at
 * all is the service's question, answered in the node project.
 */

const refresh = vi.fn();

// Spread the real module rather than replacing it. `next/navigation` is consumed
// as a namespace by the bits of Next that Vite has already pre-bundled, so a
// factory returning only `useRouter` breaks the import of everything else in it.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
});

function Sujeto({
  accion,
}: {
  accion: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
}) {
  return (
    <ConfirmarAccion
      etiqueta="Dar de baja"
      titulo="¿Dar de baja esta imagen?"
      sujeto="BA JOV 001"
      consecuencia="Deja de aparecer en los listados. No se borra: su historial sigue completo."
      etiquetaDeConfirmacion="Sí, dar de baja"
      accion={accion}
    />
  );
}

const exito = () => Promise.resolve({ ok: true as const, data: null });

describe("ConfirmarAccion", () => {
  it("nombra lo que va a cambiar, no sólo pregunta si estás seguro", async () => {
    const pantalla = await render(<Sujeto accion={vi.fn(exito)} />);
    await pantalla.getByRole("button", { name: "Dar de baja" }).click();

    const dialogo = await pantalla
      .getByRole("dialog", { name: "¿Dar de baja esta imagen?" })
      .element();

    // Story 17 asks for the subject and the consequence, and the second is the one
    // usually skipped. "¿Estás seguro?" is not a question anybody can answer.
    expect(dialogo.textContent).toContain("BA JOV 001");
    expect(dialogo.textContent).toContain("No se borra");
  });

  it("se recorre entero con el teclado", async () => {
    const accion = vi.fn(exito);
    const pantalla = await render(<Sujeto accion={accion} />);
    const disparador = await pantalla
      .getByRole("button", { name: "Dar de baja" })
      .element();

    // Reach the trigger by Tab, not by clicking it: the point is that a person
    // who never touches the screen can get through this.
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(disparador);

    await userEvent.keyboard("{Enter}");
    const dialogo = document.querySelector("dialog");
    expect(dialogo?.open).toBe(true);
    expect(dialogo?.contains(document.activeElement)).toBe(true);

    // The confirm button is the first focusable thing inside, so Enter again is
    // the whole gesture: open, confirm. That ordering is a decision — the
    // destructive button is first because it is what somebody opened the dialog
    // to do, and the dialog itself is the confirmation step.
    await userEvent.keyboard("{Enter}");
    expect(accion).toHaveBeenCalledOnce();
  });

  it("Escape cierra sin ejecutar, y devuelve el foco al disparador", async () => {
    const accion = vi.fn(exito);
    const pantalla = await render(<Sujeto accion={accion} />);
    const disparador = await pantalla
      .getByRole("button", { name: "Dar de baja" })
      .element();

    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");

    // The one that matters. Escape is a way out, never a shortcut through.
    expect(accion).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")?.open).toBe(false);
    expect(document.activeElement).toBe(disparador);
  });

  it("«No, volver» tampoco ejecuta", async () => {
    const accion = vi.fn(exito);
    const pantalla = await render(<Sujeto accion={accion} />);

    await pantalla.getByRole("button", { name: "Dar de baja" }).click();
    await pantalla.getByRole("button", { name: "No, volver" }).click();

    expect(accion).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")?.open).toBe(false);
  });

  it("muestra el rechazo del servicio en vez de tragarlo", async () => {
    const accion = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: "No se puede: la imagen está en la casa de alguien.",
      })
    );
    const pantalla = await render(<Sujeto accion={accion} />);

    await pantalla.getByRole("button", { name: "Dar de baja" }).click();
    await pantalla.getByRole("button", { name: "Sí, dar de baja" }).click();

    // The most useful refusal on this screen is a fact the person needs, and the
    // dialog stays open holding it. A baja refused because an Asignación is open
    // is not an error to hide behind a closing dialog.
    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("está en la casa de alguien");
    expect(document.querySelector("dialog")?.open).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("limpia el rechazo al reabrirse", async () => {
    const accion = vi
      .fn<() => Promise<{ ok: false; error: string }>>()
      .mockResolvedValue({ ok: false, error: "No se puede por ahora." });
    const pantalla = await render(<Sujeto accion={accion} />);

    await pantalla.getByRole("button", { name: "Dar de baja" }).click();
    await pantalla.getByRole("button", { name: "Sí, dar de baja" }).click();
    await userEvent.keyboard("{Escape}");
    await pantalla.getByRole("button", { name: "Dar de baja" }).click();

    // A stale refusal shown above a fresh question is a dialog claiming something
    // failed that has not been attempted yet.
    expect(document.querySelector("dialog")?.textContent).not.toContain(
      "No se puede por ahora."
    );
  });

  it("no tiene violaciones de axe", async () => {
    const pantalla = await render(<Sujeto accion={vi.fn(exito)} />);
    await pantalla.getByRole("button", { name: "Dar de baja" }).click();

    expect(await violacionesDeAxe(document.body)).toEqual([]);
  });
});
