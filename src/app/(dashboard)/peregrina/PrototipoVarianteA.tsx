import Link from "next/link";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import { ESTADO_LABELS } from "@/modules/peregrina/peregrina.types";
import { MODALIDAD_LABELS, TIPO_LABELS } from "./prototipo-datos";

/**
 * PROTOTIPO — Variante A, «Panel». Throwaway.
 *
 * The conventional administrative shape: a permanent dark sidebar, a toolbar of
 * filters, and one wide table. Optimised for somebody at a desk with the whole
 * inventory in front of them, scanning down a column.
 *
 * On a phone the table stops being a table — each row becomes a stacked block —
 * because story 21 forbids horizontal scrolling, and a genuinely wide table
 * cannot honour that any other way.
 */

const NAV = [
  { href: "/dashboard", etiqueta: "Inicio" },
  { href: "/peregrina", etiqueta: "Peregrinas", activo: true },
  { href: "/misionero", etiqueta: "Misioneros" },
  { href: "/asignacion/new", etiqueta: "Entregar una imagen" },
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
      className={`inline-flex items-center gap-2 rounded-md border-2 px-2 py-1 text-base font-semibold ${estilo[peregrina.estado]}`}
    >
      <span aria-hidden>{marca[peregrina.estado]}</span>
      {ESTADO_LABELS[peregrina.estado]}
    </span>
  );
}

export default function PrototipoVarianteA({
  peregrinas,
}: {
  peregrinas: PeregrinaDTO[];
}) {
  return (
    <div className="min-h-screen bg-neutral-100 text-[18px] text-neutral-900 lg:flex">
      <aside className="bg-neutral-900 text-white lg:min-h-screen lg:w-72 lg:shrink-0">
        <div className="flex items-center gap-3 border-b border-white/15 px-5 py-5">
          <span aria-hidden className="text-2xl">
            ◆
          </span>
          <span className="text-lg font-bold leading-tight">
            Campaña del Rosario
          </span>
        </div>

        <nav aria-label="Principal" className="p-3">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.activo ? "page" : undefined}
                  className={`flex min-h-12 items-center rounded-lg px-4 text-lg font-medium ${ANILLO} focus-visible:ring-offset-neutral-900 ${
                    item.activo
                      ? "bg-white font-bold text-neutral-900"
                      : "text-neutral-100 hover:bg-white/10"
                  }`}
                >
                  {item.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-white/15 px-5 py-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-white text-lg font-bold text-neutral-900">
            C
          </span>
          <span className="leading-tight">
            <span className="block font-semibold">Campaña Joven Córdoba</span>
            <span className="block text-base text-neutral-300">
              Administrador
            </span>
          </span>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 pb-28 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Peregrinas</h1>
            <p className="mt-1 text-lg text-neutral-700">
              {peregrinas.length} imágenes en tu territorio
            </p>
          </div>
          <Link
            href="/peregrina/new"
            className={`inline-flex min-h-12 items-center rounded-lg bg-blue-800 px-5 text-lg font-semibold text-white ${ANILLO}`}
          >
            Registrar una Peregrina
          </Link>
        </header>

        <div className="mb-4 flex flex-wrap gap-3 rounded-lg border-2 border-neutral-300 bg-white p-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="text-base font-semibold">Buscar por Código</span>
            <input
              type="search"
              placeholder="CBA JOV 0001"
              className={`min-h-12 rounded-lg border-2 border-neutral-500 px-3 text-lg ${ANILLO}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-base font-semibold">Estado</span>
            <select
              defaultValue=""
              className={`min-h-12 rounded-lg border-2 border-neutral-500 bg-white px-3 text-lg ${ANILLO}`}
            >
              <option value="">Todos</option>
              <option value="activa">Activa</option>
              <option value="en_reparacion">En reparación</option>
              <option value="extraviada">Extraviada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-base font-semibold">Modalidad</span>
            <select
              defaultValue=""
              className={`min-h-12 rounded-lg border-2 border-neutral-500 bg-white px-3 text-lg ${ANILLO}`}
            >
              <option value="">Todas</option>
              <option value="JOV">Jóvenes</option>
              <option value="FAM">Familias</option>
              <option value="INF">Infancia</option>
              <option value="ADU">Adultos</option>
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-lg border-2 border-neutral-300 bg-white">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Peregrinas de tu territorio, con su Estado y quién la tiene
            </caption>
            <thead className="hidden lg:table-header-group">
              <tr className="border-b-2 border-neutral-300 bg-neutral-100">
                <th scope="col" className="px-4 py-3 text-base uppercase tracking-wide">
                  Código
                </th>
                <th scope="col" className="px-4 py-3 text-base uppercase tracking-wide">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-base uppercase tracking-wide">
                  Modalidad
                </th>
                <th scope="col" className="px-4 py-3 text-base uppercase tracking-wide">
                  Diócesis/Localidad
                </th>
                <th scope="col" className="px-4 py-3 text-base uppercase tracking-wide">
                  La tiene
                </th>
              </tr>
            </thead>
            <tbody>
              {peregrinas.map((p) => (
                <tr
                  key={p.id}
                  className="block border-b border-neutral-300 last:border-b-0 lg:table-row"
                >
                  <td className="block px-4 pt-4 lg:table-cell lg:py-4">
                    <Link
                      href={`/peregrina/${p.id}`}
                      className={`rounded font-mono text-xl font-bold text-blue-900 underline ${ANILLO}`}
                    >
                      {p.codigo}
                    </Link>
                    <span className="ml-2 text-base text-neutral-700">
                      {TIPO_LABELS[p.tipo]}
                    </span>
                  </td>
                  <td className="block px-4 pt-2 lg:table-cell lg:py-4">
                    <Estado peregrina={p} />
                  </td>
                  <td className="block px-4 pt-2 text-lg lg:table-cell lg:py-4">
                    <span className="font-semibold lg:hidden">Modalidad: </span>
                    {MODALIDAD_LABELS[p.modalidad]}
                  </td>
                  <td className="block px-4 pt-2 text-lg lg:table-cell lg:py-4">
                    <span className="font-semibold lg:hidden">Territorio: </span>
                    {p.diocesisLocalidad.nombre}
                  </td>
                  <td className="block px-4 pb-4 pt-2 text-lg lg:table-cell lg:py-4">
                    {p.tenenciaActual ? (
                      <>
                        <span className="font-semibold lg:hidden">La tiene: </span>
                        {p.tenenciaActual.nombre} {p.tenenciaActual.apellido}
                      </>
                    ) : (
                      <span className="text-neutral-700">
                        Nadie la tiene ahora
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
