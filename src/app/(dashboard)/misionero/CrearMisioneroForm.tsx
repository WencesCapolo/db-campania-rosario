"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createMisioneroAction } from "@/modules/misionero/misionero.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type { CentroTipo } from "@/modules/misionero/misionero.schema";
import {
  CENTRO_LABELS,
  CENTRO_TIPOS,
  createMisioneroSchema,
} from "@/modules/misionero/misionero.types";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * Cargar un Misionero.
 *
 * This form did not exist. `MisioneroService.create` was written in issue #1,
 * tested, and reachable from nothing — so a Misionero could not be created
 * through the application at all, and the only way to get one in was a SQL
 * insert. Everything downstream of it was therefore unreachable too: with no
 * Misioneros there is nobody to hand an image to, which made the assignment flow
 * a screen whose first picker was always empty.
 *
 * One page rather than the stepped flow the assignment uses, and that is a
 * judgement about which kind of screen this is. A stepped flow earns its extra
 * taps when each step is a *decision* — who, then which image, then confirm. This
 * is transcription: somebody has a name and a phone number in front of them and
 * is typing them in. Paginating that adds three taps and hides the fields
 * somebody wants to check against their sheet of paper before saving.
 *
 * What it does borrow from a stepped flow is the split between what is required
 * and what is not. Four of the seven fields are optional, and a form that mixes
 * them at random reads as seven obligations; they are in their own fieldset,
 * under a legend that says so.
 *
 * "Guardar y agregar otro" keeps the territory and clears the person, because
 * these arrive a parish at a time, and moves focus back to Nombre — otherwise
 * the caret is left on a button halfway down a phone screen and the next name
 * gets typed nowhere.
 *
 * `enListado` es este mismo formulario arriba de la tabla de `/misionero`, y ahí
 * hay un botón en lugar de dos: guardar *es* «guardar y agregar otro», más un
 * `router.refresh()` que vuelve a leer la tabla del servidor, así que la fila
 * recién cargada aparece abajo sin que nadie la busque. Es la misma decisión que
 * el alta de Peregrinas, por la misma razón: estos registros se tipean de a lotes
 * y la confirmación que se quiere es ver aparecer la fila. `/misionero/new` sigue
 * existiendo porque el flujo de Asignación manda ahí cuando la persona no está
 * cargada todavía, y ahí sí navegar a la ficha es lo que sigue.
 */

const CENTROS = CENTRO_TIPOS.map((t) => ({
  valor: t,
  etiqueta: CENTRO_LABELS[t],
}));

/** Named so "Guardar y agregar otro" can put the caret back in it. */
const ID_NOMBRE = "misionero-nombre";

/**
 * The year's *shape*, which is a fact about the text box rather than about the
 * Campaña. One copy, read by the blur check and by the submit guard, because two
 * would eventually word it differently.
 */
const ANIO_DE_CUATRO_CIFRAS =
  "El año de consagración tiene que ser un año de cuatro cifras.";

const esAnioEscrito = (texto: string) => /^\d{4}$/.test(texto);

export default function CrearMisioneroForm({
  enListado = false,
}: {
  /** Arriba de la tabla de `/misionero`: un botón, y refresca el listado. */
  enListado?: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    null,
  );
  const [centroTipo, setCentroTipo] = useState<CentroTipo | "">("");
  const [centroNombre, setCentroNombre] = useState("");
  const [anioConsagracion, setAnioConsagracion] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  // Story 15: each field is checked as it is left, against the same schema the
  // router parses — so the message somebody sees while their eyes are still on the
  // field is the message the server would have given them after eight of them.
  const validacion = useValidacionAlSalir(createMisioneroSchema);

  function guardar(seguirCargando: boolean) {
    setError(null);
    setGuardado(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    // The year is a string in the input and a number in the service. An empty
    // field is "not recorded" and must reach the service as null, not as NaN —
    // `Number("")` is 0, which would claim a consagración in the year zero.
    const anio = anioConsagracion.trim();
    if (anio && !esAnioEscrito(anio)) {
      validacion.marcar("anioConsagracion", ANIO_DE_CUATRO_CIFRAS);
      return;
    }

    empezar(async () => {
      const resultado = await createMisioneroAction({
        nombre,
        apellido,
        telefono: telefono.trim() || null,
        diocesisLocalidadId,
        centroTipo: centroTipo || null,
        centroNombre: centroNombre.trim() || null,
        anioConsagracion: anio ? Number(anio) : null,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (!seguirCargando) {
        router.push(`/misionero/${resultado.data.id}`);
        return;
      }

      // Keep the territory — the next person is almost always from the same
      // Diócesis — and clear everything that belongs to this one. The centro
      // stays too: a batch is usually one parish.
      setGuardado(`${resultado.data.nombre} ${resultado.data.apellido}`);
      // The messages belonged to the person just saved; the next one starts clean.
      validacion.limpiar();
      setNombre("");
      setApellido("");
      setTelefono("");
      setAnioConsagracion("");
      formulario.current
        ?.querySelector<HTMLInputElement>(`#${ID_NOMBRE}`)
        ?.focus();

      // En el listado la confirmación de verdad es la fila: `refresh()` vuelve a
      // leer la tabla del servidor y la persona recién cargada aparece abajo.
      if (enListado) router.refresh();
    });
  }

  return (
    <form
      ref={formulario}
      className="max-w-xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(enListado);
      }}
    >
      {guardado && (
        <Mensaje tono="exito">
          <p>
            <strong>{guardado}</strong> quedó cargado. Podés seguir con la
            siguiente persona.
          </p>
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <Campo
        id={ID_NOMBRE}
        etiqueta="Nombre"
        required
        autoComplete="given-name"
        value={nombre}
        error={validacion.error("nombre")}
        onChange={(e) => {
          setNombre(e.target.value);
          validacion.alEscribir("nombre");
        }}
        onBlur={(e) => validacion.alSalir("nombre", e.target.value)}
      />

      <Campo
        etiqueta="Apellido"
        required
        autoComplete="family-name"
        value={apellido}
        error={validacion.error("apellido")}
        onChange={(e) => {
          setApellido(e.target.value);
          validacion.alEscribir("apellido");
        }}
        onBlur={(e) => validacion.alSalir("apellido", e.target.value)}
      />

      <Campo
        etiqueta="Teléfono"
        ayuda="Opcional. Sirve para poder ubicarla cuando haya que buscar una imagen."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={telefono}
        error={validacion.error("telefono")}
        onChange={(e) => {
          setTelefono(e.target.value);
          validacion.alEscribir("telefono");
        }}
        onBlur={(e) => validacion.alSalir("telefono", e.target.value)}
      />

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
        <legend className="px-2 text-base font-bold text-tinta">
          El centro donde se venera la imagen (opcional)
        </legend>

        <p className="text-base leading-relaxed text-tinta-suave">
          Si no lo sabés ahora, dejalo vacío. Se puede completar después.
        </p>

        <Eleccion
          etiqueta="Tipo de centro"
          vacia="Sin especificar"
          value={centroTipo}
          opciones={CENTROS}
          onChange={(e) => setCentroTipo(e.target.value as CentroTipo | "")}
        />

        <Campo
          etiqueta="Nombre del centro"
          value={centroNombre}
          error={validacion.error("centroNombre")}
          onChange={(e) => {
            setCentroNombre(e.target.value);
            validacion.alEscribir("centroNombre");
          }}
          onBlur={(e) => validacion.alSalir("centroNombre", e.target.value)}
        />

        <Campo
          etiqueta="Año de consagración"
          ayuda="Cuatro cifras, por ejemplo 1998."
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={anioConsagracion}
          error={validacion.error("anioConsagracion")}
          onChange={(e) => {
            setAnioConsagracion(e.target.value);
            validacion.alEscribir("anioConsagracion");
          }}
          onBlur={(e) => {
            // Empty is "not recorded" and is fine. Anything else has to be four
            // digits before the schema's own rules — 1900, not the future — can
            // say anything meaningful about it.
            const texto = e.target.value.trim();
            if (!texto) return;
            if (!esAnioEscrito(texto)) {
              validacion.marcar("anioConsagracion", ANIO_DE_CUATRO_CIFRAS);
              return;
            }
            validacion.alSalir("anioConsagracion", Number(texto));
          }}
        />
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente
            ? "Guardando…"
            : enListado
              ? "Cargar la persona"
              : "Guardar"}
        </Boton>

        {/* Un botón y no dos en el listado: guardar ahí ya es «y agregar otro»,
            porque la fila queda a la vista abajo. */}
        {!enListado && (
          <Boton
            tono="secundario"
            disabled={pendiente}
            onClick={() => guardar(true)}
          >
            Guardar y agregar otro
          </Boton>
        )}
      </div>
    </form>
  );
}
