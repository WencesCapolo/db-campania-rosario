import Image from "next/image";
import Link from "next/link";

/**
 * Inicio — tres botones, y nada más.
 *
 * The home screen is a hub, not a dashboard. Everything a Referente opens this
 * system to do is one of three things, and each one gets a target big enough to
 * hit with a thumb without reading first. Counts, charts and filtering are
 * issue #5's tablero; putting a summary here would push the three things below
 * the fold on a phone to make room for information nobody came for.
 *
 * "Entregar una imagen" is the verb rather than the noun on purpose: the other
 * two are places you go to look something up, this one is the thing you came to
 * record. It is last because it is the one with consequences — and it is the one
 * that carries the filled blue, so the two ways of finding something and the one
 * way of changing something do not look alike.
 *
 * ─── El tratamiento ──────────────────────────────────────────────────────────
 *
 * Esta pantalla es la primera que lleva el tema de la Campaña, tomado de
 * schoenstatt.org.ar: el azul institucional en los títulos, el lienzo azulado de
 * fondo, el filete dorado que allá parte cada sección, el filete celeste al canto
 * y las esquinas de 3 px. Los tokens y las dos adaptaciones que el tema necesitó
 * están en globals.css; los pares, en contraste.test.ts.
 *
 * Salió de siete variantes en esta misma ruta, todas borradas. Las tres primeras
 * discutían el fondo: ganó el claro, porque en un teléfono en una oficina con una
 * lámpara es el que no pelea con el reflejo. Las tres siguientes discutían el
 * encabezado: ganó **un solo marco**, con los tres destinos separados por filetes
 * en lugar de por aire — menos cantos en pantalla, una sola cosa que mirar. Las
 * últimas tres movían el retrato del Padre Pozzobón, y ganó centrado y chico, como
 * el sello de una hoja: el encabezado queda simétrico y el retrato está sin pesar.
 *
 * De esa última ronda quedó una cosa más, que es la razón por la que el encabezado
 * está *adentro* de la tarjeta y no arriba de ella: así el filete celeste corre por
 * el borde superior de toda la composición en lugar de partirla en dos objetos. La
 * pantalla tiene un borde en total.
 */

type Acceso = {
  href: string;
  titulo: string;
  descripcion: string;
  principal: boolean;
};

const ACCESOS: Acceso[] = [
  {
    href: "/peregrina",
    titulo: "Peregrinas",
    descripcion: "Buscar una imagen y ver dónde está",
    principal: false,
  },
  {
    href: "/misionero",
    titulo: "Misioneros",
    descripcion: "Buscar una persona y ver qué tiene",
    principal: false,
  },
  {
    href: "/asignacion/new",
    titulo: "Entregar una imagen",
    descripcion: "Registrar que una imagen cambió de manos",
    principal: true,
  },
];

/*
 * La punta de flecha. Es geometría y no un glifo tipográfico, así que se ve igual
 * en cualquier fuente instalada, y va `aria-hidden` porque el link ya dice a dónde
 * lleva: es refuerzo de que esto se toca, no una segunda cosa que leer.
 */
function Punta({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    /* Centrado óptico y no geométrico: la tarjeta queda arriba del centro exacto,
       más o menos a la mitad del camino entre pegada a la barra y centrada. El
       centro real de una pantalla con una sola cosa se lee como caída, porque la
       barra ya ocupa el borde de arriba y nada ocupa el de abajo.
       El sesgo son los dos `p*` desparejos: con `items-center`, el aire de más
       abajo empuja la tarjeta hacia arriba la mitad de la diferencia. Y `pt-6` es
       el piso: cuando la pantalla es más baja que la tarjeta, el centrado cede y
       queda el margen, en lugar de recortarla. */
    <div className="flex flex-1 items-center justify-center bg-lienzo px-5 pt-6 pb-28">
      <main className="w-full max-w-xl">
        <div className="overflow-hidden rounded-marco border-2 border-borde-suave bg-papel">
          <header className="border-b-2 border-borde-suave bg-lienzo px-5 pt-10 pb-7 text-center sm:px-6">
            {/*
             * El retrato del Padre Pozzobón con la Peregrina, el mismo del sitio.
             * Va `alt=""` y `aria-hidden` porque es la identidad de la pantalla y no
             * un dato: quien lo reconoce no necesita que se lo digan, y a quien
             * navega con lector de pantalla no le agrega nada antes de las tres
             * cosas que vino a hacer.
             *
             * El PNG ya trae su marco dorado octogonal, así que no lleva borde
             * nuestro encima — dos marcos sobre la misma foto es exactamente el
             * gesto que abarata una pantalla.
             */}
            <Image
              src="/pozzobon.png"
              alt=""
              width={320}
              height={320}
              priority
              aria-hidden
              className="mx-auto h-20 w-20"
            />

            <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-oro-tinta uppercase sm:text-sm">
              Campaña del Rosario
            </p>

            <h1 className="mt-3 font-stretch-condensed text-4xl leading-tight font-bold text-azul sm:text-5xl">
              ¿Qué querés hacer?
            </h1>

            {/* El filete dorado del sitio, corto y centrado: acá cierra el
                encabezado en lugar de separar dos bloques del mismo ancho. Es
                decoración y no lleva nada encima — #ac954f da 2.9:1, que no
                alcanza ni para una regla que diga algo. */}
            <hr className="mx-auto mt-7 w-16 border-t-4 border-oro" />
          </header>

          <ul>
            {ACCESOS.map((acceso, i) => (
              <li
                key={acceso.href}
                className={i > 0 ? "border-t-2 border-borde-suave" : undefined}
              >
                <Link
                  href={acceso.href}
                  className={`flex min-h-24 items-center gap-5 px-5 py-5 no-underline sm:px-6 ${
                    acceso.principal
                      ? "bg-azul hover:bg-azul-noche"
                      : "hover:bg-lienzo"
                  }`}
                >
                  <span className="flex flex-1 flex-col gap-1">
                    <span
                      className={`font-stretch-condensed text-2xl leading-tight font-bold ${
                        acceso.principal ? "text-white" : "text-azul"
                      }`}
                    >
                      {acceso.titulo}
                    </span>
                    <span
                      className={`text-base leading-snug ${
                        acceso.principal ? "text-white" : "text-tinta-suave"
                      }`}
                    >
                      {acceso.descripcion}
                    </span>
                  </span>

                  <Punta
                    className={`h-6 w-6 shrink-0 ${
                      acceso.principal ? "text-white" : "text-azul"
                    }`}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
