"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import type { Modalidad, PeregrinaTipo } from "@/modules/peregrina/peregrina.schema";
import {
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";

/**
 * Registrar una Peregrina.
 *
 * Territory is one choice rather than three fields, which is the point of
 * issue 1. The Código is not asked for: it is generated, and shown afterwards so
 * whoever is holding the image knows what to write on it.
 *
 * Styling is deliberately plain — issue 4 brings the design system. What is
 * load-bearing here is the behaviour: 48px controls, focus rings that do not
 * depend on colour, errors announced, and "Guardar y agregar otra", because
 * these records get typed in by hand a batch at a time.
 */

// Built from the enum through the shared label table, never listed by hand:
// the Campaña has sixteen Modalidades, and a second copy of that list is a
// second place to forget one.
const MODALIDADES_ELEGIBLES: { valor: Modalidad; etiqueta: string }[] =
  MODALIDADES.map((m) => ({ valor: m, etiqueta: MODALIDAD_LABELS[m] }));

const TIPOS: { valor: PeregrinaTipo; etiqueta: string }[] = (
  ["peregrina", "auxiliar"] as const
).map((t) => ({ valor: t, etiqueta: TIPO_LABELS[t] }));

const CAMPO =
  "min-h-12 w-full rounded-lg border-2 border-neutral-400 bg-white px-3 text-lg " +
  "text-neutral-900 focus-visible:outline-none focus-visible:ring-4 " +
  "focus-visible:ring-blue-700 focus-visible:border-blue-700";

const ETIQUETA = "block text-lg font-semibold text-neutral-900";

const BOTON =
  "min-h-12 rounded-lg px-5 text-lg font-semibold focus-visible:outline-none " +
  "focus-visible:ring-4 focus-visible:ring-blue-700 disabled:opacity-60";

export default function CreatePeregrinaForm() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [tipo, setTipo] = useState<PeregrinaTipo>("peregrina");
  const [modalidad, setModalidad] = useState<Modalidad>("JOV");
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null
  );

  const [error, setError] = useState<string | null>(null);
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null);

  function guardar(seguirCargando: boolean) {
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

      if (seguirCargando) {
        // Keep tipo, modalidad and territory: the next image is almost always
        // from the same batch. Only the Código changes, and it is generated.
        setUltimoCodigo(result.data.codigo);
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
      {ultimoCodigo && (
        <p
          role="status"
          className="rounded-lg border-2 border-neutral-900 bg-neutral-100 p-4 text-lg text-neutral-900"
        >
          Guardada. Su Código es <strong>{ultimoCodigo}</strong>. Escribilo en la
          imagen.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border-2 border-red-800 bg-red-50 p-4 text-lg text-red-900"
        >
          {error}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className={ETIQUETA}>Tipo</legend>
        <select
          className={CAMPO}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as PeregrinaTipo)}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={ETIQUETA}>Modalidad</legend>
        <select
          className={CAMPO}
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value as Modalidad)}
        >
          {MODALIDADES_ELEGIBLES.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta} ({m.valor})
            </option>
          ))}
        </select>
      </fieldset>

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <p className="text-lg text-neutral-700">
        El Código se genera automáticamente a partir de la Provincia y la
        Modalidad. No hace falta escribirlo.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pendiente}
          className={`${BOTON} bg-neutral-900 text-white`}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => guardar(true)}
          className={`${BOTON} border-2 border-neutral-900 text-neutral-900`}
        >
          Guardar y agregar otra
        </button>
      </div>
    </form>
  );
}
