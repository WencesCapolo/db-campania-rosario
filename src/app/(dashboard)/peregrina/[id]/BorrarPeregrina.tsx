"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import { borrarPeregrinaAction } from "@/modules/peregrina/peregrina.router";

/**
 * Borrar una Peregrina — ADR 0014. Deja de existir en el sistema, con su
 * historial. Se puede siempre; si estuvo a cargo de alguien, el diálogo avisa
 * cuántos períodos se pierden y quién la tiene ahora.
 *
 * No hay otra salida acá. Una imagen que se perdió no se borra: se le cambia el
 * Estado a Extraviada editándola, y sigue en el inventario con quien la tuvo
 * por última vez.
 */

export default function BorrarPeregrina({
  id,
  identificacion,
  periodos,
  laTiene,
}: {
  id: string;
  identificacion: string;
  /** Cuántas Asignaciones tuvo: es lo que se pierde al borrarla. */
  periodos: number;
  /** El nombre de quien la tiene ahora, si alguien la tiene. */
  laTiene: string | null;
}) {
  const aviso =
    periodos === 0
      ? "Nunca estuvo a cargo de nadie, así que no se pierde ningún historial."
      : `Atención: ${laTiene ? `ahora la tiene ${laTiene}, y ` : ""}estuvo a cargo de alguien ${periodos === 1 ? "una vez" : `${periodos} veces`}. Ese historial también se borra, y deja de figurar en la ficha de cada Misionero que la tuvo. Si se perdió, no la borres: cambiale el Estado a Extraviada.`;

  return (
    <ConfirmarAccion
      etiqueta="Borrar"
      titulo="¿Borrar esta imagen del sistema?"
      sujeto={identificacion}
      consecuencia={`Deja de existir en el sistema y no se puede deshacer. ${aviso}`}
      etiquetaDeConfirmacion="Sí, borrarla"
      accion={() => borrarPeregrinaAction(id)}
      despues="/peregrina"
    />
  );
}
