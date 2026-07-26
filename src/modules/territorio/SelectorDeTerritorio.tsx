"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Eleccion from "@/components/Eleccion";
import { Cargando, PanelDeError, Vacio } from "@/components/EstadosAsincronicos";
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
 * Native `<select>` through `Eleccion`: the OS picker is large, familiar, and
 * scrolls with a thumb. On the primitives now rather than on its own CAMPO and
 * ETIQUETA constants, which is not only a visual change — `Eleccion` binds the
 * label, the help text, the error and the derived facts to the control with one
 * `useId`, and the hand-written version bound the label and left the derived
 * `<dl>` associated by an id it built itself.
 *
 * The three states go through the shared components, and the distinction they
 * enforce is the one that matters here: the wide read this makes reaches one
 * level past the Actor's own territory, to their Provincia, so a picker is not a
 * list of one. A refusal is still a refusal — it lands on `PanelDeError` with a
 * retry, never on `Vacio`, because "no hay Diócesis en tu territorio" told to
 * somebody who was refused is a different sentence from the truth.
 */

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
  | { fase: "error" }
  | { fase: "listo"; provincias: ProvinciaDTO[]; diocesis: DiocesisLocalidadDTO[] };

export default function SelectorDeTerritorio({
  value,
  onChange,
  name = "diocesisLocalidadId",
  required = true,
}: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [provinciaId, setProvinciaId] = useState<string>("");

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
        if (vigente) setEstado({ fase: "error" });
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
    return <Cargando filas={2} etiqueta="Cargando territorios…" />;
  }

  if (estado.fase === "error") {
    return (
      <PanelDeError
        titulo="No pudimos cargar los territorios"
        mensaje="Puede ser la conexión. Probá de nuevo; si sigue sin cargar, avisale a un Asesor Nacional."
        alReintentar={reintentar}
      />
    );
  }

  if (estado.diocesis.length === 0) {
    return (
      <Vacio
        titulo="No hay Diócesis/Localidades cargadas"
        mensaje="Todavía no hay ninguna en tu territorio. Pedile a un Asesor Nacional que agregue la tuya."
      />
    );
  }

  const mostrarProvincias = estado.provincias.length > 1;

  return (
    <div className="space-y-5">
      {mostrarProvincias && (
        <Eleccion
          etiqueta="Provincia"
          ayuda="Sirve para acortar la lista de abajo. No hace falta elegirla."
          vacia="Todas las Provincias"
          value={provinciaId}
          opciones={estado.provincias.map((p) => ({
            valor: p.id,
            etiqueta: p.nombre,
          }))}
          onChange={(e) => {
            setProvinciaId(e.target.value);
            // The chosen Diócesis may not be in the new Provincia's list, and a
            // select whose value is not among its options renders as blank while
            // the form still holds the old id.
            onChange(null);
          }}
        />
      )}

      <Eleccion
        etiqueta="Diócesis/Localidad"
        name={name}
        required={required}
        vacia="Elegí una Diócesis/Localidad"
        value={value ?? ""}
        opciones={diocesisVisibles.map((d) => ({
          valor: d.id,
          // Full names, never abbreviations — "Córdoba", not "CBA".
          etiqueta:
            mostrarProvincias && !provinciaId
              ? `${d.nombre} — ${d.provincia.nombre}`
              : d.nombre,
        }))}
        onChange={(e) => onChange(e.target.value || null)}
        // Provincia and Región follow from the choice. Shown, never asked for.
        derivado={
          elegida && (
            <dl className="grid grid-cols-1 gap-3 rounded-control bg-fondo p-4 text-base sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-tinta-suave">Provincia</dt>
                <dd className="text-tinta">{elegida.provincia.nombre}</dd>
              </div>
              <div>
                <dt className="font-semibold text-tinta-suave">Región</dt>
                <dd className="text-tinta">{elegida.region}</dd>
              </div>
            </dl>
          )
        }
      />
    </div>
  );
}
