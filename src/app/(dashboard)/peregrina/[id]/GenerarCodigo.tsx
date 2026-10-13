"use client";

import { useState } from "react";
import Campo from "@/components/Campo";
import ConfirmarAccion from "@/components/ConfirmarAccion";
import { generarCodigoAction } from "@/modules/peregrina/peregrina.router";

/**
 * Darle su Código a una imagen que sólo tenía Numeración anterior — ADR 0012.
 *
 * Con un número opcional (ADR 0013): si ya se le escribió uno, se tipea; si no,
 * se le da el siguiente libre. La única negativa es un Código que ya existe, y
 * llega al diálogo con esas palabras.
 *
 * Behind a confirmation because it is about to be written on the image. The
 * Numeración anterior is not erased, and the dialog says so, because the person
 * pressing this is often holding a paper list that still uses it.
 */
export default function GenerarCodigo({
  id,
  numeracionAnterior,
}: {
  id: string;
  numeracionAnterior: string;
}) {
  const [numero, setNumero] = useState("");
  const texto = numero.trim();

  return (
    <div className="space-y-4">
      <Campo
        etiqueta="Número (opcional)"
        ayuda="Si ya tiene un número nuevo escrito, ponelo. Si lo dejás vacío, se le da el siguiente libre."
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
      />

      <ConfirmarAccion
        tono="principal"
        etiqueta="Ponerle su Código"
        titulo="¿Ponerle un Código a esta imagen?"
        sujeto={numeracionAnterior}
        consecuencia={
          (texto
            ? `El Código se arma con su Provincia, su Modalidad y el número ${texto}. `
            : "El sistema le da el número que sigue para su Provincia y su Modalidad. ") +
          "Desde ahí se la identifica por ese Código, y hay que escribirlo en la imagen. La numeración anterior no se borra: se la sigue pudiendo buscar por ella."
        }
        etiquetaDeConfirmacion="Sí, ponerle el Código"
        // Un texto que no es un número llega como NaN, y el router lo rechaza
        // con el mismo mensaje que el alta.
        accion={() => generarCodigoAction(id, texto ? Number(texto) : undefined)}
      />
    </div>
  );
}
