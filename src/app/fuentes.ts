import { Open_Sans } from "next/font/google";

/**
 * La tipografía de la Campaña: Open Sans, la de schoenstatt.org.ar.
 *
 * El sitio sirve además Open Sans Condensed para los títulos. Esa familia ya no
 * existe aparte — Google la retiró cuando Open Sans pasó a variable, y el ancho
 * condensado quedó como el eje `wdth` de la misma fuente. Por eso acá es una sola
 * descarga con ese eje pedido, y un título se condensa con
 * `font-stretch-condensed`: mismo resultado, la mitad de bytes.
 *
 * next/font la descarga en el build y la sirve desde nuestro dominio, así que
 * ninguna pantalla le pide nada a Google en tiempo de ejecución — ni le cuenta a
 * Google quién la está usando.
 *
 * `variable` y no `className`: el consumo es `--font-marca` en globals.css, que es
 * lo que lee `body`, y no una clase de fuente colgada de cada elemento.
 */
export const openSans = Open_Sans({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  variable: "--fuente-open-sans",
  display: "swap",
});
