import {
  getProvinciasAction,
  getDiocesisLocalidadesAction,
  getUsoDiocesisLocalidadAction,
  getUsoProvinciaAction,
  darDeBajaDiocesisLocalidadAction,
  darDeBajaProvinciaAction,
} from "@/modules/territorio/territorio.router";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import { Vacio } from "@/components/EstadosAsincronicos";
import CrearDiocesis from "./CrearDiocesis";
import CrearProvincia from "./CrearProvincia";
import RetirarTerritorio from "./RetirarTerritorio";

/**
 * Territorio — the reference data everything else points at.
 *
 * This screen did not exist, and its absence was not cosmetic: the 24
 * Provincias are seeded, but a Diócesis/Localidad is local knowledge nobody can
 * ship a table of, and there was no way to enter one. Every Peregrina, every
 * Misionero and every territorial Usuario references one, so a fresh
 * installation had zero of them and no path to a first record — the territory
 * picker on the Peregrina form was simply empty, saying nothing about why.
 *
 * Adding a territory is national work. `TerritorioService` refuses it to
 * anybody below `asesor_nacional`, which is why this lives under /admin and
 * why the page does not re-check: the refusal arrives as an error, and the
 * boundary renders it.
 *
 * Retiring is the interesting operation, and the count comes first — see
 * RetirarTerritorio.
 */

export const dynamic = "force-dynamic";

export default async function TerritorioPage() {
  const [provincias, diocesis] = await Promise.all([
    getProvinciasAction(),
    getDiocesisLocalidadesAction(),
  ]);

  const activas = provincias.filter((p) => !p.deBaja);

  const porProvincia = new Map<string, typeof diocesis>();
  for (const d of diocesis) {
    const lista = porProvincia.get(d.provincia.id) ?? [];
    lista.push(d);
    porProvincia.set(d.provincia.id, lista);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold text-tinta">Territorio</h1>
        <p className="mt-1 text-base text-tinta-suave">
          Las Provincias y Diócesis/Localidades que se pueden elegir al cargar
          imágenes, Misioneros y accesos.
        </p>
      </header>

      {/* Plegada, porque se usa de vez en cuando y la lista es lo que se viene a
          mirar. Abierta mientras no hay ninguna: entonces agregar la primera es
          lo único que se puede hacer acá. */}
      <details
        open={diocesis.length === 0}
        className="group rounded-tarjeta border-2 border-borde bg-papel"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-tarjeta px-5 py-4 hover:bg-fondo [&::-webkit-details-marker]:hidden">
          <h2 className="text-xl font-bold text-tinta">
            Agregar una Diócesis o Localidad
          </h2>
          {/* La palabra y el borde, además de la flecha — como en el alta de
              Peregrinas. Cambia con `group-open`, sin estado en el cliente. */}
          <span className="flex min-h-12 shrink-0 items-center gap-2 rounded-control border-2 border-borde-fuerte px-3 font-semibold text-tinta">
            <span className="group-open:hidden">Abrir</span>
            <span className="hidden group-open:inline">Cerrar</span>
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </span>
        </summary>
        <div className="border-t-2 border-borde px-5 py-4">
          <CrearDiocesis provincias={activas} />
        </div>
      </details>

      <Tarjeta titulo="Diócesis y Localidades">
        {diocesis.length === 0 ? (
          <Vacio
            titulo="Todavía no hay ninguna cargada"
            mensaje="Hasta que agregues la primera no se pueden cargar imágenes ni Misioneros, porque cada uno pertenece a una Diócesis o Localidad."
          />
        ) : (
          <ul className="space-y-3">
            {[...porProvincia.entries()]
              .sort(([, a], [, b]) =>
                a[0].provincia.nombre.localeCompare(
                  b[0].provincia.nombre,
                  "es",
                ),
              )
              .map(([provinciaId, lista]) => (
                <li key={provinciaId}>
                  <h3 className="text-base font-bold text-tinta-suave">
                    {lista[0].provincia.nombre}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {lista
                      .slice()
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                      .map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-borde p-3"
                        >
                          <span className="flex flex-wrap items-center gap-3">
                            <span className="text-base font-semibold text-tinta">
                              {d.nombre}
                            </span>
                            {d.deBaja && (
                              <Insignia tono="neutro">Retirada</Insignia>
                            )}
                          </span>

                          {!d.deBaja && (
                            <RetirarTerritorio
                              nombre={d.nombre}
                              que="la Diócesis/Localidad"
                              contarUso={getUsoDiocesisLocalidadAction.bind(
                                null,
                                d.id,
                              )}
                              retirar={darDeBajaDiocesisLocalidadAction.bind(
                                null,
                                d.id,
                              )}
                            />
                          )}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Provincias">
        <div className="space-y-5">
          <p className="text-base leading-relaxed text-tinta-suave">
            Las 24 vienen cargadas. La abreviatura es la que se usa para armar
            los Códigos — «CBA» en «CBA JOV 0001» — y por eso no se puede
            cambiar después de que existan imágenes.
          </p>

          <CrearProvincia />

          <ul className="space-y-2">
            {provincias.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-borde p-3"
              >
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-base font-semibold text-tinta">
                    {p.nombre}
                  </span>
                  <span className="font-mono text-base text-tinta-suave">
                    {p.abreviatura}
                  </span>
                  {p.deBaja && <Insignia tono="neutro">Retirada</Insignia>}
                </span>

                {!p.deBaja && (
                  <RetirarTerritorio
                    nombre={p.nombre}
                    que="la Provincia"
                    contarUso={getUsoProvinciaAction.bind(null, p.id)}
                    retirar={darDeBajaProvinciaAction.bind(null, p.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      </Tarjeta>
    </main>
  );
}
