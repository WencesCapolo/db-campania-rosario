import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import PlanillaDeExcel from "./PlanillaDeExcel";
import { tamanioDelObjetivo, violacionesDeAxe } from "@/test/accesibilidad";
import type { RevisionDTO } from "@/modules/planilla/planilla.types";

/**
 * La planilla de Excel, en su diálogo — ADR 0017. Lo que se prueba es lo que la
 * pantalla hace: que primero se elija entre importar y exportar, que una
 * planilla con errores no ofrezca cargar y diga qué fila corregir, que la carga
 * mande el mismo archivo, y que exportar lleve los filtros sólo a la lista de
 * la pantalla en que se está. Que sea todo o nada es del servicio, y está en su
 * suite.
 */

const revisarPlanillaAction = vi.fn();
const importarPlanillaAction = vi.fn();
const refresh = vi.fn();

vi.mock("@/modules/planilla/planilla.router", () => ({
  revisarPlanillaAction: (...args: unknown[]) => revisarPlanillaAction(...args),
  importarPlanillaAction: (...args: unknown[]) => importarPlanillaAction(...args),
}));

// Se esparce el módulo real: Next lo consume como namespace (ver
// ConfirmarAccion.test.tsx).
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ refresh }),
}));

const totales = { misioneros: 2, imagenesNuevas: 1, entregas: 1 };

const conErrores: RevisionDTO = {
  errores: [],
  lista: false,
  totales,
  filas: [
    { numero: 2, misionero: "Gómez, Ana", imagen: "CBA JOV 0001 (nueva)", errores: [], avisos: [] },
    {
      numero: 3,
      misionero: "Pérez, Juan",
      imagen: null,
      errores: ["No encontramos la Diócesis/Localidad «Atlántida»."],
      avisos: [],
    },
  ],
};

const lista: RevisionDTO = {
  ...conErrores,
  lista: true,
  filas: [
    conErrores.filas[0]!,
    {
      numero: 3,
      misionero: "Pérez, Juan",
      imagen: null,
      errores: [],
      avisos: ["Ya hay un Misionero con este nombre en esta Diócesis/Localidad."],
    },
  ],
};

const xlsx = () =>
  new File(["contenido"], "misioneros.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  revisarPlanillaAction.mockReset();
  importarPlanillaAction.mockReset();
  refresh.mockClear();
});

async function abrir(
  props: Partial<React.ComponentProps<typeof PlanillaDeExcel>> = {},
) {
  const pantalla = await render(
    <PlanillaDeExcel
      pantalla="misionero"
      consultaDeFiltros=""
      total={12}
      filtrado={false}
      {...props}
    />,
  );
  await pantalla.getByRole("button", { name: "Planilla de Excel" }).click();
  return pantalla;
}

/** Hasta el paso de subir: Importar → plantilla → «Ya llené la planilla». */
async function hastaSubir() {
  const pantalla = await abrir();
  await pantalla.getByRole("button", { name: /Importar Planilla/ }).click();
  await pantalla.getByRole("button", { name: /Ya llené la planilla/ }).click();
  return pantalla;
}

async function subir() {
  const pantalla = await hastaSubir();
  await userEvent.upload(pantalla.getByLabelText("La planilla llena"), xlsx());
  await pantalla.getByRole("button", { name: "Revisar la planilla" }).click();
  return pantalla;
}

describe("exportar", () => {
  it("con filtros, la lista de esta pantalla los lleva y la otra va entera", async () => {
    const pantalla = await abrir({
      pantalla: "peregrina",
      consultaDeFiltros: "estado=activa",
      total: 4,
      filtrado: true,
    });
    await pantalla.getByRole("button", { name: /Exportar Planilla/ }).click();

    const filtrada = await pantalla
      .getByRole("link", { name: "Sólo las 4 imágenes de estos filtros" })
      .element();
    expect(filtrada.getAttribute("href")).toBe("/peregrina/planilla?estado=activa");
    expect(filtrada.getAttribute("download")).not.toBeNull();

    expect(
      (
        await pantalla
          .getByRole("link", { name: "Todas las Peregrinas, sin filtros" })
          .element()
      ).getAttribute("href"),
    ).toBe("/peregrina/planilla");
    expect(
      (
        await pantalla.getByRole("link", { name: "Todos los Misioneros" }).element()
      ).getAttribute("href"),
    ).toBe("/misionero/planilla");
  });

});

describe("importar", () => {
  it("con errores, dice qué fila corregir y no ofrece cargar", async () => {
    revisarPlanillaAction.mockResolvedValue({ ok: true, data: conErrores });
    const pantalla = await subir();

    await expect.element(pantalla.getByText("Hay 1 fila con errores.")).toBeVisible();
    await expect
      .element(pantalla.getByText("No encontramos la Diócesis/Localidad «Atlántida»."))
      .toBeVisible();
    expect(pantalla.getByRole("button", { name: /^Cargar/ }).query()).toBeNull();

    const enviado = revisarPlanillaAction.mock.calls[0]?.[0] as FormData;
    expect((enviado.get("archivo") as File).name).toBe("misioneros.xlsx");
  });

  it("lista, muestra los avisos, carga el mismo archivo y al terminar refresca", async () => {
    revisarPlanillaAction.mockResolvedValue({ ok: true, data: lista });
    importarPlanillaAction.mockResolvedValue({ ok: true, data: totales });
    const pantalla = await subir();

    await expect
      .element(pantalla.getByText(/Ya hay un Misionero con este nombre/))
      .toBeVisible();
    await pantalla.getByRole("button", { name: "Cargar 2 Misioneros" }).click();

    await expect.element(pantalla.getByText("La planilla se cargó.")).toBeVisible();
    await expect
      .element(pantalla.getByText("Se cargaron 2 Misioneros, 1 imagen nueva y 1 entrega."))
      .toBeVisible();
    const enviado = importarPlanillaAction.mock.calls[0]?.[0] as FormData;
    expect((enviado.get("archivo") as File).name).toBe("misioneros.xlsx");

    await pantalla.getByRole("button", { name: "Listo, ver la lista" }).click();
    expect(refresh).toHaveBeenCalledOnce();
    expect(pantalla.container.ownerDocument.querySelector("dialog[open]")).toBeNull();
  });

});

describe("accesibilidad", () => {
  it("la plantilla es un enlace de 48 px, y no hay violaciones de axe", async () => {
    const pantalla = await abrir();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);

    await pantalla.getByRole("button", { name: /Importar Planilla/ }).click();
    const descarga = await pantalla
      .getByRole("link", { name: "Descargar la plantilla" })
      .element();
    expect(descarga.getAttribute("download")).not.toBeNull();
    expect(tamanioDelObjetivo(descarga).alto).toBeGreaterThanOrEqual(48);

    revisarPlanillaAction.mockResolvedValue({ ok: true, data: lista });
    await pantalla.getByRole("button", { name: /Ya llené la planilla/ }).click();
    await userEvent.upload(pantalla.getByLabelText("La planilla llena"), xlsx());
    await pantalla.getByRole("button", { name: "Revisar la planilla" }).click();
    await expect.element(pantalla.getByText("Para mirar")).toBeVisible();

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
    pantalla.container.querySelector("details")!.open = true;
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
