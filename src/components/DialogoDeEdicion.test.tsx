import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { useState } from "react";
import DialogoDeEdicion from "./DialogoDeEdicion";
import { violacionesDeAxe } from "@/test/accesibilidad";

const refresh = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ refresh }),
}));

/** Un formulario mínimo, con un campo que recuerda lo que se tipeó. */
function Formulario({
  alGuardar,
  alCancelar,
}: {
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("Ana");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        alGuardar();
      }}
    >
      <label>
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <button type="submit">Guardar</button>
      <button type="button" onClick={alCancelar}>
        No, volver
      </button>
    </form>
  );
}

async function pantalla() {
  return render(
    <DialogoDeEdicion titulo="Editar a Ana">
      {(acciones) => <Formulario {...acciones} />}
    </DialogoDeEdicion>,
  );
}

beforeEach(() => refresh.mockReset());

describe("el diálogo de edición", () => {
  it("abre el formulario en un modal, y guardar lo cierra y refresca la ficha", async () => {
    const p = await pantalla();
    await p.getByRole("button", { name: "Editar sus datos" }).click();

    await expect.element(p.getByRole("dialog", { name: "Editar a Ana" })).toBeVisible();
    await p.getByRole("button", { name: "Guardar" }).click();

    await expect.element(p.getByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("tocar el fondo no lo cierra: no se pierde lo tipeado", async () => {
    const p = await pantalla();
    await p.getByRole("button", { name: "Editar sus datos" }).click();
    await userEvent.fill(p.getByLabelText("Nombre"), "Beatriz");

    const dialogo = (await p.getByRole("dialog").element()) as HTMLDialogElement;
    dialogo.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialogo.open).toBe(true);
    await expect.element(p.getByLabelText("Nombre")).toHaveValue("Beatriz");
  });

  it("al volver a abrir arranca de nuevo, sin lo que quedó a medio tipear", async () => {
    const p = await pantalla();
    await p.getByRole("button", { name: "Editar sus datos" }).click();
    await userEvent.fill(p.getByLabelText("Nombre"), "Beatriz");
    await p.getByRole("button", { name: "No, volver" }).click();
    expect(refresh).not.toHaveBeenCalled();

    await p.getByRole("button", { name: "Editar sus datos" }).click();
    await expect.element(p.getByLabelText("Nombre")).toHaveValue("Ana");
  });

  it("no tiene violaciones de axe abierto", async () => {
    const p = await pantalla();
    await p.getByRole("button", { name: "Editar sus datos" }).click();
    expect(await violacionesDeAxe(p.container)).toEqual([]);
  });
});
