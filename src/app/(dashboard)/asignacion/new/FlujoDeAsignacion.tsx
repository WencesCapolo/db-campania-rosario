"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  asignarAction,
  entregarAction,
} from "@/modules/asignacion/asignacion.router";
import Boton, { BotonEnlace } from "@/components/Boton";
import Eleccion from "@/components/Eleccion";
import AreaDeTexto from "@/components/AreaDeTexto";
import Mensaje from "@/components/Mensaje";
import Insignia from "@/components/Insignia";
import { Vacio } from "@/components/EstadosAsincronicos";
import { nombreDeTenedor } from "@/lib/formato";
import {
  opcionDeTenedorConTerritorio,
  tenedorDeDTO,
} from "@/lib/tenedor-en-pantalla";
import { valorDeTenedor } from "@/modules/misionero/matrimonio.types";
import type { TenedorDTO } from "@/modules/misionero/matrimonio.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * Registrar que una Peregrina pasó a un Misionero — historias 1, 2, 8, 21 y 22.
 *
 * Three steps rather than one form: "Paso 1: Elegir Misionero", "Paso 2: Elegir
 * Imagen", "Confirmar". The people entering these records are often older adults
 * doing it from a phone in a parish hall, and a single screen with two pickers and
 * two notes is the form they give up on.
 *
 * One step is one decision, one thumb, no scrolling to find the button. The Volver
 * at each step goes back without losing what was already chosen.
 *
 * If the image is already out, this does not refuse: it says who has it and closes
 * that period as it opens the next, which is exactly what "she passed it on to me"
 * means. Assigning an image nobody has and handing one on are different service
 * operations — `asignar` and `entregar` — and the flow picks between them so the
 * person does not have to know that. The confirmation states the consequence and
 * names whose period closes, in the future tense, because that sentence is what
 * they are agreeing to rather than a report of what already happened.
 *
 * On the primitives now, and two things about it changed. The empty state used to
 * tell somebody to go and register a Misionero, with no link, to a route that did
 * not exist; it links, and the route exists. And step 2 says who has each image in
 * the option itself — finding that out at the confirmation is finding out after
 * the point where choosing a different image was still easy.
 *
 * El paso 1 elige un **Tenedor**, no una persona: una imagen la puede tener un
 * Misionero o un Matrimonio, y la lista es una sola con las dos clases adentro
 * (ADR 0010). Un Misionero casado no aparece — la pareja lo reemplaza — así que
 * no hay forma de elegir una opción que el service vaya a rechazar. El
 * `<option value>` es `persona:abc` / `matrimonio:def`, que es lo que un
 * `<select>` nativo sabe llevar: un string.
 */

type Paso = 1 | 2 | 3;

const PASOS = 3;

export default function FlujoDeAsignacion({
  tenedores,
  peregrinas,
}: {
  /** El roster colapsado: personas solteras y matrimonios, una fila cada uno. */
  tenedores: TenedorDTO[];
  peregrinas: PeregrinaDTO[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [paso, setPaso] = useState<Paso>(1);
  const [valor, setValor] = useState("");
  const [peregrinaId, setPeregrinaId] = useState("");
  const [nota, setNota] = useState("");
  const [notaCierre, setNotaCierre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const elegido = tenedores.find(
    (t) => valorDeTenedor(tenedorDeDTO(t)) === valor,
  );
  const peregrina = peregrinas.find((p) => p.id === peregrinaId);
  // The image is out. Confirming closes that period and opens the next one.
  const tenencia = peregrina?.tenenciaActual ?? null;

  // Three states on every async surface, and this is the empty one. A picker with
  // nothing in it has to say what to do next and give somebody a way to get
  // there, rather than sit there being empty.
  if (tenedores.length === 0) {
    return (
      <Vacio
        titulo="Todavía no hay Misioneros en tu territorio"
        mensaje="Una imagen se entrega a un Misionero o a un Matrimonio, así que hay que cargarlos primero."
        accion={
          <BotonEnlace href="/misionero/new">Cargar un Misionero</BotonEnlace>
        }
      />
    );
  }

  if (peregrinas.length === 0) {
    return (
      <Vacio
        titulo="Todavía no hay Peregrinas en tu territorio"
        mensaje="Registrá la imagen y su Código se genera solo. Después vas a poder entregarla."
        accion={
          <BotonEnlace href="/peregrina/new">
            Registrar una Peregrina
          </BotonEnlace>
        }
      />
    );
  }

  function confirmar() {
    if (!peregrina || !elegido) return;
    setError(null);
    const tenedor = tenedorDeDTO(elegido);

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

      // The Peregrina's own screen, not the historial: it opens with "¿Quién la
      // tiene ahora?", which is the fact just registered, and the historial is
      // one link from there. Landing on the chain of custody made somebody read
      // a list to confirm the thing they had done.
      router.push(`/peregrina/${peregrina.id}`);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Announced on change, so somebody who is not looking at the heading still
          learns the screen moved. */}
      <p
        className="text-base font-semibold text-tinta-suave"
        aria-live="polite"
      >
        Paso {paso} de {PASOS}
      </p>

      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      {/* ── Paso 1: Elegir quién la recibe ── */}
      {paso === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-tinta">
            Paso 1: Elegir quién la recibe
          </h2>

          <Eleccion
            etiqueta="¿A quién pasa la imagen?"
            ayuda="Un Misionero o un Matrimonio. Una pareja aparece una sola vez, con los dos nombres."
            vacia="Elegí un Misionero o un Matrimonio…"
            value={valor}
            opciones={tenedores.map(opcionDeTenedorConTerritorio)}
            onChange={(e) => setValor(e.target.value)}
          />

          {/* La «y» sola se pasa por alto en un teléfono, así que la clase de
              Tenedor se dice con una palabra además de con el nombre. */}
          {elegido?.tipo === "matrimonio" && (
            <Insignia tono="neutro">Matrimonio</Insignia>
          )}

          <Boton disabled={!elegido} onClick={() => setPaso(2)}>
            Siguiente
          </Boton>
        </div>
      )}

      {/* ── Paso 2: Elegir Imagen ── */}
      {paso === 2 && elegido && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-tinta">
            Paso 2: Elegir Imagen
          </h2>
          <p className="text-base text-tinta-suave">
            Para {nombreDeTenedor(elegido)}.
          </p>

          <Eleccion
            etiqueta="¿Qué Peregrina?"
            vacia="Elegí una Peregrina…"
            value={peregrinaId}
            opciones={peregrinas.map((p) => ({
              valor: p.id,
              etiqueta: p.tenenciaActual
                ? `${p.codigo} — la tiene ${nombreDeTenedor(p.tenenciaActual)}`
                : `${p.codigo} — sin entregar`,
            }))}
            onChange={(e) => setPeregrinaId(e.target.value)}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Boton disabled={!peregrinaId} onClick={() => setPaso(3)}>
              Siguiente
            </Boton>
            <Boton tono="secundario" onClick={() => setPaso(1)}>
              Volver
            </Boton>
          </div>
        </div>
      )}

      {/* ── Paso 3: Confirmar ── */}
      {paso === 3 && peregrina && elegido && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-tinta">Confirmar</h2>

          {/* `aviso` rather than `neutro` when a period is about to close. This
              is the one step of the three that takes something away from
              somebody, and it should not look like a summary. */}
          <Mensaje tono={tenencia ? "aviso" : "neutro"}>
            <p>
              La Peregrina{" "}
              <strong className="font-mono">{peregrina.codigo}</strong> queda a
              cargo de <strong>{nombreDeTenedor(elegido)}</strong>
              {elegido.tipo === "matrimonio" ? ", que son un Matrimonio" : ""}.
            </p>
            {tenencia && (
              // Say the consequence before it happens. Somebody's period of
              // charge is about to close, and that is the sentence they have to
              // agree with.
              <p>
                Se cierra el período de{" "}
                <strong>{nombreDeTenedor(tenencia)}</strong>, que la tiene
                ahora.
                Su período queda en el historial.
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <Boton disabled={pendiente} onClick={confirmar}>
              {pendiente ? "Registrando…" : "Registrar la entrega"}
            </Boton>
            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={() => setPaso(2)}
            >
              Volver
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}
