import Link from "next/link";
import { getMatrimonioByIdAction } from "@/modules/misionero/matrimonio.router";
import { CENTRO_LABELS } from "@/modules/misionero/misionero.types";
import type { MisioneroDTO } from "@/modules/misionero/misionero.types";
import { getHistorialDeMisioneroAction } from "@/modules/asignacion/asignacion.router";
import Tarjeta from "@/components/Tarjeta";
import Insignia from "@/components/Insignia";
import { BotonEnlace } from "@/components/Boton";
import { Vacio } from "@/components/EstadosAsincronicos";
import {
  dias,
  fecha,
  nombreCompleto,
  nombreDeTenedor,
  registro,
} from "@/lib/formato";
import BajaDeMatrimonio from "./BajaDeMatrimonio";

/**
 * Un Matrimonio, y todo lo que tuvo la casa.
 *
 * La página que le faltaba a la otra mitad de ADR 0010: el roster colapsado
 * muestra una pareja como **una** fila, y esa fila tenía que llevar a algún
 * lado. `/misionero/<id>` no servía — el id es el del Matrimonio, no el de una
 * persona — y linkear a un cónyuge habría vuelto a archivar la casa bajo uno de
 * los dos, que es exactamente lo que esta funcionalidad vino a sacar.
 *
 * Espeja a `/misionero/<id>` y se separa de ella en una sola cosa, que es la
 * cosa: **qué es de los dos y qué es de cada uno.** El Centro y el territorio se
 * muestran una vez, porque la pareja los comparte. El Año de consagración, el
 * Resumen anual y el teléfono van por persona: dos personas se consagran en dos
 * años distintos, y `MatrimonioDTO` dejó de llevar un teléfono de la casa
 * justamente porque cada uno atiende el suyo.
 *
 * El historial se lee por el cónyuge A y se filtra a los períodos de la pareja.
 * `historialDeMisionero` ya incluye lo del Matrimonio — la casa era la de los
 * dos — así que acá sobra la mitad individual, que tiene su propia página. El
 * filtro sólo puede achicar lo que el service ya autorizó, nunca ampliarlo; el
 * lugar propio de esta lectura es un `historialDeMatrimonio` en
 * `AsignacionService`, y está anotado como deuda y no escrito acá porque un
 * router no lleva reglas.
 *
 * Ninguna de las dos lecturas va en un try. Una negativa es del error boundary
 * de (dashboard): renderizarla como «no tuvo ninguna imagen» afirmaría algo
 * sobre una casa que este Actor no puede ver.
 */

export const dynamic = "force-dynamic";

export default async function MatrimonioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const matrimonio = await getMatrimonioByIdAction(id);
  const { misioneroA, misioneroB } = matrimonio;

  const historial = (
    await getHistorialDeMisioneroAction(misioneroA.id)
  ).filter((a) => a.tenedor.tipo === "matrimonio" && a.tenedor.id === id);

  const abiertas = historial.filter((a) => a.abierta);
  const cerradas = historial.filter((a) => !a.abierta).reverse();

  const nombre = nombreDeTenedor({ tipo: "matrimonio", matrimonio });

  // Un Matrimonio no tiene territorio propio: es el del cónyuge A, y está bien
  // definido porque el formulario lo carga una sola vez para los dos.
  const territorio = misioneroA.diocesisLocalidad;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-tinta">{nombre}</h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* La «y» sola se pasa por alto en un teléfono. `Insignia` ya trae
              glifo y palabra, así que la clase de Tenedor se lee sin depender
              del color — aunque acá sea una clase y no un estado. */}
          <Insignia tono="neutro">Matrimonio</Insignia>
          {matrimonio.deBaja && (
            <Insignia tono="neutro">Dado de baja de la Campaña</Insignia>
          )}
        </div>

        <p className="text-base text-tinta-suave">
          {territorio.nombre}, {misioneroA.provincia}
        </p>

        {matrimonio.centroNombre && (
          <p className="text-base text-tinta-suave">
            {matrimonio.centroTipo
              ? `${CENTRO_LABELS[matrimonio.centroTipo]}: `
              : ""}
            {matrimonio.centroNombre}
          </p>
        )}
      </header>

      <Tarjeta titulo="Los dos Misioneros">
        {/* Una lista y no una tabla: son dos filas, y cada una es un nombre, un
            año y un link. Una tabla de dos filas es densidad sin información. */}
        <ul className="space-y-4">
          <li>
            <Conyuge misionero={misioneroA} />
          </li>
          <li>
            <Conyuge misionero={misioneroB} />
          </li>
        </ul>
      </Tarjeta>

      <Tarjeta titulo="¿Qué tienen ahora?">
        {abiertas.length === 0 ? (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-tinta-suave">
              No tienen ninguna imagen a cargo.
            </p>
            {!matrimonio.deBaja && (
              <BotonEnlace href="/asignacion/new">
                Entregarles una imagen
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

      <Tarjeta titulo="Imágenes que tuvieron antes">
        {cerradas.length === 0 ? (
          <Vacio
            titulo="Todavía no devolvieron ninguna"
            mensaje="Cuando una imagen que tuvieron vuelva o pase a otro, ese período va a quedar acá."
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
                  {/* `cerradas` sale de filtrar por `abierta`, pero `cerradaAt`
                      es nullable por su cuenta, así que se lee en vez de dar por
                      hecho que los dos coinciden. */}
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

                {/* Un territorio, nunca una persona: los Referentes Locales
                    comparten un login por territorio. */}
                <p className="text-base text-tinta-suave">{registro(a)}</p>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>

      {/* Los resúmenes son de cada uno, no de la casa: dos tarjetas, cada una
          con el nombre de quien la escribió. Juntarlos en una sola perdería de
          quién es cada año. */}
      <ResumenesAnuales misionero={misioneroA} />
      <ResumenesAnuales misionero={misioneroB} />

      <Tarjeta titulo="Administrar">
        <BajaDeMatrimonio
          id={matrimonio.id}
          nombre={nombre}
          deBaja={matrimonio.deBaja}
        />
      </Tarjeta>
    </main>
  );
}

/**
 * Un cónyuge: su nombre, su año, y su página.
 *
 * El Año de consagración vive acá y no en el encabezado porque es de la persona
 * y no de la pareja — es la razón por la que un Matrimonio son dos filas de
 * `misionero` y no una sola con dos nombres.
 */
function Conyuge({ misionero }: { misionero: MisioneroDTO }) {
  return (
    <div className="space-y-1">
      <Link
        href={`/misionero/${misionero.id}`}
        className="flex min-h-12 items-center text-lg font-bold text-accion underline"
      >
        {nombreCompleto(misionero)}
      </Link>

      {misionero.deBaja && (
        <Insignia tono="neutro">Dado de baja de la Campaña</Insignia>
      )}

      <p className="text-base text-tinta-suave">
        {misionero.anioConsagracion
          ? `Consagración: ${misionero.anioConsagracion}`
          : "Sin año de consagración registrado"}
      </p>

      {/* El teléfono es de cada uno y no de la casa. Se muestra acá, al lado
          del nombre de quien atiende, y no arriba junto al territorio.
          Se dice «sin teléfono» en vez de no decir nada: una pareja con un solo
          número cargado es el caso común, y un renglón que falta se lee como un
          error de la pantalla en vez de como un dato que no está. */}
      <p className="text-base text-tinta-suave">
        {misionero.telefono
          ? `Teléfono: ${misionero.telefono}`
          : "Sin teléfono registrado"}
      </p>
    </div>
  );
}

function ResumenesAnuales({ misionero }: { misionero: MisioneroDTO }) {
  const resumenes = Object.entries(misionero.resumenesAnuales).sort(
    ([a], [b]) => Number(b) - Number(a),
  );

  if (resumenes.length === 0) return null;

  return (
    <Tarjeta titulo={`Resúmenes anuales de ${nombreCompleto(misionero)}`}>
      <dl className="space-y-3">
        {resumenes.map(([anio, texto]) => (
          <div key={anio}>
            <dt className="text-base font-bold text-tinta">{anio}</dt>
            <dd className="text-base leading-relaxed text-tinta">{texto}</dd>
          </div>
        ))}
      </dl>
    </Tarjeta>
  );
}
