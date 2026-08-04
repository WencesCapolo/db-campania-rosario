"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import { CLAVE_DE_PAGINA } from "@/lib/paginacion";

/**
 * Buscar una persona, y ver quién tiene las manos libres.
 *
 * Two controls, because a Misionero has two things worth asking about: their name
 * and whether they are holding an image. Estado, Modalidad and Tipo are absent on
 * purpose — those belong to an image, and a "Misioneros de Modalidad Jóvenes"
 * filter would be inventing a relationship the Campaña does not record.
 *
 * El select de tenencia tiene las dos respuestas y no una. «Sólo los que no tienen
 * ninguna» es capacidad libre — a quién se le puede entregar algo. «Sólo los que
 * tienen alguna» es la pregunta del otro lado, la que aparece cuando falta una
 * imagen o cuando hay que pedir devoluciones, y con una sola opción había que
 * leerla por descarte sobre la columna «¿Tiene imagen?», página por página.
 *
 * Un valor y no dos banderas: son excluyentes, y `sinImagen=1&conImagen=1` es una
 * dirección sin respuesta. «Todos» borra el parámetro en lugar de escribir un
 * tercer valor, así que la dirección de una lista sin filtrar no lo nombra.
 *
 * In the address like every other filter, so the tablero's "Misioneros sin imagen"
 * card can link straight here with the filter already applied, and so coming back
 * from a person's page does not throw the search away.
 *
 * El buscador encuentra a un matrimonio por el apellido de cualquiera de los dos
 * — «Benítez» trae a «Álvarez, Ana y Benítez, Juan» (ADR 0010). Eso va en la
 * ayuda del campo y no en la etiqueta: la etiqueta se lee cada vez que alguien
 * pasa por acá y ya nombra tres cosas, y una cuarta la vuelve un párrafo.
 *
 * Los dos controles quedan a la vista, y ahí se aparta del listado de Peregrinas,
 * que pliega los suyos. Ahí son seis selects que empujan las filas afuera de un
 * teléfono; acá es uno, y un botón «Mostrar filtros» que esconde un solo select
 * agrega un toque para ahorrar un renglón.
 */

const TENENCIA = [
  { valor: "con", etiqueta: "Sólo los que tienen alguna imagen" },
  { valor: "sin", etiqueta: "Sólo los que no tienen ninguna" },
];

export default function FiltrosDeMisionero({
  q,
  tenencia,
}: {
  q: string;
  /** `null` es «Todos», y es lo que se ve cuando la dirección no dice nada. */
  tenencia: "con" | "sin" | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, empezar] = useTransition();
  const [borrador, setBorrador] = useState(q);

  function aplicar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    // Back to the first page: a narrower search has fewer pages, and page four of
    // two comes back empty and reads as "nobody matches".
    params.delete(CLAVE_DE_PAGINA);
    const query = params.toString();
    empezar(() => router.push(query ? `/misionero?${query}` : "/misionero"));
  }

  return (
    <form
      className="space-y-4 rounded-marco border-2 border-borde-suave bg-papel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar({ q: borrador.trim() });
      }}
    >
      <Campo
        etiqueta="Buscar por nombre, apellido o territorio"
        ayuda="En un matrimonio alcanza con el apellido de cualquiera de los dos."
        type="search"
        inputMode="search"
        placeholder="Gómez"
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
      />

      <Eleccion
        etiqueta="¿Tiene alguna imagen?"
        opciones={TENENCIA}
        vacia="Todos"
        value={tenencia ?? ""}
        onChange={(e) => aplicar({ imagen: e.target.value })}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Buscando…" : "Buscar"}
        </Boton>

        {(q || tenencia) && (
          <Boton
            tono="secundario"
            disabled={pendiente}
            onClick={() => {
              setBorrador("");
              aplicar({ q: "", imagen: "" });
            }}
          >
            Limpiar filtros
          </Boton>
        )}
      </div>
    </form>
  );
}
