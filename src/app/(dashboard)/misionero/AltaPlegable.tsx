"use client";

import { useState, type ReactNode } from "react";

/**
 * «Cargar un Misionero», cerrado hasta que alguien lo pide.
 *
 * La pantalla se abre más para buscar a alguien que para cargarlo, y el alta
 * abierta empujaba la tabla dos pantallas abajo en un teléfono. Así que el
 * encabezado lleva un botón, y el formulario aparece debajo cuando se lo toca.
 *
 * Un botón con `aria-expanded` y no un `<details>`: el disparador vive en el
 * encabezado, al lado del título de la pantalla, y el formulario fuera de él —
 * un `<summary>` tiene que ser el primer hijo de lo que abre. El botón dice lo
 * que hace con palabras, «Cargar un Misionero» o «Cerrar el alta», además de la
 * flecha, y cambia de relleno a borde al abrirse.
 *
 * Cerrar esconde y no desmonta. Quien cierra a mitad de una ficha para mirar la
 * tabla vuelve y la encuentra como la dejó; desmontarla sería tirar lo tipeado
 * por haber tocado un botón que no dice «borrar».
 */
export default function AltaPlegable({
  encabezado,
  bajada,
  children,
}: {
  /** El título de la pantalla, que va a la izquierda del botón. */
  encabezado: ReactNode;
  bajada: string;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <header className="flex flex-col items-center gap-6 border-b-2 border-borde-suave bg-lienzo px-5 pt-8 pb-6 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        {encabezado}

        <button
          type="button"
          aria-expanded={abierta}
          aria-controls="alta-de-misionero"
          onClick={() => setAbierta((a) => !a)}
          className={
            "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-control border-2 px-5 text-base font-semibold " +
            (abierta
              ? "border-azul bg-papel text-azul hover:bg-lienzo"
              : "border-transparent bg-azul text-white hover:bg-azul-noche")
          }
        >
          {abierta ? "Cerrar el alta" : "Cargar un Misionero"}
          <span aria-hidden>{abierta ? "▴" : "▾"}</span>
        </button>
      </header>

      <section
        id="alta-de-misionero"
        hidden={!abierta}
        aria-labelledby="titulo-alta-de-misionero"
        className="px-5 py-6 sm:px-6"
      >
        <h2
          id="titulo-alta-de-misionero"
          className="font-stretch-condensed text-2xl leading-tight font-bold text-azul"
        >
          Cargar un Misionero
        </h2>
        <p className="mt-1 mb-5 text-base leading-relaxed text-tinta-suave">
          {bajada}
        </p>

        {children}
      </section>
    </>
  );
}
