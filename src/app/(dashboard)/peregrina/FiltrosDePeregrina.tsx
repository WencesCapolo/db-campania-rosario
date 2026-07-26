"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import {
  ESTADOS_SELECCIONABLES,
  ESTADO_LABELS,
  MODALIDADES,
  MODALIDAD_LABELS,
} from "@/modules/peregrina/peregrina.types";

/**
 * Buscar y filtrar el listado — story 24.
 *
 * The filters live in the URL, not in component state, and that is the whole
 * reason they survive going back to the list from a Peregrina. State would be
 * thrown away by the navigation; a query string is part of where you were. It
 * also makes a filtered list something you can send to somebody.
 *
 * The Estado options are built from `ESTADOS_SELECCIONABLES`, never from
 * `peregrinaEstadoEnum.enumValues`. The enum still contains the legacy
 * `inactiva`, and offering it here would quietly undo the decision issue #3
 * argued at length: records carrying it keep displaying it, nothing new gets it.
 * A record already marked `inactiva` is still reachable — it is in the list, it
 * just is not something you can filter *to*, which is the trade this list makes
 * for not reintroducing the value.
 */

const OPCIONES_DE_MODALIDAD = MODALIDADES.map((m) => ({
  valor: m,
  etiqueta: MODALIDAD_LABELS[m],
}));

const ESTADOS = ESTADOS_SELECCIONABLES.map((e) => ({
  valor: e,
  etiqueta: ESTADO_LABELS[e],
}));

export default function FiltrosDePeregrina({
  codigo,
  estado,
  modalidad,
}: {
  codigo: string;
  estado: string;
  modalidad: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, empezar] = useTransition();

  const [borrador, setBorrador] = useState(codigo);

  function aplicar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    empezar(() => router.push(`/peregrina?${params.toString()}`));
  }

  const hayFiltros = Boolean(codigo || estado || modalidad);

  return (
    <form
      className="space-y-4 rounded-tarjeta border-2 border-borde bg-papel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar({ codigo: borrador.trim() });
      }}
    >
      <Campo
        etiqueta="Buscar por Código"
        type="search"
        inputMode="search"
        placeholder="CBA JOV 0001"
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Eleccion
          etiqueta="Estado"
          opciones={ESTADOS}
          vacia="Todos"
          value={estado}
          onChange={(e) => aplicar({ estado: e.target.value })}
        />
        <Eleccion
          etiqueta="Modalidad"
          opciones={OPCIONES_DE_MODALIDAD}
          vacia="Todas"
          value={modalidad}
          onChange={(e) => aplicar({ modalidad: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Buscando…" : "Buscar"}
        </Boton>

        {hayFiltros && (
          <Boton
            tono="secundario"
            disabled={pendiente}
            onClick={() => {
              setBorrador("");
              aplicar({ codigo: "", estado: "", modalidad: "" });
            }}
          >
            Limpiar
          </Boton>
        )}
      </div>
    </form>
  );
}
