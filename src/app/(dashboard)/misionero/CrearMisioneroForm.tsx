"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createMisioneroAction } from "@/modules/misionero/misionero.router";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import { asignarAction } from "@/modules/asignacion/asignacion.router";
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
import type {
  Modalidad,
  PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";
import {
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
} from "@/modules/peregrina/peregrina.types";
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
 * **La imagen que ya se llevó.** Casi nadie carga a un Misionero en abstracto: lo
 * carga porque le entregó una Peregrina, y hasta ahora eso eran dos pantallas —
 * ésta, y después el flujo de Asignación, donde había que volver a buscar por
 * apellido a la persona recién tipeada. El último fieldset lo hace acá, con tres
 * respuestas: ninguna por ahora, una imagen ya registrada, o una nueva. La tercera
 * es el alta de Peregrinas —Tipo y Modalidad, sin Código, porque el Código se
 * genera— y usa el mismo territorio que se eligió para la persona, que es el caso
 * real: la imagen se registra donde vive quien la tiene.
 *
 * Las tres operaciones siguen siendo tres llamadas y en ese orden — crear la
 * persona, crear la imagen si hace falta, `asignar` — porque la carga de una
 * Peregrina *es* la de una Peregrina y el cambio de tenencia pasa por el único
 * lugar donde puede pasar, `AsignacionService.asignar`. No hay transacción que las
 * abarque, así que la falla parcial se dice en voz alta en lugar de deshacerse: si
 * la persona quedó cargada y la entrega no, el mensaje lo nombra y el formulario
 * no navega, porque perder de vista que la persona ya existe es cómo alguien la
 * carga dos veces.
 *
 * El picker ofrece sólo las libres. Una imagen que está en otra casa no se entrega
 * desde acá: eso cierra el período de otra persona, es `entregar`, y el flujo de
 * Asignación tiene una pantalla que dice quién la tiene antes de pedir que se
 * confirme.
 *
 * `enListado` es este mismo formulario arriba de la tabla de `/misionero`, y ahí
 * hay un botón en lugar de dos: guardar *es* «guardar y agregar otro», más un
 * `router.refresh()` que vuelve a leer la tabla del servidor, así que la fila
 * recién cargada aparece abajo sin que nadie la busque. Es la misma decisión que
 * el alta de Peregrinas, por la misma razón: estos registros se tipean de a lotes
 * y la confirmación que se quiere es ver aparecer la fila. `/misionero/new` sigue
 * existiendo porque el flujo de Asignación manda ahí cuando la persona no estáf
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

/** Qué se hace con la imagen al cargar a la persona. */
type Entrega = "ninguna" | "existente" | "nueva";

const ENTREGAS: { valor: Entrega; etiqueta: string }[] = [
  { valor: "ninguna", etiqueta: "Ninguna por ahora" },
  { valor: "existente", etiqueta: "Una imagen ya registrada" },
  { valor: "nueva", etiqueta: "Una imagen nueva, que registro ahora" },
];

// Desde el enum a través de la tabla de etiquetas, nunca a mano: son dieciséis
// Modalidades, y una segunda copia de la lista es un segundo lugar donde falta una.
const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

export default function CrearMisioneroForm({
  enListado = false,
  disponibles = [],
}: {
  /** Arriba de la tabla de `/misionero`: un botón, y refresca el listado. */
  enListado?: boolean;
  /**
   * Las imágenes que nadie tiene, para el picker del último fieldset. Vienen del
   * servidor y no de un efecto: la pantalla ya es una lectura, y una lista que
   * aparece medio segundo tarde es una lista que alguien no ve.
   */
  disponibles?: PeregrinaDTO[];
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

  const [entrega, setEntrega] = useState<Entrega>("ninguna");
  const [peregrinaId, setPeregrinaId] = useState("");
  const [tipo, setTipo] = useState<PeregrinaTipo>("peregrina");
  const [modalidad, setModalidad] = useState<Modalidad>("JOV");

  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  /** El Código de la imagen que quedó a su cargo, cuando quedó alguna. */
  const [codigoEntregado, setCodigoEntregado] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  // Story 15: each field is checked as it is left, against the same schema the
  // router parses — so the message somebody sees while their eyes are still on the
  // field is the message the server would have given them after eight of them.
  const validacion = useValidacionAlSalir(createMisioneroSchema);

  /**
   * La imagen, después de que la persona ya existe.
   *
   * Devuelve el Código cuando quedó entregada, o el mensaje de la negativa. La
   * persona ya está cargada cuando esto corre: nada de lo que pase acá la borra,
   * y por eso el error que devuelve se cuenta como «quedó a medias» y no como
   * «falló el alta».
   */
  async function entregarImagen(
    misioneroId: string,
  ): Promise<{ codigo: string } | { error: string }> {
    let id = peregrinaId;
    let codigo = disponibles.find((p) => p.id === peregrinaId)?.codigo ?? "";

    if (entrega === "nueva") {
      // El territorio de la imagen es el de la persona que se la lleva: es donde
      // vive, y es la única respuesta que este formulario tiene.
      const creada = await createPeregrinaAction({
        tipo,
        modalidad,
        diocesisLocalidadId,
      });
      if (!creada.ok) return { error: creada.error };
      id = creada.data.id;
      codigo = creada.data.codigo;
    }

    const asignada = await asignarAction({
      peregrinaId: id,
      misioneroId,
      nota: null,
    });
    if (!asignada.ok) return { error: asignada.error };

    return { codigo };
  }

  function guardar(seguirCargando: boolean) {
    setError(null);
    setGuardado(null);
    setCodigoEntregado(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    if (entrega === "existente" && !peregrinaId) {
      setError("Elegí la imagen peregrina asignada, o poné «Ninguna por ahora».");
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

      const persona = `${resultado.data.nombre} ${resultado.data.apellido}`;

      let entregado: string | null = null;
      if (entrega !== "ninguna") {
        const imagen = await entregarImagen(resultado.data.id);

        if ("error" in imagen) {
          // La persona quedó cargada y la imagen no. Decirlo y quedarse acá: si
          // esto navegara a la ficha, el siguiente intento sería cargarla de nuevo.
          setError(
            `${persona} quedó cargado, pero la imagen no quedó a su cargo: ${imagen.error} Podés entregársela desde «Entregar una imagen».`,
          );
          if (enListado) router.refresh();
          return;
        }

        entregado = imagen.codigo;
      }

      if (!seguirCargando) {
        router.push(`/misionero/${resultado.data.id}`);
        return;
      }

      // Keep the territory — the next person is almost always from the same
      // Diócesis — and clear everything that belongs to this one. The centro
      // stays too: a batch is usually one parish.
      setGuardado(persona);
      setCodigoEntregado(entregado);
      // The messages belonged to the person just saved; the next one starts clean.
      validacion.limpiar();
      setNombre("");
      setApellido("");
      setTelefono("");
      setAnioConsagracion("");
      // La imagen es de esta persona y no del lote: la siguiente arranca sin
      // ninguna, para que nadie entregue dos veces la misma por inercia.
      setEntrega("ninguna");
      setPeregrinaId("");
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
            <strong>{guardado}</strong> quedó cargado
            {codigoEntregado ? (
              <>
                , con la imagen{" "}
                <strong className="font-mono">{codigoEntregado}</strong> a su
                cargo
              </>
            ) : null}
            . Podés seguir con la siguiente persona.
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
          Centro y consagración (opcional)
        </legend>

        <p className="text-base leading-relaxed text-tinta-suave">
          El Santuario, Ermita o Parroquia donde pertenece el misionero, y el año
          en que se consagró. Si no lo sabés ahora, dejalo vacío: se puede
          completar después.
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

      <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
        <legend className="px-2 text-base font-bold text-tinta">
          Imagen Peregrina asignada (opcional)
        </legend>

        <p className="text-base leading-relaxed text-tinta-suave">
          Si ya se llevó una Peregrina, se puede dejar registrado acá mismo. Si
          no, dejalo en «Ninguna por ahora»: después se entrega desde «Entregar
          una imagen».
        </p>

        <Eleccion
          etiqueta="¿Se lleva alguna imagen?"
          value={entrega}
          opciones={ENTREGAS}
          onChange={(e) => setEntrega(e.target.value as Entrega)}
        />

        {entrega === "existente" &&
          (disponibles.length === 0 ? (
            <Mensaje tono="aviso">
              <p>
                No hay imágenes libres en tu territorio. Registrá una nueva acá
                arriba, o entregale una que esté en otra casa desde «Entregar
                una imagen», que cierra el período de quien la tiene.
              </p>
            </Mensaje>
          ) : (
            <Eleccion
              etiqueta="Cuál"
              vacia="Elegí la imagen"
              ayuda="Sólo las que no tiene nadie ahora mismo."
              value={peregrinaId}
              opciones={disponibles.map((p) => ({
                valor: p.id,
                etiqueta: `${p.codigo} — ${MODALIDAD_LABELS[p.modalidad]}, ${p.diocesisLocalidad.nombre}`,
              }))}
              onChange={(e) => setPeregrinaId(e.target.value)}
            />
          ))}

        {entrega === "nueva" && (
          <>
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

            <p className="text-base leading-relaxed text-tinta-suave">
              La imagen se registra en la misma Diócesis/Localidad que elegiste
              arriba, y su Código se genera solo. Cuando se guarde, va a estar
              acá para escribirlo en la imagen.
            </p>
          </>
        )}
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
