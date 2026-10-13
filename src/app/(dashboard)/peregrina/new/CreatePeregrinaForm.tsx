"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import CamposDePeregrinaForm, {
  useCamposDePeregrina,
  type Rotulacion,
} from "@/modules/peregrina/CamposDePeregrina";

/**
 * Registrar una Peregrina.
 *
 * Territory is one choice rather than three fields, which is the point of
 * issue 1. Of the Código only the número is asked for, and it is optional
 * (ADR 0013): left empty, the next free one is taken, and the Código is shown
 * afterwards so whoever is holding the image knows what to write on it.
 *
 * The one exception is an image that already has something written on it from
 * before the Campaña's format — ADR 0012. That is one question, asked first,
 * because it decides whether there is anything to type at all; the answer stays
 * between saves, since a batch of old images arrives together.
 *
 * On the primitives now. The behaviour that was load-bearing before the design
 * system arrived still is, and none of it comes from the CSS: the two save
 * buttons, because these records get typed in by hand a batch at a time and
 * "Guardar y agregar otra" keeps the Tipo, the Modalidad and the territory for
 * the next one; and the Código shown afterwards, because it is about to be
 * written on a statue in pen.
 *
 * The two panels are `Mensaje` rather than two hand-written boxes, and that
 * settles something the hand-written version only happened to get right: the
 * Código panel was `role="status"` and the failure was `role="alert"`, both
 * chosen per element. Here the role follows from the tone, so the next panel
 * somebody adds cannot get it backwards.
 */

const ROTULACIONES = [
  { valor: "nueva", etiqueta: "No, lleva el formato de la Campaña" },
  { valor: "vieja", etiqueta: "Sí, ya tiene una numeración escrita de antes" },
] as const;

export default function CreatePeregrinaForm() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [rotulacion, setRotulacion] = useState<Rotulacion>("nueva");
  const campos = useCamposDePeregrina();
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [ultimaGuardada, setUltimaGuardada] = useState<PeregrinaDTO | null>(
    null,
  );

  function guardar(seguirCargando: boolean) {
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

      if (seguirCargando) {
        // Keep tipo, modalidad and territory: the next image is almost always
        // from the same batch. The número, the numeración and the fecha are the
        // ones typed again.
        setUltimaGuardada(result.data);
        campos.siguienteDelLote();
        return;
      }

      router.push("/peregrina");
    });
  }

  return (
    <form
      className="max-w-xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
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

      <Eleccion
        etiqueta="¿La imagen ya tiene una numeración escrita?"
        ayuda="Las imágenes que se rotularon antes del formato de la Campaña."
        value={rotulacion}
        opciones={[...ROTULACIONES]}
        onChange={(e) => {
          setRotulacion(e.target.value as Rotulacion);
          campos.validacion.limpiar();
        }}
      />

      <CamposDePeregrinaForm campos={campos} rotulacion={rotulacion} />

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Boton>
        <Boton
          tono="secundario"
          disabled={pendiente}
          onClick={() => guardar(true)}
        >
          Guardar y agregar otra
        </Boton>
      </div>
    </form>
  );
}
