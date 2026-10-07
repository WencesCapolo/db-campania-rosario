import { Suspense, cache } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/get-current-user";
import { esNacional } from "@/lib/authorization/alcance";
import { getTableroAction } from "@/modules/tablero/tablero.router";
import { getDiocesisLocalidadesAction } from "@/modules/territorio/territorio.router";
import {
  MODALIDAD_LABELS,
  comoQueryString,
  filtrosDesdeParams,
  type FiltrosDeInventario as Filtros,
} from "@/modules/peregrina/peregrina.types";
// El componente y el tipo se llaman igual porque son la misma cosa vista de dos
// lados: el formulario que los escribe y la forma que valida lo que escribió.
import FiltrosDeInventario from "@/modules/peregrina/FiltrosDeInventario";
import Barras from "@/components/Barras";
import { Cargando } from "@/components/EstadosAsincronicos";
import {
  ActivasYExtraviadas,
  PorConsagracion,
  aListado,
  imagenes,
} from "./tarjetas";

/**
 * El tablero: cómo se reparten las imágenes.
 *
 * Cinco tarjetas — activas contra extraviadas, el año de consagración de quien
 * las tiene, Modalidad, Provincia y Diócesis — y nada más. Las listas de trabajo
 * (extraviadas, estancadas, nunca entregadas) se fueron de acá: el tablero dice
 * cómo está repartido el inventario, y cada cifra lleva a los registros.
 *
 * Every figure is a link to the records behind it where the listado can filter
 * by it, carrying the filters that produced it (story 21). The links are built
 * from `comoQueryString`, the same function the filter form writes the address
 * with, so a figure and the list it leads to cannot disagree about what was
 * asked. Provincia and año are not links: the listado has no filter for either.
 *
 * `Suspense` is what makes story 25 true: the shell, the heading and the filters
 * paint immediately and the figures stream in behind a skeleton.
 *
 * The read is deliberately not wrapped in a try. A refusal — a rol with no
 * territory, or a crafted `?diocesisLocalidadId=` — reaches `error.tsx`. A
 * tablero of zeros in its place would say "your Campaña is empty" to somebody who
 * was refused.
 */

export const dynamic = "force-dynamic";

/**
 * Una lectura por pedido aunque la usen dos partes de la página — el total del
 * encabezado y las tarjetas. `cache` compara por identidad, y las dos reciben el
 * mismo objeto `filtros`.
 */
const leerTablero = cache((filtros: Filtros) => getTableroAction(filtros));

export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = filtrosDesdeParams(await searchParams);
  const actor = await getCurrentUser();
  const nacional = esNacional(actor.role);

  const territorios = nacional
    ? (await getDiocesisLocalidadesAction()).map((d) => ({
        id: d.id,
        nombre: d.nombre,
      }))
    : null;

  return (
    <div className="flex-1 bg-lienzo">
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-5">
        <header>
          <h1 className="font-stretch-condensed text-4xl leading-tight font-bold text-azul">
            Tablero
          </h1>
          <p className="mt-1 text-lg text-tinta-suave">
            {nacional ? "Toda la Campaña" : "Tu territorio"}
            <Suspense key={comoQueryString(filtros)} fallback={null}>
              <Total filtros={filtros} />
            </Suspense>
          </p>
          <span aria-hidden className="mt-3 block h-1 w-16 bg-oro" />
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
    </div>
  );
}

async function Total({ filtros }: { filtros: Filtros }) {
  const { totalPeregrinas } = await leerTablero(filtros);
  return (
    <>
      {" · "}
      <Link href={aListado(filtros, {})} className="text-azul underline">
        {imagenes(totalPeregrinas)}
      </Link>
    </>
  );
}

async function Cifras({ filtros }: { filtros: Filtros }) {
  const tablero = await leerTablero(filtros);
  const enlace = (extra: Partial<Filtros>) => aListado(filtros, extra);
  const total = tablero.totalPeregrinas;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ActivasYExtraviadas tablero={tablero} filtros={filtros} />

      <PorConsagracion tablero={tablero} filtros={filtros} />

      <Barras
        titulo="Por Modalidad"
        nota={`Las ${tablero.porModalidad.length}, de la más numerosa a la menos.`}
        total={total}
        visibles={FILAS_DE_ENTRADA}
        barras={[...tablero.porModalidad]
          .sort((a, b) => b.total - a.total)
          .map((fila) => ({
            etiqueta: MODALIDAD_LABELS[fila.modalidad],
            detalle: fila.modalidad,
            valor: fila.total,
            href: enlace({ modalidad: fila.modalidad }),
          }))}
        vacio="Ninguna imagen coincide con los filtros."
      />

      {tablero.porProvincia && (
        <Barras
          titulo="Por Provincia"
          nota="La Provincia sale de la Diócesis de cada imagen."
          total={total}
          barras={tablero.porProvincia.map((fila) => ({
            etiqueta: fila.nombre,
            valor: fila.total,
          }))}
          vacio="Ninguna imagen coincide con los filtros."
        />
      )}

      {tablero.porDiocesis && (
        <div className="sm:col-span-2">
          <Barras
            titulo="Por Diócesis/Localidad"
            nota={
              tablero.porDiocesis.length === 1
                ? "Una con imágenes."
                : `${tablero.porDiocesis.length} con imágenes.`
            }
            total={total}
            visibles={FILAS_DE_ENTRADA}
            barras={tablero.porDiocesis.map((fila) => ({
              etiqueta: fila.nombre,
              detalle: fila.provincia,
              valor: fila.total,
              href: enlace({ diocesisLocalidadId: fila.diocesisLocalidadId }),
            }))}
            vacio="Ninguna imagen coincide con los filtros."
          />
        </div>
      )}
    </div>
  );
}

/** Ocho filas y el resto detrás de «Ver las N»: una tarjeta, no una pantalla. */
const FILAS_DE_ENTRADA = 8;
