"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/get-current-user";
import { aResultado } from "@/lib/errors";
import { PlanillaService } from "./planilla.service";
import {
  MAXIMO_DE_BYTES,
  MAXIMO_DE_FILAS,
  type ActionResult,
  type RevisionDTO,
  type TotalesDeCargaDTO,
} from "./planilla.types";

/**
 * PlanillaRouter — las dos acciones de importar (ADR 0017). Las descargas son
 * route handlers, porque devuelven un archivo y no un resultado.
 *
 * Resuelve el Actor, saca el archivo del formulario y delega. Que el archivo
 * sea una planilla con sentido lo decide el servicio; acá sólo que haya uno y
 * que no sea enorme, antes de leerlo entero a memoria.
 */

async function archivoDe(
  datos: FormData
): Promise<ActionResult<Buffer>> {
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elegí la planilla que querés subir.", codigo: "validacion" };
  }
  if (archivo.size > MAXIMO_DE_BYTES) {
    return {
      ok: false,
      error:
        `El archivo pesa más de ${MAXIMO_DE_BYTES / 1024 / 1024} MB. ` +
        `Partilo en planillas de hasta ${MAXIMO_DE_FILAS} filas.`,
      codigo: "validacion",
    };
  }
  return { ok: true, data: Buffer.from(await archivo.arrayBuffer()) };
}

export async function revisarPlanillaAction(
  datos: FormData
): Promise<ActionResult<RevisionDTO>> {
  const actor = await getCurrentUser();
  const archivo = await archivoDe(datos);
  if (!archivo.ok) return archivo;
  return aResultado(() => PlanillaService.revisar(actor, archivo.data));
}

export async function importarPlanillaAction(
  datos: FormData
): Promise<ActionResult<TotalesDeCargaDTO>> {
  const actor = await getCurrentUser();
  const archivo = await archivoDe(datos);
  if (!archivo.ok) return archivo;

  const resultado = await aResultado(() =>
    PlanillaService.importar(actor, archivo.data)
  );
  if (resultado.ok) {
    revalidatePath("/misionero");
    revalidatePath("/peregrina");
    revalidatePath("/tablero");
  }
  return resultado;
}
