import { getPeregrinaByIdAction } from "@/modules/peregrina/peregrina.router";
import { getHistorialDePeregrinaAction } from "@/modules/asignacion/asignacion.router";
import {
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";
import EstadoDePeregrina from "@/modules/peregrina/EstadoDePeregrina";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import Mensaje from "@/components/Mensaje";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { dias, fecha, nombreDeTenedor } from "@/lib/formato";
import { hrefDeTenedor } from "@/lib/tenedor-en-pantalla";
import BajaDePeregrina from "./BajaDePeregrina";

/**
 * Una Peregrina, en una pantalla.
 *
 * The parent the historial page never had: it existed at
 * /peregrina/[id]/historial with nothing above it, so nothing could link to a
 * Peregrina — only to its history.
 *
 * This page answers the question somebody actually arrives with, which is where
 * the image is, and puts the chain of custody one link away rather than in front
 * of them. Reads are not wrapped in a try: a refusal belongs to the (dashboard)
 * error boundary, and a Peregrina somebody may not see rendering as "no existe"
 * would be a different lie from the one issue #2 refused to tell.
 */

export const dynamic = "force-dynamic";

export default async function PeregrinaPage({
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
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <header className="space-y-3">
        <h1 className="font-mono text-3xl font-bold text-tinta">
          {peregrina.codigo}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <EstadoDePeregrina estado={peregrina.estado} />
          {peregrina.deBaja && <Insignia tono="neutro">Dada de baja</Insignia>}
        </div>

        <p className="text-base text-tinta-suave">
          {TIPO_LABELS[peregrina.tipo]} ·{" "}
          {MODALIDAD_LABELS[peregrina.modalidad]} ·{" "}
          {peregrina.diocesisLocalidad.nombre}, {peregrina.provincia}
        </p>
      </header>

      <Tarjeta titulo="¿Quién la tiene ahora?">
        {abierta ? (
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              La tiene <strong>{nombreDeTenedor(abierta.tenedor)}</strong>
              {abierta.tenedor.deBaja ? " (dado de baja)" : ""}, desde el{" "}
              {fecha(abierta.abiertaAt)} — {dias(abierta.diasEnCargo)}.
            </p>

            {/* Una pareja es **un** Tenedor y se nombra una sola vez. La «y»
                sola se pasa por alto en un teléfono, así que la clase va
                también como palabra. */}
            {abierta.tenedor.tipo === "matrimonio" && (
              <Insignia tono="neutro">Matrimonio</Insignia>
            )}

            {peregrina.estado === "extraviada" && (
              // The open Asignación stays open on purpose when an image is
              // marked extraviada: the last holder is the only lead anybody
              // has, and hiding it deletes the answer to the question this
              // screen exists to answer — user story 6.
              <Mensaje tono="alerta">
                <p>
                  La imagen está registrada como extraviada. Éstas son las
                  últimas manos en las que estuvo, y es por donde conviene
                  empezar a buscarla.
                </p>
              </Mensaje>
            )}

            {/* Cada clase de Tenedor tiene su propia página: la de la persona,
                o la de la pareja. */}
            <BotonEnlace tono="secundario" href={hrefDeTenedor(abierta.tenedor)}>
              Ver a {nombreDeTenedor(abierta.tenedor)}
            </BotonEnlace>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              No la tiene nadie ahora.
            </p>
            {!peregrina.deBaja && (
              <BotonEnlace href="/asignacion/new">
                Entregarla a un Misionero
              </BotonEnlace>
            )}
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Historial"
        acciones={
          historial.length > 0 && (
            <BotonEnlace
              tono="secundario"
              href={`/peregrina/${peregrina.id}/historial`}
            >
              Ver el historial completo
            </BotonEnlace>
          )
        }
      >
        {historial.length === 0 ? (
          <Vacio
            titulo="Nunca estuvo a cargo de nadie"
            mensaje="Esta imagen todavía no se entregó. Cuando se entregue, cada período va a quedar acá."
          />
        ) : (
          <ol className="space-y-3">
            {historial
              .slice()
              .reverse()
              .slice(0, 3)
              .map((a) => (
                <li key={a.id} className="text-base leading-relaxed">
                  <strong>{nombreDeTenedor(a.tenedor)}</strong> —{" "}
                  {fecha(a.abiertaAt)} a{" "}
                  {a.cerradaAt ? fecha(a.cerradaAt) : "hoy"} (
                  {dias(a.diasEnCargo)})
                </li>
              ))}
            {historial.length > 3 && (
              <li className="text-base text-tinta-suave">
                y {historial.length - 3}{" "}
                {historial.length - 3 === 1 ? "período más" : "períodos más"}.
              </li>
            )}
          </ol>
        )}
      </Tarjeta>

      <Tarjeta titulo="Administrar">
        <BajaDePeregrina
          id={peregrina.id}
          codigo={peregrina.codigo}
          deBaja={peregrina.deBaja}
        />
      </Tarjeta>
    </main>
  );
}
