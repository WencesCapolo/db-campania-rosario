"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import {
  darDeBajaPeregrinaAction,
  eliminarPeregrinaAction,
  reactivarPeregrinaAction,
} from "@/modules/peregrina/peregrina.router";

/**
 * Sacar una Peregrina del inventario — ADR 0013. Dos salidas, y la diferencia
 * es el historial:
 *
 *  - **Marcar como extraviada** es la baja de siempre con su nombre de la
 *    Campaña: deja de aparecer en los listados, no se le entrega a nadie, y su
 *    historial sigue entero. Se puede recuperar.
 *  - **Eliminar** la borra del sistema, y existe para la que se cargó por
 *    error. Si ya estuvo a cargo de alguien, `PeregrinaService.eliminar` la
 *    rechaza y el mensaje dice que se marque como extraviada.
 *
 * Ninguna de las dos reglas se repite acá: si el servicio dice que no, el motivo
 * llega al diálogo, y es exactamente lo que la persona necesita leer.
 */

export default function BajaDePeregrina({
  id,
  identificacion,
  deBaja,
  conHistorial,
}: {
  id: string;
  identificacion: string;
  deBaja: boolean;
  /** Ya estuvo a cargo de alguien: entonces no se ofrece eliminarla. */
  conHistorial: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {deBaja ? (
        <ConfirmarAccion
          tono="secundario"
          etiqueta="Apareció: recuperarla"
          titulo="¿Volver a poner esta imagen en el inventario?"
          sujeto={identificacion}
          consecuencia="Deja de figurar como extraviada, vuelve a aparecer en los listados y se le puede volver a entregar a un Misionero."
          etiquetaDeConfirmacion="Sí, recuperarla"
          accion={() => reactivarPeregrinaAction(id)}
        />
      ) : (
        <ConfirmarAccion
          etiqueta="Marcar como extraviada"
          titulo="¿Marcar esta imagen como extraviada?"
          sujeto={identificacion}
          consecuencia="Deja de aparecer en los listados y no se le puede entregar a nadie. No se borra: su historial sigue completo, y si aparece se la puede recuperar."
          etiquetaDeConfirmacion="Sí, está extraviada"
          accion={() => darDeBajaPeregrinaAction(id)}
        />
      )}

      {!conHistorial && (
        <ConfirmarAccion
          etiqueta="Eliminar"
          titulo="¿Eliminar esta imagen del sistema?"
          sujeto={identificacion}
          consecuencia="Se borra para siempre y no se puede deshacer. Es para una imagen cargada por error: como nunca estuvo a cargo de nadie, no se pierde ningún historial."
          etiquetaDeConfirmacion="Sí, eliminarla"
          accion={() => eliminarPeregrinaAction(id)}
          despues="/peregrina"
        />
      )}
    </div>
  );
}
