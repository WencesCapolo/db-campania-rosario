"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
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
  createPeregrinaSchema,
  type PeregrinaDTO,
} from "@/modules/peregrina/peregrina.types";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * Registrar una Peregrina.
 *
 * Territory is one choice rather than three fields, which is the point of
 * issue 1. The Código is not asked for: it is generated, and shown afterwards so
 * whoever is holding the image knows what to write on it.
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

// Built from the enum through the shared label table, never listed by hand:
// the Campaña has sixteen Modalidades, and a second copy of that list is a
// second place to forget one.
const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  // The three-letter code is shown beside the name because it is the part that
  // ends up in the Código, and somebody checking a statue against the screen is
  // reading the code rather than the name.
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const ROTULACIONES = [
  { valor: "nueva", etiqueta: "No, hay que generarle un Código" },
  { valor: "anterior", etiqueta: "Sí, ya tiene una numeración escrita" },
] as const;

type Rotulacion = (typeof ROTULACIONES)[number]["valor"];

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

export default function CreatePeregrinaForm() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [rotulacion, setRotulacion] = useState<Rotulacion>("nueva");
  const [numeracionAnterior, setNumeracionAnterior] = useState("");
  const [tipo, setTipo] = useState<PeregrinaTipo>("peregrina");
  const [modalidad, setModalidad] = useState<Modalidad>("JOV");
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [ultimaGuardada, setUltimaGuardada] = useState<PeregrinaDTO | null>(
    null,
  );
  const validacion = useValidacionAlSalir(createPeregrinaSchema);

  function guardar(seguirCargando: boolean) {
    setError(null);
    setUltimaGuardada(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    startTransition(async () => {
      const result = await createPeregrinaAction({
        ...(rotulacion === "anterior" && { numeracionAnterior }),
        tipo,
        modalidad,
        diocesisLocalidadId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (seguirCargando) {
        // Keep tipo, modalidad and territory: the next image is almost always
        // from the same batch. Only the Código changes, and it is generated —
        // or the numeración, which is the one thing typed again.
        setUltimaGuardada(result.data);
        setNumeracionAnterior("");
        validacion.limpiar();
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
          validacion.alEscribir("numeracionAnterior");
        }}
      />

      {rotulacion === "anterior" && (
        <Campo
          etiqueta="Numeración anterior"
          ayuda="Escribila tal como está en la imagen."
          value={numeracionAnterior}
          error={validacion.error("numeracionAnterior")}
          onChange={(e) => {
            setNumeracionAnterior(e.target.value);
            validacion.alEscribir("numeracionAnterior");
          }}
          onBlur={(e) =>
            validacion.alSalir("numeracionAnterior", e.target.value)
          }
        />
      )}

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

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      {rotulacion === "nueva" && (
        <p className="text-base leading-relaxed text-tinta-suave">
          El Código se genera automáticamente a partir de la Provincia y la
          Modalidad. No hace falta escribirlo.
        </p>
      )}

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
