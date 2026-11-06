import { getCurrentUser } from "@/lib/get-current-user";
import { PlanillaService } from "@/modules/planilla/planilla.service";
import { respuestaDePlanilla } from "@/modules/planilla/planilla.descarga";
import { filtrosDeMisionerosParaExportarSchema } from "@/modules/planilla/planilla.types";

/**
 * Los Misioneros como `.xlsx`, con los filtros del listado — ADR 0017.
 *
 * Un filtro que no se entiende se descarta, como en la pantalla: es un dedazo o
 * un link viejo, y una descarga rechazada por eso no le sirve a nadie.
 */
export async function GET(request: Request): Promise<Response> {
  const actor = await getCurrentUser();
  const params = new URL(request.url).searchParams;

  const filtros: Record<string, string> = {};
  for (const clave of ["q", "imagen", "diocesisLocalidadId", "region"] as const) {
    const valor = params.get(clave)?.trim();
    if (!valor) continue;
    const uno = filtrosDeMisionerosParaExportarSchema.shape[clave].safeParse(valor);
    if (uno.success && uno.data) filtros[clave] = uno.data;
  }

  return respuestaDePlanilla(
    await PlanillaService.misioneros(
      actor,
      filtrosDeMisionerosParaExportarSchema.parse(filtros)
    ),
    "misioneros"
  );
}
