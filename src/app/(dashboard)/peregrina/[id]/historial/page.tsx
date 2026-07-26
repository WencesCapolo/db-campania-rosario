import { getPeregrinaByIdAction } from "@/modules/peregrina/peregrina.router";
import { getHistorialDePeregrinaAction } from "@/modules/asignacion/asignacion.router";
import { getMisionerosAction } from "@/modules/misionero/misionero.router";
import EstadoDePeregrina from "@/modules/peregrina/EstadoDePeregrina";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import Mensaje from "@/components/Mensaje";
import Volver from "@/components/Volver";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { dias, fecha, nombreCompleto, registro } from "@/lib/formato";
import RegistrarDevolucion from "./RegistrarDevolucion";
import CorregirAsignacion from "./CorregirAsignacion";

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
 * On the primitives, and the three helper functions that used to sit at the bottom
 * of this file are gone. `fecha`, `dias` and `registro` live in
 * `src/lib/formato.ts` — they were lifted out of here when the Misionero detail
 * page needed the same three, and this copy was the one left behind to drift.
 * `registro` is the one that matters: it takes a `RegistroDTO`, which has no name
 * field in it at all, so no screen can render "registrada por María Pérez" about
 * a login that a whole territory shares.
 *
 * Every period carries a Corregir control — story 17. This is the right screen for
 * it and the only one: a correction is made while reading the chain and noticing
 * that a link in it is wrong, and it is the screen that already shows
 * `corregidaAt`, so the record of the edit appears beside the thing that makes
 * edits.
 */

export const dynamic = "force-dynamic";

export default async function HistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The Misionero list is read here, alongside the history, because every period
  // carries a correction dialog and each of those needs the same picker. One read
  // for the page rather than one per period, and it is the Actor's own scoped list
  // — `MisioneroService.listAll` derives its filter, so this cannot widen what a
  // correction may point at.
  const [peregrina, historial, misioneros] = await Promise.all([
    getPeregrinaByIdAction(id),
    getHistorialDePeregrinaAction(id),
    getMisionerosAction(),
  ]);

  const abierta = historial.find((a) => a.abierta) ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <div className="space-y-2">
        <Volver href={`/peregrina/${peregrina.id}`}>
          Volver a {peregrina.codigo}
        </Volver>

        <h1 className="font-mono text-3xl font-bold text-tinta">
          {peregrina.codigo}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <EstadoDePeregrina estado={peregrina.estado} />
          {peregrina.deBaja && <Insignia tono="neutro">Dada de baja</Insignia>}
        </div>

        <p className="text-base text-tinta-suave">
          {peregrina.diocesisLocalidad.nombre}, {peregrina.provincia}
        </p>
      </div>

      <Tarjeta titulo="¿Quién la tiene ahora?">
        {abierta ? (
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              La tiene <strong>{nombreCompleto(abierta.misionero)}</strong>
              {abierta.misionero.deBaja ? " (dado de baja)" : ""}, desde el{" "}
              {fecha(abierta.abiertaAt)} — {dias(abierta.diasEnCargo)}.
            </p>

            {peregrina.estado === "extraviada" && (
              // Marking a Peregrina Extraviada leaves this period open on
              // purpose: the last holder is the only lead anybody has, and
              // closing it would delete the answer to the question this screen
              // exists to answer — user story 6.
              <Mensaje tono="alerta">
                <p>
                  La imagen está registrada como extraviada. Éste es el último
                  Misionero que la tuvo, y es por donde conviene empezar a
                  buscarla.
                </p>
              </Mensaje>
            )}

            <RegistrarDevolucion
              peregrinaId={peregrina.id}
              codigo={peregrina.codigo}
              misionero={nombreCompleto(abierta.misionero)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              No está a cargo de nadie.
            </p>
            {!peregrina.deBaja && (
              <BotonEnlace href="/asignacion/new">
                Entregarla a un Misionero
              </BotonEnlace>
            )}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Historial completo">
        {historial.length === 0 ? (
          <Vacio
            titulo="Nunca estuvo a cargo de nadie"
            mensaje="Esta imagen todavía no se entregó. Cuando se entregue, cada período va a quedar acá."
          />
        ) : (
          <ol className="space-y-5">
            {historial.map((a) => (
              <li
                key={a.id}
                className="space-y-1 border-b-2 border-borde pb-5 last:border-b-0 last:pb-0"
              >
                <p className="text-base font-bold text-tinta">
                  {nombreCompleto(a.misionero)}
                  {a.misionero.deBaja ? " (dado de baja)" : ""}
                </p>

                <p className="text-base leading-relaxed text-tinta">
                  {fecha(a.abiertaAt)} a{" "}
                  {a.cerradaAt ? fecha(a.cerradaAt) : "hoy, sigue a cargo"} (
                  {dias(a.diasEnCargo)})
                </p>

                {a.notaApertura && (
                  <p className="text-base text-tinta-suave">
                    Al entregar: {a.notaApertura}
                  </p>
                )}
                {a.notaCierre && (
                  <p className="text-base text-tinta-suave">
                    Al devolver: {a.notaCierre}
                  </p>
                )}

                {/* A territory, never a person. */}
                <p className="text-base text-tinta-suave">{registro(a)}</p>

                {a.corregidaAt && (
                  // The correction is itself visible — user story 17. A record
                  // that was edited and does not say so is a record nobody can
                  // trust twice.
                  <p className="text-base text-tinta-suave">
                    Corregida el {fecha(a.corregidaAt)}
                    {a.corregidaPor?.diocesisLocalidad
                      ? ` desde ${a.corregidaPor.diocesisLocalidad}`
                      : ""}
                    .
                  </p>
                )}

                <div className="pt-2">
                  <CorregirAsignacion asignacion={a} misioneros={misioneros} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>
    </main>
  );
}
