import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/get-current-user";
import { esNacional } from "@/lib/authorization/alcance";
import { getTableroAction } from "@/modules/tablero/tablero.router";
import { getDiocesisLocalidadesAction } from "@/modules/territorio/territorio.router";
import {
  ESTADO_LABELS,
  MODALIDAD_LABELS,
  TIPO_LABELS,
  comoQueryString,
  filtrosDesdeParams,
  type FiltrosDeInventario as Filtros,
} from "@/modules/peregrina/peregrina.types";
// El componente y el tipo se llaman igual porque son la misma cosa vista de dos
// lados: el formulario que los escribe y la forma que valida lo que escribió.
import FiltrosDeInventario from "@/modules/peregrina/FiltrosDeInventario";
import type { TableroDTO } from "@/modules/tablero/tablero.types";
import Barras from "@/components/Barras";
import Tarjeta from "@/components/Tarjeta";
import { BotonEnlace } from "@/components/Boton";
import { Cargando } from "@/components/EstadosAsincronicos";
import { nombreDeTenedor } from "@/lib/formato";
import { hrefDeTenedor } from "@/lib/tenedor-en-pantalla";

/**
 * El tablero.
 *
 * The screen the people who authorised this project will look at, and the one
 * that is worthless if the figures are wrong — so everything on it is a server
 * aggregate through one seam, and the only interactive part is the filter form.
 *
 * One column on a phone and two from `sm` up (story 24). Nothing collapses into a
 * different layout: every block is a card with a heading, a few rows of words and
 * numbers, and at most a bar per row, which reads the same at 390px and at
 * 1280px. That is the whole reason there is no dense table anywhere on it.
 *
 * Every figure is a link to the records behind it, carrying the filters that
 * produced it (story 21). The links are built here rather than in the DTO because
 * an href is a fact about routing, and `TableroDTO` should not know there is a web
 * page — but they are built from `comoQueryString`, the same function the filter
 * form writes the address with, so a figure and the list it leads to cannot
 * disagree about what was asked.
 *
 * `Suspense` is what makes story 25 true: the shell, the heading and the filters
 * paint immediately and the figures stream in behind a skeleton. Without it the
 * whole route waits on the slowest aggregate, which on a parish connection looks
 * like a screen that never loaded.
 *
 * The read is deliberately not wrapped in a try. A refusal — a rol with no
 * territory, or a crafted `?diocesisLocalidadId=` — reaches `error.tsx`. A
 * tablero of zeros in its place would say "your Campaña is empty" to somebody who
 * was refused.
 */

export const dynamic = "force-dynamic";

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = filtrosDesdeParams(await searchParams);
  const actor = await getCurrentUser();

  const territorios = esNacional(actor.role)
    ? (await getDiocesisLocalidadesAction()).map((d) => ({
        id: d.id,
        nombre: d.nombre,
      }))
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold text-tinta">Tablero</h1>
        <p className="mt-1 text-base text-tinta-suave">
          {esNacional(actor.role)
            ? "Las cifras de toda la Campaña."
            : "Las cifras de tu territorio."}{" "}
          Cada número lleva a los registros que lo componen.
        </p>
      </header>

      <FiltrosDeInventario
        filtros={filtros}
        destino="/tablero"
        territorios={territorios}
        conBusqueda={false}
      />

      <Suspense
        key={comoQueryString(filtros)}
        fallback={<Cargando filas={4} />}
      >
        <Cifras filtros={filtros} />
      </Suspense>
    </main>
  );
}

async function Cifras({ filtros }: { filtros: Filtros }) {
  const tablero = await getTableroAction(filtros);
  const enlace = (extra: Partial<Filtros>) => aListado(filtros, extra);

  return (
    <div className="space-y-5">
      <Totales tablero={tablero} filtros={filtros} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Barras
          titulo="Por Estado"
          unidad={UNIDAD}
          barras={tablero.porEstado.map((fila) => ({
            etiqueta: ESTADO_LABELS[fila.estado],
            valor: fila.total,
            href: enlace({ estado: fila.estado }),
          }))}
        />

        <Barras
          titulo="Por Modalidad"
          unidad={UNIDAD}
          barras={tablero.porModalidad.map((fila) => ({
            etiqueta: MODALIDAD_LABELS[fila.modalidad],
            valor: fila.total,
            href: enlace({ modalidad: fila.modalidad }),
          }))}
        />

        <Barras
          titulo="Peregrinas y auxiliares"
          unidad={UNIDAD}
          barras={tablero.porTipo.map((fila) => ({
            etiqueta: TIPO_LABELS[fila.tipo],
            valor: fila.total,
            href: enlace({ tipo: fila.tipo }),
          }))}
        />

        {tablero.porRegion && (
          <Barras
            titulo="Por Región"
            unidad={UNIDAD}
            barras={tablero.porRegion.map((fila) => ({
              etiqueta: fila.region,
              valor: fila.total,
              href: enlace({ region: fila.region }),
            }))}
          />
        )}

        {tablero.porDiocesis && (
          <Barras
            titulo="Diócesis y localidades"
            unidad={UNIDAD}
            barras={tablero.porDiocesis.map((fila) => ({
              etiqueta: fila.nombre,
              valor: fila.total,
              href: enlace({ diocesisLocalidadId: fila.diocesisLocalidadId }),
            }))}
          />
        )}

        {tablero.crecimiento && (
          <Barras
            titulo="Altas por mes"
            unidad={UNIDAD}
            barras={tablero.crecimiento.map((fila) => ({
              etiqueta: comoMes(fila.mes),
              valor: fila.total,
            }))}
            vacio="Todavía no hay imágenes cargadas."
          />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Extraviadas tablero={tablero} />
        <Estancadas tablero={tablero} />
        <NuncaAsignadas tablero={tablero} filtros={filtros} />
        <SinImagen tablero={tablero} />
      </div>
    </div>
  );
}

const UNIDAD = { singular: "imagen", plural: "imágenes" };

/**
 * The three numbers somebody came for — stories 1, 3 and 4.
 *
 * Big, first, and each one a link. "Sin dueño ahora" is the one that leads to
 * work: those are the images that could be in somebody's hands and are not.
 */
function Totales({
  tablero,
  filtros,
}: {
  tablero: TableroDTO;
  filtros: Filtros;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Cifra
        titulo="Imágenes"
        valor={tablero.totalPeregrinas}
        href={aListado(filtros, {})}
      />
      <Cifra
        titulo="No las tiene nadie"
        valor={tablero.sinTenencia}
        href={aListado(filtros, { tenencia: "libre" })}
        nota="Disponibles para entregar"
      />
      <Cifra
        titulo="Misioneros"
        valor={tablero.totalMisioneros}
        href="/misionero"
      />
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  href,
  nota,
}: {
  titulo: string;
  valor: number;
  href: string;
  nota?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col justify-center rounded-tarjeta border-2 border-borde-fuerte bg-papel px-5 py-4 no-underline"
    >
      <span className="text-4xl font-bold tabular-nums text-tinta">
        {valor}
      </span>
      <span className="text-base font-semibold text-accion underline">
        {titulo}
      </span>
      {nota && <span className="text-base text-tinta-suave">{nota}</span>}
    </Link>
  );
}

/** Story 9: the lost images, and who last had each one. */
function Extraviadas({ tablero }: { tablero: TableroDTO }) {
  if (!tablero.extraviadas) {
    return (
      <Tarjeta titulo="Extraviadas">
        <p className="text-base text-tinta-suave">
          Esta tarjeta no aplica con el filtro de Estado que elegiste. Limpiá el
          filtro para verla.
        </p>
      </Tarjeta>
    );
  }

  const { total, filas } = tablero.extraviadas;

  return (
    <Tarjeta titulo="Extraviadas">
      {total === 0 ? (
        <p className="text-base text-tinta">
          Ninguna imagen está marcada como extraviada.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {filas.map((fila) => (
              <li key={fila.id}>
                <Link
                  href={`/peregrina/${fila.id}/historial`}
                  className="flex min-h-12 flex-col justify-center rounded-control"
                >
                  <span className="font-mono text-lg font-bold text-accion underline">
                    {fila.codigo}
                  </span>
                  {/* Un Matrimonio es **un** Tenedor y da un nombre, no dos:
                      la tarjeta dice a quién llamar, y «Ana Álvarez» cuando la
                      tienen Ana y Juan es media respuesta (ADR 0010). */}
                  <span className="text-base text-tinta">
                    {fila.ultimoTenedor
                      ? `La tenía ${nombreDeTenedor(fila.ultimoTenedor)}`
                      : "Nunca estuvo a cargo de nadie"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Recorte total={total} mostradas={filas.length} />
        </>
      )}
    </Tarjeta>
  );
}

/** Story 8: images that have been in the same hands too long. */
function Estancadas({ tablero }: { tablero: TableroDTO }) {
  const { total, filas } = tablero.estancadas;

  return (
    <Tarjeta titulo="Sin cambiar de manos">
      {total === 0 ? (
        <p className="text-base text-tinta">
          Ninguna imagen lleva más de {tablero.umbralDeDiasEstancada} días en
          las mismas manos.
        </p>
      ) : (
        <>
          <p className="mb-3 text-base text-tinta-suave">
            Más de {tablero.umbralDeDiasEstancada} días en las mismas manos.
          </p>
          <ul className="space-y-3">
            {filas.map((fila) => (
              <li key={fila.peregrinaId}>
                <Link
                  href={`/peregrina/${fila.peregrinaId}/historial`}
                  className="flex min-h-12 flex-col justify-center rounded-control"
                >
                  <span className="font-mono text-lg font-bold text-accion underline">
                    {fila.codigo}
                  </span>
                  <span className="text-base text-tinta">
                    {nombreDeTenedor(fila.tenedor)} · hace {fila.dias} días
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Recorte total={total} mostradas={filas.length} />
        </>
      )}
    </Tarjeta>
  );
}

/** Story 19: images nobody has ever taken out. */
function NuncaAsignadas({
  tablero,
  filtros,
}: {
  tablero: TableroDTO;
  filtros: Filtros;
}) {
  if (!tablero.nuncaAsignadas) {
    return (
      <Tarjeta titulo="Nunca entregadas">
        <p className="text-base text-tinta-suave">
          Esta tarjeta no aplica con el filtro de tenencia que elegiste.
        </p>
      </Tarjeta>
    );
  }

  const { total, filas } = tablero.nuncaAsignadas;

  return (
    <Tarjeta
      titulo="Nunca entregadas"
      acciones={
        total > 0 ? (
          <BotonEnlace href="/asignacion/new" tono="secundario">
            Entregar una
          </BotonEnlace>
        ) : undefined
      }
    >
      {total === 0 ? (
        <p className="text-base text-tinta">
          Todas las imágenes estuvieron a cargo de alguien alguna vez.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {filas.map((fila) => (
              <li key={fila.id}>
                <Link
                  href={`/peregrina/${fila.id}`}
                  className="flex min-h-12 items-center rounded-control font-mono text-lg font-bold text-accion underline"
                >
                  {fila.codigo}
                </Link>
              </li>
            ))}
          </ul>
          <Recorte
            total={total}
            mostradas={filas.length}
            href={aListado(filtros, { tenencia: "libre" })}
          />
        </>
      )}
    </Tarjeta>
  );
}

/**
 * Story 5: whoever has their hands free, to match against the images above.
 *
 * Tenedores and not people, so a Matrimonio is **one** entry and neither spouse
 * appears beside it (ADR 0010). While this counted people, an idle couple filled
 * two lines of a card whose whole job is to say how much capacity is going
 * unused — and both lines led to half a household.
 */
function SinImagen({ tablero }: { tablero: TableroDTO }) {
  const { total, filas } = tablero.tenedoresSinPeregrina;

  return (
    <Tarjeta titulo="Sin imagen a cargo">
      {total === 0 ? (
        <p className="text-base text-tinta">
          Todos tienen al menos una imagen a cargo.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {filas.map((fila) => (
              <li key={`${fila.tipo}:${fila.id}`}>
                <Link
                  href={hrefDeTenedor(fila)}
                  className="flex min-h-12 items-center rounded-control text-lg font-semibold text-accion underline"
                >
                  {nombreDeTenedor(fila)}
                </Link>
              </li>
            ))}
          </ul>
          <Recorte
            total={total}
            mostradas={filas.length}
            href="/misionero?imagen=sin"
          />
        </>
      )}
    </Tarjeta>
  );
}

/**
 * "Showing 8 of 23" — said out loud, because a list cut short without saying so
 * reads as the whole answer.
 */
function Recorte({
  total,
  mostradas,
  href,
}: {
  total: number;
  mostradas: number;
  href?: string;
}) {
  if (total <= mostradas) return null;

  return (
    <p className="mt-3 text-base text-tinta-suave">
      Mostrando {mostradas} de {total}.{" "}
      {href && (
        <Link href={href} className="font-semibold text-accion underline">
          Ver todas
        </Link>
      )}
    </p>
  );
}

/**
 * A figure's link to its records: the filters on screen, plus the one dimension
 * the figure itself narrows.
 *
 * `undefined` in `extra` deliberately overrides, so a card that fixes a dimension
 * — Estado for the Extraviadas — replaces the filter rather than adding to it.
 */
function aListado(filtros: Filtros, extra: Partial<Filtros>): string {
  const query = comoQueryString({ ...filtros, ...extra });
  return query ? `/peregrina?${query}` : "/peregrina";
}

/** `2026-07` as "julio 2026" — a month is read, not parsed. */
function comoMes(mes: string): string {
  const [anio, numero] = mes.split("-");
  const fecha = new Date(Number(anio), Number(numero) - 1, 1);
  return fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
