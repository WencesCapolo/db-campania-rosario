"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  asignarAction,
  entregarAction,
} from "@/modules/asignacion/asignacion.router";
import type { MisioneroDTO } from "@/modules/misionero/misionero.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * Registrar que una Peregrina pasó a un Misionero — historias 1, 2, 8, 21 y 22.
 *
 * Three steps rather than one form: "Paso 1: Elegir Misionero", "Paso 2: Elegir
 * Imagen", "Confirmar". The people entering these records are often older adults
 * doing it from a phone in a parish hall, and a single screen with two pickers and
 * two notes is the form they give up on.
 *
 * One step is one decision, one thumb, no scrolling to find the button. The Volver
 * at each step goes back without losing what was already chosen.
 *
 * If the image is already out, this does not refuse: it says who has it and closes
 * that period as it opens the next, which is exactly what "she passed it on to me"
 * means. Assigning an image nobody has and handing one on are different service
 * operations — `asignar` and `entregar` — and the flow picks between them so the
 * person does not have to know that.
 *
 * Styling is deliberately plain — issue #4 brings the design system, and this is
 * meant to be **restyled, not rebuilt**. What is load-bearing is the behaviour:
 * 48px controls, native `<select>` for the OS picker, focus rings that do not
 * depend on colour, errors announced, and a confirmation that states the
 * consequence before it happens.
 */

const CAMPO =
  "min-h-12 w-full rounded-lg border-2 border-neutral-400 bg-white px-3 text-lg " +
  "text-neutral-900 focus-visible:outline-none focus-visible:ring-4 " +
  "focus-visible:ring-blue-700 focus-visible:border-blue-700";

const ETIQUETA = "block text-lg font-semibold text-neutral-900";

const BOTON =
  "min-h-12 rounded-lg px-5 text-lg font-semibold focus-visible:outline-none " +
  "focus-visible:ring-4 focus-visible:ring-blue-700 disabled:opacity-60";

const PRIMARIO = `${BOTON} bg-neutral-900 text-white`;
const SECUNDARIO = `${BOTON} border-2 border-neutral-900 text-neutral-900`;

type Paso = 1 | 2 | 3;

export default function FlujoDeAsignacion({
  misioneros,
  peregrinas,
}: {
  misioneros: MisioneroDTO[];
  peregrinas: PeregrinaDTO[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [paso, setPaso] = useState<Paso>(1);
  const [misioneroId, setMisioneroId] = useState("");
  const [peregrinaId, setPeregrinaId] = useState("");
  const [nota, setNota] = useState("");
  const [notaCierre, setNotaCierre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const misionero = misioneros.find((m) => m.id === misioneroId);
  const peregrina = peregrinas.find((p) => p.id === peregrinaId);
  // The image is out. Confirming closes that period and opens the next one.
  const tenencia = peregrina?.tenenciaActual ?? null;

  // Three states on every async surface, and this is the empty one. A picker with
  // nothing in it has to say what to do, not sit there.
  if (misioneros.length === 0 || peregrinas.length === 0) {
    return (
      <p className="rounded-lg border-2 border-neutral-900 bg-neutral-100 p-4 text-lg text-neutral-900">
        {misioneros.length === 0
          ? "Todavía no hay Misioneros en tu territorio. Registrá uno antes de entregar una imagen."
          : "Todavía no hay Peregrinas en tu territorio. Registrá una antes de entregarla."}
      </p>
    );
  }

  function confirmar() {
    if (!peregrina || !misionero) return;
    setError(null);

    startTransition(async () => {
      const resultado = tenencia
        ? await entregarAction({
            peregrinaId: peregrina.id,
            misioneroId: misionero.id,
            notaCierre: notaCierre.trim() || null,
            nota: nota.trim() || null,
          })
        : await asignarAction({
            peregrinaId: peregrina.id,
            misioneroId: misionero.id,
            nota: nota.trim() || null,
          });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/peregrina/${peregrina.id}/historial`);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <p className="text-lg text-neutral-700" aria-live="polite">
        Paso {paso} de 3
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-lg border-2 border-red-800 bg-red-50 p-4 text-lg text-red-900"
        >
          {error}
        </p>
      )}

      {/* ── Paso 1: Elegir Misionero ── */}
      {paso === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-neutral-900">
            Paso 1: Elegir Misionero
          </h2>

          <div className="space-y-2">
            <label className={ETIQUETA} htmlFor="misionero">
              ¿A quién pasa la imagen?
            </label>
            <select
              id="misionero"
              className={CAMPO}
              value={misioneroId}
              onChange={(e) => setMisioneroId(e.target.value)}
            >
              <option value="">Elegí un Misionero…</option>
              {misioneros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.apellido}, {m.nombre} — {m.diocesisLocalidad.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={PRIMARIO}
            disabled={!misioneroId}
            onClick={() => setPaso(2)}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Paso 2: Elegir Imagen ── */}
      {paso === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-neutral-900">
            Paso 2: Elegir Imagen
          </h2>
          <p className="text-lg text-neutral-700">
            Para {misionero?.nombre} {misionero?.apellido}.
          </p>

          <div className="space-y-2">
            <label className={ETIQUETA} htmlFor="peregrina">
              ¿Qué Peregrina?
            </label>
            <select
              id="peregrina"
              className={CAMPO}
              value={peregrinaId}
              onChange={(e) => setPeregrinaId(e.target.value)}
            >
              <option value="">Elegí una Peregrina…</option>
              {peregrinas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo}
                  {p.tenenciaActual
                    ? ` — la tiene ${p.tenenciaActual.nombre} ${p.tenenciaActual.apellido}`
                    : " — sin entregar"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={PRIMARIO}
              disabled={!peregrinaId}
              onClick={() => setPaso(3)}
            >
              Siguiente
            </button>
            <button
              type="button"
              className={SECUNDARIO}
              onClick={() => setPaso(1)}
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: Confirmar ── */}
      {paso === 3 && peregrina && misionero && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-neutral-900">Confirmar</h2>

          <div className="rounded-lg border-2 border-neutral-900 bg-neutral-100 p-4 text-lg text-neutral-900">
            <p>
              La Peregrina <strong>{peregrina.codigo}</strong> queda a cargo de{" "}
              <strong>
                {misionero.nombre} {misionero.apellido}
              </strong>
              .
            </p>
            {tenencia && (
              // Say the consequence before it happens. Somebody's period of charge
              // is about to close, and that is the sentence they have to agree with.
              <p className="mt-2">
                Se cierra el período de{" "}
                <strong>
                  {tenencia.nombre} {tenencia.apellido}
                </strong>
                , que la tiene ahora. Su período queda en el historial.
              </p>
            )}
          </div>

          {tenencia && (
            <div className="space-y-2">
              <label className={ETIQUETA} htmlFor="nota-cierre">
                ¿Algo que anotar sobre la devolución? (opcional)
              </label>
              <textarea
                id="nota-cierre"
                className={`${CAMPO} min-h-24 py-2`}
                value={notaCierre}
                maxLength={500}
                onChange={(e) => setNotaCierre(e.target.value)}
                placeholder="Volvió con el marco flojo."
              />
            </div>
          )}

          <div className="space-y-2">
            <label className={ETIQUETA} htmlFor="nota">
              ¿Algo que anotar sobre la entrega? (opcional)
            </label>
            <textarea
              id="nota"
              className={`${CAMPO} min-h-24 py-2`}
              value={nota}
              maxLength={500}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Entregada en la peregrinación diocesana."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={PRIMARIO}
              disabled={pendiente}
              onClick={confirmar}
            >
              {pendiente ? "Registrando…" : "Registrar la entrega"}
            </button>
            <button
              type="button"
              className={SECUNDARIO}
              disabled={pendiente}
              onClick={() => setPaso(2)}
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
