"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type {
  Modalidad,
  PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import {
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
  createPeregrinaSchema,
  type PeregrinaDTO,
} from "@/modules/peregrina/peregrina.types";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * El alta, en la misma pantalla que el listado.
 *
 * Es el mismo formulario que vivía en `/peregrina/new` — Tipo, Modalidad y una
 * sola elección de territorio, sin Código, porque el Código se genera — con dos
 * cosas distintas, y las dos salen de estar acá:
 *
 *  1. **No navega.** Guarda, muestra el Código para que se pueda escribir en la
 *     imagen, y `router.refresh()` vuelve a leer el listado del servidor: la fila
 *     recién cargada aparece abajo sin que nadie tenga que buscarla. Eso es lo que
 *     hacía el botón "Guardar y agregar otra", así que hay un botón y no dos.
 *  2. **Conserva Tipo, Modalidad y territorio.** Estos registros se cargan de a
 *     lotes, y el siguiente es casi siempre del mismo lote.
 *
 * Son dos instancias en la pantalla, una por rotulación — ADR 0012. La `vieja`
 * agrega arriba de todo la Numeración anterior, que se tipea tal como está en la
 * imagen, y no genera Código; la `nueva` es el alta de siempre. Es un componente
 * y no dos porque el resto del formulario es el mismo, y dos copias de Tipo,
 * Modalidad y territorio son dos lugares donde una se queda atrás.
 *
 * El rol de cada panel sale del tono de `Mensaje` y no se elige acá: el Código es
 * una confirmación y se anuncia como status, la falla interrumpe. Al revés, un
 * lector de pantalla cortaría la frase para dar una buena noticia y se callaría
 * una negativa.
 */

// Desde el enum a través de la tabla de etiquetas, nunca a mano: son dieciséis
// Modalidades, y una segunda copia de la lista es un segundo lugar donde falta una.
const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  // El código de tres letras va al lado del nombre porque es la parte que termina
  // en el Código, y quien compara una imagen con la pantalla lee el código.
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

export type Rotulacion = "nueva" | "vieja";

export default function AltaRapida({ rotulacion }: { rotulacion: Rotulacion }) {
  const router = useRouter();
  const vieja = rotulacion === "vieja";
  const [pendiente, startTransition] = useTransition();

  const [tipo, setTipo] = useState<PeregrinaTipo>("peregrina");
  const [modalidad, setModalidad] = useState<Modalidad>("JOV");
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );

  const [numeracionAnterior, setNumeracionAnterior] = useState("");
  const validacion = useValidacionAlSalir(createPeregrinaSchema);

  const [error, setError] = useState<string | null>(null);
  const [ultimaGuardada, setUltimaGuardada] = useState<PeregrinaDTO | null>(
    null,
  );

  function guardar() {
    setError(null);
    setUltimaGuardada(null);

    if (vieja) {
      validacion.alSalir("numeracionAnterior", numeracionAnterior);
      if (!numeracionAnterior.trim()) return;
    }

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    startTransition(async () => {
      const result = await createPeregrinaAction({
        ...(vieja && { numeracionAnterior }),
        tipo,
        modalidad,
        diocesisLocalidadId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUltimaGuardada(result.data);
      // Lo único que cambia de una imagen vieja a la siguiente del lote.
      setNumeracionAnterior("");
      validacion.limpiar();
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      {ultimaGuardada && (
        <Mensaje tono="exito">
          {ultimaGuardada.codigo ? (
            <p>
              Guardada. Su Código es{" "}
              <strong className="font-mono">{ultimaGuardada.codigo}</strong>.
              Escribilo en la imagen.
            </p>
          ) : (
            <p>
              Guardada con su numeración anterior,{" "}
              <strong className="font-mono">
                {ultimaGuardada.identificacion}
              </strong>
              .
            </p>
          )}
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      {vieja && (
        <Campo
          etiqueta="Numeración anterior"
          ayuda="Escribila tal como está en la imagen. Por ejemplo: «Peregrina 7», «Rosario-12», «15»."
          autoComplete="off"
          value={numeracionAnterior}
          error={validacion.error("numeracionAnterior")}
          onChange={(e) => {
            setNumeracionAnterior(e.target.value);
            validacion.alEscribir("numeracionAnterior");
          }}
          onBlur={(e) =>
            validacion.alSalir("numeracionAnterior", e.target.value)
          }
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Eleccion
          etiqueta="Tipo"
          value={tipo}
          opciones={TIPOS}
          onChange={(e) => setTipo(e.target.value as PeregrinaTipo)}
        />

        <Eleccion
          etiqueta="Modalidad"
          value={modalidad}
          opciones={MODALIDADES_ELEGIBLES}
          onChange={(e) => setModalidad(e.target.value as Modalidad)}
        />
      </div>

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <p className="text-base leading-relaxed text-tinta-suave">
        {vieja
          ? "No se le genera un Código ahora. Cuando se le escriba uno nuevo, se genera desde su ficha."
          : "El Código se genera solo, a partir de la Provincia y la Modalidad. No hace falta escribirlo."}
      </p>

      <Boton type="submit" disabled={pendiente}>
        {pendiente
          ? "Guardando…"
          : vieja
            ? "Registrar con su numeración"
            : "Registrar y generar el Código"}
      </Boton>
    </form>
  );
}
