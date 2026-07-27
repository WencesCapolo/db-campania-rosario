import Link from "next/link";
import {
  getMisionerosFiltradosAction,
  getMisionerosPaginadosAction,
} from "@/modules/misionero/misionero.router";
import { getMisionerosSinPeregrinaAction } from "@/modules/asignacion/asignacion.router";
import type { MisioneroDTO } from "@/modules/misionero/misionero.types";
import Insignia from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import Paginador from "@/components/Paginador";
import { Vacio } from "@/components/EstadosAsincronicos";
import {
  CLAVE_DE_PAGINA,
  armarPagina,
  cantidadDePaginas,
  paginaDesdeParams,
  paginaExistente,
  rango,
  type Pagina,
} from "@/lib/paginacion";
import { nombreCompleto } from "@/lib/formato";
import FiltrosDeMisionero from "./FiltrosDeMisionero";

/**
 * Misioneros de tu territorio.
 *
 * This route did not exist. The sidebar linked to it and got a 404, which is why
 * it is here before the visual language is finally settled — a live 404 in the
 * primary navigation is worse than a screen that gets restyled once.
 *
 * Cards rather than a table, matching the Peregrina list: the shape of the answer
 * is a person, where they are, and how to reach them, because that is what
 * somebody is looking for when they open it.
 *
 * Two filters, both in the address. The search is `MisioneroService.search`,
 * implemented and tested since issue #1 and left without a screen until now; "sólo
 * los que no tienen ninguna" is the other half of the tablero's idle-capacity
 * card, and it links straight here so that finding somebody free and opening
 * their page is one journey instead of two.
 *
 * The "sin imagen" filter is applied by intersecting with the scoped list of
 * people who have no open Asignación, rather than by a second filtered query. The
 * anti-join deliberately ignores the *image's* territory — somebody holding a
 * Peregrina that has since moved Diócesis is not free — and that is a property of
 * `findMisionerosSinPeregrina`, not something this page should try to restate.
 *
 * The read is not wrapped in a try. It throws on refusal, `error.tsx` catches
 * it, and `Vacio` below is only ever reached when the query genuinely came back
 * with nothing: "no hay Misioneros" shown to somebody who was refused would tell
 * them their territory is empty and confirm to a prober that it exists.
 */

export const dynamic = "force-dynamic";

export default async function MisioneroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sinImagen?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const sinImagen = params.sinImagen === "1";
  const paginaPedida = paginaDesdeParams(params);
  const filtros = q ? { q } : {};

  /*
   * Two reads, two ways of paginating, and the difference is the anti-join.
   *
   * Without "sólo los que no tienen ninguna" the page comes from the database,
   * one page of rows and a count over the same predicate. With it, the set is the
   * intersection of two scoped reads — and the second, `findMisionerosSinPeregrina`,
   * deliberately ignores the *image's* territory, so it cannot be expressed as a
   * filter on this query. The intersection therefore has to be computed before it
   * can be cut, which means fetching both in full and slicing here.
   *
   * That is a real limit and it is written down rather than hidden: it is bounded
   * by the Actor's territory, so a Diócesis's worth of people, and the honest fix
   * is an anti-join inside the filtered query — a change to
   * `AsignacionRepository`, not something this page should fake.
   */
  const encontrados = sinImagen
    ? await getMisionerosFiltradosAction(filtros)
    : null;

  const libres = sinImagen ? await getMisionerosSinPeregrinaAction() : null;

  const pagina =
    encontrados && libres
      ? enMemoria(
          encontrados.filter((m) => libres.some((l) => l.id === m.id)),
          paginaPedida
        )
      : await getMisionerosPaginadosAction(filtros, paginaPedida);

  const misioneros = pagina.filas;
  const filtrado = Boolean(q || sinImagen);

  const hrefDePagina = (n: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (sinImagen) query.set("sinImagen", "1");
    query.set(CLAVE_DE_PAGINA, String(n));
    return `/misionero?${query.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-tinta">Misioneros</h1>
          <p className="mt-1 text-base text-tinta-suave" aria-live="polite">
            {/* The whole matching set, not this page's rows. */}
            {pagina.total === 1 ? "1 persona" : `${pagina.total} personas`}
            {filtrado ? " con esos filtros" : " en tu territorio"}
          </p>
        </div>

        <BotonEnlace href="/misionero/new">Cargar un Misionero</BotonEnlace>
      </header>

      <FiltrosDeMisionero q={q} sinImagen={sinImagen} />

      {misioneros.length === 0 ? (
        filtrado ? (
          <Vacio
            titulo="Nadie coincide"
            mensaje="Probá con parte del apellido, o limpiá los filtros para ver a todos."
          />
        ) : (
        <Vacio
          titulo="Todavía no hay Misioneros cargados"
          mensaje="Cuando cargues la primera persona va a aparecer acá, y vas a poder entregarle una imagen."
          accion={
            <BotonEnlace href="/misionero/new">
              Cargar el primer Misionero
            </BotonEnlace>
          }
        />
        )
      ) : (
        <ul className="space-y-3">
          {misioneros.map((m) => (
            <li key={m.id}>
              <Link
                href={`/misionero/${m.id}`}
                className="block rounded-tarjeta border-2 border-borde bg-papel p-4 hover:border-borde-fuerte"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-bold text-tinta">
                    {nombreCompleto(m)}
                  </span>
                  {m.deBaja && <Insignia tono="neutro">Dado de baja</Insignia>}
                </span>

                <span className="mt-1 block text-base text-tinta-suave">
                  {m.diocesisLocalidad.nombre}, {m.provincia}
                  {m.telefono ? ` · ${m.telefono}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Paginador
        pagina={pagina.pagina}
        paginas={pagina.paginas}
        total={pagina.total}
        porPagina={pagina.porPagina}
        unidad="personas"
        href={hrefDePagina}
      />

      <BotonEnlace href="/asignacion/new" tono="secundario">
        Entregar una imagen
      </BotonEnlace>
    </main>
  );
}

/**
 * A page cut out of a list already in memory — the "sin imagen" case above, and
 * the only one.
 *
 * Same shape as what the service returns, so the screen renders one thing rather
 * than branching, and the total is the intersection's real size rather than the
 * slice's.
 */
function enMemoria(
  filas: MisioneroDTO[],
  paginaPedida: number
): Pagina<MisioneroDTO> {
  const actual = paginaExistente(
    paginaPedida,
    cantidadDePaginas(filas.length)
  );
  const { limit, offset } = rango(actual);
  return armarPagina(filas.slice(offset, offset + limit), filas.length, actual);
}
