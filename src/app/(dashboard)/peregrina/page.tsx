import Image from "next/image";
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
import { Vacio } from "@/components/EstadosAsincronicos";
import { nombreCompleto } from "@/lib/formato";
import FiltrosDeInventario from "@/modules/peregrina/FiltrosDeInventario";
import Volver from "@/components/Volver";
import AltaRapida from "./AltaRapida";

/**
 * Peregrinas — una pantalla, tres bloques: el alta, los filtros, la tabla.
 *
 * Antes eran dos pantallas y una lista de tarjetas. Lo que cambió y por qué:
 *
 *  - **El alta está acá.** Cargar una imagen era `/peregrina/new`, ida y vuelta,
 *    y estos registros se tipean de a lotes: el formulario arriba de la tabla deja
 *    ver aparecer la fila que se acaba de cargar, que es la confirmación que se
 *    quiere. `/peregrina/new` sigue existiendo porque el flujo de Asignación
 *    manda ahí cuando la imagen no está cargada todavía.
 *  - **Es una tabla y no tarjetas.** Es lo que se pidió. Vale decir qué se
 *    resigna: la tarjeta hacía del Código un blanco enorme y no tenía que
 *    reacomodarse en un teléfono. La tabla lo compensa con lo que puede — el
 *    Código es lo primero de cada fila, en mono y en azul, y la fila entera mide
 *    54 px de alto — y en una pantalla angosta scrollea al costado dentro de su
 *    marco, sin que scrollee la página. Una segunda maqueta abajo de `lg` sería
 *    dos cosas que mantener, y así es como se separan.
 *  - **Los filtros están plegados y el buscador no.** Quien llega con la imagen en
 *    la mano tipea su Código; filtrar por Modalidad es el mandado raro. Seis
 *    selects abiertos arriba de las filas empujan las filas afuera de un teléfono.
 *    Lo que queda a la vista con los filtros cerrados es la línea que dice cuáles
 *    están puestos y el botón que los limpia — el resto está en el componente.
 *
 * Hay un `Volver a Inicio` arriba de todo. El logo de la barra ya va a `/dashboard`,
 * pero "el logo es el inicio" es una convención de quien navega seguido, y estos
 * son adultos mayores cargando registros a mano: el mismo destino dicho con
 * palabras y con un blanco de 54 px no es una repetición para ellos.
 *
 * El tratamiento es el de Inicio: cuerpo en `lienzo`, cada bloque en un marco de
 * `borde-suave` sobre `papel`, títulos en `azul` condensado, el filete dorado
 * cerrando el encabezado. Ningún par nuevo — todos están en `contraste.test.ts`.
 *
 * La lectura no va en un try a propósito. Tira en una negativa, `error.tsx` la
 * agarra, y `Vacio` sólo se alcanza cuando la consulta de verdad no trajo nada:
 * "no hay Peregrinas" mostrado a quien fue rechazado le diría que su territorio
 * está vacío, y a quien está tanteando le confirmaría que existe.
 *
 * Los filtros son una sola pregunta a la base, la misma que hace el tablero, con
 * el mismo predicado: `filtrosDeInventarioSchema`. Un número del tablero tiene que
 * llevar a *exactamente* las filas que lo forman.
 */

const TONO_POR_ESTADO: Record<PeregrinaEstado, TonoDeInsignia> = {
  activa: "exito",
  en_reparacion: "aviso",
  extraviada: "alerta",
  inactiva: "neutro",
};

const CELDA = "px-4 py-3 align-middle";

export const dynamic = "force-dynamic";

export default async function PeregrinaListaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = filtrosDesdeParams(params);
  const paginaPedida = paginaDesdeParams(params);

  // El selector de territorio de los filtros es para los dos rols nacionales. Los
  // registros de un Referente Local ya son una Diócesis, y ofrecerle las otras de
  // su Provincia sería ofrecerle un control cuyo uso siempre termina en negativa.
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

  // Los filtros ya son un query string, así que el link de una página es ese
  // string más una clave. Se arma acá y no en el paginador, que si no tendría que
  // conocer cada clave de filtro — de esas hay una lista, y está en el módulo.
  const hrefDePagina = (n: number) => {
    const query = new URLSearchParams(comoQueryString(filtros));
    query.set(CLAVE_DE_PAGINA, String(n));
    return `/peregrina?${query.toString()}`;
  };

  return (
    <div className="flex-1 bg-lienzo px-5 py-6">
      <main className="mx-auto w-full max-w-4xl space-y-6">
        <Volver href="/dashboard">Volver a Inicio</Volver>

        <div className="overflow-hidden rounded-marco border-2 border-borde-suave bg-papel">
          {/* El encabezado va adentro del marco, como en Inicio: el bloque tiene
              un borde en total en lugar de un título con canto propio arriba de
              una tarjeta.

              En un teléfono es una columna centrada y la imagen va arriba; desde
              `sm` es un renglón con el texto a la izquierda y la imagen a la
              derecha. El filete dorado sigue al texto: centrado cuando el texto
              está centrado, al ras de la izquierda cuando no. */}
          <header className="flex flex-col items-center gap-6 border-b-2 border-borde-suave bg-lienzo px-5 pt-8 pb-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-oro-tinta uppercase sm:text-sm">
                Campaña del Rosario
              </p>

              <h1 className="mt-3 font-stretch-condensed text-4xl leading-tight font-bold text-azul sm:text-5xl">
                Peregrinas
              </h1>

              {/* Decoración: #ac954f da 2.9:1 y no lleva nada encima. */}
              <hr className="mx-auto mt-6 w-16 border-t-4 border-oro sm:mx-0" />
            </div>

            {/*
             * La Peregrina en su capilla, la imagen que este sistema inventaria.
             * `alt=""` y `aria-hidden` porque es la identidad de la pantalla y no un
             * dato: el título ya dice de qué se trata, y describirla no le agrega
             * nada a quien navega con lector de pantalla antes de llegar al
             * formulario.
             *
             * Sin borde ni sombra encima: el objeto ya tiene su propio contorno de
             * madera, y un segundo marco sobre una foto que ya trae uno es el gesto
             * que abarata una pantalla.
             */}
            <Image
              src="/peregrina.webp"
              alt=""
              width={640}
              height={640}
              priority
              aria-hidden
              className="h-28 w-28 shrink-0 sm:h-32 sm:w-32"
            />
          </header>

          <section className="px-5 py-6 sm:px-6">
            <h2 className="font-stretch-condensed text-2xl leading-tight font-bold text-azul">
              Registrar una imagen
            </h2>
            <p className="mt-1 mb-5 text-base leading-relaxed text-tinta-suave">
              Se carga acá mismo y aparece en la tabla de abajo.
            </p>

            <AltaRapida />
          </section>
        </div>

        <FiltrosDeInventario
          filtros={filtros}
          destino="/peregrina"
          territorios={territorios}
          plegable
        />

        <div className="overflow-hidden rounded-marco border-2 border-borde-suave bg-papel">
          <div className="border-b-2 border-borde-suave bg-lienzo px-5 py-4 sm:px-6">
            <h2 className="font-stretch-condensed text-2xl leading-tight font-bold text-azul">
              Las imágenes
            </h2>
            <p className="mt-1 text-base text-tinta-suave" aria-live="polite">
              {/* El conjunto entero, del agregado — no las filas de esta página.
                  "20 imágenes" en la página uno de nueve sería un conteo del
                  tamaño de página, que es la cifra que este proyecto sacó. */}
              {pagina.total === 1 ? "1 imagen" : `${pagina.total} imágenes`}
              {filtrado ? " con esos filtros" : " en tu territorio"}
            </p>
          </div>

          {peregrinas.length === 0 ? (
            <div className="px-5 py-6 sm:px-6">
              {filtrado ? (
                <Vacio
                  titulo="Ninguna imagen coincide"
                  mensaje="Probá con menos filtros, o revisá el Código: se escribe como «CBA JOV 0001»."
                />
              ) : (
                <Vacio
                  titulo="Todavía no hay imágenes cargadas"
                  mensaje="Cargá la primera con el formulario de arriba: el Código se genera solo, para que puedas anotarlo en la imagen."
                />
              )}
            </div>
          ) : (
            /* El scroll al costado vive en la tabla y no en la página: en un
               teléfono se arrastra la tabla, y el resto de la pantalla se queda
               quieto. */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-base">
                <thead>
                  <tr className="border-b-2 border-borde-suave">
                    <th
                      scope="col"
                      className={`${CELDA} font-semibold text-tinta`}
                    >
                      Código
                    </th>
                    <th
                      scope="col"
                      className={`${CELDA} font-semibold text-tinta`}
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className={`${CELDA} font-semibold text-tinta`}
                    >
                      ¿Quién la tiene?
                    </th>
                    <th
                      scope="col"
                      className={`${CELDA} font-semibold text-tinta`}
                    >
                      Modalidad
                    </th>
                    <th
                      scope="col"
                      className={`${CELDA} font-semibold text-tinta`}
                    >
                      Diócesis/Localidad
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {peregrinas.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-borde-suave last:border-b-0 hover:bg-lienzo"
                    >
                      <th scope="row" className={`${CELDA} font-normal`}>
                        {/* El Código es el link, y es lo primero de la fila:
                            alguien llega con la imagen en la mano y está
                            emparejando esa cadena. `whitespace-nowrap` para que
                            «CBA JOV 0001» no se corte en tres renglones. */}
                        <Link
                          href={`/peregrina/${p.id}`}
                          className="font-mono text-lg font-bold whitespace-nowrap text-azul"
                        >
                          {p.codigo}
                        </Link>
                        {p.deBaja && (
                          <span className="mt-1 block text-sm text-tinta-suave">
                            dada de baja
                          </span>
                        )}
                      </th>

                      <td className={CELDA}>
                        <Insignia tono={TONO_POR_ESTADO[p.estado]}>
                          {ESTADO_LABELS[p.estado]}
                        </Insignia>
                      </td>

                      <td className={`${CELDA} text-tinta`}>
                        {p.tenenciaActual ? (
                          nombreCompleto(p.tenenciaActual)
                        ) : (
                          <span className="text-tinta-suave">Nadie</span>
                        )}
                      </td>

                      <td className={`${CELDA} whitespace-nowrap text-tinta`}>
                        {MODALIDAD_LABELS[p.modalidad]}
                        <span className="block text-sm text-tinta-suave">
                          {TIPO_LABELS[p.tipo]}
                        </span>
                      </td>

                      <td className={`${CELDA} text-tinta`}>
                        {p.diocesisLocalidad.nombre}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Paginador
          pagina={pagina.pagina}
          paginas={pagina.paginas}
          total={pagina.total}
          porPagina={pagina.porPagina}
          unidad="imágenes"
          href={hrefDePagina}
        />
      </main>
    </div>
  );
}
