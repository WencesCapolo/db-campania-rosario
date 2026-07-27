"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { TableroService } from "./tablero.service";
import { filtrosDeInventarioSchema } from "@/modules/peregrina/peregrina.types";
import type { TableroDTO } from "./tablero.types";

/**
 * TableroRouter — one server action.
 *
 * Resolves the Actor, parses the filters, delegates. There is nothing to
 * revalidate: the tablero writes nothing, and every figure it shows is derived
 * from records whose own routers already revalidate.
 *
 * The read deliberately does not catch. A refusal — a lower rol with no territory,
 * or a crafted territory filter — has to reach the error boundary: rendering it as
 * a screen full of zeros would tell somebody their Campaña is empty.
 */
export async function getTableroAction(filtros: unknown): Promise<TableroDTO> {
  const actor = await getCurrentUser();
  const parsed = filtrosDeInventarioSchema.parse(filtros ?? {});
  return TableroService.resumen(actor, parsed);
}
