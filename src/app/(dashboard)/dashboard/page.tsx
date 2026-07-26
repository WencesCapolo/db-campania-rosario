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

const ANILLO =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="text-3xl font-bold text-neutral-900">¿Qué querés hacer?</h1>

      <ul className="mt-6 space-y-4">
        {ACCESOS.map((acceso) => (
          <li key={acceso.href}>
            <Link
              href={acceso.href}
              className={`flex min-h-24 flex-col justify-center gap-1 rounded-xl border-2 border-neutral-900 bg-white px-6 py-5 hover:bg-neutral-100 ${ANILLO}`}
            >
              <span className="text-2xl font-bold text-neutral-900">
                {acceso.titulo}
              </span>
              <span className="text-lg text-neutral-700">
                {acceso.descripcion}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
