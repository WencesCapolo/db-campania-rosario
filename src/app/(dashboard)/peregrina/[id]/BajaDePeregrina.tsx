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
 *  - **Eliminar** la borra del sistema junto con su historial. Se puede siempre;
 *    si estuvo a cargo de alguien, el diálogo lo avisa con cuántos períodos se
 *    pierden y quién la tiene ahora, y ofrece la otra salida.
 *
 * La negativa de marcarla extraviada mientras alguien la tiene no se repite
 * acá: si el servicio dice que no, el motivo llega al diálogo.
 */

export default function BajaDePeregrina({
  id,
  identificacion,
  deBaja,
  periodos,
  laTiene,
}: {
  id: string;
  identificacion: string;
  deBaja: boolean;
  /** Cuántas Asignaciones tuvo: es lo que se pierde al eliminarla. */
  periodos: number;
  /** El nombre de quien la tiene ahora, si alguien la tiene. */
  laTiene: string | null;
}) {
  const aviso =
    periodos === 0
      ? "Nunca estuvo a cargo de nadie, así que no se pierde ningún historial."
      : `Atención: ${laTiene ? `ahora la tiene ${laTiene}, y ` : ""}estuvo a cargo de alguien ${periodos === 1 ? "una vez" : `${periodos} veces`}. Ese historial también se borra, y deja de figurar en la ficha de cada Misionero que la tuvo.${
          // Ya marcada, ofrecer marcarla sería ofrecer lo que ya hizo.
          deBaja ? "" : " Si se perdió, conviene más marcarla como extraviada."
        }`;

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

      <ConfirmarAccion
        etiqueta="Eliminar"
        titulo="¿Eliminar esta imagen del sistema?"
        sujeto={identificacion}
        consecuencia={`Se borra para siempre y no se puede deshacer. ${aviso}`}
        etiquetaDeConfirmacion="Sí, eliminarla"
        accion={() => eliminarPeregrinaAction(id)}
        despues="/peregrina"
      />
    </div>
  );
}
