"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarAction, entregarAction } from "./asignacion.router";
import { createPeregrinaAction } from "@/modules/peregrina/peregrina.router";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import CamposDePeregrinaForm, {
  useCamposDePeregrina,
  type Rotulacion,
} from "@/modules/peregrina/CamposDePeregrina";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import AreaDeTexto from "@/components/AreaDeTexto";
import Mensaje from "@/components/Mensaje";
import Dialogo from "@/components/Dialogo";
import { nombreDeTenedor } from "@/lib/formato";
import { coincide } from "@/lib/busqueda-en-pantalla";
import type { Tenedor } from "@/modules/misionero/matrimonio.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * Entregar una imagen desde la ficha de quien la recibe, en un diálogo.
 *
 * Llegar a «Entregarle una imagen» desde la ficha de alguien y caer en
 * `/asignacion/new` obligaba a buscar de nuevo a la persona de cuya ficha se
 * venía. Acá el Tenedor ya está elegido —es la ficha—, así que de los tres pasos
 * del flujo queda uno: elegir la imagen, y en la misma pantalla lo que va a pasar
 * y las notas. Igual que el flujo, elige entre `asignar` y `entregar` según la
 * imagen esté libre o afuera, y dice de quién se cierra el período antes de
 * cerrarlo.
 *
 * Si la imagen no está registrada, se registra desde acá: «No está en la lista»
 * cambia el diálogo al alta —los mismos `CamposDePeregrina`, con el territorio
 * de quien la recibe ya puesto— y al guardar vuelve con ella elegida. Son dos
 * acciones y no una transacción, como en el alta del Misionero: una imagen
 * registrada y no entregada es un estado válido, y el cambio de tenencia sigue
 * pasando sólo por `AsignacionService`.
 *
 * La ficha es un componente de servidor: le pasa sólo datos, nunca una función.
 */

export default function EntregarImagen({
  tenedor,
  nombre,
  diocesisLocalidadId,
  peregrinas,
  etiqueta = "Entregarle una imagen",
}: {
  tenedor: Tenedor;
  /** Cómo se llama quien la recibe, para la frase de confirmación. */
  nombre: string;
  /** El territorio que trae puesto el alta de una imagen nueva. */
  diocesisLocalidadId: string;
  peregrinas: PeregrinaDTO[];
  etiqueta?: string;
}) {
  const [vez, setVez] = useState(0);

  return (
    <Dialogo
      titulo={`Entregarle una imagen a ${nombre}`}
      cerrarConElFondo={false}
      disparador={(control) => (
        <Boton
          onClick={() => {
            setVez((v) => v + 1);
            control.abrir();
          }}
        >
          {etiqueta}
        </Boton>
      )}
    >
      {(control) => (
        // Se monta de nuevo en cada apertura: arranca vacío, no con lo que
        // quedó a medias la vez anterior.
        <div key={vez} className="mt-4">
          <FormularioDeEntrega
            tenedor={tenedor}
            nombre={nombre}
            diocesisLocalidadId={diocesisLocalidadId}
            peregrinas={peregrinas}
            alEntregar={control.cerrar}
            alCancelar={control.cancelar}
          />
        </div>
      )}
    </Dialogo>
  );
}

const ROTULACIONES = [
  { valor: "nueva", etiqueta: "No, lleva el formato de la Campaña" },
  { valor: "vieja", etiqueta: "Sí, ya tiene una numeración escrita de antes" },
] as const;

export function FormularioDeEntrega({
  tenedor,
  nombre,
  diocesisLocalidadId: territorioDeQuienRecibe,
  peregrinas: deLaFicha,
  alEntregar,
  alCancelar,
}: {
  tenedor: Tenedor;
  nombre: string;
  diocesisLocalidadId: string;
  peregrinas: PeregrinaDTO[];
  alEntregar: () => void;
  alCancelar: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [vista, setVista] = useState<"elegir" | "alta">("elegir");
  const [busqueda, setBusqueda] = useState("");
  const [peregrinaId, setPeregrinaId] = useState("");
  const [nota, setNota] = useState("");
  const [notaCierre, setNotaCierre] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Las registradas desde este diálogo, hasta que la ficha se vuelva a leer.
  const [creadas, setCreadas] = useState<PeregrinaDTO[]>([]);
  const [recienCreada, setRecienCreada] = useState<PeregrinaDTO | null>(null);

  const [rotulacion, setRotulacion] = useState<Rotulacion>("nueva");
  const campos = useCamposDePeregrina();
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    territorioDeQuienRecibe,
  );

  const peregrinas = [
    ...creadas,
    ...deLaFicha.filter((p) => !creadas.some((c) => c.id === p.id)),
  ];
  const peregrina = peregrinas.find((p) => p.id === peregrinaId);
  // La imagen está afuera: confirmar cierra ese período y abre el siguiente.
  const tenencia = peregrina?.tenenciaActual ?? null;

  const etiquetaDe = (p: PeregrinaDTO) =>
    p.tenenciaActual
      ? `${p.identificacion} — la tiene ${nombreDeTenedor(p.tenenciaActual)}`
      : `${p.identificacion} — sin entregar`;

  // Lo elegido se conserva aunque el filtro lo deje afuera, para que borrar una
  // letra no cambie qué imagen se entrega.
  const filtradas = busqueda.trim()
    ? peregrinas.filter(
        (p) => p.id === peregrinaId || coincide(etiquetaDe(p), busqueda),
      )
    : peregrinas;

  function registrarImagen() {
    setError(null);
    const datos = campos.paraAlta(rotulacion);
    if (!datos) return;
    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    startTransition(async () => {
      const resultado = await createPeregrinaAction({
        ...datos,
        diocesisLocalidadId,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setCreadas((c) => [resultado.data, ...c]);
      setRecienCreada(resultado.data);
      setPeregrinaId(resultado.data.id);
      setBusqueda("");
      setVista("elegir");
      // Ya existe aunque después no se entregue: que la ficha la tenga si el
      // diálogo se vuelve a abrir.
      router.refresh();
    });
  }

  function confirmar() {
    if (!peregrina) return;
    setError(null);

    startTransition(async () => {
      const resultado = tenencia
        ? await entregarAction({
            peregrinaId: peregrina.id,
            tenedor,
            notaCierre: notaCierre.trim() || null,
            nota: nota.trim() || null,
          })
        : await asignarAction({
            peregrinaId: peregrina.id,
            tenedor,
            nota: nota.trim() || null,
          });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      // La ficha abre con «¿Qué tiene ahora?», que es justo lo que se acaba de
      // registrar: cerrar y volver a leerla es la confirmación.
      alEntregar();
      router.refresh();
    });
  }

  if (vista === "alta") {
    return (
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          registrarImagen();
        }}
      >
        <h3 className="text-lg font-bold text-tinta">Registrar una Peregrina</h3>

        {error && (
          <Mensaje tono="alerta">
            <p>{error}</p>
          </Mensaje>
        )}

        <Eleccion
          etiqueta="¿La imagen ya tiene una numeración escrita?"
          ayuda="Las imágenes que se rotularon antes del formato de la Campaña."
          value={rotulacion}
          opciones={[...ROTULACIONES]}
          onChange={(e) => {
            setRotulacion(e.target.value as Rotulacion);
            campos.validacion.limpiar();
          }}
        />

        <CamposDePeregrinaForm campos={campos} rotulacion={rotulacion} />

        <SelectorDeTerritorio
          value={diocesisLocalidadId}
          onChange={setDiocesisLocalidadId}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Boton type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar y elegirla"}
          </Boton>
          <Boton
            tono="secundario"
            disabled={pendiente}
            onClick={() => {
              setError(null);
              setVista("elegir");
            }}
          >
            Volver a elegir
          </Boton>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {recienCreada && (
        <Mensaje tono="exito">
          {recienCreada.codigo ? (
            <p>
              Registrada. Su Código es{" "}
              <strong className="font-mono">{recienCreada.codigo}</strong>.
              Escribilo en la imagen. Ya quedó elegida abajo.
            </p>
          ) : (
            <p>
              Registrada con su numeración anterior,{" "}
              <strong className="font-mono">
                {recienCreada.identificacion}
              </strong>
              . Ya quedó elegida abajo.
            </p>
          )}
        </Mensaje>
      )}

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      {peregrinas.length === 0 ? (
        <p className="text-base leading-relaxed text-tinta-suave">
          Todavía no hay Peregrinas en tu territorio. Registrala acá abajo y
          después la entregás.
        </p>
      ) : (
        <>
          <Campo
            etiqueta="Buscar por Identificación"
            ayuda="Escribí parte del Código o de la numeración, y la lista de abajo se achica."
            type="search"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {filtradas.length === 0 ? (
            <Mensaje tono="aviso">
              <p>
                Ninguna Peregrina coincide. Revisá lo que escribiste, o
                registrala si es nueva.
              </p>
            </Mensaje>
          ) : (
            <Eleccion
              etiqueta="¿Qué Peregrina?"
              ayuda={
                busqueda.trim()
                  ? `${filtradas.length === 1 ? "Queda 1" : `Quedan ${filtradas.length}`} de ${peregrinas.length}.`
                  : undefined
              }
              vacia="Elegí una Peregrina…"
              value={peregrinaId}
              opciones={filtradas.map((p) => ({
                valor: p.id,
                etiqueta: etiquetaDe(p),
              }))}
              onChange={(e) => {
                setPeregrinaId(e.target.value);
                setRecienCreada(null);
              }}
            />
          )}
        </>
      )}

      <Boton
        tono="secundario"
        onClick={() => {
          setError(null);
          setVista("alta");
        }}
      >
        No está en la lista: registrar una nueva
      </Boton>

      {peregrina && (
        <div className="space-y-6 border-t border-borde pt-6">
          {/* `aviso` cuando se cierra un período: es lo único de esta pantalla
              que le saca algo a alguien, y no tiene que parecer un resumen. */}
          <Mensaje tono={tenencia ? "aviso" : "neutro"}>
            <p>
              La Peregrina{" "}
              <strong className="font-mono">{peregrina.identificacion}</strong>{" "}
              queda a cargo de <strong>{nombre}</strong>.
            </p>
            {tenencia && (
              <p>
                Se cierra el período de{" "}
                <strong>{nombreDeTenedor(tenencia)}</strong>, que la tiene
                ahora. Su período queda en el historial.
              </p>
            )}
          </Mensaje>

          {tenencia && (
            <AreaDeTexto
              etiqueta="¿Algo que anotar sobre la devolución?"
              ayuda="Opcional."
              value={notaCierre}
              maxLength={500}
              contador
              onChange={(e) => setNotaCierre(e.target.value)}
              placeholder="Volvió con el marco flojo."
            />
          )}

          <AreaDeTexto
            etiqueta="¿Algo que anotar sobre la entrega?"
            ayuda="Opcional."
            value={nota}
            maxLength={500}
            contador
            onChange={(e) => setNota(e.target.value)}
            placeholder="Entregada en la peregrinación diocesana."
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton disabled={!peregrina || pendiente} onClick={confirmar}>
          {pendiente ? "Registrando…" : "Registrar la entrega"}
        </Boton>
        <Boton tono="secundario" disabled={pendiente} onClick={alCancelar}>
          No, volver
        </Boton>
      </div>
    </div>
  );
}
