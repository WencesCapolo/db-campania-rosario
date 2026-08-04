"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { corregirAsignacionAction } from "@/modules/asignacion/asignacion.router";
import Boton from "@/components/Boton";
import Dialogo from "@/components/Dialogo";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import AreaDeTexto from "@/components/AreaDeTexto";
import Mensaje from "@/components/Mensaje";
import {
  deCampoDeFecha,
  nombreDeTenedor,
  nombreDeTenedorEnLista,
  paraCampoDeFecha,
} from "@/lib/formato";
import { opcionDeTenedor } from "@/lib/tenedor-en-pantalla";
import {
  tenedorDesdeValor,
  valorDeTenedor,
} from "@/modules/misionero/matrimonio.types";
import type { AsignacionDTO } from "@/modules/asignacion/asignacion.types";
import type { TenedorDTO } from "@/modules/misionero/matrimonio.types";

/**
 * Corregir un período mal cargado — historia 17.
 *
 * `AsignacionService.corregir` shipped in issue #3 with a full test suite and no
 * caller, which made it the largest tested-but-unreachable surface left. The
 * mistake it exists for is ordinary: the wrong Misionero picked from a list of
 * names that look alike, or a date typed as the day somebody got round to
 * recording it rather than the day the image actually changed hands. Without this
 * the only remedies were to leave the record wrong or to open a second Asignación
 * that contradicts it.
 *
 * An edit, never a deletion, and never a silent one. The repository stamps
 * `corregidaAt` on every path, and the historial page renders it — a record that
 * was changed and does not say so is a record nobody can trust twice. That is why
 * the dialog says so before saving rather than after.
 *
 * Only what changed is sent. Posting every field would stamp a correction onto a
 * period where somebody opened the dialog, read it and closed it — and if nothing
 * changed at all, the service's own refusal ("No hay nada que corregir.") is a
 * better sentence than anything this component could invent, so it is allowed to
 * arrive.
 *
 * Dates go through `paraCampoDeFecha`/`deCampoDeFecha` rather than
 * `toISOString().slice(0, 10)`. Argentina is UTC−3, so an entrega at 21:00 is
 * already tomorrow in UTC, and the naïve round trip would silently move every
 * date a caller did not touch one day forward.
 *
 * The Misionero list is only offered while the period is open in the sense that
 * matters: a closed period may name somebody who has since left the Campaña —
 * that is what history is — and the service refuses to leave an *open* one with a
 * Misionero dado de baja, since they would be holding an image while absent from
 * every active list. The list handed in is the active one, so the second case
 * cannot be chosen; the first is left exactly as it was recorded.
 *
 * Lo que se corrige es el **Tenedor**, no la persona: el período pudo ser de un
 * Matrimonio, y la lista es la misma que la del flujo de entrega — una sola, con
 * personas solteras y parejas adentro (ADR 0010). Un período mal cargado a un
 * cónyuge se arregla eligiendo la pareja, que es exactamente el error que este
 * diálogo existe para arreglar.
 */
export default function CorregirAsignacion({
  asignacion,
  tenedores,
}: {
  asignacion: AsignacionDTO;
  /** El roster colapsado del alcance del Actor: solteros y matrimonios. */
  tenedores: TenedorDTO[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  // `TenedorResueltoDTO` lleva `tipo` e `id` afuera de la rama justamente para
  // esto: el valor del `<option>` se arma sin discriminar la unión.
  const valorRegistrado = valorDeTenedor(asignacion.tenedor);

  const inicial = {
    tenedor: valorRegistrado,
    abiertaAt: paraCampoDeFecha(asignacion.abiertaAt),
    cerradaAt: asignacion.cerradaAt
      ? paraCampoDeFecha(asignacion.cerradaAt)
      : "",
    notaApertura: asignacion.notaApertura ?? "",
    notaCierre: asignacion.notaCierre ?? "",
  };

  const [campos, setCampos] = useState(inicial);
  const [error, setError] = useState<string | null>(null);

  function editar<C extends keyof typeof inicial>(
    campo: C,
    valor: string,
  ): void {
    setCampos((previos) => ({ ...previos, [campo]: valor }));
  }

  // A closed period whose Tenedor has since left the Campaña would otherwise
  // vanish from its own picker and read as "nobody chosen". The historical name
  // is added back, marked, so the field shows what the record says. Vale igual
  // para un Matrimonio dado de baja: la historia sigue leyéndose como la pareja,
  // porque eso es lo que era entonces.
  const opciones = tenedores.map(opcionDeTenedor);
  const opcionesDeTenedor = opciones.some((o) => o.valor === valorRegistrado)
    ? opciones
    : [
        ...opciones,
        {
          valor: valorRegistrado,
          etiqueta: `${nombreDeTenedorEnLista(asignacion.tenedor)} (${
            asignacion.tenedor.tipo === "matrimonio"
              ? "matrimonio dado de baja"
              : "dado de baja"
          })`,
        },
      ];

  return (
    <Dialogo
      titulo="Corregir este período"
      alCerrar={(cancelado) => {
        setError(null);
        // On a confirmation the fields already hold what was saved, and these
        // props do not reach `useState` again — putting them back would show the
        // uncorrected record as though the correction had failed.
        if (cancelado) setCampos(inicial);
      }}
      disparador={(control) => (
        <Boton tono="secundario" onClick={control.abrir}>
          Corregir
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            El período de{" "}
            <strong>{nombreDeTenedor(asignacion.tenedor)}</strong>. Se corrige,
            no se borra: la corrección queda anotada en el historial con la
            fecha de hoy.
          </p>

          {error && (
            <div className="mt-4">
              <Mensaje tono="alerta">
                <p>{error}</p>
              </Mensaje>
            </div>
          )}

          <div className="mt-4 space-y-5">
            <Eleccion
              etiqueta="¿Quién la tuvo?"
              ayuda="Un Misionero o un Matrimonio. Una pareja aparece una sola vez, con los dos nombres."
              value={campos.tenedor}
              opciones={opcionesDeTenedor}
              onChange={(e) => editar("tenedor", e.target.value)}
            />

            <Campo
              etiqueta="Fecha de entrega"
              type="date"
              value={campos.abiertaAt}
              onChange={(e) => editar("abiertaAt", e.target.value)}
            />

            {asignacion.cerradaAt && (
              // Only for a closed period. Setting a date here on an open one
              // would close it, and closing a period is a devolución — a
              // different act, with its own control and its own confirmation.
              <Campo
                etiqueta="Fecha de devolución"
                type="date"
                value={campos.cerradaAt}
                onChange={(e) => editar("cerradaAt", e.target.value)}
              />
            )}

            <AreaDeTexto
              etiqueta="Nota de la entrega"
              value={campos.notaApertura}
              maxLength={500}
              contador
              onChange={(e) => editar("notaApertura", e.target.value)}
            />

            {asignacion.cerradaAt && (
              <AreaDeTexto
                etiqueta="Nota de la devolución"
                value={campos.notaCierre}
                maxLength={500}
                contador
                onChange={(e) => editar("notaCierre", e.target.value)}
              />
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Boton
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);

                  const abiertaAt =
                    campos.abiertaAt === inicial.abiertaAt
                      ? undefined
                      : deCampoDeFecha(campos.abiertaAt);
                  const cerradaAt =
                    campos.cerradaAt === inicial.cerradaAt
                      ? undefined
                      : deCampoDeFecha(campos.cerradaAt);

                  if (abiertaAt === null || cerradaAt === null) {
                    setError("Revisá las fechas: falta una o está incompleta.");
                    return;
                  }

                  // Sólo puede ser null si alguien escribió el valor a mano; el
                  // único que arma opciones acá es este mismo módulo.
                  const tenedor =
                    campos.tenedor === inicial.tenedor
                      ? undefined
                      : (tenedorDesdeValor(campos.tenedor) ?? undefined);

                  const resultado = await corregirAsignacionAction({
                    asignacionId: asignacion.id,
                    // Only what changed. Sending everything would stamp a
                    // correction onto a period somebody merely looked at, and
                    // sending nothing lets the service say "No hay nada que
                    // corregir." — which is the right sentence.
                    ...(tenedor !== undefined && { tenedor }),
                    ...(abiertaAt !== undefined && { abiertaAt }),
                    ...(cerradaAt !== undefined && { cerradaAt }),
                    ...(campos.notaApertura !== inicial.notaApertura && {
                      notaApertura: campos.notaApertura.trim() || null,
                    }),
                    ...(campos.notaCierre !== inicial.notaCierre && {
                      notaCierre: campos.notaCierre.trim() || null,
                    }),
                  });

                  if (!resultado.ok) {
                    setError(resultado.error);
                    return;
                  }

                  control.cerrar();
                  router.refresh();
                })
              }
            >
              {pendiente ? "Guardando…" : "Guardar la corrección"}
            </Boton>

            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={control.cancelar}
            >
              No, volver
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
