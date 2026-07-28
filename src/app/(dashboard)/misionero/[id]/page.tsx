import Link from "next/link";
import { getMisioneroByIdAction } from "@/modules/misionero/misionero.router";
import { CENTRO_LABELS } from "@/modules/misionero/misionero.types";
import { getHistorialDeMisioneroAction } from "@/modules/asignacion/asignacion.router";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import { dias, fecha, nombreCompleto, registro } from "@/lib/formato";
import BajaDeMisionero from "./BajaDeMisionero";

/**
 * Un Misionero, y todo lo que tuvo.
 *
 * A route that did not exist: the sidebar linked to /misionero and got a 404,
 * and nothing anywhere could link to a person.
 *
 * The first question is what they have right now, because that is what somebody
 * asks when an image needs finding. Everything they have *had* is under it, most
 * recent first, because that is a different question and a rarer one.
 *
 * A Misionero given de baja still renders, with everything they held still
 * naming them. That is user story 15 and the reason nothing is destroyed — the
 * row exists so the history keeps resolving.
 *
 * Neither read is wrapped in a try. A refusal belongs to the (dashboard) error
 * boundary; rendering it as "no tuvo ninguna imagen" would assert something
 * about a person this Actor is not allowed to see.
 */

export const dynamic = "force-dynamic";

export default async function MisioneroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [misionero, historial] = await Promise.all([
    getMisioneroByIdAction(id),
    getHistorialDeMisioneroAction(id),
  ]);

  const abiertas = historial.filter((a) => a.abierta);
  const cerradas = historial.filter((a) => !a.abierta).reverse();

  const resumenes = Object.entries(misionero.resumenesAnuales).sort(
    ([a], [b]) => Number(b) - Number(a),
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-tinta">
          {nombreCompleto(misionero)}
        </h1>

        {misionero.deBaja && (
          <Insignia tono="neutro">Dado de baja de la Campaña</Insignia>
        )}

        <p className="text-base text-tinta-suave">
          {misionero.diocesisLocalidad.nombre}, {misionero.provincia}
          {misionero.telefono ? ` · ${misionero.telefono}` : ""}
        </p>

        {(misionero.centroNombre || misionero.anioConsagracion) && (
          <p className="text-base text-tinta-suave">
            {misionero.centroNombre && (
              <>
                {misionero.centroTipo
                  ? `${CENTRO_LABELS[misionero.centroTipo]}: `
                  : ""}
                {misionero.centroNombre}
              </>
            )}
            {misionero.centroNombre && misionero.anioConsagracion ? " · " : ""}
            {misionero.anioConsagracion && (
              <>Consagración: {misionero.anioConsagracion}</>
            )}
          </p>
        )}
      </header>

      <Tarjeta titulo="¿Qué tiene ahora?">
        {abiertas.length === 0 ? (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              No tiene ninguna imagen a cargo.
            </p>
            {!misionero.deBaja && (
              <BotonEnlace href="/asignacion/new">
                Entregarle una imagen
              </BotonEnlace>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {abiertas.map((a) => (
              <li key={a.id}>
                <BotonEnlace
                  tono="secundario"
                  anchoCompleto
                  href={`/peregrina/${a.peregrina.id}`}
                >
                  <span className="font-mono">{a.peregrina.codigo}</span>
                  <span className="font-normal">
                    desde el {fecha(a.abiertaAt)} · {dias(a.diasEnCargo)}
                  </span>
                </BotonEnlace>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Imágenes que tuvo antes">
        {cerradas.length === 0 ? (
          <Vacio
            titulo="Todavía no devolvió ninguna"
            mensaje="Cuando una imagen que tuvo vuelva o pase a otra persona, ese período va a quedar acá."
          />
        ) : (
          <ol className="space-y-4">
            {cerradas.map((a) => (
              <li key={a.id} className="space-y-1">
                <p className="text-base leading-relaxed">
                  <Link
                    href={`/peregrina/${a.peregrina.id}`}
                    className="font-mono font-bold text-accion underline"
                  >
                    {a.peregrina.codigo}
                  </Link>{" "}
                  — {fecha(a.abiertaAt)} a{" "}
                  {/* `cerradas` is filtered on `abierta`, but the DTO's
                      `cerradaAt` is independently nullable, so this reads it
                      rather than asserting the two agree. */}
                  {a.cerradaAt ? fecha(a.cerradaAt) : "una fecha sin registrar"}{" "}
                  ({dias(a.diasEnCargo)})
                </p>

                {a.notaApertura && (
                  <p className="text-base text-tinta-suave">
                    Al entregar: {a.notaApertura}
                  </p>
                )}
                {a.notaCierre && (
                  <p className="text-base text-tinta-suave">
                    Al devolver: {a.notaCierre}
                  </p>
                )}

                {/* A territory, never a person: Referentes Locales share one
                    login per territory, so this is where it was registered and
                    not who registered it. */}
                <p className="text-base text-tinta-suave">{registro(a)}</p>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>

      {resumenes.length > 0 && (
        <Tarjeta titulo="Resúmenes anuales">
          <dl className="space-y-3">
            {resumenes.map(([anio, texto]) => (
              <div key={anio}>
                <dt className="text-base font-bold text-tinta">{anio}</dt>
                <dd className="text-base leading-relaxed text-tinta">
                  {texto}
                </dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      )}

      <Tarjeta titulo="Administrar">
        <BajaDeMisionero
          id={misionero.id}
          nombre={nombreCompleto(misionero)}
          deBaja={misionero.deBaja}
        />
      </Tarjeta>
    </main>
  );
}
