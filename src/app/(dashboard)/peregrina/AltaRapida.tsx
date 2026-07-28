"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type {
  Modalidad,
  PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import {
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";

/**
 * El alta, en la misma pantalla que el listado.
 *
 * Es el mismo formulario que vivía en `/peregrina/new` — Tipo, Modalidad y una
 * sola elección de territorio, sin Código, porque el Código se genera — con dos
 * cosas distintas, y las dos salen de estar acá:
 *
 *  1. **No navega.** Guarda, muestra el Código para que se pueda escribir en la
 *     imagen, y `router.refresh()` vuelve a leer el listado del servidor: la fila
 *     recién cargada aparece abajo sin que nadie tenga que buscarla. Eso es lo que
 *     hacía el botón "Guardar y agregar otra", así que hay un botón y no dos.
 *  2. **Conserva Tipo, Modalidad y territorio.** Estos registros se cargan de a
 *     lotes, y el siguiente es casi siempre del mismo lote.
 *
 * El rol de cada panel sale del tono de `Mensaje` y no se elige acá: el Código es
 * una confirmación y se anuncia como status, la falla interrumpe. Al revés, un
 * lector de pantalla cortaría la frase para dar una buena noticia y se callaría
 * una negativa.
 */

// Desde el enum a través de la tabla de etiquetas, nunca a mano: son dieciséis
// Modalidades, y una segunda copia de la lista es un segundo lugar donde falta una.
const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  // El código de tres letras va al lado del nombre porque es la parte que termina
  // en el Código, y quien compara una imagen con la pantalla lee el código.
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

export default function AltaRapida() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [tipo, setTipo] = useState<PeregrinaTipo>("peregrina");
  const [modalidad, setModalidad] = useState<Modalidad>("JOV");
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);

  function guardar() {
    setError(null);
    setUltimoCodigo(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    startTransition(async () => {
      const result = await createPeregrinaAction({
        tipo,
        modalidad,
        diocesisLocalidadId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUltimoCodigo(result.data.codigo);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      {ultimoCodigo && (
        <Mensaje tono="exito">
          <p>
            Guardada. Su Código es{" "}
            <strong className="font-mono">{ultimoCodigo}</strong>. Escribilo en
            la imagen.
          </p>
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Eleccion
          etiqueta="Tipo"
          value={tipo}
          opciones={TIPOS}
          onChange={(e) => setTipo(e.target.value as PeregrinaTipo)}
        />

        <Eleccion
          etiqueta="Modalidad"
          value={modalidad}
          opciones={MODALIDADES_ELEGIBLES}
          onChange={(e) => setModalidad(e.target.value as Modalidad)}
        />
      </div>

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <p className="text-base leading-relaxed text-tinta-suave">
        El Código se genera solo, a partir de la Provincia y la Modalidad. No
        hace falta escribirlo.
      </p>

      <Boton type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Registrar la imagen"}
      </Boton>
    </form>
  );
}
