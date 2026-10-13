"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Mensaje from "@/components/Mensaje";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import CamposDePeregrinaForm, {
  useCamposDePeregrina,
  type Rotulacion,
} from "@/modules/peregrina/CamposDePeregrina";

/**
 * El alta, en la misma pantalla que el listado.
 *
 * Es el mismo formulario que vivía en `/peregrina/new` — los campos de
 * `CamposDePeregrina` y una sola elección de territorio — con dos cosas
 * distintas, y las dos salen de estar acá:
 *
 *  1. **No navega.** Guarda, muestra el Código para que se pueda escribir en la
 *     imagen, y `router.refresh()` vuelve a leer el listado del servidor: la fila
 *     recién cargada aparece abajo sin que nadie tenga que buscarla. Eso es lo que
 *     hacía el botón "Guardar y agregar otra", así que hay un botón y no dos.
 *  2. **Conserva Tipo, Modalidad y territorio.** Estos registros se cargan de a
 *     lotes, y el siguiente es casi siempre del mismo lote.
 *
 * Son dos instancias en la pantalla, una por rotulación — ADR 0012. La `vieja`
 * agrega arriba de todo la Numeración anterior, que se tipea tal como está en la
 * imagen, y no genera Código; la `nueva` pide el número, opcional (ADR 0013). Es un componente
 * y no dos porque el resto del formulario es el mismo, y dos copias de Tipo,
 * Modalidad y territorio son dos lugares donde una se queda atrás.
 *
 * El rol de cada panel sale del tono de `Mensaje` y no se elige acá: el Código es
 * una confirmación y se anuncia como status, la falla interrumpe. Al revés, un
 * lector de pantalla cortaría la frase para dar una buena noticia y se callaría
 * una negativa.
 */

export type { Rotulacion };

export default function AltaRapida({ rotulacion }: { rotulacion: Rotulacion }) {
  const router = useRouter();
  const vieja = rotulacion === "vieja";
  const [pendiente, startTransition] = useTransition();

  const campos = useCamposDePeregrina();
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [ultimaGuardada, setUltimaGuardada] = useState<PeregrinaDTO | null>(
    null,
  );

  function guardar() {
    setError(null);
    setUltimaGuardada(null);

    const datos = campos.paraAlta(rotulacion);
    if (!datos) return;

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    startTransition(async () => {
      const result = await createPeregrinaAction({
        ...datos,
        diocesisLocalidadId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUltimaGuardada(result.data);
      campos.siguienteDelLote();
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
      {ultimaGuardada && (
        <Mensaje tono="exito">
          {ultimaGuardada.codigo ? (
            <p>
              Guardada. Su Código es{" "}
              <strong className="font-mono">{ultimaGuardada.codigo}</strong>.
              Escribilo en la imagen.
            </p>
          ) : (
            <p>
              Guardada con su numeración anterior,{" "}
              <strong className="font-mono">
                {ultimaGuardada.identificacion}
              </strong>
              .
            </p>
          )}
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <CamposDePeregrinaForm campos={campos} rotulacion={rotulacion} />

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <p className="text-base leading-relaxed text-tinta-suave">
        {vieja
          ? "No se le genera un Código ahora. Cuando se le escriba uno nuevo, se genera desde su ficha."
          : "El Código se arma con la Provincia, la Modalidad y el número."}
      </p>

      <Boton type="submit" disabled={pendiente}>
        {pendiente
          ? "Guardando…"
          : vieja
            ? "Registrar con su numeración"
            : "Registrar con su Código"}
      </Boton>
    </form>
  );
}
