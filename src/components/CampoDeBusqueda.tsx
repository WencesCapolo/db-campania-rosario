"use client";

import { useId } from "react";

/**
 * Campo de búsqueda de una lista — busca mientras se escribe, sin botón (ADR 0015).
 *
 * El estado lo lleva `useBusquedaEnVivo`, que escribe en la dirección; esto es lo
 * que se ve. Una lupa adentro a la izquierda, que dice qué es el campo antes de
 * leer la etiqueta. A la derecha, «Buscando…» mientras lo escrito no es todavía
 * lo buscado, y un ✕ para empezar de nuevo.
 *
 * «Buscando…» es texto y no sólo un círculo que gira: un círculo solo no dice
 * nada a quien no ve la animación, ni a quien la tiene apagada. En el teléfono,
 * donde no entra la palabra, queda el círculo, y la palabra sigue disponible para
 * el lector de pantalla.
 *
 * Enter busca enseguida y Escape borra. No hay `<form>`: no hay nada que enviar.
 */

interface Props {
  etiqueta: string;
  ayuda?: string;
  placeholder?: string;
  texto: string;
  escribir: (texto: string) => void;
  buscarYa: () => void;
  borrar: () => void;
  buscando: boolean;
}

export default function CampoDeBusqueda({
  etiqueta,
  ayuda,
  placeholder,
  texto,
  escribir,
  buscarYa,
  borrar,
  buscando,
}: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="space-y-1" role="search">
      <label htmlFor={id} className="block text-base font-semibold text-tinta">
        {etiqueta}
      </label>

      {ayuda && (
        <p id={idAyuda} className="text-base text-tinta-suave">
          {ayuda}
        </p>
      )}

      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-azul"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4.5 4.5" strokeLinecap="round" />
        </svg>

        <input
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={ayuda ? idAyuda : undefined}
          placeholder={placeholder}
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscarYa();
            } else if (e.key === "Escape" && texto) {
              e.preventDefault();
              borrar();
            }
          }}
          className="min-h-12 w-full rounded-control border-2 border-borde-fuerte bg-papel pr-24 pl-10 sm:pr-40 text-base text-tinta [&::-webkit-search-cancel-button]:appearance-none"
        />

        <span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
          {buscando && (
            <span className="flex items-center gap-2 px-1 text-base font-semibold text-tinta-suave">
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-3 border-neutro-fondo border-t-azul motion-reduce:animate-none"
              />
              <span className="sr-only sm:not-sr-only">Buscando…</span>
            </span>
          )}
          {texto && (
            <button
              type="button"
              onClick={borrar}
              // Con el teclado se borra con Escape; el ✕ es para el dedo, y fuera
              // del orden de Tab deja que Tab vaya del campo a lo que sigue.
              tabIndex={-1}
              aria-label="Borrar la búsqueda"
              className="flex size-11 items-center justify-center rounded-control text-lg text-tinta hover:bg-lienzo"
            >
              <span aria-hidden>✕</span>
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
