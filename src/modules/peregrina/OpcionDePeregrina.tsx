import type { OpcionDeBuscador } from "@/components/Buscador";
import { nombreDeTenedor } from "@/lib/formato";
import EstadoDePeregrina from "./EstadoDePeregrina";
import type { PeregrinaDTO } from "./peregrina.types";

/**
 * Una Peregrina como opción de un `Buscador`: su Identificación, quién la tiene,
 * y su Estado cuando no es Activa.
 *
 * Quién la tiene va en la opción y no en la confirmación, porque enterarse ahí
 * es enterarse cuando elegir otra imagen ya no es fácil. El Estado va sólo
 * cuando dice algo: una lista donde cada fila dice «Activa» es una lista donde
 * nadie lee la que dice «Extraviada».
 *
 * `detalle` reemplaza la segunda línea cuando la lista ya sabe que nadie las
 * tiene, como en el alta de un Misionero, donde se ofrecen sólo las libres.
 */
export function opcionDePeregrina(
  p: PeregrinaDTO,
  detalle?: string,
): OpcionDeBuscador {
  return {
    valor: p.id,
    etiqueta: p.identificacion,
    detalle:
      detalle ??
      (p.tenenciaActual
        ? `La tiene ${nombreDeTenedor(p.tenenciaActual)}`
        : "Sin entregar"),
    insignia:
      p.estado === "activa" ? undefined : <EstadoDePeregrina estado={p.estado} />,
  };
}
