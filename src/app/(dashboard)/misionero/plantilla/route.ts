import { getCurrentUser } from "@/lib/get-current-user";
import { PlanillaService } from "@/modules/planilla/planilla.service";
import { respuestaDePlanilla } from "@/modules/planilla/planilla.descarga";

/** La plantilla para cargar Misioneros, armada para quien la pide — ADR 0017. */
export async function GET(): Promise<Response> {
  const actor = await getCurrentUser();
  return respuestaDePlanilla(
    await PlanillaService.plantilla(actor),
    "plantilla-misioneros"
  );
}
