"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import {
  darDeBajaPeregrinaAction,
  reactivarPeregrinaAction,
} from "@/modules/peregrina/peregrina.router";

/**
 * Dar de baja una Peregrina, o volver a darla de alta.
 *
 * There is no delete, and the confirmation says so plainly rather than
 * threatening something that will not happen: the record stays, because every
 * Asignación in the history names this Código and a chain that stops resolving
 * to a real image is worse than an unused row.
 *
 * The guard that refuses a baja while an Asignación is open lives in
 * `PeregrinaService.darDeBaja`. Nothing is duplicated here — if it refuses, the
 * message arrives in the dialog, and "no se puede, la tiene alguien" is exactly
 * what the person needs to read.
 */

export default function BajaDePeregrina({
  id,
  codigo,
  deBaja,
}: {
  id: string;
  codigo: string;
  deBaja: boolean;
}) {
  if (deBaja) {
    return (
      <ConfirmarAccion
        tono="secundario"
        etiqueta="Volver a dar de alta"
        titulo="¿Volver a poner esta imagen en el inventario?"
        sujeto={codigo}
        consecuencia="Vuelve a aparecer en los listados y se le puede volver a entregar a un Misionero."
        etiquetaDeConfirmacion="Sí, dar de alta"
        accion={() => reactivarPeregrinaAction(id)}
      />
    );
  }

  return (
    <ConfirmarAccion
      etiqueta="Dar de baja"
      titulo="¿Dar de baja esta imagen?"
      sujeto={codigo}
      consecuencia="Deja de aparecer en los listados y no se le puede entregar a nadie. No se borra: su historial sigue completo y se puede volver a dar de alta."
      etiquetaDeConfirmacion="Sí, dar de baja"
      accion={() => darDeBajaPeregrinaAction(id)}
    />
  );
}
