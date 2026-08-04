"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import { darDeBajaMatrimonioAction } from "@/modules/misionero/matrimonio.router";

/**
 * Terminar un Matrimonio.
 *
 * Es una baja como cualquier otra, y por eso se confirma como cualquier otra: el
 * sujeto es la pareja, con los dos nombres, porque «¿dar de baja?» sin nombre es
 * cómo se da de baja el hogar equivocado.
 *
 * Lo que la baja hace no es borrar nada. Los dos cónyuges vuelven a ser
 * Misioneros individuales — el roster deja de encontrarles una pareja activa y
 * aparecen solos, sin un cambio de código — y cada Asignación que la pareja tuvo
 * sigue leyéndose como la pareja, porque eso es lo que era entonces (ADR 0010).
 *
 * La negativa mientras todavía tienen una imagen viene de `MatrimonioService.baja`
 * y aparece en el diálogo. Es el caso útil: una imagen en esa casa no se fue del
 * inventario porque el matrimonio haya terminado, y hay que registrar la
 * devolución primero.
 *
 * No hay «volver a dar de alta», y ésa es la diferencia con `BajaDeMisionero`.
 * Un Matrimonio que terminó no se reanuda con un botón: si la pareja vuelve, se
 * carga de nuevo, que es el mismo camino que el PRD deja para el resto de los
 * retrofits.
 */

export default function BajaDeMatrimonio({
  id,
  nombre,
  deBaja,
}: {
  id: string;
  nombre: string;
  deBaja: boolean;
}) {
  if (deBaja) {
    return (
      <p className="text-base leading-relaxed text-tinta-suave">
        Este Matrimonio ya está dado de baja. Los dos Misioneros siguen en la
        Campaña por separado, y todo lo que la pareja tuvo a cargo sigue en el
        historial a nombre de los dos.
      </p>
    );
  }

  return (
    <ConfirmarAccion
      etiqueta="Dar de baja el Matrimonio"
      titulo="¿Dar de baja este Matrimonio?"
      sujeto={nombre}
      consecuencia="Deja de aparecer como una pareja en los listados, y cada uno vuelve a figurar por separado. No se borra: todo lo que tuvieron a cargo sigue apareciendo a nombre de los dos en el historial de cada imagen."
      etiquetaDeConfirmacion="Sí, dar de baja"
      accion={() => darDeBajaMatrimonioAction(id)}
    />
  );
}
