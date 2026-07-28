import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import FlujoDeAsignacion from "./FlujoDeAsignacion";
import { violacionesDeAxe } from "@/test/accesibilidad";
import type { MisioneroDTO } from "@/modules/misionero/misionero.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

/**
 * El flujo de entrega, recorrido sólo con el teclado.
 *
 * The other half of the requirement: keyboard-only traversal of the stepped
 * assignment flow. This is the screen with the most steps and the only one where a
 * step is a decision rather than a field, so a keyboard user who cannot reach
 * "Siguiente" cannot record a handover at all.
 *
 * The behavioural assertion that is not about accessibility, and is here anyway
 * because this is the only place it can be checked: **the flow picks between two
 * different service operations.** If the image is already out it calls `entregar`,
 * which closes somebody's period as it opens the next; if nobody has it, `asignar`.
 * The person entering the record is not asked to know which, and the confirmation
 * states the consequence before it happens. Nothing in the node project can catch
 * a regression there — the services are each tested, and which one the UI calls is
 * a UI fact.
 *
 * The router module is mocked because it is `"use server"`: importing it in a
 * browser would pull in the service, the repository and `src/db`. What is under
 * test is which action is called with what, which is exactly what a spy answers.
 */

const asignarAction = vi.fn();
const entregarAction = vi.fn();
const push = vi.fn();

vi.mock("@/modules/asignacion/asignacion.router", () => ({
  asignarAction: (...args: unknown[]) => asignarAction(...args),
  entregarAction: (...args: unknown[]) => entregarAction(...args),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  asignarAction.mockReset().mockResolvedValue({ ok: true, data: {} });
  entregarAction.mockReset().mockResolvedValue({ ok: true, data: {} });
  push.mockReset();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
// Written out in full rather than cast into shape. A DTO built with `as` stops
// failing the typecheck the day a field is added to it, which is the day the
// fixture starts lying about what the screen receives.

const VILLA_MARIA: DiocesisLocalidadDTO = {
  id: "dl-1",
  nombre: "Villa María",
  deBaja: false,
  region: "CENTRO",
  provincia: {
    id: "p-1",
    nombre: "Córdoba",
    abreviatura: "CBA",
    deBaja: false,
  },
};

function misionero(id: string, nombre: string, apellido: string): MisioneroDTO {
  return {
    id,
    nombre,
    apellido,
    telefono: null,
    estado: "activo",
    diocesisLocalidad: VILLA_MARIA,
    provincia: "Córdoba",
    region: "CENTRO",
    deBaja: false,
    centroTipo: null,
    centroNombre: null,
    anioConsagracion: null,
    resumenesAnuales: {},
    createdById: "u-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function peregrina(
  id: string,
  codigo: string,
  tenencia: PeregrinaDTO["tenenciaActual"],
): PeregrinaDTO {
  return {
    id,
    codigo,
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: VILLA_MARIA,
    provincia: "Córdoba",
    region: "CENTRO",
    tenenciaActual: tenencia,
    deBaja: false,
    createdById: "u-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

const ANA = misionero("m-1", "Ana", "Gómez");
const BEATRIZ = misionero("m-2", "Beatriz", "Ruiz");

const SIN_ENTREGAR = peregrina("pg-1", "CBA JOV 001", null);
const YA_ENTREGADA = peregrina("pg-2", "CBA JOV 002", {
  misioneroId: BEATRIZ.id,
  nombre: "Beatriz",
  apellido: "Ruiz",
  deBaja: false,
});

const TODOS = {
  misioneros: [ANA, BEATRIZ],
  peregrinas: [SIN_ENTREGAR, YA_ENTREGADA],
};

describe("FlujoDeAsignacion", () => {
  it("se recorre entero con el teclado, sin tocar la pantalla", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    // Paso 1. Tab reaches the select; the OS picker is native, so choosing is
    // typing the option's first letters — which is one of the reasons the select
    // is native.
    await userEvent.keyboard("{Tab}");
    const misioneros = await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .element();
    expect(document.activeElement).toBe(misioneros);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(
      await pantalla.getByRole("button", { name: "Siguiente" }).element(),
    );
    await userEvent.keyboard("{Enter}");

    // Paso 2 — and the heading changed, which is what tells somebody the screen
    // moved.
    await expect
      .element(pantalla.getByRole("heading", { name: "Paso 2: Elegir Imagen" }))
      .toBeInTheDocument();

    await pantalla
      .getByRole("combobox", { name: "¿Qué Peregrina?" })
      .selectOptions("CBA JOV 001 — sin entregar");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();

    // Paso 3.
    await pantalla
      .getByRole("button", { name: "Registrar la entrega" })
      .click();

    expect(asignarAction).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith(`/peregrina/${SIN_ENTREGAR.id}`);
  });

  it("dice en qué paso va, en voz alta", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    // "Paso 1 de 3" is a live region. Somebody who cannot see the heading change
    // otherwise gets no signal at all that pressing Siguiente did anything.
    const contador = await pantalla.getByText("Paso 1 de 3").element();
    expect(contador.getAttribute("aria-live")).toBe("polite");
  });

  it("Volver no pierde lo que ya se eligió", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla.getByRole("button", { name: "Volver" }).click();

    // Losing the choice on the way back turns a three-step flow into a three-step
    // flow you have to complete in one pass, which is worse than one long form.
    await expect
      .element(
        pantalla.getByRole("combobox", { name: "¿A quién pasa la imagen?" }),
      )
      .toHaveValue(ANA.id);
  });

  it("dice de quién se cierra el período antes de cerrarlo", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla
      .getByRole("combobox", { name: "¿Qué Peregrina?" })
      .selectOptions("CBA JOV 002 — la tiene Beatriz Ruiz");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();

    // The sentence somebody is agreeing to, in the future tense, naming the person
    // whose period is about to close.
    await expect
      .element(pantalla.getByRole("status"))
      .toHaveTextContent("Se cierra el período de Beatriz Ruiz");
  });

  it("entrega en vez de asignar cuando la imagen ya está afuera", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla
      .getByRole("combobox", { name: "¿Qué Peregrina?" })
      .selectOptions("CBA JOV 002 — la tiene Beatriz Ruiz");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla
      .getByRole("button", { name: "Registrar la entrega" })
      .click();

    // Two service operations, one flow. `asignar` on an image somebody already has
    // is the call that would refuse — the person handing it on does not have to
    // know which verb applies.
    expect(entregarAction).toHaveBeenCalledOnce();
    expect(asignarAction).not.toHaveBeenCalled();
    expect(entregarAction.mock.calls[0][0]).toMatchObject({
      peregrinaId: YA_ENTREGADA.id,
      misioneroId: ANA.id,
    });
  });

  it("muestra el rechazo del servicio y se queda en el paso", async () => {
    entregarAction.mockResolvedValue({
      ok: false,
      error: "Esa imagen ya la tiene otra persona.",
    });
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla
      .getByRole("combobox", { name: "¿Qué Peregrina?" })
      .selectOptions("CBA JOV 002 — la tiene Beatriz Ruiz");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    await pantalla
      .getByRole("button", { name: "Registrar la entrega" })
      .click();

    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("ya la tiene otra persona");
    expect(push).not.toHaveBeenCalled();
  });

  it("cuando no hay Misioneros ofrece cargar uno", async () => {
    const pantalla = await render(
      <FlujoDeAsignacion misioneros={[]} peregrinas={[SIN_ENTREGAR]} />,
    );

    // A picker with nothing in it has to say what to do and give a way to get
    // there. This used to be a paragraph telling somebody to register a Misionero,
    // from a screen with no link, to a route that did not exist.
    await expect
      .element(pantalla.getByRole("link", { name: "Cargar un Misionero" }))
      .toHaveAttribute("href", "/misionero/new");
  });

  it("cuando no hay Peregrinas ofrece registrar una", async () => {
    const pantalla = await render(
      <FlujoDeAsignacion misioneros={[ANA]} peregrinas={[]} />,
    );

    await expect
      .element(pantalla.getByRole("link", { name: "Registrar una Peregrina" }))
      .toHaveAttribute("href", "/peregrina/new");
  });

  it("no tiene violaciones de axe en ninguno de los tres pasos", async () => {
    const pantalla = await render(<FlujoDeAsignacion {...TODOS} />);

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    await pantalla
      .getByRole("combobox", { name: "¿A quién pasa la imagen?" })
      .selectOptions("Gómez, Ana — Villa María");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    await pantalla
      .getByRole("combobox", { name: "¿Qué Peregrina?" })
      .selectOptions("CBA JOV 002 — la tiene Beatriz Ruiz");
    await pantalla.getByRole("button", { name: "Siguiente" }).click();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
