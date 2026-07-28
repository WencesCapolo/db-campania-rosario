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
 * `plegable` hides the six selects behind a button and leaves the Código box out
 * in the open. On the listado that is the honest weighting — somebody arrives
 * holding an image and types its Código; filtering by Modalidad is the rarer
 * errand, and six selects above the rows push them off a phone. It defaults to
 * false because on the tablero the filters *are* the screen.
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
  plegable = false,
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
  /** Puts the six selects behind a button. The Código box stays visible. */
  plegable?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, empezar] = useTransition();
  const [borrador, setBorrador] = useState(filtros.codigo ?? "");
  const [borradorMisionero, setBorradorMisionero] = useState(
    filtros.misionero ?? "",
  );

  // Arranca abierto cuando la dirección ya trae filtros: quien llega a una vista
  // filtrada — desde el tablero, o por un link pegado en un mensaje — tiene que ver
  // los controles que la explican, no un botón que los esconde.
  const [abiertos, setAbiertos] = useState(
    () => !plegable || hayFiltros(filtros),
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
    // `q` belongs to the Misionero list and is not one of the inventory filters,
    // but "Limpiar" means all of them to the person pressing it.
    params.delete("q");
    params.delete(CLAVE_DE_PAGINA);
    const query = params.toString();
    empezar(() => router.push(query ? `${destino}?${query}` : destino));
  }

  const activos = describir(filtros, territorios ?? []);

  return (
    <form
      className="space-y-4 rounded-marco border-2 border-borde-suave bg-papel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar({
          codigo: borrador.trim(),
          misionero: borradorMisionero.trim(),
        });
      }}
    >
      {conBusqueda && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Buscar por Código"
            type="search"
            inputMode="search"
            placeholder="CBA JOV 0001"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
          />
          {/* El nombre de quien la tiene, y no un selector de Misioneros: una
              Diócesis tiene cientos, y quien pregunta ya tiene el apellido en la
              cabeza. Las dos cajas se envían con el mismo botón, porque son la
              misma pregunta hecha por dos datos que suelen venir juntos: alguien
              trae una imagen y sabe de quién era. */}
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

      <div className="flex flex-col gap-3 sm:flex-row">
        {conBusqueda && (
          <Boton type="submit" disabled={pendiente}>
            {pendiente ? "Buscando…" : "Buscar"}
          </Boton>
        )}

        {plegable && (
          <Boton
            tono="secundario"
            aria-expanded={abiertos}
            aria-controls={idDeLosFiltros}
            onClick={() => setAbiertos((v) => !v)}
          >
            {abiertos ? "Ocultar filtros" : "Mostrar filtros"}
          </Boton>
        )}

        {hayFiltros(filtros) && (
          <Boton tono="secundario" disabled={pendiente} onClick={limpiar}>
            Limpiar filtros
          </Boton>
        )}
      </div>

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
        className={abiertos ? "grid gap-4 sm:grid-cols-2" : "hidden"}
      >
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

        {territorios && territorios.length > 1 && (
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
      </div>

      {/*
        Which filters are on, in words — story 18. A figure that looks wrong is
        almost always a filter somebody forgot, and the fix is to say so next to
        the numbers rather than expecting them to read six selects back.
      */}
      {activos.length > 0 && (
        <p className="text-base text-tinta" aria-live="polite">
          <span className="font-semibold">Filtros activos:</span>{" "}
          {activos.join(" · ")}
        </p>
      )}
    </form>
  );
}

/** The active filters as the Campaña's own words, for the summary line. */
function describir(
  filtros: FiltrosDeInventario,
  territorios: TerritorioParaFiltrar[],
): string[] {
  const partes: string[] = [];

  if (filtros.codigo) partes.push(`Código «${filtros.codigo}»`);
  if (filtros.misionero) partes.push(`la tiene «${filtros.misionero}»`);
  if (filtros.estado) partes.push(ESTADO_LABELS[filtros.estado]);
  if (filtros.modalidad) partes.push(MODALIDAD_LABELS[filtros.modalidad]);
  if (filtros.tipo) partes.push(TIPO_LABELS[filtros.tipo]);
  if (filtros.tenencia) partes.push(TENENCIA_LABELS[filtros.tenencia]);
  if (filtros.region) partes.push(`Región ${filtros.region}`);
  if (filtros.diocesisLocalidadId) {
    const territorio = territorios.find(
      (t) => t.id === filtros.diocesisLocalidadId,
    );
    partes.push(territorio ? territorio.nombre : "una Diócesis/Localidad");
  }

  return partes;
}
