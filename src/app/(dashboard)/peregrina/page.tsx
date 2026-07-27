import Link from "next/link";
import { getPeregrinasPaginadasAction } from "@/modules/peregrina/peregrina.router";
import { getDiocesisLocalidadesAction } from "@/modules/territorio/territorio.router";
import { getCurrentUser } from "@/lib/get-current-user";
import { esNacional } from "@/lib/authorization/alcance";
import {
  ESTADO_LABELS,
  MODALIDAD_LABELS,
  TIPO_LABELS,
  comoQueryString,
  filtrosDesdeParams,
  hayFiltros,
} from "@/modules/peregrina/peregrina.types";
import { CLAVE_DE_PAGINA, paginaDesdeParams } from "@/lib/paginacion";
import Paginador from "@/components/Paginador";
import type { PeregrinaEstado } from "@/modules/peregrina/peregrina.schema";
import Insignia, { type TonoDeInsignia } from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { nombreCompleto } from "@/lib/formato";
import FiltrosDeInventario from "@/modules/peregrina/FiltrosDeInventario";

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
 * Filtering is one question to the database now, not a narrow indexed read plus a
 * pass in memory. That older arrangement was honest about its limits — territorial
 * scoping had already cut the set down to tens of rows — but it could not answer
 * the six-dimension question the tablero links here with, and a count on the
 * tablero has to lead to *exactly* the rows behind it. Same filters, same
 * predicate, one definition: `filtrosDeInventarioSchema`.
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = filtrosDesdeParams(params);
  const paginaPedida = paginaDesdeParams(params);

  // The territory picker is for the two nacional rols only. A Referente Local's
  // records are one Diócesis already, and offering them their Provincia's other
  // Diócesis would be offering a control whose every use is refused.
  const actor = await getCurrentUser();
  const territorios = esNacional(actor.role)
    ? (await getDiocesisLocalidadesAction()).map((d) => ({
        id: d.id,
        nombre: d.nombre,
      }))
    : null;

  const pagina = await getPeregrinasPaginadasAction(filtros, paginaPedida);
  const peregrinas = pagina.filas;
  const filtrado = hayFiltros(filtros);

  // The filters are already a query string, so a page link is that string plus
  // one key. Built here rather than in the paginador, which would then have to
  // know every filter key — there is one list of those, and it is in the module.
  const hrefDePagina = (n: number) => {
    const query = new URLSearchParams(comoQueryString(filtros));
    query.set(CLAVE_DE_PAGINA, String(n));
    return `/peregrina?${query.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Peregrinas</h1>
          <p className="mt-1 text-base text-tinta-suave" aria-live="polite">
            {/* The whole matching set, from the aggregate — not this page's rows.
                "20 imágenes" on page one of nine would be a count of the page
                size, which is the figure this project spent issue 5 removing. */}
            {pagina.total === 1 ? "1 imagen" : `${pagina.total} imágenes`}
            {filtrado ? " con esos filtros" : " en tu territorio"}
          </p>
        </div>

        <BotonEnlace href="/peregrina/new">Registrar una Peregrina</BotonEnlace>
      </header>

      <FiltrosDeInventario
        filtros={filtros}
        destino="/peregrina"
        territorios={territorios}
      />

      {peregrinas.length === 0 ? (
        filtrado ? (
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

      <Paginador
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        total={pagina.total}
        porPagina={pagina.porPagina}
        unidad="imágenes"
        href={hrefDePagina}
      />
    </main>
  );
}
