import Link from "next/link";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import { ESTADO_LABELS } from "@/modules/peregrina/peregrina.types";
import { MODALIDAD_LABELS } from "./prototipo-datos";

/**
 * PROTOTIPO — Variante C, «Pregunta primero». Throwaway.
 *
 * Neither of the other two asks what the person came to do. This one does, and
 * everything else is subordinate to the answer.
 *
 * The screen opens as one question — "¿Qué imagen buscás?" — with a large field
 * and a row of chunky Estado buttons that are toggles rather than a dropdown, so
 * filtering costs one tap and the current filter is legible without opening
 * anything. Results are a plain two-line list under it: Código, then a sentence
 * saying where the image is.
 *
 * The bet is that a screen with one obvious thing on it beats a screen with a
 * complete map of the system, for somebody who opens the app three times a
 * month.
 */

const FILTROS = [
  { clave: "todas", etiqueta: "Todas", activo: true },
  { clave: "activa", etiqueta: "Activas" },
  { clave: "en_reparacion", etiqueta: "En reparación" },
  { clave: "extraviada", etiqueta: "Extraviadas" },
  { clave: "sin_tenencia", etiqueta: "Sin nadie" },
];

const ANILLO =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

function marcaDeEstado(estado: string): string {
  return (
    { activa: "●", en_reparacion: "▲", extraviada: "✕", inactiva: "—" }[
      estado
    ] ?? "●"
  );
}

export default function PrototipoVarianteC({
  peregrinas,
}: {
  peregrinas: PeregrinaDTO[];
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 pb-40 pt-6">
        <h1 className="text-4xl font-bold leading-tight">
          ¿Qué imagen buscás?
        </h1>

        <label className="mt-5 block">
          <span className="sr-only">Buscar por Código</span>
          <input
            type="search"
            placeholder="Escribí el Código, por ejemplo CBA JOV 0001"
            className={`min-h-16 w-full rounded-xl border-2 border-neutral-900 px-4 text-xl ${ANILLO}`}
          />
        </label>

        <fieldset className="mt-5">
          <legend className="mb-2 text-lg font-semibold">Mostrar</legend>
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.clave}
                type="button"
                aria-pressed={Boolean(f.activo)}
                className={`min-h-12 rounded-full border-2 px-4 text-lg font-semibold ${ANILLO} ${
                  f.activo
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-400 bg-white text-neutral-900 hover:border-neutral-900"
                }`}
              >
                {f.activo ? "✓ " : ""}
                {f.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="mt-8 text-lg text-neutral-700" aria-live="polite">
          {peregrinas.length} imágenes
        </p>

        <ul className="mt-2 divide-y-2 divide-neutral-200 border-y-2 border-neutral-200">
          {peregrinas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/peregrina/${p.id}`}
                className={`flex min-h-20 flex-col justify-center gap-1 py-4 hover:bg-neutral-100 ${ANILLO}`}
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-bold">
                    {p.codigo}
                  </span>
                  <span className="text-lg text-neutral-700">
                    <span aria-hidden>{marcaDeEstado(p.estado)}</span>{" "}
                    {ESTADO_LABELS[p.estado]}
                  </span>
                </span>
                <span className="text-lg leading-relaxed">
                  {p.tenenciaActual ? (
                    <>
                      La tiene {p.tenenciaActual.nombre}{" "}
                      {p.tenenciaActual.apellido}, en{" "}
                      {p.diocesisLocalidad.nombre}.
                    </>
                  ) : (
                    <>
                      No la tiene nadie. Está en {p.diocesisLocalidad.nombre}.
                    </>
                  )}{" "}
                  <span className="text-neutral-700">
                    {MODALIDAD_LABELS[p.modalidad]}.
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/peregrina/new"
          className={`mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-800 px-5 text-xl font-semibold text-white ${ANILLO}`}
        >
          Registrar una Peregrina nueva
        </Link>
      </div>
    </div>
  );
}
