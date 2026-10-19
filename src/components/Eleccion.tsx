"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalizar } from "@/lib/busqueda-en-pantalla";

/**
 * Elección — un desplegable propio, con su etiqueta (ADR 0015).
 *
 * Antes era un `<select>` nativo, a propósito: en el teléfono abre el selector
 * del sistema. Cerrado, en cambio, era el único control de la pantalla que no
 * parecía de la app. Ahora es un botón con `role="combobox"` que abre una lista
 * debajo, según el patrón «select-only combobox» del APG. El foco no sale nunca
 * del botón, y la opción en la que se está la nombra `aria-activedescendant`.
 *
 * Cerrado tiene el mismo borde y la misma altura que un `Campo`, para que el
 * formulario sea parejo. Abierta, la lista es liviana: borde suave, sombra y
 * filas de 48 px, el mínimo. La opción elegida va en azul con ✓, y no en un
 * relleno entero; la que se recorre con el teclado se pinta de `lienzo`.
 *
 * Lo que el navegador daba gratis ahora es nuestro, y está acá: ↑ ↓ Inicio Fin,
 * Enter y Espacio, Escape, Tab, y escribir letras para saltar a la opción que
 * empieza así. Las pruebas del proyecto `navegador` sostienen lo demás.
 *
 * Las opciones llegan como datos y no como hijos, para que nadie pueda armar la
 * lista con la fuente equivocada. Hay una lista en particular donde eso importa:
 * el Estado de una Peregrina se arma con `ESTADOS_SELECCIONABLES` y nunca con
 * `peregrinaEstadoEnum.enumValues`, que volvería a ofrecer el `inactiva` heredado.
 */

export interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  etiqueta: string;
  opciones: Opcion[];
  value: string;
  alElegir: (valor: string) => void;
  /** Va primera, con valor vacío. Es para «Todas», no para una opción real. */
  vacia?: string;
  ayuda?: string;
  error?: string | null;
  /**
   * Lo que se sigue de lo elegido. Se muestra debajo del control y se anuncia
   * como parte de su descripción.
   *
   * `ayuda` no puede hacer este trabajo: es lo que hay que saber *antes* de
   * elegir, y va arriba del control. Lo que se deriva es un resultado, va
   * después, y igual hay que anunciarlo. El selector de territorio muestra la
   * Provincia y la Región que siguen de una Diócesis: quien ve las lee sin que se
   * lo pidan, y quien usa un lector de pantalla nunca llegaría a ellas.
   */
  derivado?: React.ReactNode;
  /** Con `name`, el valor viaja en un `<input type="hidden">` del formulario. */
  name?: string;
  disabled?: boolean;
}

export default function Eleccion({
  etiqueta,
  opciones,
  value,
  alElegir,
  vacia,
  ayuda,
  error,
  derivado,
  name,
  disabled,
}: Props) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const idDerivado = `${id}-derivado`;

  const todas: Opcion[] =
    vacia !== undefined ? [{ valor: "", etiqueta: vacia }, ...opciones] : opciones;
  const elegida = opciones.find((o) => o.valor === value);

  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const tipeado = useRef({ texto: "", hasta: 0 });

  // La opción activa a la vista: con el teclado, una lista de 25 Diócesis se
  // recorre hasta abajo, y la fila tiene que seguir al foco.
  useEffect(() => {
    if (!abierta) return;
    lista.current
      ?.querySelector(`[data-indice="${activa}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierta, activa]);

  // En el teléfono la lista se abre cerca del borde de abajo. Se trae a la vista
  // una vez, al abrir.
  useEffect(() => {
    if (abierta) lista.current?.scrollIntoView({ block: "nearest" });
  }, [abierta]);

  function abrir() {
    setActiva(Math.max(0, todas.findIndex((o) => o.valor === value)));
    setAbierta(true);
  }

  function elegir(indice: number) {
    const opcion = todas[indice];
    if (opcion) alElegir(opcion.valor);
    setAbierta(false);
    boton.current?.focus();
  }

  /** Escribir «ro» salta a «Rosario». Las letras se juntan durante medio segundo. */
  function saltarA(letra: string) {
    const ahora = Date.now();
    const t = tipeado.current;
    t.texto = ahora < t.hasta ? t.texto + letra : letra;
    t.hasta = ahora + 600;
    const indice = todas.findIndex((o) =>
      normalizar(o.etiqueta).startsWith(normalizar(t.texto)),
    );
    if (indice < 0) return;
    setActiva(indice);
    setAbierta(true);
  }

  function teclas(e: React.KeyboardEvent) {
    const ultima = todas.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
        e.preventDefault();
        if (!abierta) return abrir();
        setActiva((i) =>
          e.key === "ArrowDown"
            ? Math.min(ultima, i + 1)
            : e.key === "ArrowUp"
              ? Math.max(0, i - 1)
              : e.key === "Home"
                ? 0
                : ultima,
        );
        return;
      case "Enter":
      case " ":
        // Cerrada, el botón hace lo de siempre y el clic la abre.
        if (!abierta) return;
        e.preventDefault();
        return elegir(activa);
      case "Escape":
        if (!abierta) return;
        e.preventDefault();
        setAbierta(false);
        return;
      case "Tab":
        setAbierta(false);
        return;
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
          saltarA(e.key);
        }
    }
  }

  const descrito = [
    ayuda ? idAyuda : null,
    error ? idError : null,
    derivado ? idDerivado : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-base font-semibold text-tinta">
        {etiqueta}
      </label>

      {ayuda && (
        <p id={idAyuda} className="text-base text-tinta-suave">
          {ayuda}
        </p>
      )}

      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setAbierta(false);
        }}
      >
        <button
          ref={boton}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={abierta}
          aria-controls={idLista}
          aria-activedescendant={abierta ? `${id}-op-${activa}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito || undefined}
          disabled={disabled}
          onClick={() => (abierta ? setAbierta(false) : abrir())}
          onKeyDown={teclas}
          className={
            "flex min-h-12 w-full items-center justify-between gap-2 rounded-control border-2 bg-papel px-3 py-2 text-left text-base text-tinta " +
            "hover:border-azul aria-expanded:border-azul aria-expanded:ring-3 aria-expanded:ring-celeste/50 " +
            "disabled:cursor-not-allowed disabled:opacity-60 " +
            (error ? "border-peligro" : "border-borde-fuerte")
          }
        >
          <span className={"min-w-0 truncate " + (elegida ? "" : "text-tinta-suave")}>
            {elegida?.etiqueta ?? vacia ?? "Elegí una opción"}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className={
              "size-4 flex-none text-azul transition-transform motion-reduce:transition-none " +
              (abierta ? "rotate-180" : "")
            }
          >
            <path d="M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4z" />
          </svg>
        </button>

        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          // El clic no tiene que sacarle el foco al botón: si lo hiciera, el
          // `blur` cerraría la lista antes de que el clic eligiera.
          onMouseDown={(e) => e.preventDefault()}
          className={
            abierta
              ? "absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-control border border-borde-suave bg-papel p-1 shadow-lg"
              : "hidden"
          }
        >
          {todas.map((o, i) => {
            const esLaElegida = o.valor === value;
            return (
              <li
                key={o.valor}
                id={`${id}-op-${i}`}
                data-indice={i}
                role="option"
                aria-selected={esLaElegida}
                onClick={() => elegir(i)}
                onMouseMove={() => setActiva(i)}
                className={
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 text-base " +
                  (i === activa ? "bg-lienzo " : "") +
                  (esLaElegida
                    ? "font-bold text-azul"
                    : o.valor === ""
                      ? "text-tinta-suave"
                      : "text-tinta")
                }
              >
                <span className="min-w-0 flex-1">{o.etiqueta}</span>
                <span aria-hidden className="w-4 flex-none text-right">
                  {esLaElegida ? "✓" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {name && <input type="hidden" name={name} value={value} />}

      {derivado && <div id={idDerivado}>{derivado}</div>}

      {error && (
        <p
          id={idError}
          role="alert"
          className="flex items-start gap-2 text-base font-semibold text-peligro"
        >
          <span aria-hidden>✕</span>
          {error}
        </p>
      )}
    </div>
  );
}
