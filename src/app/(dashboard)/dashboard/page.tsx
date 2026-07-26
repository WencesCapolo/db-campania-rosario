import Link from "next/link";

/**
 * Inicio — three buttons, and nothing else.
 *
 * The home screen is a hub, not a dashboard. Everything a Referente opens this
 * system to do is one of three things, and each one gets a target big enough to
 * hit with a thumb without reading first. Counts, charts and filtering are
 * issue #5's tablero; putting a summary here would push the three things below
 * the fold on a phone to make room for information nobody came for.
 *
 * "Entregar una imagen" is the verb rather than the noun on purpose: the other
 * two are places you go to look something up, this one is the thing you came to
 * record. It is last because it is the one with consequences.
 *
 * On the tokens now. This screen shipped with the same `ring-amber-400` the shell
 * had — 1.8:1 against white, so the largest, most-used targets in the app carried
 * the one focus indicator that failed. The global `:focus-visible` rule handles
 * all three, which is why there is no ring in this file at all.
 */

const ACCESOS = [
  {
    href: "/peregrina",
    titulo: "Peregrinas",
    descripcion: "Buscar una imagen y ver dónde está",
  },
  {
    href: "/misionero",
    titulo: "Misioneros",
    descripcion: "Buscar una persona y ver qué tiene",
  },
  {
    href: "/asignacion/new",
    titulo: "Entregar una imagen",
    descripcion: "Registrar que una imagen cambió de manos",
  },
];

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold text-tinta">¿Qué querés hacer?</h1>

      <ul className="mt-6 space-y-4">
        {ACCESOS.map((acceso) => (
          <li key={acceso.href}>
            <Link
              href={acceso.href}
              className="flex min-h-24 flex-col justify-center gap-1 rounded-tarjeta border-2 border-borde-fuerte bg-papel px-6 py-5 no-underline hover:bg-fondo"
            >
              <span className="text-2xl font-bold text-tinta">
                {acceso.titulo}
              </span>
              <span className="text-base text-tinta-suave">
                {acceso.descripcion}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
