"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";

/**
 * Buscar una persona, y ver quién tiene las manos libres.
 *
 * Two controls, because a Misionero has two things worth asking about: their name
 * and whether they are holding an image. Estado, Modalidad and Tipo are absent on
 * purpose — those belong to an image, and a "Misioneros de Modalidad Jóvenes"
 * filter would be inventing a relationship the Campaña does not record.
 *
 * In the address like every other filter, so the tablero's "Misioneros sin imagen"
 * card can link straight here with the filter already applied, and so coming back
 * from a person's page does not throw the search away.
 */

const TENENCIA = [{ valor: "1", etiqueta: "Sólo los que no tienen ninguna" }];

export default function FiltrosDeMisionero({
  q,
  sinImagen,
}: {
  q: string;
  sinImagen: boolean;
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
    const query = params.toString();
    empezar(() => router.push(query ? `/misionero?${query}` : "/misionero"));
  }

  return (
    <form
      className="space-y-4 rounded-tarjeta border-2 border-borde bg-papel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar({ q: borrador.trim() });
      }}
    >
      <Campo
        etiqueta="Buscar por nombre, apellido o territorio"
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
        value={sinImagen ? "1" : ""}
        onChange={(e) => aplicar({ sinImagen: e.target.value })}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Buscando…" : "Buscar"}
        </Boton>

        {(q || sinImagen) && (
          <Boton
            tono="secundario"
            disabled={pendiente}
            onClick={() => {
              setBorrador("");
              aplicar({ q: "", sinImagen: "" });
            }}
          >
            Limpiar filtros
          </Boton>
        )}
      </div>
    </form>
  );
}
