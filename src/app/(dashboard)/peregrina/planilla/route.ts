import { getCurrentUser } from "@/lib/get-current-user";
import {
  filtrosDeInventarioSchema,
  filtrosDesdeParams,
} from "@/modules/peregrina/peregrina.types";
import { PlanillaService } from "@/modules/planilla/planilla.service";
import { respuestaDePlanilla } from "@/modules/planilla/planilla.descarga";

/**
 * Las Peregrinas como `.xlsx`, con los filtros del listado — ADR 0017.
 *
 * Los filtros se leen de la dirección igual que en la pantalla, así que la
 * planilla tiene exactamente las filas que el listado cuenta.
 */
export async function GET(request: Request): Promise<Response> {
  const actor = await getCurrentUser();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filtros = filtrosDeInventarioSchema.parse(filtrosDesdeParams(params));
  return respuestaDePlanilla(
    await PlanillaService.peregrinas(actor, filtros),
    "peregrinas"
  );
}
