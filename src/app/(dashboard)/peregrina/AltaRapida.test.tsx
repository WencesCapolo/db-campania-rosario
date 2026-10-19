import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import AltaRapida from "./AltaRapida";
import SeccionDeAlta from "./SeccionDeAlta";
import { tamanioDelObjetivo, violacionesDeAxe } from "@/test/accesibilidad";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * Las dos altas de /peregrina — ADR 0012. Lo que se prueba es lo que la pantalla
 * hace con la rotulación: qué campo aparece, qué se le manda al router y qué se
 * le dice a quien guarda. Que la Numeración anterior no gaste un número es del
 * servicio, y está en su suite.
 */

const createPeregrinaAction = vi.fn();
const refresh = vi.fn();

vi.mock("@/modules/peregrina/peregrina.router", () => ({
  createPeregrinaAction: (...args: unknown[]) => createPeregrinaAction(...args),
}));

const VILLA_MARIA: DiocesisLocalidadDTO = {
  id: "dl-1",
  nombre: "Villa María",
  deBaja: false,
  region: "CENTRO",
  provincia: { id: "p-1", nombre: "Córdoba", abreviatura: "CBA", deBaja: false },
};

vi.mock("@/modules/territorio/territorio.router", () => ({
  getProvinciasAction: async () => [VILLA_MARIA.provincia],
  getDiocesisLocalidadesAction: async () => [VILLA_MARIA],
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ refresh }),
}));

function guardada(
  codigo: string | null,
  numeracionAnterior: string | null,
): PeregrinaDTO {
  return {
    id: "p-1",
    identificacion: codigo ?? numeracionAnterior ?? "",
    codigo,
    numeracionAnterior,
    codigoNum: codigo ? 1 : null,
    fechaConsagracion: null,
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: VILLA_MARIA,
    provincia: "Córdoba",
    region: "CENTRO",
    tenenciaActual: null,
    createdById: "u-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

beforeEach(() => {
  createPeregrinaAction.mockReset();
  refresh.mockReset();
});

describe("el alta de una imagen vieja", () => {
  it("avisa al salir del campo vacío, en castellano", async () => {
    const pantalla = await render(<AltaRapida rotulacion="vieja" />);
    const campo = pantalla.getByLabelText("Numeración anterior");

    await userEvent.click(campo);
    await userEvent.tab();

    await expect
      .element(pantalla.getByText("Escribí la numeración que tiene la imagen."))
      .toBeVisible();
  });

  it("manda la numeración tal como se tipeó y no promete un Código", async () => {
    createPeregrinaAction.mockResolvedValue({
      ok: true,
      data: guardada(null, "Peregrina 7"),
    });
    const pantalla = await render(<AltaRapida rotulacion="vieja" />);

    await userEvent.fill(pantalla.getByLabelText("Numeración anterior"), "Peregrina 7");
    await userEvent.selectOptions(
      pantalla.getByLabelText("Diócesis/Localidad"),
      "dl-1",
    );
    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su numeración" }),
    );

    expect(createPeregrinaAction).toHaveBeenCalledWith(
      expect.objectContaining({ numeracionAnterior: "Peregrina 7" }),
    );
    await expect
      .element(pantalla.getByText(/Guardada con su numeración anterior/))
      .toBeVisible();
    // Lo único que cambia de una imagen del lote a la siguiente.
    await expect
      .element(pantalla.getByLabelText("Numeración anterior"))
      .toHaveValue("");
  });

  it("no guarda sin la numeración", async () => {
    const pantalla = await render(<AltaRapida rotulacion="vieja" />);

    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su numeración" }),
    );

    expect(createPeregrinaAction).not.toHaveBeenCalled();
  });
});

describe("el alta de una imagen nueva", () => {
  it("no pide numeración anterior, y sin número no manda ninguno", async () => {
    createPeregrinaAction.mockResolvedValue({
      ok: true,
      data: guardada("CBA JOV 0001", null),
    });
    const pantalla = await render(<AltaRapida rotulacion="nueva" />);

    expect(
      pantalla.container.querySelector("input[autocomplete=off]:not([inputmode=numeric])"),
    ).toBeNull();

    await userEvent.selectOptions(
      pantalla.getByLabelText("Diócesis/Localidad"),
      "dl-1",
    );
    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su Código" }),
    );

    const enviado = createPeregrinaAction.mock.calls[0]?.[0];
    expect(enviado).not.toHaveProperty("numeracionAnterior");
    expect(enviado).not.toHaveProperty("numero");
    await expect.element(pantalla.getByText("CBA JOV 0001")).toBeVisible();
  });

  it("manda el número escrito, como número — ADR 0013", async () => {
    createPeregrinaAction.mockResolvedValue({
      ok: true,
      data: guardada("CBA JOV 0042", null),
    });
    const pantalla = await render(<AltaRapida rotulacion="nueva" />);

    await userEvent.fill(pantalla.getByLabelText("Número (opcional)"), "42");
    await userEvent.selectOptions(
      pantalla.getByLabelText("Diócesis/Localidad"),
      "dl-1",
    );
    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su Código" }),
    );

    expect(createPeregrinaAction).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 42 }),
    );
    // El siguiente del lote empieza sin número.
    await expect
      .element(pantalla.getByLabelText("Número (opcional)"))
      .toHaveValue("");
  });

  it("avisa al salir si el número tiene letras, y no guarda", async () => {
    const pantalla = await render(<AltaRapida rotulacion="nueva" />);
    const campo = pantalla.getByLabelText("Número (opcional)");

    await userEvent.fill(campo, "4a");
    await userEvent.tab();

    await expect
      .element(pantalla.getByText(/tiene que ser un número entero/))
      .toBeVisible();

    await userEvent.selectOptions(
      pantalla.getByLabelText("Diócesis/Localidad"),
      "dl-1",
    );
    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su Código" }),
    );
    expect(createPeregrinaAction).not.toHaveBeenCalled();
  });

  it("manda la Fecha de consagración cuando se la pone", async () => {
    createPeregrinaAction.mockResolvedValue({
      ok: true,
      data: guardada("CBA JOV 0001", null),
    });
    const pantalla = await render(<AltaRapida rotulacion="nueva" />);

    await userEvent.fill(
      pantalla.getByLabelText("Fecha de consagración de la imagen (opcional)"),
      "1998-10-18",
    );
    await userEvent.selectOptions(
      pantalla.getByLabelText("Diócesis/Localidad"),
      "dl-1",
    );
    await userEvent.click(
      pantalla.getByRole("button", { name: "Registrar con su Código" }),
    );

    expect(createPeregrinaAction).toHaveBeenCalledWith(
      expect.objectContaining({ fechaConsagracion: "1998-10-18" }),
    );
  });
});

describe("la sección plegable", () => {
  async function seccion() {
    return render(
      <SeccionDeAlta titulo="Registrar una imagen vieja" bajada="Ya tiene una numeración.">
        <p>Adentro</p>
      </SeccionDeAlta>,
    );
  }

  it("arranca cerrada y se abre con el teclado, diciendo Cerrar con palabras", async () => {
    const pantalla = await seccion();
    const resumen = pantalla.container.querySelector("summary")!;

    await expect.element(pantalla.getByText("Adentro")).not.toBeVisible();
    await expect.element(pantalla.getByText("Abrir")).toBeVisible();

    resumen.focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(pantalla.getByText("Adentro")).toBeVisible();
    await expect.element(pantalla.getByText("Cerrar")).toBeVisible();
  });

  it("el resumen y su botón miden al menos 48px de alto", async () => {
    const pantalla = await seccion();
    const resumen = pantalla.container.querySelector("summary")!;
    const boton = resumen.lastElementChild!;

    expect(tamanioDelObjetivo(resumen).alto).toBeGreaterThanOrEqual(48);
    expect(tamanioDelObjetivo(boton).alto).toBeGreaterThanOrEqual(48);
  });

  it("el botón tiene borde: no es sólo una flecha", async () => {
    const pantalla = await seccion();
    const boton = pantalla.container.querySelector("summary")!.lastElementChild!;

    expect(parseFloat(getComputedStyle(boton).borderTopWidth)).toBeGreaterThanOrEqual(2);
  });

  it("no tiene violaciones de axe, abierta ni cerrada", async () => {
    const pantalla = await seccion();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    pantalla.container.querySelector("details")!.open = true;
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
