"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  getDiocesisLocalidadesAction,
  getProvinciasAction,
} from "./territorio.router";
import type { DiocesisLocalidadDTO, ProvinciaDTO } from "./territorio.types";

/**
 * The territory picker.
 *
 * One choice, not three: a Usuario picks a Diócesis/Localidad and the Provincia
 * and Región are shown, derived, read-only. There is no way to enter a
 * contradictory combination because there is nothing to enter.
 *
 * A Provincia select appears only when the Actor can see more than one — for a
 * Referente Local it would be a list of one, and a control with one option is
 * noise. An Asesor Nacional gets it, because their list is the country.
 *
 * Native `<select>`: the OS picker is large, familiar, and scrolls with a thumb.
 * Styling here is deliberately plain — issue 4 brings the design system, and
 * this component is meant to be restyled rather than rebuilt. The behaviour is
 * the part worth getting right now: three states, full names, no colour-only
 * signals, 48px targets.
 */

const CAMPO =
  "min-h-12 w-full rounded-lg border-2 border-neutral-400 bg-white px-3 text-lg " +
  "text-neutral-900 focus-visible:outline-none focus-visible:ring-4 " +
  "focus-visible:ring-blue-700 focus-visible:border-blue-700";

const ETIQUETA = "block text-lg font-semibold text-neutral-900";

interface Props {
  /** Currently selected Diócesis/Localidad, if any. */
  value: string | null;
  onChange: (diocesisLocalidadId: string | null) => void;
  /** Rendered as the form control's name, for a plain form POST. */
  name?: string;
  required?: boolean;
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; provincias: ProvinciaDTO[]; diocesis: DiocesisLocalidadDTO[] };

export default function SelectorDeTerritorio({
  value,
  onChange,
  name = "diocesisLocalidadId",
  required = true,
}: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [provinciaId, setProvinciaId] = useState<string>("");
  const idProvincia = useId();
  const idDiocesis = useId();

  // Bumped by the retry button to re-run the effect. The state is only ever
  // written from inside the promise, never synchronously in the effect body,
  // so a load cannot cascade renders.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;

    Promise.all([getProvinciasAction(), getDiocesisLocalidadesAction()]).then(
      ([provincias, diocesis]) => {
        if (vigente) setEstado({ fase: "listo", provincias, diocesis });
      },
      () => {
        if (vigente) {
          setEstado({
            fase: "error",
            mensaje: "No pudimos cargar el listado de territorios.",
          });
        }
      }
    );

    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado({ fase: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  const diocesisVisibles = useMemo(() => {
    if (estado.fase !== "listo") return [];
    if (!provinciaId) return estado.diocesis;
    return estado.diocesis.filter((d) => d.provincia.id === provinciaId);
  }, [estado, provinciaId]);

  const elegida = useMemo(
    () =>
      estado.fase === "listo"
        ? (estado.diocesis.find((d) => d.id === value) ?? null)
        : null,
    [estado, value]
  );

  if (estado.fase === "cargando") {
    return (
      <p role="status" className="py-4 text-lg text-neutral-700">
        Cargando territorios…
      </p>
    );
  }

  if (estado.fase === "error") {
    return (
      <div role="alert" className="space-y-3 py-4">
        <p className="text-lg text-neutral-900">{estado.mensaje}</p>
        <button
          type="button"
          onClick={reintentar}
          className="min-h-12 rounded-lg border-2 border-neutral-900 px-4 text-lg font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (estado.diocesis.length === 0) {
    return (
      <div role="status" className="py-4">
        <p className="text-lg text-neutral-900">
          Todavía no hay Diócesis/Localidades cargadas en tu territorio. Pedile a
          un Asesor Nacional que agregue la tuya.
        </p>
      </div>
    );
  }

  const mostrarProvincias = estado.provincias.length > 1;

  return (
    <div className="space-y-5">
      {mostrarProvincias && (
        <div className="space-y-2">
          <label htmlFor={idProvincia} className={ETIQUETA}>
            Provincia{" "}
            <span className="font-normal text-neutral-700">
              (para acortar la lista)
            </span>
          </label>
          <select
            id={idProvincia}
            className={CAMPO}
            value={provinciaId}
            onChange={(e) => {
              setProvinciaId(e.target.value);
              onChange(null);
            }}
          >
            <option value="">Todas las Provincias</option>
            {estado.provincias.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={idDiocesis} className={ETIQUETA}>
          Diócesis/Localidad
        </label>
        <select
          id={idDiocesis}
          name={name}
          required={required}
          className={CAMPO}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          aria-describedby={elegida ? `${idDiocesis}-derivado` : undefined}
        >
          <option value="">Elegí una Diócesis/Localidad</option>
          {diocesisVisibles.map((d) => (
            <option key={d.id} value={d.id}>
              {/* Full names, never abbreviations — "Córdoba", not "CBA". */}
              {mostrarProvincias && !provinciaId
                ? `${d.nombre} — ${d.provincia.nombre}`
                : d.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Provincia and Región follow from the choice. Shown, never asked for. */}
      {elegida && (
        <dl
          id={`${idDiocesis}-derivado`}
          className="grid grid-cols-1 gap-3 rounded-lg bg-neutral-100 p-4 text-lg sm:grid-cols-2"
        >
          <div>
            <dt className="font-semibold text-neutral-700">Provincia</dt>
            <dd className="text-neutral-900">{elegida.provincia.nombre}</dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-700">Región</dt>
            <dd className="text-neutral-900">{elegida.region}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
