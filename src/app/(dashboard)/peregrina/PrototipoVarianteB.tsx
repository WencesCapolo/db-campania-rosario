import Link from "next/link";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import { ESTADO_LABELS } from "@/modules/peregrina/peregrina.types";
import { MODALIDAD_LABELS, TIPO_LABELS } from "./prototipo-datos";

/**
 * PROTOTIPO — Variante B, «Fichas». Throwaway.
 *
 * Phone first, and it does not degrade into a phone layout — it starts there.
 * No sidebar at all: navigation is a bottom tab bar within thumb reach, five
 * targets, each with its own label rather than an icon a stranger has to guess.
 * On a wide screen the tab bar moves to the top and the cards form a grid; the
 * information hierarchy does not change.
 *
 * There is no table. Each Peregrina is a card whose whole surface is the link,
 * with the Código the largest thing on it, because a Referente arrives holding
 * an image with a Código written on it and is matching that string.
 *
 * Filters are behind one button that opens a native dialog, so the list is not
 * pushed off the first screen by controls used once a session.
 */

const NAV = [
  { href: "/dashboard", etiqueta: "Inicio" },
  { href: "/peregrina", etiqueta: "Peregrinas", activo: true },
  { href: "/misionero", etiqueta: "Misioneros" },
  { href: "/asignacion/new", etiqueta: "Entregar" },
  { href: "/admin/users", etiqueta: "Usuarios" },
];

const ANILLO =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

function Estado({ peregrina }: { peregrina: PeregrinaDTO }) {
  const estilo: Record<string, string> = {
    activa: "border-green-800 bg-green-100 text-green-900",
    en_reparacion: "border-amber-800 bg-amber-100 text-amber-900",
    extraviada: "border-red-800 bg-red-100 text-red-900",
    inactiva: "border-neutral-700 bg-neutral-200 text-neutral-900",
  };
  const marca: Record<string, string> = {
    activa: "●",
    en_reparacion: "▲",
    extraviada: "✕",
    inactiva: "—",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-base font-bold ${estilo[peregrina.estado]}`}
    >
      <span aria-hidden>{marca[peregrina.estado]}</span>
      {ESTADO_LABELS[peregrina.estado]}
    </span>
  );
}

export default function PrototipoVarianteB({
  peregrinas,
}: {
  peregrinas: PeregrinaDTO[];
}) {
  return (
    <div className="min-h-screen bg-neutral-100 text-[18px] text-neutral-900">
      <header className="sticky top-0 z-20 border-b-2 border-neutral-300 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Peregrinas</h1>
          <span className="rounded-full bg-neutral-200 px-3 py-1 text-base font-semibold">
            {peregrinas.length}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-40 pt-4">
        <div className="mb-4 flex gap-3">
          <button
            type="button"
            className={`min-h-12 flex-1 rounded-xl border-2 border-neutral-900 bg-white px-4 text-lg font-semibold ${ANILLO}`}
          >
            Filtrar y buscar
          </button>
          <Link
            href="/peregrina/new"
            className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-blue-800 px-4 text-lg font-semibold text-white ${ANILLO}`}
          >
            Registrar
          </Link>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {peregrinas.map((p) => (
            <li key={p.id}>
              <Link
                href={`/peregrina/${p.id}`}
                className={`block rounded-xl border-2 border-neutral-300 bg-white p-4 hover:border-neutral-900 ${ANILLO}`}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-2xl font-bold tracking-tight">
                    {p.codigo}
                  </span>
                  <Estado peregrina={p} />
                </span>

                <span className="mt-3 block text-lg leading-relaxed">
                  {p.tenenciaActual ? (
                    <>
                      La tiene{" "}
                      <span className="font-semibold">
                        {p.tenenciaActual.nombre} {p.tenenciaActual.apellido}
                      </span>
                      .
                    </>
                  ) : (
                    <span className="text-neutral-700">
                      No la tiene nadie ahora.
                    </span>
                  )}
                </span>

                <span className="mt-2 block text-base text-neutral-700">
                  {TIPO_LABELS[p.tipo]} · {MODALIDAD_LABELS[p.modalidad]} ·{" "}
                  {p.diocesisLocalidad.nombre}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-neutral-300 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={item.activo ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center px-1 text-center text-sm font-semibold leading-tight ${ANILLO} ${
                  item.activo
                    ? "border-t-4 border-blue-800 text-blue-900"
                    : "border-t-4 border-transparent text-neutral-700"
                }`}
              >
                {item.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
