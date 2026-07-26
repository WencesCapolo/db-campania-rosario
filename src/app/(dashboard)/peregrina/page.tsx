import Link from "next/link";
import {
  getPeregrinasAction,
  getPeregrinasPorEstadoAction,
  getPeregrinasPorModalidadAction,
} from "@/modules/peregrina/peregrina.router";
import {
  ESTADO_LABELS,
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import type {
  Modalidad,
  PeregrinaEstado,
} from "@/modules/peregrina/peregrina.schema";
import Insignia, { type TonoDeInsignia } from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { nombreCompleto } from "@/lib/formato";
import FiltrosDePeregrina from "./FiltrosDePeregrina";

/**
 * El listado de Peregrinas.
 *
 * Cards, not a table. A Referente arrives holding an image with a Código
 * written on it and is matching that one string, so the Código is the largest
 * thing on each card and the whole card is the link — a 54px row of text with a
 * small link in it is a worse target than a card you can hit anywhere. It also
 * means nothing has to collapse at a breakpoint: a table wide enough to be
 * useful cannot honour story 21 on a phone without becoming a different layout
 * below `lg`, and maintaining two is how they drift.
 *
 * The read is deliberately not wrapped in a try. It throws on refusal,
 * `error.tsx` catches it, and `Vacio` is only reachable when the query genuinely
 * returned nothing — "no hay Peregrinas" shown to somebody who was refused would
 * tell them their territory is empty and confirm to a prober that it exists.
 *
 * Filtering: the service is asked the narrowest question it has a method and an
 * index for, and anything left over is narrowed here. Território scoping has
 * already bounded the set to one Diócesis by the time it arrives, so the
 * remainder is tens of rows, not thousands. Code search is in memory for the
 * same reason and because there is no `searchPeregrinas` to call — adding one
 * would be a service change, and this PRD is presentation only.
 */

const TONO_POR_ESTADO: Record<PeregrinaEstado, TonoDeInsignia> = {
  activa: "exito",
  en_reparacion: "aviso",
  extraviada: "alerta",
  inactiva: "neutro",
};

export const dynamic = "force-dynamic";

export default async function PeregrinaListaPage({
  searchParams,
}: {
  searchParams: Promise<{
    codigo?: string;
    estado?: string;
    modalidad?: string;
  }>;
}) {
  const filtros = await searchParams;

  const codigo = (filtros.codigo ?? "").trim();
  const estado = esEstado(filtros.estado) ? filtros.estado : "";
  const modalidad = esModalidad(filtros.modalidad) ? filtros.modalidad : "";

  const peregrinas = filtrar(await leer(estado, modalidad), {
    codigo,
    estado,
    modalidad,
  });

  const hayFiltros = Boolean(codigo || estado || modalidad);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Peregrinas</h1>
          <p className="mt-1 text-base text-tinta-suave" aria-live="polite">
            {peregrinas.length === 1
              ? "1 imagen"
              : `${peregrinas.length} imágenes`}
            {hayFiltros ? " con esos filtros" : " en tu territorio"}
          </p>
        </div>

        <BotonEnlace href="/peregrina/new">Registrar una Peregrina</BotonEnlace>
      </header>

      <FiltrosDePeregrina
        codigo={codigo}
        estado={estado}
        modalidad={modalidad}
      />

      {peregrinas.length === 0 ? (
        hayFiltros ? (
          <Vacio
            titulo="Ninguna imagen coincide"
            mensaje="Probá con menos filtros, o revisá el Código: se escribe como «CBA JOV 0001»."
          />
        ) : (
          <Vacio
            titulo="Todavía no hay imágenes cargadas"
            mensaje="Cuando registres la primera va a aparecer acá, con su Código generado para que puedas anotarlo en la imagen."
            accion={
              <BotonEnlace href="/peregrina/new">
                Registrar la primera
              </BotonEnlace>
            }
          />
        )
      ) : (
        <ul className="space-y-3">
          {peregrinas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/peregrina/${p.id}`}
                className="block rounded-tarjeta border-2 border-borde bg-papel p-4 hover:border-borde-fuerte"
              >
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-bold text-tinta">
                    {p.codigo}
                  </span>
                  <Insignia tono={TONO_POR_ESTADO[p.estado]}>
                    {ESTADO_LABELS[p.estado]}
                  </Insignia>
                </span>

                <span className="mt-3 block text-base leading-relaxed text-tinta">
                  {p.tenenciaActual ? (
                    <>
                      La tiene{" "}
                      <strong>{nombreCompleto(p.tenenciaActual)}</strong>.
                    </>
                  ) : (
                    <span className="text-tinta-suave">
                      No la tiene nadie ahora.
                    </span>
                  )}
                </span>

                <span className="mt-1 block text-base text-tinta-suave">
                  {TIPO_LABELS[p.tipo]} · {MODALIDAD_LABELS[p.modalidad]} ·{" "}
                  {p.diocesisLocalidad.nombre}
                  {p.deBaja ? " · dada de baja" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * Ask the service the narrowest question it has an index for.
 *
 * With both filters set there is no combined method, so the more selective of
 * the two goes to the database and the other is applied below. Estado is the
 * more selective in practice — most images are `activa`, but the interesting
 * queries are for the handful that are not.
 */
async function leer(estado: string, modalidad: string): Promise<PeregrinaDTO[]> {
  if (estado) return getPeregrinasPorEstadoAction(estado as PeregrinaEstado);
  if (modalidad)
    return getPeregrinasPorModalidadAction(modalidad as Modalidad);
  return getPeregrinasAction();
}

function filtrar(
  peregrinas: PeregrinaDTO[],
  { codigo, modalidad }: { codigo: string; estado: string; modalidad: string }
): PeregrinaDTO[] {
  const buscado = codigo.toLowerCase().replace(/\s+/g, " ");

  return peregrinas.filter((p) => {
    if (modalidad && p.modalidad !== modalidad) return false;
    if (buscado && !p.codigo.toLowerCase().includes(buscado)) return false;
    return true;
  });
}

function esEstado(v: string | undefined): v is PeregrinaEstado {
  return (
    v === "activa" ||
    v === "en_reparacion" ||
    v === "extraviada" ||
    v === "inactiva"
  );
}

function esModalidad(v: string | undefined): v is Modalidad {
  // Checked against the enum rather than a hand-written list, so adding a
  // Modalidad cannot leave a filter silently rejecting it.
  return MODALIDADES.some((m) => m === v);
}
