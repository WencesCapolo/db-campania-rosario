import Link from "next/link";
import {
  ESTADO_LABELS,
  comoQueryString,
  type FiltrosDeInventario as Filtros,
} from "@/modules/peregrina/peregrina.types";
import type { TableroDTO } from "@/modules/tablero/tablero.types";
import type { PeregrinaEstado } from "@/modules/peregrina/peregrina.schema";
import { Panel } from "@/components/Barras";
import Columnas from "@/components/Columnas";

/**
 * Las dos tarjetas del tablero que no son una lista de barras.
 *
 * Fuera de `page.tsx` porque un archivo de página no puede exportar otra cosa
 * que la página, y éstas se montan solas en el navegador para medirlas.
 */

export const UNIDAD = { singular: "imagen", plural: "imágenes" };

/**
 * Activas y extraviadas, las dos cifras que alguien viene a mirar del Estado.
 *
 * Dos números grandes con glifo y palabra, porque el color solo no lo lee uno de
 * cada doce hombres; la barra de abajo es la proporción y está `aria-hidden`
 * porque las cifras ya la dicen. En reparación e inactivas no son ni una cosa ni
 * la otra, y se nombran debajo en lugar de desaparecer: las cuatro suman el
 * total.
 */
export function ActivasYExtraviadas({
  tablero,
  filtros,
}: {
  tablero: TableroDTO;
  filtros: Filtros;
}) {
  const de = (estado: PeregrinaEstado) =>
    tablero.porEstado.find((fila) => fila.estado === estado)?.total ?? 0;
  const total = tablero.totalPeregrinas;
  const otras = (["en_reparacion", "inactiva"] as const).filter(
    (estado) => de(estado) > 0,
  );

  // Los cuatro tramos en orden, cada uno empezando donde terminó el anterior.
  const tramos = (
    [
      ["activa", "fill-exito-tinta"],
      ["en_reparacion", "fill-aviso-tinta"],
      ["inactiva", "fill-neutro-tinta"],
      ["extraviada", "fill-alerta-tinta"],
    ] as const
  ).reduce<{ x: number; ancho: number; clase: string }[]>(
    (hechos, [estado, clase]) => {
      const ultimo = hechos.at(-1);
      const x = ultimo ? ultimo.x + ultimo.ancho : 0;
      return [...hechos, { x, ancho: de(estado), clase }];
    },
    [],
  );

  return (
    <Panel
      titulo="Activas y extraviadas"
      nota="El estado de la imagen, no de quién la tiene."
    >
      {total === 0 ? (
        <p className="text-base text-tinta-suave">
          Ninguna imagen coincide con los filtros.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <CifraDeEstado
              glifo="✓"
              etiqueta="Activas"
              valor={de("activa")}
              total={total}
              href={aListado(filtros, { estado: "activa" })}
              clases="border-exito-tinta bg-exito-fondo text-exito-tinta"
            />
            <CifraDeEstado
              glifo="✕"
              etiqueta="Extraviadas"
              valor={de("extraviada")}
              total={total}
              href={aListado(filtros, { estado: "extraviada" })}
              clases="border-alerta-tinta bg-alerta-fondo text-alerta-tinta"
            />
          </div>

          <svg
            aria-hidden
            viewBox={`0 0 ${total} 10`}
            preserveAspectRatio="none"
            className="mt-3 h-5 w-full overflow-hidden rounded-marco border-2 border-borde-fuerte bg-fondo"
          >
            {tramos.map((tramo) => (
              <rect
                key={tramo.clase}
                x={tramo.x}
                y="0"
                height="10"
                width={tramo.ancho}
                className={tramo.clase}
              />
            ))}
          </svg>

          {otras.length > 0 && (
            <p className="mt-2 text-base text-tinta">
              Y{" "}
              {otras.map((estado, i) => (
                <span key={estado}>
                  {i > 0 && " y "}
                  <Link
                    href={aListado(filtros, { estado })}
                    className="text-azul underline"
                  >
                    {de(estado)} {ESTADO_LABELS[estado].toLowerCase()}
                  </Link>
                </span>
              ))}
              , que no son ni una cosa ni la otra.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function CifraDeEstado({
  glifo,
  etiqueta,
  valor,
  total,
  href,
  clases,
}: {
  glifo: string;
  etiqueta: string;
  valor: number;
  total: number;
  href: string;
  clases: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-24 flex-col justify-center rounded-control border-2 px-4 py-3 no-underline ${clases}`}
    >
      <span className="text-base underline">
        <span aria-hidden>{glifo}</span> {etiqueta}
      </span>
      <span className="text-4xl leading-tight font-bold tabular-nums">
        {valor.toLocaleString("es-AR")}
      </span>
      <span className="text-base">{Math.round((valor * 100) / total)} %</span>
    </Link>
  );
}

/**
 * Las imágenes que alguien tiene, por el quinquenio en que se consagró quien la
 * tiene.
 *
 * Lo que no entra en las columnas no desaparece: las que tiene alguien sin año
 * cargado y las que no tiene nadie van debajo, con nombre y cifra, porque un
 * gráfico que las omite parece decir que todas tienen año.
 */
export function PorConsagracion({
  tablero,
  filtros,
}: {
  tablero: TableroDTO;
  filtros: Filtros;
}) {
  const conAnio = tablero.porConsagracion.filter(
    (fila): fila is { desde: number; total: number } => fila.desde !== null,
  );
  const sinAnio =
    tablero.porConsagracion.find((fila) => fila.desde === null)?.total ?? 0;

  return (
    <Panel
      titulo="Por año de consagración"
      nota="Las imágenes que hoy tiene alguien, según el año en que se consagró quien la tiene."
    >
      {conAnio.length === 0 ? (
        <p className="text-base text-tinta-suave">
          Nadie que tenga una imagen tiene el año de consagración cargado.
        </p>
      ) : (
        <Columnas
          unidad={UNIDAD}
          columnas={conAnio.map((fila) => ({
            etiqueta: `${fila.desde} a ${fila.desde + 4}`,
            arriba: String(fila.desde),
            abajo: `–${String(fila.desde + 4).slice(2)}`,
            valor: fila.total,
          }))}
        />
      )}

      <ul className="mt-3 flex flex-wrap gap-2">
        {sinAnio > 0 && (
          <li className={PASTILLA}>
            Su Misionero no tiene año cargado:{" "}
            <b className="ml-1 tabular-nums">{sinAnio}</b>
          </li>
        )}
        {tablero.sinTenencia > 0 && (
          <li>
            <Link
              href={aListado(filtros, { tenencia: "libre" })}
              className={`${PASTILLA} underline`}
            >
              No las tiene nadie:{" "}
              <b className="ml-1 tabular-nums">{tablero.sinTenencia}</b>
            </Link>
          </li>
        )}
      </ul>
    </Panel>
  );
}

const PASTILLA =
  "inline-flex min-h-12 items-center rounded-full border-2 border-neutro-tinta bg-neutro-fondo px-4 text-base text-neutro-tinta";

export function imagenes(n: number): string {
  return `${n.toLocaleString("es-AR")} ${n === 1 ? UNIDAD.singular : UNIDAD.plural}`;
}

/**
 * A figure's link to its records: the filters on screen, plus the one dimension
 * the figure itself narrows.
 *
 * `undefined` in `extra` deliberately overrides, so a card that fixes a dimension
 * — Estado for the Extraviadas — replaces the filter rather than adding to it.
 */
export function aListado(filtros: Filtros, extra: Partial<Filtros>): string {
  const query = comoQueryString({ ...filtros, ...extra });
  return query ? `/peregrina?${query}` : "/peregrina";
}
