import Image from "next/image";
import Link from "next/link";
import {
  getMisionerosFiltradosAction,
  getMisionerosPaginadosAction,
} from "@/modules/misionero/misionero.router";
import {
  getTenedoresConPeregrinaAction,
  getTenedoresSinPeregrinaAction,
  getTenenciasDeTenedoresAction,
} from "@/modules/asignacion/asignacion.router";
import { getPeregrinasDisponiblesAction } from "@/modules/peregrina/peregrina.router";
import { CENTRO_LABELS } from "@/modules/misionero/misionero.types";
import {
  valorDeTenedor,
  type TenedorDTO,
} from "@/modules/misionero/matrimonio.types";
import type { TenenciaDeTenedorDTO } from "@/modules/asignacion/asignacion.types";
import { BotonEnlace } from "@/components/Boton";
import Insignia from "@/components/Insignia";
import Paginador from "@/components/Paginador";
import Volver from "@/components/Volver";
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
import { nombreDeTenedorEnLista } from "@/lib/formato";
import FiltrosDeMisionero from "./FiltrosDeMisionero";
import CrearMisioneroForm from "./CrearMisioneroForm";

/**
 * Misioneros — una pantalla, tres bloques: el alta, los filtros, la tabla.
 *
 * Es el mismo cambio que hizo el listado de Peregrinas, por las mismas razones:
 *
 *  - **El alta está acá.** Cargar una persona era `/misionero/new`, ida y vuelta, y
 *    estas fichas se tipean de a lotes — una parroquia por vez. El formulario
 *    arriba de la tabla es el mismo componente, con `enListado`: guarda, conserva
 *    el territorio y el centro, limpia la persona, devuelve el foco a Nombre y
 *    `router.refresh()` hace aparecer la fila abajo. `/misionero/new` sigue
 *    existiendo porque el flujo de Asignación manda ahí cuando la persona no está
 *    cargada todavía.
 *  - **Es una tabla y no tarjetas.** Se resigna lo que la tarjeta compraba: un
 *    blanco enorme por persona y una maqueta que nunca tenía que reacomodarse. Se
 *    compensa con lo que se puede — el nombre es lo primero de la fila y es el
 *    link, las filas miden 54 px, y en una pantalla angosta la tabla scrollea al
 *    costado adentro de su marco en lugar de scrollear la página.
 *  - **El tratamiento es el de Inicio:** cuerpo en `lienzo`, cada bloque un marco
 *    de `borde-suave` sobre `papel`, títulos en `azul` condensado, el filete
 *    dorado cerrando el encabezado, y un «Volver a Inicio» con palabras y 54 px de
 *    blanco — el logo de la barra ya va ahí, pero logo-es-el-inicio es una
 *    convención de quien navega seguido y no de quien carga registros a mano.
 *
 * La columna «¿Tiene imagen?» es una consulta por página y no una por fila, y no
 * está scopeada por el territorio de la *imagen*: una Peregrina movida a otra
 * Diócesis sigue estando en la casa de quien la tiene, así que decir «Ninguna»
 * sería mentir en la dirección cómoda. Su Código, en cambio, sólo se nombra cuando
 * el Actor podía leerlo igual — lo decide `AsignacionService.tenenciasDeTenedores`,
 * con la misma distinción que hace la negativa al dar de baja a un Misionero.
 *
 * Dos filtros, los dos en la dirección. El buscador es `MisioneroService.search`, y
 * el de tenencia tiene las dos respuestas: «sólo los que tienen alguna» y «sólo los
 * que no tienen ninguna». La segunda es la otra mitad de la tarjeta de capacidad
 * libre del tablero, que linkea derecho acá para que encontrar a alguien libre y
 * abrir su ficha sea un viaje y no dos; la primera es la pregunta del otro lado —
 * quién tiene que devolver algo, a quién llamar cuando falta una imagen.
 *
 * Un solo parámetro, `?imagen=con|sin`, y no dos banderas: son excluyentes, y dos
 * banderas dejan escribir `sinImagen=1&conImagen=1`, que no tiene respuesta. Un
 * valor que no es ninguno de los dos se descarta y se listan todos, porque eso es
 * un dedazo y no una escalada.
 *
 * El filtro se aplica intersecando con la lista scopeada de gente con —o sin—
 * Asignación abierta, y no con una segunda consulta filtrada. El join ignora a
 * propósito el territorio de la *imagen* — quien tiene una Peregrina que después se
 * movió de Diócesis no está libre — y eso es una propiedad de
 * `findTenedoresSinPeregrina` y su gemela, no algo que esta pantalla deba repetir.
 *
 * La lectura no va en un try a propósito. Tira en una negativa, `error.tsx` la
 * agarra, y `Vacio` sólo se alcanza cuando la consulta de verdad no trajo nada: «no
 * hay Misioneros» mostrado a quien fue rechazado le diría que su territorio está
 * vacío, y a quien está tanteando le confirmaría que existe.
 *
 * **La tabla es de Tenedores y no de personas.** Un matrimonio es una fila y sus
 * dos cónyuges no son ninguna (ADR 0010): el listado era el lugar donde la misma
 * casa aparecía dos veces y había que saber que eran una. El nombre lo arma
 * `nombreDeTenedorEnLista`, que colapsa el apellido cuando es el mismo, y la fila
 * lleva además una `Insignia` que dice «Matrimonio» — la «y» del medio se pierde
 * en un teléfono, y la Insignia trae glifo y palabra, así que la distinción no
 * queda en el color.
 *
 * El nombre sigue siendo el link, y lleva a la ficha del Tenedor: `/misionero/:id`
 * en una persona, `/matrimonio/:id` en una casa. No a la ficha de uno de los dos
 * cónyuges — abrir «Álvarez, Ana y Benítez, Juan» y aterrizar en Ana es la misma
 * media verdad que este cambio saca del listado. El teléfono, el Centro y el
 * estado de baja de la fila son los del matrimonio; el territorio es el del
 * cónyuge A, que es de dónde lo toma el propio modelo.
 */

/**
 * Las dos respuestas del filtro de tenencia, y nada más.
 *
 * Un `?imagen=` con cualquier otra cosa se descarta y se listan todos: un valor
 * que no existe es un dedazo o un link viejo, y contestarlo con una lista vacía
 * haría parecer que el territorio se quedó sin gente.
 */
type FiltroDeTenencia = "con" | "sin";

const esTenencia = (valor?: string): valor is FiltroDeTenencia =>
  valor === "con" || valor === "sin";

/** El id de la fila, que es el del Tenedor y no el de una persona adentro. */
function idDeFila(fila: TenedorDTO): string {
  return fila.tipo === "persona" ? fila.persona.id : fila.matrimonio.id;
}

/**
 * Lo que la fila muestra además del nombre, venga de una persona o de una casa.
 *
 * El teléfono, el Centro y la baja son del matrimonio cuando hay matrimonio —
 * eso es lo que la casa comparte. El territorio no: un matrimonio no tiene uno
 * propio y sale del cónyuge A, que es exactamente de donde lo saca el modelo para
 * scopearlo (ADR 0010), así que la pantalla no está eligiendo nada acá.
 */
function datosDeLaFila(fila: TenedorDTO) {
  if (fila.tipo === "persona") {
    const p = fila.persona;
    return {
      diocesisLocalidad: p.diocesisLocalidad.nombre,
      provincia: p.provincia,
      telefono: p.telefono,
      telefonos: telefonosDe([p]),
      centroTipo: p.centroTipo,
      centroNombre: p.centroNombre,
      deBaja: p.deBaja,
    };
  }

  const m = fila.matrimonio;
  return {
    diocesisLocalidad: m.misioneroA.diocesisLocalidad.nombre,
    provincia: m.misioneroA.provincia,
    telefonos: telefonosDe([m.misioneroA, m.misioneroB]),
    centroTipo: m.centroTipo,
    centroNombre: m.centroNombre,
    deBaja: m.deBaja,
  };
}

/**
 * Los teléfonos de la fila, que son de personas y no de casas.
 *
 * Un matrimonio tiene hasta dos, cada uno de uno de los dos, y los dos son
 * opcionales — así que la celda muestra ninguno, uno o los dos. Cuando hay más de
 * uno cada número dice de quién es: llamar es llamarle a alguien, y un par de
 * números sin nombre obliga a probar los dos.
 */
function telefonosDe(
  personas: { nombre: string; telefono: string | null }[],
): { deQuien: string; numero: string }[] {
  const conNumero = personas.filter((p) => p.telefono);
  return conNumero.map((p) => ({
    deQuien: conNumero.length > 1 ? p.nombre : "",
    // Filtrado arriba: acá ya no puede ser null.
    numero: p.telefono ?? "",
  }));
}

/**
 * Si la fila está en la lista de Tenedores con —o sin— imagen, que es el filtro
 * de tenencia.
 *
 * Una pertenencia por identidad y nada más, porque las dos listas están keyeadas
 * igual: `findTenedoresSinPeregrina` y su gemela contestan por Tenedor, de la
 * misma forma en que el roster arma sus filas.
 *
 * No siempre fue así. Mientras contestaron por Misionero, esto buscaba a un
 * matrimonio por sus dos cónyuges — y no alcanzaba, porque las Asignaciones de un
 * matrimonio apuntan al matrimonio y no a ninguno de los dos, así que una casa
 * con una imagen a cargo caía del lado equivocado del filtro sin que nada
 * fallara. Era la lectura polimórfica a medias que ADR 0010 avisa que falla en
 * silencio, y se arregló donde correspondía: en `AsignacionRepository`.
 *
 * La clave es `valorDeTenedor` y no el id pelado. El id de una persona y el de un
 * matrimonio viven en espacios distintos, y compararlos sueltos es cómo dos cosas
 * que no son la misma llegan a parecerlo.
 */
function claveDeFila(fila: TenedorDTO): string {
  return valorDeTenedor({ tipo: fila.tipo, id: idDeFila(fila) });
}

const CELDA = "px-4 py-3 align-middle";

const ENCABEZADO_DE_COLUMNA = `${CELDA} font-semibold text-tinta`;

export const dynamic = "force-dynamic";

export default async function MisioneroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; imagen?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tenencia = esTenencia(params.imagen) ? params.imagen : null;
  const paginaPedida = paginaDesdeParams(params);
  const filtros = q ? { q } : {};

  /*
   * Two reads, two ways of paginating, and the difference is the join.
   *
   * Without the tenencia filter the page comes from the database, one page of rows
   * and a count over the same predicate. With it, the set is the intersection of
   * two scoped reads — and the second, `findTenedoresSinPeregrina` or its twin,
   * deliberately ignores the *image's* territory, so it cannot be expressed as a
   * filter on this query. The intersection therefore has to be computed before it
   * can be cut, which means fetching both in full and slicing here.
   *
   * That is a real limit and it is written down rather than hidden: it is bounded
   * by the Actor's territory, so a Diócesis's worth of people, and the honest fix
   * is the join inside the filtered query — a change to `AsignacionRepository`,
   * not something this page should fake. It cannot live in `MisioneroRepository`
   * either: the import chain runs misionero → peregrina → asignación, one way, so
   * the misionero query has no `asignacion` to join against.
   */
  const encontrados = tenencia
    ? await getMisionerosFiltradosAction(filtros)
    : null;

  const porTenencia = tenencia
    ? tenencia === "sin"
      ? await getTenedoresSinPeregrinaAction()
      : await getTenedoresConPeregrinaAction()
    : null;

  const clavesConTenencia = porTenencia
    ? new Set(porTenencia.map((t) => valorDeTenedor({ tipo: t.tipo, id: t.id })))
    : null;

  const pagina =
    encontrados && clavesConTenencia
      ? enMemoria(
          encontrados.filter((t) => clavesConTenencia.has(claveDeFila(t))),
          paginaPedida,
        )
      : await getMisionerosPaginadosAction(filtros, paginaPedida);

  const filas = pagina.filas;
  const filtrado = Boolean(q || tenencia);

  // Una consulta para las filas de esta página, no una por fila: veinte filas
  // serían veinte viajes por la misma pregunta. Con el filtro de tenencia puesto la
  // respuesta gruesa ya se sabe, pero se pide igual, porque la celda dice *cuál*
  // imagen y porque «ninguna dentro de tu territorio» y «ninguna» no son lo mismo.
  // Las imágenes libres, para el alta de arriba: cargar a una persona y dejar
  // asentado qué se llevó es lo mismo que hace el flujo de Asignación, y hacerlo
  // acá evita volver a buscar por apellido a quien se acaba de tipear.
  const disponibles = await getPeregrinasDisponiblesAction();

  const tenencias = filas.length
    ? await getTenenciasDeTenedoresAction(
        filas.map((f) => ({ tipo: f.tipo, id: idDeFila(f) })),
      )
    : [];
  const tenenciaDe = new Map(
    tenencias.map((t) => [valorDeTenedor(t.tenedor), t]),
  );

  const hrefDePagina = (n: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (tenencia) query.set("imagen", tenencia);
    query.set(CLAVE_DE_PAGINA, String(n));
    return `/misionero?${query.toString()}`;
  };

  return (
    <div className="flex-1 bg-lienzo px-5 py-6">
      <main className="mx-auto w-full max-w-4xl space-y-6">
        <Volver href="/dashboard">Volver a Inicio</Volver>

        <div className="overflow-hidden rounded-marco border-2 border-borde-suave bg-papel">
          {/* El encabezado va adentro del marco, como en Inicio: el bloque tiene
              un borde en total en lugar de un título con canto propio arriba de
              una tarjeta.

              En un teléfono es una columna centrada y la imagen va arriba; desde
              `sm` es un renglón con el texto a la izquierda y la imagen a la
              derecha. El filete dorado sigue al texto: centrado cuando el texto
              está centrado, al ras de la izquierda cuando no. */}
          <header className="flex flex-col items-center gap-6 border-b-2 border-borde-suave bg-lienzo px-5 pt-8 pb-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-oro-tinta uppercase sm:text-sm">
                Campaña del Rosario
              </p>

              <h1 className="mt-3 font-stretch-condensed text-4xl leading-tight font-bold text-azul sm:text-5xl">
                Misioneros
              </h1>

              {/* Decoración: #ac954f da 2.9:1 y no lleva nada encima. */}
              <hr className="mx-auto mt-6 w-16 border-t-4 border-oro sm:mx-0" />
            </div>

            {/*
             * `alt=""` y `aria-hidden` porque es la identidad de la pantalla y no un
             * dato: el título ya dice de qué se trata, y describir la foto no le
             * agrega nada a quien navega con lector de pantalla antes de llegar al
             * formulario.
             *
             * `w-auto` y no un cuadrado: la foto es apaisada, y forzarla a
             * `h-28 w-28` la aplastaría.
             */}
            <Image
              src="/Papa-Leon-XIV-con-la-Cruz-de-la-Unidad.webp"
              alt=""
              width={1000}
              height={900}
              priority
              aria-hidden
              className="h-24 w-auto shrink-0 sm:h-28"
            />
          </header>

          <section className="px-5 py-6 sm:px-6">
            <h2 className="font-stretch-condensed text-2xl leading-tight font-bold text-azul">
              Cargar un Misionero
            </h2>
            <p className="mt-1 mb-5 text-base leading-relaxed text-tinta-suave">
              Una persona de la Campaña, o un matrimonio: no entra al sistema ni
              tiene contraseña, es quien puede tener una imagen a cargo. Se
              carga acá mismo y aparece en la tabla de abajo.
            </p>

            <CrearMisioneroForm enListado disponibles={disponibles} />
          </section>
        </div>

        <FiltrosDeMisionero q={q} tenencia={tenencia} />

        <div className="overflow-hidden rounded-marco border-2 border-borde-suave bg-papel">
          <div className="border-b-2 border-borde-suave bg-lienzo px-5 py-4 sm:px-6">
            <h2 className="font-stretch-condensed text-2xl leading-tight font-bold text-azul">
              Las personas
            </h2>
            <p className="mt-1 text-base text-tinta-suave" aria-live="polite">
              {/* El conjunto entero, del agregado — no las filas de esta página.
                  «Personas y matrimonios» porque eso es lo que se cuenta: un
                  matrimonio es uno acá y dos en la vida, y decir «personas» a
                  secas haría que el número no cerrara con las filas de abajo. */}
              {pagina.total === 1
                ? "1 persona o matrimonio"
                : `${pagina.total} personas y matrimonios`}
              {filtrado ? " con esos filtros" : " en tu territorio"}
            </p>
          </div>

          {filas.length === 0 ? (
            <div className="px-5 py-6 sm:px-6">
              {filtrado ? (
                <Vacio
                  titulo="Nadie coincide"
                  mensaje="Probá con parte del apellido, o limpiá los filtros para ver a todos."
                />
              ) : (
                <Vacio
                  titulo="Todavía no hay Misioneros cargados"
                  mensaje="Cargá la primera persona con el formulario de arriba: después vas a poder entregarle una imagen."
                />
              )}
            </div>
          ) : (
            /* El scroll al costado vive en la tabla y no en la página: en un
               teléfono se arrastra la tabla, y el resto de la pantalla se queda
               quieto. */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-base">
                <thead>
                  <tr className="border-b-2 border-borde-suave">
                    <th scope="col" className={ENCABEZADO_DE_COLUMNA}>
                      Nombre
                    </th>
                    <th scope="col" className={ENCABEZADO_DE_COLUMNA}>
                      ¿Tiene imagen?
                    </th>
                    <th scope="col" className={ENCABEZADO_DE_COLUMNA}>
                      Diócesis/Localidad
                    </th>
                    <th scope="col" className={ENCABEZADO_DE_COLUMNA}>
                      Teléfono
                    </th>
                    <th scope="col" className={ENCABEZADO_DE_COLUMNA}>
                      Centro
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filas.map((fila) => {
                    const id = idDeFila(fila);
                    const casa = datosDeLaFila(fila);

                    return (
                      <tr
                        key={id}
                        className="border-b border-borde-suave last:border-b-0 hover:bg-lienzo"
                      >
                        <th scope="row" className={`${CELDA} font-normal`}>
                          {/* El nombre es el link y es lo primero de la fila:
                              quien busca a alguien está emparejando un apellido.
                              La ficha de un matrimonio es la del matrimonio, no
                              la de uno de los dos. */}
                          <Link
                            href={
                              fila.tipo === "persona"
                                ? `/misionero/${id}`
                                : `/matrimonio/${id}`
                            }
                            className="text-lg font-bold text-azul"
                          >
                            {nombreDeTenedorEnLista(fila)}
                          </Link>

                          {fila.tipo === "matrimonio" && (
                            <span className="mt-2 block">
                              <Insignia>Matrimonio</Insignia>
                            </span>
                          )}

                          {casa.deBaja && (
                            <span className="mt-1 block text-sm text-tinta-suave">
                              {fila.tipo === "matrimonio"
                                ? "matrimonio dado de baja"
                                : "dado de baja"}
                            </span>
                          )}
                        </th>

                        <td className={CELDA}>
                          <Tenencia tenencia={tenenciaDe.get(claveDeFila(fila))} />
                        </td>

                        <td className={`${CELDA} text-tinta`}>
                          {casa.diocesisLocalidad}
                          <span className="block text-sm text-tinta-suave">
                            {casa.provincia}
                          </span>
                        </td>

                        <td className={`${CELDA} whitespace-nowrap text-tinta`}>
                          {casa.telefonos.length === 0 ? (
                            <span className="text-tinta-suave">
                              Sin teléfono
                            </span>
                          ) : (
                            /* Un link `tel:` porque esta columna existe para
                               llamar: en un teléfono llamar es tocarlo, y en una
                               computadora sigue siendo texto que se puede copiar.
                               Un matrimonio puede tener dos, y entonces cada uno
                               dice de quién es. */
                            <span className="flex flex-col gap-1">
                              {casa.telefonos.map((t) => (
                                <span key={t.numero}>
                                  <a
                                    href={`tel:${t.numero}`}
                                    className="text-accion"
                                  >
                                    {t.numero}
                                  </a>
                                  {t.deQuien && (
                                    <span className="block text-sm text-tinta-suave">
                                      {t.deQuien}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>

                        <td className={`${CELDA} text-tinta`}>
                          {casa.centroTipo || casa.centroNombre ? (
                            <>
                              {casa.centroTipo &&
                                CENTRO_LABELS[casa.centroTipo]}
                              {casa.centroNombre && (
                                <span className="block text-sm text-tinta-suave">
                                  {casa.centroNombre}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-tinta-suave">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Paginador
          pagina={pagina.pagina}
          paginas={pagina.paginas}
          total={pagina.total}
          porPagina={pagina.porPagina}
          unidad="personas y matrimonios"
          href={hrefDePagina}
        />

        <BotonEnlace href="/asignacion/new" tono="secundario">
          Entregar una imagen
        </BotonEnlace>
      </main>
    </div>
  );
}

/**
 * Qué imagen tiene esta persona, dicho en una celda.
 *
 * Tres respuestas y no dos, y la tercera es la que importa: una Peregrina que se
 * movió a otra Diócesis mientras alguien la tiene en la casa sigue estando en esa
 * casa, pero nombrar su Código sería confirmar un registro que este Actor no puede
 * leer. Entonces se dice que hay una y no cuál — que además es lo que alguien
 * necesita para saber que esa persona no está libre.
 *
 * El Código es un link a la imagen, en mono: es la cadena que se compara contra lo
 * que está escrito en la Peregrina, y `whitespace-nowrap` para que «CBA JOV 0001»
 * no se corte en tres renglones.
 */
function Tenencia({ tenencia }: { tenencia?: TenenciaDeTenedorDTO }) {
  const propias = tenencia?.peregrinas ?? [];
  const ajenas = tenencia?.ajenas ?? 0;

  if (propias.length === 0 && ajenas === 0) {
    return <span className="text-tinta-suave">Ninguna</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {propias.map((p) => (
        <Link
          key={p.id}
          href={`/peregrina/${p.id}`}
          className="font-mono font-bold whitespace-nowrap text-azul"
        >
          {p.codigo}
        </Link>
      ))}

      {ajenas > 0 && (
        <span className="text-sm text-tinta-suave">
          {ajenas === 1
            ? "1 imagen de otro territorio"
            : `${ajenas} imágenes de otro territorio`}
        </span>
      )}
    </span>
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
  filas: TenedorDTO[],
  paginaPedida: number,
): Pagina<TenedorDTO> {
  const actual = paginaExistente(paginaPedida, cantidadDePaginas(filas.length));
  const { limit, offset } = rango(actual);
  return armarPagina(filas.slice(offset, offset + limit), filas.length, actual);
}
