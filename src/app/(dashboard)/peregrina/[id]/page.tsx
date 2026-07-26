import { getPeregrinaByIdAction } from "@/modules/peregrina/peregrina.router";
import { getHistorialDePeregrinaAction } from "@/modules/asignacion/asignacion.router";
import {
  ESTADO_LABELS,
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";
import type { PeregrinaEstado } from "@/modules/peregrina/peregrina.schema";
import Tarjeta from "@/components/Tarjeta";
import Insignia, { type TonoDeInsignia } from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { dias, fecha, nombreCompleto } from "@/lib/formato";
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

const TONO_POR_ESTADO: Record<PeregrinaEstado, TonoDeInsignia> = {
  activa: "exito",
  en_reparacion: "aviso",
  extraviada: "alerta",
  inactiva: "neutro",
};

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
          <Insignia tono={TONO_POR_ESTADO[peregrina.estado]}>
            {ESTADO_LABELS[peregrina.estado]}
          </Insignia>
          {peregrina.deBaja && <Insignia tono="neutro">Dada de baja</Insignia>}
        </div>

        <p className="text-base text-tinta-suave">
          {TIPO_LABELS[peregrina.tipo]} · {MODALIDAD_LABELS[peregrina.modalidad]} ·{" "}
          {peregrina.diocesisLocalidad.nombre}, {peregrina.provincia}
        </p>
      </header>

      <Tarjeta titulo="¿Quién la tiene ahora?">
        {abierta ? (
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              La tiene{" "}
              <strong>{nombreCompleto(abierta.misionero)}</strong>
              {abierta.misionero.deBaja ? " (dado de baja)" : ""}, desde el{" "}
              {fecha(abierta.abiertaAt)} — {dias(abierta.diasEnCargo)}.
            </p>

            {peregrina.estado === "extraviada" && (
              // The open Asignación stays open on purpose when an image is
              // marked extraviada: the last holder is the only lead anybody
              // has, and hiding it deletes the answer to the question this
              // screen exists to answer — user story 6.
              <p className="rounded-control border-2 border-alerta-tinta bg-alerta-fondo p-4 text-base leading-relaxed text-alerta-tinta">
                La imagen está registrada como extraviada. Éste es el último
                Misionero que la tuvo, y es por donde conviene empezar a
                buscarla.
              </p>
            )}

            <BotonEnlace
              tono="secundario"
              href={`/misionero/${abierta.misionero.id}`}
            >
              Ver a {nombreCompleto(abierta.misionero)}
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
                  <strong>{nombreCompleto(a.misionero)}</strong> —{" "}
                  {fecha(a.abiertaAt)} a{" "}
                  {a.cerradaAt ? fecha(a.cerradaAt) : "hoy"} ({dias(a.diasEnCargo)}
                  )
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
