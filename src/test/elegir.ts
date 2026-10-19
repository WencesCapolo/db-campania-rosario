import type { RenderResult } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

/**
 * Elegir en una `Eleccion` y en un `Buscador`, como lo haría una persona.
 *
 * Ninguno de los dos es un `<select>` (ADR 0015), así que `selectOptions` no
 * sirve. Se abre el control y se toca la opción por su nombre accesible, que es
 * lo mismo que oye un lector de pantalla: si el nombre de la opción se rompe, la
 * prueba se rompe con él.
 */

type Pantalla = Pick<RenderResult, "getByRole">;

export async function elegir(
  pantalla: Pantalla,
  etiqueta: string,
  opcion: string,
): Promise<void> {
  await pantalla.getByRole("combobox", { name: etiqueta }).click();
  await pantalla.getByRole("option", { name: opcion, exact: true }).click();
}

/**
 * En un `Buscador`: escribir y tocar la opción. `opcion` es el comienzo del
 * nombre accesible —«CBA JOV 001»—, porque el nombre entero lleva el detalle:
 * «CBA JOV 001, Sin entregar».
 */
export async function buscarYElegir(
  pantalla: Pantalla,
  etiqueta: string,
  texto: string,
  opcion: string,
): Promise<void> {
  await userEvent.fill(pantalla.getByRole("combobox", { name: etiqueta }), texto);
  await pantalla
    .getByRole("option", { name: new RegExp(`^${escapar(opcion)}\\b`) })
    .click();
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
