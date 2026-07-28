"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * La barra de navegación.
 *
 * Es cliente y no servidor por una sola razón: marca la ruta actual, y para eso
 * hace falta `usePathname`. El Usuario se sigue resolviendo en el servidor y baja
 * por props — acá no hay ninguna decisión de permisos, sólo qué links mostrar, que
 * ya viene decidido.
 *
 * Salió de tres variantes en las rutas del grupo (`?variant=N1|N2|N3`, borradas):
 * N1 pintaba la barra entera de azul-noche y N3 la partía en dos pisos, con el
 * nombre arriba. Ganó ésta, la de papel: el cuerpo de la app es claro, y una franja
 * azul a todo el ancho arriba de un cuerpo claro es la misma mancha que perdió en
 * la ronda del tratamiento.
 *
 * ─── Los destinos ────────────────────────────────────────────────────────────
 *
 * Eran tres links subrayados en azul, del mismo peso que el nombre del Usuario y
 * sin nada que dijera en cuál estás. Ahora son controles, y la diferencia no es
 * decorativa:
 *
 *  · **Llevan borde.** Un control se reconoce como control antes de que alguien lo
 *    toque, que es la razón por la que ningún `Boton` del sistema tiene variante
 *    fantasma. Tres palabras subrayadas al lado de un nombre propio no se leían
 *    como tres lugares a dónde ir.
 *  · **El actual va relleno.** `aria-current="page"` lo dice para quien escucha;
 *    el relleno azul y el borde azul lo dicen para quien mira. Cambia el relleno y
 *    no sólo el matiz del texto, así que sirve para quien no distingue los colores.
 *  · **Son del tamaño de un botón.** `min-h-12` son 54 px, y el `px-4` les da
 *    ancho de sobra para un pulgar. Antes eran texto de 18 px con 12 px de aire.
 *
 * El subrayado se fue con el borde: un control relleno o encuadrado ya dice que se
 * toca, y tres subrayados seguidos es sopa de links. Queda el foco, que es la única
 * cosa que este archivo no dibuja — la regla está en globals.css, una sola vez.
 */

type Props = {
  nombre: string;
  rol: string;
  puedeAdministrar: boolean;
  esNacional: boolean;
};

function destinos({ puedeAdministrar, esNacional }: Props) {
  return [
    // El tablero se llega desde acá y no desde Inicio: Inicio son las tres cosas
    // que un Referente vino a hacer, y las cifras no son una de ellas — pero son
    // la primera cosa que abre un Responsable Diocesano o un Asesor Nacional, así
    // que tienen que estar a un toque desde cualquier pantalla.
    { href: "/tablero", texto: "Tablero" },
    ...(puedeAdministrar ? [{ href: "/admin/users", texto: "Usuarios" }] : []),
    // Territorio is national work — TerritorioService refuses it below
    // asesor_nacional — so the link is not offered to a Responsable Diocesano who
    // could only be refused by it.
    ...(esNacional ? [{ href: "/admin/territorio", texto: "Territorio" }] : []),
  ];
}

const DESTINO =
  "inline-flex min-h-12 items-center rounded-marco border-2 px-4 text-base font-semibold no-underline";

const TONOS = {
  /* El actual: relleno azul, borde azul. Blanco encima da 10:1. */
  actual: "border-azul bg-azul text-white",
  /* Los otros: encuadrados y en azul sobre papel, 10:1, con el borde a 4.5:1. El
     hover cambia el fondo, pero no es el único aviso de que esto se toca — el
     borde ya está ahí sin que nadie pase por encima. */
  otro: "border-borde-suave bg-papel text-azul hover:bg-lienzo",
};

export function Barra(props: Props) {
  const pathname = usePathname();

  return (
    <header className="border-b-2 border-borde bg-papel">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3">
        {/* El logo de Schoenstatt Argentina, el mismo del sitio. `alt=""` porque el
            nombre de la Campaña está al lado en texto: es identidad, no dato. */}
        <Link
          href="/dashboard"
          className="inline-flex min-h-12 items-center gap-3 rounded-marco px-1 text-lg font-bold text-azul no-underline"
        >
          <Image
            src="/logo-schoenstatt-arg.png"
            alt=""
            width={320}
            height={320}
            aria-hidden
            className="h-10 w-10 shrink-0"
          />
          <span className="font-stretch-condensed text-xl">
            Campaña del Rosario
          </span>
        </Link>

        <nav aria-label="Secciones" className="ml-auto flex items-center gap-2">
          {destinos(props).map(({ href, texto }) => {
            const actual = pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={actual ? "page" : undefined}
                className={`${DESTINO} ${actual ? TONOS.actual : TONOS.otro}`}
              >
                {texto}
              </Link>
            );
          })}
        </nav>

        {/* Separado por una regla y no por aire: el aire ya lo usan los destinos, y
            sin la regla el nombre propio se lee como un cuarto lugar a dónde ir. */}
        <span className="border-l-2 border-borde-suave pl-4 text-base leading-tight">
          <span className="block font-semibold text-tinta">{props.nombre}</span>
          <span className="block text-sm text-tinta-suave">{props.rol}</span>
        </span>
      </div>

      {/* El filete dorado del sitio, al pie y *adentro* del borde: el canto de abajo
          lo sigue dibujando `borde` (3.8:1), que es lo que pide delimitar una
          región. El dorado no delimita nada — #ac954f da 2.9:1 sobre papel. */}
      <span aria-hidden className="block h-1 bg-oro" />
    </header>
  );
}
