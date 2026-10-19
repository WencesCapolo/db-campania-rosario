"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { coincide, normalizar } from "@/lib/busqueda-en-pantalla";

/**
 * Buscador — un solo campo para buscar en una lista larga y elegir (ADR 0015).
 *
 * Antes eran dos controles: un campo «Buscar por nombre» que achicaba un
 * `<select>` que estaba debajo. Se escribía en uno y se elegía en otro. Ahora se
 * escribe en el campo y la lista se abre debajo y se achica letra por letra.
 * Es el patrón «combobox con lista» del APG: el foco se queda en el campo, y la
 * opción en la que se está la nombra `aria-activedescendant`.
 *
 * Es para las listas de cientos: las Peregrinas de una Diócesis y quienes pueden
 * tener una. Para cuatro opciones está `Eleccion`.
 *
 * Tres cosas que la versión de dos controles ya hacía, y siguen acá:
 *  - **Con una sola coincidencia, queda elegida.** Un toque menos.
 *  - **Cuando nada coincide, lo dice** debajo del campo, y no con una lista vacía.
 *  - **El filtro es `coincide`**, el mismo de todas las listas en pantalla: sin
 *    tildes, y cada palabra en cualquier orden.
 *
 * Lo elegido queda escrito en el campo y confirmado en un recuadro debajo, con
 * su detalle. Si alguien escribe encima, deja de estar elegido: lo que dice el
 * campo y lo que se va a mandar no pueden ser dos cosas distintas.
 */

export interface OpcionDeBuscador {
  valor: string;
  /** Lo que se escribe en el campo al elegirla: un nombre, una Identificación. */
  etiqueta: string;
  /** La segunda línea: quién la tiene, de qué territorio es. Se busca también. */
  detalle?: string;
  /** Una `Insignia`, a la derecha. No se busca. */
  insignia?: React.ReactNode;
}

interface Props {
  etiqueta: string;
  opciones: OpcionDeBuscador[];
  value: string;
  alElegir: (valor: string) => void;
  ayuda?: string;
  placeholder?: string;
  /** Lo que se dice cuando nada coincide, con lo que se escribió. */
  sinCoincidencias: (busqueda: string) => string;
  /** La etiqueta tipográfica de la opción: `font-mono` para una Identificación. */
  mono?: boolean;
}

/** Más filas no se leen; se escribe una letra más. */
const MAXIMO_A_LA_VISTA = 50;

export default function Buscador({
  etiqueta,
  opciones,
  value,
  alElegir,
  ayuda,
  placeholder,
  sinCoincidencias,
  mono = false,
}: Props) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idCuenta = `${id}-cuenta`;

  const elegida = opciones.find((o) => o.valor === value);
  const [texto, setTexto] = useState(elegida?.etiqueta ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const coinciden = busqueda.trim()
    ? opciones.filter((o) =>
        coincide(`${o.etiqueta} ${o.detalle ?? ""}`, busqueda),
      )
    : opciones;
  const aLaVista = coinciden.slice(0, MAXIMO_A_LA_VISTA);

  useEffect(() => {
    if (!abierta) return;
    lista.current
      ?.querySelector(`[data-indice="${activa}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierta, activa]);

  function elegir(opcion: OpcionDeBuscador) {
    alElegir(opcion.valor);
    setTexto(opcion.etiqueta);
    setBusqueda("");
    setAbierta(false);
  }

  function escribir(nuevo: string) {
    setTexto(nuevo);
    setBusqueda(nuevo);
    setActiva(0);
    setAbierta(true);
    const quedan = nuevo.trim()
      ? opciones.filter((o) => coincide(`${o.etiqueta} ${o.detalle ?? ""}`, nuevo))
      : [];
    // Si queda una sola, ya está elegida: un toque menos. Si no, lo que había
    // elegido deja de estarlo, porque el campo ya no dice su nombre.
    alElegir(quedan.length === 1 && quedan[0] ? quedan[0].valor : "");
  }

  function borrar() {
    setTexto("");
    setBusqueda("");
    alElegir("");
    setAbierta(true);
    campo.current?.focus();
  }

  function teclas(e: React.KeyboardEvent) {
    const ultima = aLaVista.length - 1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierta) {
        setAbierta(true);
        return;
      }
      setActiva((i) =>
        e.key === "ArrowDown" ? Math.min(ultima, i + 1) : Math.max(0, i - 1),
      );
    } else if (e.key === "Enter" && abierta) {
      const opcion = aLaVista[activa];
      if (!opcion) return;
      e.preventDefault();
      elegir(opcion);
    } else if (e.key === "Escape") {
      if (abierta) {
        e.preventDefault();
        setAbierta(false);
      } else if (texto) {
        e.preventDefault();
        borrar();
      }
    }
  }

  const cuenta = busqueda.trim()
    ? coinciden.length === 1
      ? `Queda 1 de ${opciones.length}.`
      : `Quedan ${coinciden.length} de ${opciones.length}.`
    : null;
  const nadie = busqueda.trim() !== "" && coinciden.length === 0;

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
          ref={campo}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierta}
          aria-controls={idLista}
          aria-activedescendant={
            abierta && aLaVista[activa] ? `${id}-op-${activa}` : undefined
          }
          aria-describedby={[ayuda ? idAyuda : null, idCuenta].filter(Boolean).join(" ")}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          onClick={() => setAbierta(true)}
          onFocus={(e) => {
            // Con algo elegido, tocar el campo es querer cambiarlo: lo escrito
            // queda seleccionado y la primera letra lo reemplaza.
            if (value) e.currentTarget.select();
          }}
          onKeyDown={teclas}
          className={
            "min-h-12 w-full rounded-control border-2 border-borde-fuerte bg-papel pr-12 pl-10 text-base text-tinta " +
            "aria-expanded:border-azul aria-expanded:ring-3 aria-expanded:ring-celeste/50 " +
            (mono && value ? "font-mono" : "")
          }
        />

        {texto && (
          <button
            type="button"
            onClick={borrar}
            // Con el teclado se borra con Escape; el ✕ es para el dedo, y fuera
            // del orden de Tab deja que Tab vaya del campo a lo que sigue.
            tabIndex={-1}
            aria-label="Borrar lo escrito"
            className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-lg text-tinta hover:bg-lienzo"
          >
            <span aria-hidden>✕</span>
          </button>
        )}

        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          aria-label={etiqueta}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          className={
            abierta && aLaVista.length > 0
              ? "absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-auto rounded-control border border-borde-suave bg-papel p-1 shadow-lg"
              : "hidden"
          }
        >
          {aLaVista.map((o, i) => {
            const esLaElegida = o.valor === value;
            return (
              <li
                key={o.valor}
                id={`${id}-op-${i}`}
                data-indice={i}
                role="option"
                aria-selected={esLaElegida}
                onClick={() => elegir(o)}
                onMouseMove={() => setActiva(i)}
                className={
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 " +
                  (i === activa ? "bg-lienzo" : "")
                }
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block font-semibold " +
                      (esLaElegida ? "text-azul " : "text-tinta ") +
                      (mono ? "font-mono" : "")
                    }
                  >
                    <Resaltado texto={o.etiqueta} busqueda={busqueda} />
                  </span>
                  {o.detalle && (
                    <>
                      {/* Sin esto, el nombre accesible pega las dos líneas:
                          «CBA JOV 0001Sin entregar». */}
                      <span className="sr-only">, </span>
                      <span className="block text-base text-tinta-suave">
                        <Resaltado texto={o.detalle} busqueda={busqueda} />
                      </span>
                    </>
                  )}
                </span>
                {o.insignia}
                <span aria-hidden className="w-4 flex-none text-right font-bold text-azul">
                  {esLaElegida ? "✓" : ""}
                </span>
              </li>
            );
          })}
          {coinciden.length > MAXIMO_A_LA_VISTA && (
            <li role="presentation" className="px-3 py-2 text-base text-tinta-suave">
              Y {coinciden.length - MAXIMO_A_LA_VISTA} más. Escribí algo más
              para achicar la lista.
            </li>
          )}
        </ul>
      </div>

      <p id={idCuenta} aria-live="polite" className="text-base text-tinta-suave">
        {cuenta}
      </p>

      {nadie && (
        <p className="flex items-start gap-2 rounded-control border-2 border-aviso-tinta bg-aviso-fondo p-3 text-base text-aviso-tinta">
          <span aria-hidden>!</span>
          {sinCoincidencias(busqueda.trim())}
        </p>
      )}

      {elegida && (
        <div className="flex items-center gap-3 rounded-control border-2 border-azul bg-lienzo px-3 py-2">
          <span aria-hidden className="text-lg font-bold text-azul">
            ✓
          </span>
          <span className="min-w-0 flex-1">
            <span className={"block font-semibold text-tinta " + (mono ? "font-mono" : "")}>
              {elegida.etiqueta}
            </span>
            {elegida.detalle && (
              <span className="block text-base text-tinta-suave">{elegida.detalle}</span>
            )}
          </span>
          {elegida.insignia}
        </div>
      )}
    </div>
  );
}

/**
 * Cada palabra de lo escrito, marcada donde aparece. Sólo si quitar las tildes no
 * cambió el largo del texto: así una posición en el texto normalizado es la misma
 * en el original, que es lo que se pinta.
 */
function Resaltado({ texto, busqueda }: { texto: string; busqueda: string }) {
  const donde = normalizar(texto);
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0 || donde.length !== texto.length) return <>{texto}</>;

  const marcado = new Array<boolean>(texto.length).fill(false);
  for (const palabra of palabras) {
    const desde = donde.indexOf(palabra);
    if (desde >= 0) marcado.fill(true, desde, desde + palabra.length);
  }

  const tramos: { texto: string; marcado: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.marcado === marcado[i]) ultimo.texto += texto[i];
    else tramos.push({ texto: texto[i] ?? "", marcado: marcado[i] ?? false });
  }

  return (
    <>
      {tramos.map((t, i) =>
        t.marcado ? (
          <mark key={i} className="rounded-sm bg-aviso-fondo text-inherit">
            {t.texto}
          </mark>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        ),
      )}
    </>
  );
}
