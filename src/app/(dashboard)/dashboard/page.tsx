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
 * de cada destino y las esquinas de 3 px. Los tokens y las dos adaptaciones que
 * el tema necesitó están en globals.css; los pares, en contraste.test.ts.
 *
 * Salió de tres variantes en esta misma ruta (`?variant=A|B|C`, borradas): A
 * ponía el azul en toda la pantalla y B lo dejaba en el registro claro del cuerpo
 * del sitio; C metía la acción dentro de una banda azul arriba. Ganó B, ésta: en
 * un teléfono en una oficina con una lámpara, el fondo claro es el que no pelea
 * con el reflejo, y es la única de las tres donde el azul lleno del destino con
 * consecuencias tiene contra qué destacar.
 *
 * La etiqueta y el título respiran más que el resto de la pantalla a propósito.
 * Son lo único que se lee de una sola vez, antes de decidir, y el aire de arriba
 * es lo que separa "leer" de "elegir".
 */

const ACCESOS = [
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
 * El filete celeste va *adentro* del borde y no en lugar de él, que es la
 * diferencia entre decoración y estructura.
 *
 * El celeste del sitio da 2.5:1 contra el papel. Como `border-l-8` reemplazaba el
 * canto izquierdo de la tarjeta, ese lado quedaba delimitado por un color que no
 * llega al 3:1 que pide SC 1.4.11 — la tarjeta perdía un borde de los cuatro. Con
 * el filete como una franja interna, los cuatro cantos siguen siendo
 * `borde-suave` y el celeste no delimita nada.
 */
const DESTINO =
  "flex min-h-24 items-stretch overflow-hidden rounded-marco border-2 no-underline";

const TONOS = {
  principal: "border-azul bg-azul hover:bg-azul-noche",
  secundario: "border-borde-suave bg-papel hover:bg-lienzo",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="min-h-screen bg-lienzo">
      <main className="mx-auto w-full max-w-2xl px-5 pt-14 pb-12">
        <header className="pb-2">
          <p className="text-sm font-semibold tracking-[0.18em] text-oro-tinta uppercase">
            Campaña del Rosario
          </p>
          <h1 className="mt-5 font-stretch-condensed text-4xl font-bold text-azul">
            ¿Qué querés hacer?
          </h1>
          {/* El filete dorado del sitio. Es decoración y no lleva nada encima:
              #ac954f no llega al contraste que pide un texto. */}
          <hr className="mt-7 border-t-4 border-oro" />
        </header>

        <ul className="mt-9 space-y-4">
          {ACCESOS.map((acceso) => (
            <li key={acceso.href}>
              <Link
                href={acceso.href}
                className={`${DESTINO} ${
                  acceso.principal ? TONOS.principal : TONOS.secundario
                }`}
              >
                {!acceso.principal && (
                  <span aria-hidden className="w-2 shrink-0 bg-celeste" />
                )}

                <span className="flex flex-col justify-center gap-1 px-6 py-5">
                  <span
                    className={`font-stretch-condensed text-2xl font-bold ${
                      acceso.principal ? "text-white" : "text-azul"
                    }`}
                  >
                    {acceso.titulo}
                  </span>
                  <span
                    className={`text-base ${
                      acceso.principal ? "text-white" : "text-tinta-suave"
                    }`}
                  >
                    {acceso.descripcion}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
