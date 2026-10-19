import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import EntregarImagen from "./EntregarImagen";
import { violacionesDeAxe } from "@/test/accesibilidad";
import { buscarYElegir } from "@/test/elegir";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import type { DiocesisLocalidadDTO } from "@/modules/territorio/territorio.types";

/**
 * Entregar desde la ficha, en un diálogo.
 *
 * Lo que sólo se ve acá: que el Tenedor de la ficha viaja hasta la acción sin
 * que nadie lo elija, que se elige entre `asignar` y `entregar` igual que en el
 * flujo, y que una imagen registrada desde el diálogo vuelve elegida y es la que
 * se entrega. Los routers se mockean porque son `"use server"`.
 */

const asignarAction = vi.fn();
const entregarAction = vi.fn();
const createPeregrinaAction = vi.fn();
const refresh = vi.fn();

vi.mock("@/modules/asignacion/asignacion.router", () => ({
  asignarAction: (...args: unknown[]) => asignarAction(...args),
  entregarAction: (...args: unknown[]) => entregarAction(...args),
}));

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

function peregrina(
  id: string,
  codigo: string,
  tenencia: PeregrinaDTO["tenenciaActual"],
): PeregrinaDTO {
  return {
    id,
    identificacion: codigo,
    codigo,
    numeracionAnterior: null,
    codigoNum: 1,
    fechaConsagracion: null,
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: VILLA_MARIA,
    provincia: "Córdoba",
    region: "CENTRO",
    tenenciaActual: tenencia,
    createdById: "u-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

const SIN_ENTREGAR = peregrina("pg-1", "CBA JOV 0001", null);
const YA_ENTREGADA = peregrina("pg-2", "CBA JOV 0002", {
  tipo: "persona",
  id: "m-2",
  deBaja: false,
  persona: { id: "m-2", nombre: "Beatriz", apellido: "Ruiz", deBaja: false },
});
const NUEVA = peregrina("pg-9", "CBA JOV 0009", null);

const ANA = { tipo: "persona", id: "m-1" } as const;

beforeEach(() => {
  asignarAction.mockReset().mockResolvedValue({ ok: true, data: {} });
  entregarAction.mockReset().mockResolvedValue({ ok: true, data: {} });
  createPeregrinaAction.mockReset().mockResolvedValue({ ok: true, data: NUEVA });
  refresh.mockReset();
});

async function abrir() {
  const pantalla = await render(
    <EntregarImagen
      tenedor={ANA}
      nombre="Ana Gómez"
      diocesisLocalidadId={VILLA_MARIA.id}
      peregrinas={[SIN_ENTREGAR, YA_ENTREGADA]}
    />,
  );
  await pantalla.getByRole("button", { name: "Entregarle una imagen" }).click();
  await expect
    .element(
      pantalla.getByRole("dialog", {
        name: "Entregarle una imagen a Ana Gómez",
      }),
    )
    .toBeVisible();
  return pantalla;
}

describe("EntregarImagen", () => {
  it("abre un diálogo con quien la recibe ya elegido, y asigna", async () => {
    const pantalla = await abrir();

    await buscarYElegir(pantalla, "¿Qué Peregrina?", "CBA JOV 0001", "CBA JOV 0001");
    await expect
      .element(pantalla.getByRole("status"))
      .toHaveTextContent("queda a cargo de Ana Gómez");
    await pantalla.getByRole("button", { name: "Registrar la entrega" }).click();

    expect(asignarAction).toHaveBeenCalledWith({
      peregrinaId: SIN_ENTREGAR.id,
      tenedor: ANA,
      nota: null,
    });
    expect(refresh).toHaveBeenCalled();
    await expect.element(pantalla.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("entrega, y dice de quién se cierra el período, cuando la imagen está afuera", async () => {
    const pantalla = await abrir();

    await buscarYElegir(pantalla, "¿Qué Peregrina?", "CBA JOV 0002", "CBA JOV 0002");
    await expect
      .element(pantalla.getByRole("status"))
      .toHaveTextContent("Se cierra el período de Beatriz Ruiz");
    await pantalla.getByRole("button", { name: "Registrar la entrega" }).click();

    expect(asignarAction).not.toHaveBeenCalled();
    expect(entregarAction.mock.calls[0][0]).toMatchObject({
      peregrinaId: YA_ENTREGADA.id,
      tenedor: ANA,
    });
  });

  it("la búsqueda achica la lista y dice cuando nada coincide", async () => {
    const pantalla = await abrir();
    const buscar = pantalla.getByRole("combobox", { name: "¿Qué Peregrina?" });

    await buscar.fill("0002");
    const opciones = pantalla
      .getByRole("option")
      .elements()
      .map((o) => o.textContent);
    expect(opciones).toHaveLength(1);
    expect(opciones[0]).toContain(YA_ENTREGADA.identificacion);

    await buscar.fill("zzz");
    await expect
      .element(pantalla.getByText(/Ninguna Peregrina coincide/))
      .toBeVisible();
  });

  it("registra una imagen nueva en el territorio de quien la recibe, y vuelve con ella elegida", async () => {
    const pantalla = await abrir();

    await pantalla
      .getByRole("button", { name: "No está en la lista: registrar una nueva" })
      .click();
    await expect
      .element(pantalla.getByRole("heading", { name: "Registrar una Peregrina" }))
      .toBeVisible();
    // El territorio viene puesto: el selector carga y queda en Villa María.
    await expect
      .element(pantalla.getByRole("combobox", { name: /Diócesis/ }))
      .toHaveTextContent(VILLA_MARIA.nombre);

    await pantalla.getByRole("button", { name: "Guardar y elegirla" }).click();

    expect(createPeregrinaAction).toHaveBeenCalledWith(
      expect.objectContaining({ diocesisLocalidadId: VILLA_MARIA.id }),
    );
    await expect
      .element(pantalla.getByText(/Su Código es/))
      .toHaveTextContent("CBA JOV 0009");
    await expect
      .element(pantalla.getByRole("combobox", { name: "¿Qué Peregrina?" }))
      .toHaveValue(NUEVA.identificacion);

    await pantalla.getByRole("button", { name: "Registrar la entrega" }).click();
    expect(asignarAction.mock.calls[0][0]).toMatchObject({
      peregrinaId: NUEVA.id,
      tenedor: ANA,
    });
  });

  it("muestra el rechazo del servicio y se queda abierto", async () => {
    asignarAction.mockResolvedValue({
      ok: false,
      error: "Esa imagen ya la tiene otra persona.",
    });
    const pantalla = await abrir();

    await buscarYElegir(pantalla, "¿Qué Peregrina?", "CBA JOV 0001", "CBA JOV 0001");
    await pantalla.getByRole("button", { name: "Registrar la entrega" }).click();

    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("ya la tiene otra persona");
    await expect.element(pantalla.getByRole("dialog")).toBeVisible();
  });

  it("no tiene violaciones de axe en ninguna de las dos vistas", async () => {
    const pantalla = await abrir();
    await buscarYElegir(pantalla, "¿Qué Peregrina?", "CBA JOV 0002", "CBA JOV 0002");
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    await pantalla
      .getByRole("button", { name: "No está en la lista: registrar una nueva" })
      .click();
    await expect
      .element(pantalla.getByRole("combobox", { name: /Diócesis/ }))
      .toHaveTextContent(VILLA_MARIA.nombre);
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
