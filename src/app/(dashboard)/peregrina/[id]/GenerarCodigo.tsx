"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import { generarCodigoAction } from "@/modules/peregrina/peregrina.router";

/**
 * Darle su Código a una imagen que sólo tenía Numeración anterior — ADR 0012.
 *
 * Behind a confirmation because it cannot be undone: a Código is never
 * regenerated, and it is about to be written on the image. The Numeración
 * anterior is not erased, and the dialog says so, because the person pressing
 * this is often holding a paper list that still uses it.
 */
export default function GenerarCodigo({
  id,
  numeracionAnterior,
}: {
  id: string;
  numeracionAnterior: string;
}) {
  return (
    <ConfirmarAccion
      tono="principal"
      etiqueta="Generar Código"
      titulo="¿Generarle un Código a esta imagen?"
      sujeto={numeracionAnterior}
      consecuencia="El sistema le da el Código que sigue para su Provincia y su Modalidad, y desde ahí se la identifica por ese Código. Hay que escribirlo en la imagen. La numeración anterior no se borra: se la sigue pudiendo buscar por ella."
      etiquetaDeConfirmacion="Sí, generar el Código"
      accion={() => generarCodigoAction(id)}
    />
  );
}
