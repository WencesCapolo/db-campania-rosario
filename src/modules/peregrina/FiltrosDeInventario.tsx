"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import { REGIONES } from "@/modules/territorio/territorio.schema";
import {
  CLAVES_DE_FILTRO,
  ESTADOS_SELECCIONABLES,
  ESTADO_LABELS,
  MODALIDADES,
  MODALIDAD_LABELS,
  TENENCIAS,
  TENENCIA_LABELS,
  TIPO_LABELS,
  hayFiltros,
  type FiltrosDeInventario,
} from "./peregrina.types";
import { peregrinaTipoEnum } from "./peregrina.schema";
import { CLAVE_DE_PAGINA } from "@/lib/paginacion";

/**
 * The filter controls — one component, every screen that filters.
 *
 * The state is the address and not this component. That is what makes a filtered
 * view survive opening a record and coming back (story 19), reload, and being
 * pasted into a message (story 20) — a `useState` is thrown away by the first
 * navigation, and a query string *is* where you were. It also means the tablero
 * and the listado cannot drift: they render this, and they parse what it wrote.
 *
 * Changing a select navigates immediately, because a select that needs a separate
 * "Apply" is two actions for one decision. The Código box does not: it is typed,
 * and navigating per keystroke would fight the keyboard.
 *
 * `enLaTabla` is the listado's version, and it differs in two ways. It has no
 * frame of its own: it sits inside the "Las imágenes" frame, in the strip under
 * the title, so what filters is attached to what is filtered. And it hides the
 * six selects behind a link and leaves the two searches out in the open, on one
 * line with their button. On the listado that is the honest weighting — somebody
 * arrives holding an image and types its Código; filtering by Modalidad is the
 * rarer errand, and six selects above the rows push them off a phone. The
 * tablero keeps the framed, always-open version, because there the filters
 * *are* the screen.
 *
 * Two things deliberately stay outside the fold: the line that says which filters
 * are on, and "Limpiar filtros". A filtered view that looks unfiltered is exactly
 * the bug story 18 is about, and the way out of one has to be reachable without
 * first reopening the thing that caused it. That is also why it opens already
 * expanded when the address arrives with filters in it.
 *
 * The territory picker appears only for the two nacional rols. A Referente Local's
 * selection list legitimately reaches their whole Provincia — that is what makes a
 * picker a picker — but *reading* another Diócesis is refused, so offering it here
 * would be offering a control that produces a refusal. Their data is one Diócesis
 * already; the filter would narrow nothing.
 */

const OPCIONES_DE_MODALIDAD = MODALIDADES.map((m) => ({
  valor: m,
  etiqueta: MODALIDAD_LABELS[m],
}));

const OPCIONES_DE_ESTADO = ESTADOS_SELECCIONABLES.map((e) => ({
  valor: e,
  etiqueta: ESTADO_LABELS[e],
}));

const OPCIONES_DE_TIPO = peregrinaTipoEnum.enumValues.map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

const OPCIONES_DE_TENENCIA = TENENCIAS.map((t) => ({
  valor: t,
  etiqueta: TENENCIA_LABELS[t],
}));

const OPCIONES_DE_REGION = REGIONES.map((r) => ({ valor: r, etiqueta: r }));

export interface TerritorioParaFiltrar {
  id: string;
  nombre: string;
}

export default function FiltrosDeInventario({
  filtros,
  destino,
  territorios,
  conBusqueda = true,
  enLaTabla = false,
}: {
  filtros: FiltrosDeInventario;
  /** Where the filters apply — `/peregrina`, `/tablero`. */
  destino: string;
  /** The Diócesis on offer, for a nacional rol. Null for everybody else. */
  territorios?: TerritorioParaFiltrar[] | null;
  /**
   * The two typed searches — Código, and the name of whoever has the image.
   * Off on the tablero: a count of one is not a figure.
   */
  conBusqueda?: boolean;
  /**
   * The listado's layout: no frame, the searches on one line, the six selects
   * behind a link, and the active filters as chips that each remove themselves.
   */
  enLaTabla?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, empezar] = useTransition();
  const [borrador, setBorrador] = useState(filtros.identificacion ?? "");
  const [borradorMisionero, setBorradorMisionero] = useState(
    filtros.misionero ?? "",
  );

  // Arranca abierto cuando la dirección ya trae un filtro de los plegados: quien
  // llega a una vista filtrada — desde el tablero, o por un link pegado en un
  // mensaje — tiene que ver el control que la explica, no un link que lo esconde.
  // Las dos búsquedas no cuentan: esas están siempre a la vista.
  const [abiertos, setAbiertos] = useState(
    () => !enLaTabla || hayFiltrosPlegados(filtros),
  );
  // `useId` y no una constante: `aria-controls` tiene que apuntar a un id único, y
  // dos instancias en una misma pantalla lo dejarían apuntando a la otra.
  const idDeLosFiltros = useId();

  function aplicar(cambios: Partial<Record<string, string>>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    // Back to the first page. Changing a filter changes how many pages there
    // are, and staying on page four of a set that now has two is a screen that
    // says nothing matched when something does.
    params.delete(CLAVE_DE_PAGINA);
    const query = params.toString();
    empezar(() => router.push(query ? `${destino}?${query}` : destino));
  }

  function limpiar() {
    setBorrador("");
    setBorradorMisionero("");
    const params = new URLSearchParams(searchParams.toString());
    for (const clave of CLAVES_DE_FILTRO) params.delete(clave);
    params.delete("q");
    params.delete(CLAVE_DE_PAGINA);
    const query = params.toString();
    empezar(() => router.push(query ? `${destino}?${query}` : destino));
  }

  /** One chip's ✕. A typed search also empties its box, or it would come back. */
  function quitar(clave: ClaveDeFiltro) {
    if (clave === "identificacion") setBorrador("");
    if (clave === "misionero") setBorradorMisionero("");
    aplicar({ [clave]: "" });
  }

  const activos = describir(filtros, territorios ?? []);
  const conTerritorio = Boolean(territorios && territorios.length > 1);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    aplicar({
      identificacion: borrador.trim(),
      misionero: borradorMisionero.trim(),
    });
  };

  const selects = (
    <>
      <Eleccion
        etiqueta="Estado"
        opciones={OPCIONES_DE_ESTADO}
        vacia="Todos"
        value={filtros.estado ?? ""}
        onChange={(e) => aplicar({ estado: e.target.value })}
      />
      <Eleccion
        etiqueta="Modalidad"
        opciones={OPCIONES_DE_MODALIDAD}
        vacia="Todas"
        value={filtros.modalidad ?? ""}
        onChange={(e) => aplicar({ modalidad: e.target.value })}
      />
      <Eleccion
        etiqueta="Tipo"
        opciones={OPCIONES_DE_TIPO}
        vacia="Peregrinas y auxiliares"
        value={filtros.tipo ?? ""}
        onChange={(e) => aplicar({ tipo: e.target.value })}
      />
      <Eleccion
        etiqueta="¿Quién la tiene?"
        opciones={OPCIONES_DE_TENENCIA}
        vacia="No importa"
        value={filtros.tenencia ?? ""}
        onChange={(e) => aplicar({ tenencia: e.target.value })}
      />

      {conTerritorio && territorios && (
        <>
          <Eleccion
            etiqueta="Diócesis/Localidad"
            opciones={territorios.map((t) => ({
              valor: t.id,
              etiqueta: t.nombre,
            }))}
            vacia="Todo el país"
            value={filtros.diocesisLocalidadId ?? ""}
            onChange={(e) => aplicar({ diocesisLocalidadId: e.target.value })}
          />
          <Eleccion
            etiqueta="Región"
            opciones={OPCIONES_DE_REGION}
            vacia="Todas"
            value={filtros.region ?? ""}
            onChange={(e) => aplicar({ region: e.target.value })}
          />
        </>
      )}
    </>
  );

  if (enLaTabla) {
    return (
      <form role="search" className="space-y-4" onSubmit={enviar}>
        {/* Las dos búsquedas y su botón en un renglón desde `md`, con el botón
            al ras de las cajas. Sin ayuda debajo de la etiqueta: «Código o
            numeración anterior» ya la dice, y en un renglón una ayuda de dos
            líneas desalinea las cajas. */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="md:flex-1">
            <Campo
              etiqueta="Código o numeración anterior"
              type="search"
              inputMode="search"
              placeholder="CBA JOV 0001"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
            />
          </div>
          {/* El nombre de quien la tiene, y no un selector de Misioneros: una
              Diócesis tiene cientos, y quien pregunta ya tiene el apellido en la
              cabeza. Las dos cajas se envían con el mismo botón, porque son la
              misma pregunta hecha por dos datos que suelen venir juntos. */}
          <div className="md:flex-1">
            <Campo
              etiqueta="Quién la tiene"
              type="search"
              inputMode="search"
              placeholder="Álvarez"
              value={borradorMisionero}
              onChange={(e) => setBorradorMisionero(e.target.value)}
            />
          </div>
          <Boton type="submit" disabled={pendiente}>
            {pendiente ? "Buscando…" : "Buscar"}
          </Boton>
        </div>

        {/* Un link subrayado y no un botón con borde: abre más controles en el
            mismo lugar, y nombra lo que esconde para que nadie tenga que abrirlo
            para saber si lo que busca está ahí. Igual mide 54 px de alto. */}
        <button
          type="button"
          aria-expanded={abiertos}
          aria-controls={idDeLosFiltros}
          onClick={() => setAbiertos((v) => !v)}
          className="inline-flex min-h-12 items-center gap-2 text-left text-base font-semibold text-azul underline underline-offset-4"
        >
          {abiertos
            ? "Menos filtros"
            : `Más filtros: Estado, Modalidad, Tipo${conTerritorio ? ", territorio" : ""}`}
          <span aria-hidden>{abiertos ? "▴" : "▾"}</span>
        </button>

        {/*
          Se esconde con `display: none` — la utilidad `hidden` — y no con opacidad ni
          alto cero: eso lo saca del orden de tabulación y del árbol de accesibilidad
          de una vez, mientras el nodo sigue existiendo, que es lo que `aria-controls`
          necesita para apuntar a algo. Un `<select>` tapado con `opacity-0` seguiría
          siendo tabulable, y el teclado caería adentro de seis controles invisibles.

          Es la clase y no el atributo `hidden`, y la razón es la desviación de esta
          base: acá Tailwind entra sin capas, y el preflight sale *antes* que las
          utilidades. `[hidden]` y `.grid` tienen la misma especificidad, así que gana
          la que va después — la utilidad. El atributo no habría escondido nada.
        */}
        <div
          id={idDeLosFiltros}
          className={
            abiertos ? "grid gap-4 sm:grid-cols-2 md:grid-cols-3" : "hidden"
          }
        >
          {selects}
        </div>

        {/* Los filtros puestos, cada uno con su ✕ — historia 18, y la salida de
            una vista filtrada sin reabrir lo que la filtró. Con uno solo, su ✕
            ya es «limpiar»; con más, aparece el botón que los saca todos. */}
        {activos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="text-base font-semibold text-tinta">
              Filtros activos:
            </span>
            {activos.map(({ clave, texto }) => (
              <button
                key={clave}
                type="button"
                disabled={pendiente}
                onClick={() => quitar(clave)}
                aria-label={`Quitar el filtro ${texto}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-control border-2 border-azul bg-papel px-3 text-base font-semibold text-azul hover:bg-lienzo disabled:cursor-not-allowed disabled:opacity-60"
              >
                {texto}
                <span aria-hidden>✕</span>
              </button>
            ))}
            {activos.length > 1 && (
              <Boton tono="secundario" disabled={pendiente} onClick={limpiar}>
                Limpiar todos
              </Boton>
            )}
          </div>
        )}
      </form>
    );
  }

  return (
    <form
      className="space-y-4 rounded-marco border-2 border-borde-suave bg-papel p-5"
      onSubmit={enviar}
    >
      {conBusqueda && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Buscar por Código"
            ayuda="O por la numeración anterior, si la imagen tiene una."
            type="search"
            inputMode="search"
            placeholder="CBA JOV 0001"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
          />
          <Campo
            etiqueta="Buscar por quién la tiene"
            ayuda="Nombre o apellido del Misionero."
            type="search"
            inputMode="search"
            placeholder="Álvarez"
            value={borradorMisionero}
            onChange={(e) => setBorradorMisionero(e.target.value)}
          />
        </div>
      )}

      {(conBusqueda || hayFiltros(filtros)) && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {conBusqueda && (
            <Boton type="submit" disabled={pendiente}>
              {pendiente ? "Buscando…" : "Buscar"}
            </Boton>
          )}

          {hayFiltros(filtros) && (
            <Boton tono="secundario" disabled={pendiente} onClick={limpiar}>
              Limpiar filtros
            </Boton>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">{selects}</div>

      {/*
        Which filters are on, in words — story 18. A figure that looks wrong is
        almost always a filter somebody forgot, and the fix is to say so next to
        the numbers rather than expecting them to read six selects back.
      */}
      {activos.length > 0 && (
        <p className="text-base text-tinta" aria-live="polite">
          <span className="font-semibold">Filtros activos:</span>{" "}
          {activos.map((a) => a.texto).join(" · ")}
        </p>
      )}
    </form>
  );
}

type ClaveDeFiltro = (typeof CLAVES_DE_FILTRO)[number];

/** Whether any filter that lives behind the fold is on. */
function hayFiltrosPlegados(filtros: FiltrosDeInventario): boolean {
  return CLAVES_DE_FILTRO.some(
    (c) => c !== "identificacion" && c !== "misionero" && Boolean(filtros[c]),
  );
}

/** The active filters as the Campaña's own words, each with the key it clears. */
function describir(
  filtros: FiltrosDeInventario,
  territorios: TerritorioParaFiltrar[],
): { clave: ClaveDeFiltro; texto: string }[] {
  const partes: { clave: ClaveDeFiltro; texto: string }[] = [];
  const poner = (clave: ClaveDeFiltro, texto: string) =>
    partes.push({ clave, texto });

  if (filtros.identificacion) {
    poner("identificacion", `Código o numeración «${filtros.identificacion}»`);
  }
  if (filtros.misionero) poner("misionero", `la tiene «${filtros.misionero}»`);
  if (filtros.estado) poner("estado", ESTADO_LABELS[filtros.estado]);
  if (filtros.modalidad)
    poner("modalidad", MODALIDAD_LABELS[filtros.modalidad]);
  if (filtros.tipo) poner("tipo", TIPO_LABELS[filtros.tipo]);
  if (filtros.tenencia) poner("tenencia", TENENCIA_LABELS[filtros.tenencia]);
  if (filtros.region) poner("region", `Región ${filtros.region}`);
  if (filtros.diocesisLocalidadId) {
    const territorio = territorios.find(
      (t) => t.id === filtros.diocesisLocalidadId,
    );
    poner(
      "diocesisLocalidadId",
      territorio ? territorio.nombre : "una Diócesis/Localidad",
    );
  }

  return partes;
}
