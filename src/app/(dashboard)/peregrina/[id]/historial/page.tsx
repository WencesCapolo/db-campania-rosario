import Link from "next/link";
import { getPeregrinaByIdAction } from "@/modules/peregrina/peregrina.router";
import { getHistorialDePeregrinaAction } from "@/modules/asignacion/asignacion.router";
import { ESTADO_LABELS } from "@/modules/peregrina/peregrina.types";
import type { AsignacionDTO } from "@/modules/asignacion/asignacion.types";
import RegistrarDevolucion from "./RegistrarDevolucion";

/**
 * La cadena de custodia de una Peregrina — historias 4, 5, 6 y 18.
 *
 * The screen this whole issue exists for: when an image cannot be found, the first
 * question anybody asks is who had it last and since when, and the previous system
 * knew only the fourth of four holders.
 *
 * Read oldest first, because a chain reads forwards. Neither read is wrapped in a
 * try: an authorization refusal belongs to the (dashboard) error boundary, and a
 * history somebody may not see rendering as "sin historial" would confirm the
 * record exists.
 *
 * Plain Tailwind on purpose — issue #4 restyles this rather than rebuilding it.
 */

export const dynamic = "force-dynamic";

export default async function HistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [peregrina, historial] = await Promise.all([
    getPeregrinaByIdAction(id),
    getHistorialDePeregrinaAction(id),
  ]);

  const abierta = historial.find((a) => a.abierta) ?? null;

  return (
    <div className="space-y-8 p-6 text-lg">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-neutral-900">
          {peregrina.codigo}
        </h1>
        <p className="text-lg text-neutral-700">
          {ESTADO_LABELS[peregrina.estado]} — {peregrina.diocesisLocalidad.nombre}
          {peregrina.deBaja ? " — dada de baja" : ""}
        </p>
      </div>

      {/* ── Tenencia actual ── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-neutral-900">
          ¿Quién la tiene ahora?
        </h2>

        {abierta ? (
          <div className="space-y-3 rounded-lg border-2 border-neutral-900 bg-neutral-100 p-4">
            <p className="text-lg text-neutral-900">
              <strong>
                {abierta.misionero.nombre} {abierta.misionero.apellido}
              </strong>
              , desde el {fecha(abierta.abiertaAt)} — {dias(abierta.diasEnCargo)}.
              {abierta.misionero.deBaja ? " (dado de baja)" : ""}
            </p>

            {peregrina.estado === "extraviada" && (
              // Marking a Peregrina Extraviada leaves this period open on purpose:
              // it is the only lead anybody has — user story 6.
              <p className="text-lg text-neutral-900">
                La imagen está registrada como extraviada. Éste es el último
                Misionero que la tuvo, y es por donde conviene empezar a buscarla.
              </p>
            )}

            <RegistrarDevolucion
              peregrinaId={peregrina.id}
              codigo={peregrina.codigo}
              misionero={`${abierta.misionero.nombre} ${abierta.misionero.apellido}`}
            />
          </div>
        ) : (
          <p className="rounded-lg border-2 border-neutral-400 p-4 text-lg text-neutral-700">
            No está a cargo de nadie.{" "}
            <Link
              href="/asignacion/new"
              className="font-semibold text-neutral-900 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
            >
              Entregarla a un Misionero
            </Link>
            .
          </p>
        )}
      </section>

      {/* ── La cadena entera ── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-neutral-900">Historial</h2>

        {historial.length === 0 ? (
          <p className="rounded-lg border-2 border-neutral-400 p-4 text-lg text-neutral-700">
            Esta Peregrina no estuvo nunca a cargo de nadie.
          </p>
        ) : (
          <ol className="space-y-3">
            {historial.map((a) => (
              <li
                key={a.id}
                className="space-y-1 rounded-lg border-2 border-neutral-400 p-4"
              >
                <p className="text-lg font-semibold text-neutral-900">
                  {a.misionero.nombre} {a.misionero.apellido}
                  {a.misionero.deBaja ? " (dado de baja)" : ""}
                </p>
                <p className="text-lg text-neutral-900">
                  {fecha(a.abiertaAt)} —{" "}
                  {a.cerradaAt ? fecha(a.cerradaAt) : "sigue a cargo"} (
                  {dias(a.diasEnCargo)})
                </p>

                {a.notaApertura && (
                  <p className="text-base text-neutral-700">
                    Al entregar: {a.notaApertura}
                  </p>
                )}
                {a.notaCierre && (
                  <p className="text-base text-neutral-700">
                    Al devolver: {a.notaCierre}
                  </p>
                )}

                <p className="text-base text-neutral-700">{registro(a)}</p>

                {a.corregidaAt && (
                  // The correction is itself visible — user story 17.
                  <p className="text-base text-neutral-700">
                    Corregida el {fecha(a.corregidaAt)}
                    {a.corregidaPor?.diocesisLocalidad
                      ? ` desde ${a.corregidaPor.diocesisLocalidad}`
                      : ""}
                    .
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/**
 * Who registered the period, as a *territory*.
 *
 * Referentes Locales share one login per territory, so the record identifies a
 * place and never a person. Copy that said "registrada por María Pérez" would be
 * asserting something the data cannot support.
 */
function registro(a: AsignacionDTO): string {
  const entrega = a.registradaPor.diocesisLocalidad
    ? `Entrega registrada desde ${a.registradaPor.diocesisLocalidad}`
    : "Entrega registrada a nivel nacional";

  if (!a.cerradaPor) return `${entrega}.`;

  const devolucion = a.cerradaPor.diocesisLocalidad
    ? `devolución desde ${a.cerradaPor.diocesisLocalidad}`
    : "devolución a nivel nacional";

  return `${entrega}; ${devolucion}.`;
}

function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(d);
}

function dias(n: number): string {
  if (n === 0) return "hoy mismo";
  return n === 1 ? "1 día" : `${n} días`;
}
