"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLAVE_DE_PAGINA } from "./paginacion";

/**
 * Una búsqueda de lista que se aplica mientras se escribe, sin botón (ADR 0015).
 *
 * La búsqueda sigue viviendo en la dirección (ADR 0007): volver de una ficha la
 * conserva, y un link pegado en un mensaje la trae. Lo que cambia es cuándo se
 * escribe ahí: cuando alguien deja de tipear por `PAUSA_DE_BUSQUEDA_MS`, o enseguida
 * con Enter. Ir al servidor con cada letra serían ocho pedidos para «Martínez», y
 * las respuestas pueden llegar desordenadas.
 *
 * Se escribe con `replace` y no con `push`, así «Atrás» no deshace la búsqueda
 * letra por letra. Y vuelve a la página 1, porque una búsqueda más angosta tiene
 * menos páginas (ADR 0008).
 *
 * La dirección se lee en el momento de escribirla y no al renderizar. Una
 * pantalla con dos búsquedas —el inventario: Código y quién la tiene— tiene dos
 * instancias, y cada una tiene que dejar intacta la clave de la otra.
 */

export const PAUSA_DE_BUSQUEDA_MS = 350;

export function useBusquedaEnVivo({
  clave,
  enLaDireccion,
  destino,
}: {
  /** El parámetro de la dirección: `q`, `identificacion`, `buscar`. */
  clave: string;
  /** Lo que la dirección dice ahora, ya leído por la página. */
  enLaDireccion: string;
  /** La ruta de la lista: `/misionero`, `/peregrina`. */
  destino: string;
}) {
  const router = useRouter();
  const [navegando, empezar] = useTransition();
  const [texto, setTexto] = useState(enLaDireccion);
  const [esperando, setEsperando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cuando la dirección cambia por otro lado —«Limpiar filtros», el ✕ de un
  // filtro, Atrás— el campo la sigue. Sin pisar lo que se está tipeando: ni
  // mientras falta la pausa, ni cuando la dirección dice lo mismo que el campo
  // sin los espacios de las puntas.
  const [anterior, setAnterior] = useState(enLaDireccion);
  if (enLaDireccion !== anterior) {
    setAnterior(enLaDireccion);
    if (!esperando && enLaDireccion !== texto.trim()) setTexto(enLaDireccion);
  }

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function aplicar(valor: string) {
    clearTimeout(temporizador.current);
    setEsperando(false);
    const params = new URLSearchParams(window.location.search);
    const limpio = valor.trim();
    if ((params.get(clave) ?? "") === limpio) return;
    if (limpio) params.set(clave, limpio);
    else params.delete(clave);
    params.delete(CLAVE_DE_PAGINA);
    const query = params.toString();
    empezar(() =>
      router.replace(query ? `${destino}?${query}` : destino, { scroll: false }),
    );
  }

  return {
    texto,
    escribir(nuevo: string) {
      setTexto(nuevo);
      setEsperando(true);
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => aplicar(nuevo), PAUSA_DE_BUSQUEDA_MS);
    },
    buscarYa: () => aplicar(texto),
    borrar() {
      setTexto("");
      aplicar("");
    },
    /**
     * Vacía el campo sin ir a ninguna parte, para quien ya navega por su cuenta:
     * «Limpiar filtros» borra esta clave junto con las demás, y una pausa que
     * quedara pendiente volvería a escribir lo que se acaba de borrar.
     */
    vaciar() {
      clearTimeout(temporizador.current);
      setEsperando(false);
      setTexto("");
    },
    // Lo escrito todavía no es lo buscado: o falta la pausa, o el servidor no
    // contestó. Las dos cosas se dicen igual, «Buscando…».
    buscando: esperando || navegando,
  };
}
