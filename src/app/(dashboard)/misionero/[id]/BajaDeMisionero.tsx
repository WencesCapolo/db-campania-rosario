"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import {
  darDeBajaMisioneroAction,
  reactivarMisioneroAction,
} from "@/modules/misionero/misionero.router";

/**
 * Dar de baja un Misionero, o volver a darlo de alta.
 *
 * The person is named in the confirmation, which is the point of story 17 — "¿dar
 * de baja?" with no name is how the wrong Misionero gets given de baja.
 *
 * The refusal while they still hold an image comes from
 * `MisioneroService.darDeBaja` and surfaces in the dialog. It is the useful
 * case: somebody leaving the Campaña while an image is in their house is exactly
 * the moment the inventory needs to say so rather than quietly closing the
 * record.
 */

export default function BajaDeMisionero({
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
      <ConfirmarAccion
        tono="secundario"
        etiqueta="Volver a dar de alta"
        titulo="¿Volver a incorporar a esta persona?"
        sujeto={nombre}
        consecuencia="Vuelve a aparecer en los listados y se le pueden volver a entregar imágenes."
        etiquetaDeConfirmacion="Sí, dar de alta"
        accion={() => reactivarMisioneroAction(id)}
      />
    );
  }

  return (
    <ConfirmarAccion
      etiqueta="Dar de baja"
      titulo="¿Dar de baja a esta persona?"
      sujeto={nombre}
      consecuencia="Deja de aparecer en los listados y no se le pueden entregar imágenes. No se borra: sigue apareciendo con su nombre en el historial de cada imagen que tuvo."
      etiquetaDeConfirmacion="Sí, dar de baja"
      accion={() => darDeBajaMisioneroAction(id)}
    />
  );
}
