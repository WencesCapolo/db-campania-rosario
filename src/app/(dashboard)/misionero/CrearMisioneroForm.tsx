"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { createMisioneroAction } from "@/modules/misionero/misionero.router";
import { createMatrimonioAction } from "@/modules/misionero/matrimonio.router";
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
import {
  createMatrimonioSchema,
  type Tenedor,
} from "@/modules/misionero/matrimonio.types";
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
import { nombreDeTenedor } from "@/lib/formato";
import {
  useValidacionAlSalir,
  type ValidacionAlSalir,
} from "@/lib/validacion-al-salir";

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
 *
 * **El matrimonio.** Una Peregrina está muchas veces a cargo de un matrimonio, y
 * hasta ahora eso eran dos personas cargadas por separado con la imagen anotada
 * abajo de la que se tipeó primero (ADR 0010). La primera pregunta del formulario
 * es entonces si es una persona o un matrimonio: si es un matrimonio cada uno
 * tiene su Nombre, su Apellido, su Teléfono y su Año de consagración, y el
 * territorio y el Centro se escriben una sola vez porque son de la casa. El
 * teléfono no lo es: se llama a una persona, y el segundo número es justamente el
 * que se marca cuando la primera no atiende. El primer par **es** el cónyuge A, que es el que
 * ordena la fila en el listado, así que quien tipea decide cómo se archiva el
 * matrimonio; el formulario lo dice con esas palabras.
 *
 * Las dos ramas validan al salir del campo contra el esquema que parsea el router
 * —`createMisioneroSchema` una, `createMatrimonioSchema` la otra— y nunca contra
 * una segunda copia de la regla escrita para el cliente (ADR 0008). Son dos hooks
 * porque son dos esquemas, los dos se llaman siempre, y `validador` elige cuál
 * contesta: el único lugar del archivo donde el nombre del campo deja de ser un
 * literal es esa función.
 *
 * El alta del matrimonio sí es una transacción — dos Misioneros y el matrimonio
 * en un solo `createMatrimonioAction`, porque medio matrimonio no es nada. Lo que
 * sigue siendo tres llamadas es la imagen, igual que antes, y la falla parcial se
 * dice en voz alta nombrando **al matrimonio** y no a uno de los dos.
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

/** Una persona sola, o un matrimonio: la primera pregunta de la pantalla. */
const QUIEN = [
  { valor: "persona", etiqueta: "No, es una persona sola" },
  { valor: "matrimonio", etiqueta: "Sí, es un matrimonio" },
];

/**
 * La validación al salir, con el nombre del campo como texto.
 *
 * El formulario es uno y los esquemas son dos: la rama de la persona valida
 * contra `createMisioneroSchema` y la del matrimonio contra
 * `createMatrimonioSchema`, que llama a las mismas cosas `nombreA`/`nombreB`. Los
 * dos hooks se llaman siempre —son hooks— y `envolver` es el único punto donde el
 * tipo de la clave se afloja a `string`, para que el resto del archivo escriba el
 * nombre del campo una vez en lugar de duplicar cada `Campo` por rama. Un nombre
 * que el esquema no describe valida como válido, que es lo que
 * `useValidacionAlSalir` ya hace, y el router parsea el objeto entero igual.
 */
interface Validador {
  error: (campo: string) => string | undefined;
  alSalir: (campo: string, valor: unknown) => void;
  alEscribir: (campo: string) => void;
  marcar: (campo: string, mensaje: string) => void;
}

function envolver<T>(v: ValidacionAlSalir<T>): Validador {
  type Clave = keyof T & string;
  return {
    error: (campo) => v.error(campo as Clave),
    alSalir: (campo, valor) => v.alSalir(campo as Clave, valor),
    alEscribir: (campo) => v.alEscribir(campo as Clave),
    marcar: (campo, mensaje) => v.marcar(campo as Clave, mensaje),
  };
}

/**
 * Un Nombre y un Apellido, que son un par y se repiten cuando hay dos personas.
 *
 * Componente y no JSX repetido dos veces: los dos pares son el mismo control con
 * otro nombre de campo, y una segunda copia es donde uno de los dos se queda sin
 * `autoComplete` o sin su mensaje de error.
 */
function ParDeNombres({
  idNombre,
  deQuien,
  campoNombre,
  campoApellido,
  nombre,
  apellido,
  onNombre,
  onApellido,
  validador,
}: {
  idNombre?: string;
  /**
   * De cuál de los dos, cuando son dos.
   *
   * Va en la etiqueta y no sólo en la leyenda del fieldset: una leyenda no forma
   * parte del nombre accesible del campo, así que quien navega con lector de
   * pantalla oiría «Nombre» dos veces seguidas y no sabría cuál está tocando.
   */
  deQuien?: string;
  campoNombre: string;
  campoApellido: string;
  nombre: string;
  apellido: string;
  onNombre: (valor: string) => void;
  onApellido: (valor: string) => void;
  validador: Validador;
}) {
  const de = deQuien ? ` (${deQuien})` : "";

  return (
    <>
      <Campo
        id={idNombre}
        etiqueta={`Nombre${de}`}
        required
        autoComplete="given-name"
        value={nombre}
        error={validador.error(campoNombre)}
        onChange={(e) => {
          onNombre(e.target.value);
          validador.alEscribir(campoNombre);
        }}
        onBlur={(e) => validador.alSalir(campoNombre, e.target.value)}
      />

      <Campo
        etiqueta={`Apellido${de}`}
        required
        autoComplete="family-name"
        value={apellido}
        error={validador.error(campoApellido)}
        onChange={(e) => {
          onApellido(e.target.value);
          validador.alEscribir(campoApellido);
        }}
        onBlur={(e) => validador.alSalir(campoApellido, e.target.value)}
      />
    </>
  );
}

/**
 * El teléfono de una de las dos personas de un matrimonio.
 *
 * Dos y no uno de la casa: el número existe para poder ubicar a alguien cuando
 * hay que buscar una imagen, y el segundo es justamente al que se llama cuando el
 * primero no atiende. Ninguno es obligatorio — el teléfono de un Misionero nunca
 * lo fue, y obligar a la primera mitad de un matrimonio a algo que esa misma
 * persona sola no debe sería una regla rara.
 */
function CampoDeTelefono({
  campo,
  deQuien,
  ayuda,
  valor,
  onValor,
  validador,
}: {
  campo: string;
  /** De cuál de los dos, por la misma razón que en `ParDeNombres`. */
  deQuien: string;
  ayuda: string;
  valor: string;
  onValor: (valor: string) => void;
  validador: Validador;
}) {
  return (
    <Campo
      etiqueta={`Teléfono (${deQuien})`}
      ayuda={ayuda}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={valor}
      error={validador.error(campo)}
      onChange={(e) => {
        onValor(e.target.value);
        validador.alEscribir(campo);
      }}
      onBlur={(e) => validador.alSalir(campo, e.target.value)}
    />
  );
}

/**
 * El Año de consagración, que es de cada persona y no de la casa.
 *
 * Dos personas se consagran en dos años distintos, así que en un matrimonio este
 * campo aparece dos veces — y por eso está acá y no escrito dos veces adentro del
 * formulario, con la misma conversión de texto a número en los dos lados.
 */
function CampoDeAnio({
  campo,
  deQuien,
  valor,
  onValor,
  validador,
}: {
  campo: string;
  /** De cuál de los dos, por la misma razón que en `ParDeNombres`. */
  deQuien?: string;
  valor: string;
  onValor: (valor: string) => void;
  validador: Validador;
}) {
  return (
    <Campo
      etiqueta={`Año de consagración${deQuien ? ` (${deQuien})` : ""}`}
      ayuda="Cuatro cifras, por ejemplo 1998."
      type="text"
      inputMode="numeric"
      maxLength={4}
      value={valor}
      error={validador.error(campo)}
      onChange={(e) => {
        onValor(e.target.value);
        validador.alEscribir(campo);
      }}
      onBlur={(e) => {
        // Empty is "not recorded" and is fine. Anything else has to be four
        // digits before the schema's own rules — 1900, not the future — can
        // say anything meaningful about it.
        const texto = e.target.value.trim();
        if (!texto) return;
        if (!esAnioEscrito(texto)) {
          validador.marcar(campo, ANIO_DE_CUATRO_CIFRAS);
          return;
        }
        validador.alSalir(campo, Number(texto));
      }}
    />
  );
}

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

  /** La primera pregunta: una persona sola, o un matrimonio. */
  const [esMatrimonio, setEsMatrimonio] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [nombreB, setNombreB] = useState("");
  const [apellidoB, setApellidoB] = useState("");
  const [anioConsagracionB, setAnioConsagracionB] = useState("");
  /** El de la persona, o el de la primera de las dos: nunca uno de la casa. */
  const [telefono, setTelefono] = useState("");
  const [telefonoB, setTelefonoB] = useState("");
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
  /**
   * Quién quedó cargado, y si eran dos.
   *
   * Los dos datos juntos y no sólo el nombre, porque el mensaje se conjuga: un
   * matrimonio «quedó cargado» suena a que entró uno solo, que es exactamente la
   * confusión que este cambio saca del sistema.
   */
  const [guardado, setGuardado] = useState<{
    nombre: string;
    matrimonio: boolean;
  } | null>(null);
  /** El Código de la imagen que quedó a su cargo, cuando quedó alguna. */
  const [codigoEntregado, setCodigoEntregado] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  // Story 15: each field is checked as it is left, against the same schema the
  // router parses — so the message somebody sees while their eyes are still on the
  // field is the message the server would have given them after eight of them.
  //
  // Dos hooks porque son dos esquemas, y los dos se llaman siempre: cambiar de
  // rama no puede cambiar cuántos hooks corre el componente. `validador` es el que
  // contesta, y es el de la rama que está a la vista.
  const validacionPersona = useValidacionAlSalir(createMisioneroSchema);
  const validacionMatrimonio = useValidacionAlSalir(createMatrimonioSchema);

  const validador = esMatrimonio
    ? envolver(validacionMatrimonio)
    : envolver(validacionPersona);

  // El primer par de nombres es el cónyuge A cuando hay dos, y la persona cuando
  // hay una. Es el mismo control y cambia contra qué campo del esquema valida.
  const campoNombre = esMatrimonio ? "nombreA" : "nombre";
  const campoApellido = esMatrimonio ? "apellidoA" : "apellido";
  const campoTelefono = esMatrimonio ? "telefonoA" : "telefono";
  const campoAnio = esMatrimonio ? "anioConsagracionA" : "anioConsagracion";

  /**
   * La imagen, después de que la persona ya existe.
   *
   * Devuelve el Código cuando quedó entregada, o el mensaje de la negativa. La
   * persona ya está cargada cuando esto corre: nada de lo que pase acá la borra,
   * y por eso el error que devuelve se cuenta como «quedó a medias» y no como
   * «falló el alta».
   */
  async function entregarImagen(
    tenedor: Tenedor,
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

    // Al matrimonio, no a uno de los dos: es un Tenedor y no dos (ADR 0010).
    const asignada = await asignarAction({
      peregrinaId: id,
      tenedor,
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
      setError(
        "Elegí la imagen peregrina asignada, o poné «Ninguna por ahora».",
      );
      return;
    }

    // The year is a string in the input and a number in the service. An empty
    // field is "not recorded" and must reach the service as null, not as NaN —
    // `Number("")` is 0, which would claim a consagración in the year zero.
    const anio = anioConsagracion.trim();
    if (anio && !esAnioEscrito(anio)) {
      validador.marcar(campoAnio, ANIO_DE_CUATRO_CIFRAS);
      return;
    }

    const anioB = anioConsagracionB.trim();
    if (esMatrimonio && anioB && !esAnioEscrito(anioB)) {
      validador.marcar("anioConsagracionB", ANIO_DE_CUATRO_CIFRAS);
      return;
    }

    // Lo que las dos ramas comparten, escrito una vez: el territorio y el Centro
    // son de la casa. El teléfono no — es de cada persona, y en un matrimonio son
    // dos.
    const casa = {
      diocesisLocalidadId,
      centroTipo: centroTipo || null,
      centroNombre: centroNombre.trim() || null,
    };

    empezar(async () => {
      // El alta del matrimonio es una transacción del lado del servidor —los dos
      // Misioneros y el matrimonio, o ninguno— y por eso es una sola llamada.
      const resultado = esMatrimonio
        ? await createMatrimonioAction({
            ...casa,
            nombreA: nombre,
            apellidoA: apellido,
            telefonoA: telefono.trim() || null,
            anioConsagracionA: anio ? Number(anio) : null,
            nombreB,
            apellidoB,
            telefonoB: telefonoB.trim() || null,
            anioConsagracionB: anioB ? Number(anioB) : null,
          })
        : await createMisioneroAction({
            ...casa,
            nombre,
            apellido,
            telefono: telefono.trim() || null,
            anioConsagracion: anio ? Number(anio) : null,
          });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      // Un nombre y un Tenedor, cualquiera haya sido la rama: de acá para abajo la
      // pantalla no vuelve a preguntar de qué clase es.
      const dato = resultado.data;
      const tenedor: Tenedor =
        "misioneroA" in dato
          ? { tipo: "matrimonio", id: dato.id }
          : { tipo: "persona", id: dato.id };
      const persona =
        "misioneroA" in dato
          ? nombreDeTenedor({ tipo: "matrimonio", matrimonio: dato })
          : nombreDeTenedor({ tipo: "persona", persona: dato });
      // Un matrimonio son dos personas y una fila: el mensaje lo conjuga en
      // plural, porque «quedó cargado» sonaría a que entró uno solo.
      const quedoCargado =
        tenedor.tipo === "matrimonio" ? "quedaron cargados" : "quedó cargado";

      let entregado: string | null = null;
      if (entrega !== "ninguna") {
        const imagen = await entregarImagen(tenedor);

        if ("error" in imagen) {
          // La persona quedó cargada y la imagen no. Decirlo y quedarse acá: si
          // esto navegara a la ficha, el siguiente intento sería cargarla de nuevo.
          setError(
            `${persona} ${quedoCargado}, pero la imagen no quedó a su cargo: ${imagen.error} Podés entregársela desde «Entregar una imagen».`,
          );
          if (enListado) router.refresh();
          return;
        }

        entregado = imagen.codigo;
      }

      if (!seguirCargando) {
        // A la ficha del Tenedor, que en un matrimonio es la del matrimonio y no
        // la de uno de los dos.
        router.push(
          tenedor.tipo === "matrimonio"
            ? `/matrimonio/${tenedor.id}`
            : `/misionero/${tenedor.id}`,
        );
        return;
      }

      // Keep the territory — the next person is almost always from the same
      // Diócesis — and clear everything that belongs to this one. The centro
      // stays too: a batch is usually one parish.
      setGuardado({
        nombre: persona,
        matrimonio: tenedor.tipo === "matrimonio",
      });
      setCodigoEntregado(entregado);
      // The messages belonged to the person just saved; the next one starts clean.
      validacionPersona.limpiar();
      validacionMatrimonio.limpiar();
      setNombre("");
      setApellido("");
      setNombreB("");
      setApellidoB("");
      setAnioConsagracionB("");
      setTelefono("");
      setTelefonoB("");
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
            <strong>{guardado.nombre}</strong>{" "}
            {guardado.matrimonio ? "quedaron cargados" : "quedó cargado"}
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

      {/* La primera pregunta de la pantalla, porque cambia el resto del
          formulario y nadie quiere descubrirla después de tipear el apellido. */}
      <Eleccion
        etiqueta="¿Es un matrimonio?"
        ayuda="Un matrimonio tiene una sola imagen a cargo entre los dos, y aparece como una sola fila en la lista."
        value={esMatrimonio ? "matrimonio" : "persona"}
        opciones={QUIEN}
        onChange={(e) => setEsMatrimonio(e.target.value === "matrimonio")}
      />

      {esMatrimonio ? (
        <>
          <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
            <legend className="px-2 text-base font-bold text-tinta">
              La primera persona
            </legend>

            <p className="text-base leading-relaxed text-tinta-suave">
              El matrimonio se ordena en la lista por este apellido y este
              nombre, así que poné primero a quien lo quieras buscar. Buscar por
              el apellido del otro también lo encuentra.
            </p>

            <ParDeNombres
              idNombre={ID_NOMBRE}
              deQuien="la primera persona"
              campoNombre={campoNombre}
              campoApellido={campoApellido}
              nombre={nombre}
              apellido={apellido}
              onNombre={setNombre}
              onApellido={setApellido}
              validador={validador}
            />

            {/* El teléfono es de cada uno y no de la casa: se llama a una
                persona, y el segundo número es el que se marca cuando la
                primera no atiende. */}
            <CampoDeTelefono
              campo={campoTelefono}
              deQuien="la primera persona"
              ayuda="Opcional. Sirve para poder ubicarlos cuando haya que buscar una imagen."
              valor={telefono}
              onValor={setTelefono}
              validador={validador}
            />

            {/* El año es de cada uno: dos personas se consagran en dos años
                distintos, y una sola casilla no podría guardar los dos. */}
            <CampoDeAnio
              campo={campoAnio}
              deQuien="la primera persona"
              valor={anioConsagracion}
              onValor={setAnioConsagracion}
              validador={validador}
            />
          </fieldset>

          <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
            <legend className="px-2 text-base font-bold text-tinta">
              La segunda persona
            </legend>

            <ParDeNombres
              deQuien="la segunda persona"
              campoNombre="nombreB"
              campoApellido="apellidoB"
              nombre={nombreB}
              apellido={apellidoB}
              onNombre={setNombreB}
              onApellido={setApellidoB}
              validador={validador}
            />

            <CampoDeTelefono
              campo="telefonoB"
              deQuien="la segunda persona"
              ayuda="Opcional, y conviene ponerlo: es a quién llamar cuando la primera persona no atiende."
              valor={telefonoB}
              onValor={setTelefonoB}
              validador={validador}
            />

            <CampoDeAnio
              campo="anioConsagracionB"
              deQuien="la segunda persona"
              valor={anioConsagracionB}
              onValor={setAnioConsagracionB}
              validador={validador}
            />
          </fieldset>
        </>
      ) : (
        <>
          <ParDeNombres
            idNombre={ID_NOMBRE}
            campoNombre={campoNombre}
            campoApellido={campoApellido}
            nombre={nombre}
            apellido={apellido}
            onNombre={setNombre}
            onApellido={setApellido}
            validador={validador}
          />

          <Campo
            etiqueta="Teléfono"
            ayuda="Opcional. Sirve para poder ubicarla cuando haya que buscar una imagen."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telefono}
            error={validador.error("telefono")}
            onChange={(e) => {
              setTelefono(e.target.value);
              validador.alEscribir("telefono");
            }}
            onBlur={(e) => validador.alSalir("telefono", e.target.value)}
          />
        </>
      )}

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
        <legend className="px-2 text-base font-bold text-tinta">
          {esMatrimonio
            ? "Centro (opcional)"
            : "Centro y consagración (opcional)"}
        </legend>

        <p className="text-base leading-relaxed text-tinta-suave">
          {esMatrimonio
            ? "El Santuario, Ermita o Parroquia donde pertenece el matrimonio, uno solo para los dos. Si no lo sabés ahora, dejalo vacío: se puede completar después."
            : "El Santuario, Ermita o Parroquia donde pertenece el misionero, y el año en que se consagró. Si no lo sabés ahora, dejalo vacío: se puede completar después."}
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
          error={validador.error("centroNombre")}
          onChange={(e) => {
            setCentroNombre(e.target.value);
            validador.alEscribir("centroNombre");
          }}
          onBlur={(e) => validador.alSalir("centroNombre", e.target.value)}
        />

        {/* En un matrimonio el año subió arriba, al lado de cada persona: son
            dos, y acá abajo no habría manera de decir de cuál es. */}
        {!esMatrimonio && (
          <CampoDeAnio
            campo={campoAnio}
            valor={anioConsagracion}
            onValor={setAnioConsagracion}
            validador={validador}
          />
        )}
      </fieldset>

      <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
        <legend className="px-2 text-base font-bold text-tinta">
          Imagen Peregrina asignada (opcional)
        </legend>

        <p className="text-base leading-relaxed text-tinta-suave">
          {esMatrimonio
            ? "Si ya se llevaron una Peregrina, se puede dejar registrado acá mismo, y queda a cargo del matrimonio y no de uno de los dos. Si no, dejalo en «Ninguna por ahora»: después se entrega desde «Entregar una imagen»."
            : "Si ya se llevó una Peregrina, se puede dejar registrado acá mismo. Si no, dejalo en «Ninguna por ahora»: después se entrega desde «Entregar una imagen»."}
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
              ? esMatrimonio
                ? "Cargar el matrimonio"
                : "Cargar la persona"
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
