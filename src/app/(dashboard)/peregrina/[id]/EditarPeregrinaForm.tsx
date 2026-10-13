"use client";

import { useState, useTransition } from "react";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { updatePeregrinaAction } from "@/modules/peregrina/peregrina.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type {
  Modalidad,
  PeregrinaEstado,
  PeregrinaTipo,
} from "@/modules/peregrina/peregrina.schema";
import {
  ESTADOS_SELECCIONABLES,
  ESTADO_LABELS,
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
  updatePeregrinaSchema,
  type PeregrinaDTO,
  type UpdatePeregrinaInput,
} from "@/modules/peregrina/peregrina.types";
import { CampoDeFechaDeConsagracion } from "@/modules/peregrina/CamposDePeregrina";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * Corregir los datos de una Peregrina — todo menos quién la tiene, que sólo lo
 * cambia una Asignación (ADR 0004).
 *
 * **El Código** se corrige por su número (ADR 0013). Si el número no se toca,
 * el Código queda tal como está escrito en la imagen aunque cambien la
 * Modalidad o el territorio; si se cambia, se arma de nuevo con la Provincia y
 * la Modalidad que la imagen tenga al guardar. Vaciarlo le saca el Código, y
 * sólo se puede si le queda la Numeración anterior: el servicio lo rechaza si
 * no, y también rechaza un Código que ya tenga otra imagen.
 *
 * Sólo se manda lo que cambió en esos dos campos, porque mandar el número sin
 * tocar volvería a armar el Código con la Modalidad nueva.
 */

const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

const NUMERO_ENTERO = "El número tiene que ser un número entero, sin letras.";

export default function EditarPeregrinaForm({
  peregrina,
  alGuardar,
  alCancelar,
}: {
  peregrina: PeregrinaDTO;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [pendiente, empezar] = useTransition();
  const validacion = useValidacionAlSalir(updatePeregrinaSchema);

  const numeroOriginal =
    peregrina.codigoNum !== null ? String(peregrina.codigoNum) : "";
  const [numero, setNumero] = useState(numeroOriginal);
  const [numeracionAnterior, setNumeracionAnterior] = useState(
    peregrina.numeracionAnterior ?? "",
  );
  const [fechaConsagracion, setFechaConsagracion] = useState(
    peregrina.fechaConsagracion ?? "",
  );
  const [tipo, setTipo] = useState<PeregrinaTipo>(peregrina.tipo);
  const [modalidad, setModalidad] = useState<Modalidad>(peregrina.modalidad);
  const [estado, setEstado] = useState<PeregrinaEstado>(peregrina.estado);
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    peregrina.diocesisLocalidad.id,
  );
  const [error, setError] = useState<string | null>(null);

  // `inactiva` se muestra en la imagen que la tiene, para que el select diga la
  // verdad, pero no se puede elegir: sólo se manda el Estado si cambió.
  const estados = (
    peregrina.estado === "inactiva"
      ? [...ESTADOS_SELECCIONABLES, "inactiva" as const]
      : ESTADOS_SELECCIONABLES
  ).map((e) => ({ valor: e, etiqueta: ESTADO_LABELS[e] }));

  function guardar() {
    setError(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    const cambios: UpdatePeregrinaInput = {
      tipo,
      modalidad,
      diocesisLocalidadId,
      fechaConsagracion: fechaConsagracion || null,
    };

    const textoNumero = numero.trim();
    if (textoNumero !== numeroOriginal) {
      if (textoNumero && !/^\d+$/.test(textoNumero)) {
        validacion.marcar("numero", NUMERO_ENTERO);
        return;
      }
      cambios.numero = textoNumero ? Number(textoNumero) : null;
    }

    const textoAnterior = numeracionAnterior.trim();
    if (textoAnterior !== (peregrina.numeracionAnterior ?? "")) {
      cambios.numeracionAnterior = textoAnterior || null;
    }

    if (estado !== peregrina.estado && estado !== "inactiva") {
      cambios.estado = estado;
    }

    empezar(async () => {
      const resultado = await updatePeregrinaAction(peregrina.id, cambios);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      alGuardar();
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <Campo
        etiqueta="Número del Código"
        ayuda={
          peregrina.codigo
            ? `Hoy su Código es ${peregrina.codigo}. Si cambiás el número, el Código se arma de nuevo con la Provincia y la Modalidad que elijas abajo. Si lo vaciás, se queda sin Código.`
            : "Todavía no tiene Código. Si le escribís un número, se le arma con su Provincia y su Modalidad."
        }
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={numero}
        error={validacion.error("numero")}
        onChange={(e) => {
          setNumero(e.target.value);
          validacion.alEscribir("numero");
        }}
        onBlur={(e) => {
          const texto = e.target.value.trim();
          if (!texto) return;
          if (!/^\d+$/.test(texto)) {
            validacion.marcar("numero", NUMERO_ENTERO);
            return;
          }
          validacion.alSalir("numero", Number(texto));
        }}
      />

      <Campo
        etiqueta="Numeración anterior"
        ayuda="La que tenía escrita antes del formato de la Campaña, si tenía. Opcional si tiene Código."
        autoComplete="off"
        value={numeracionAnterior}
        error={validacion.error("numeracionAnterior")}
        onChange={(e) => {
          setNumeracionAnterior(e.target.value);
          validacion.alEscribir("numeracionAnterior");
        }}
        onBlur={(e) => {
          const texto = e.target.value.trim();
          if (texto) validacion.alSalir("numeracionAnterior", texto);
        }}
      />

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

      <Eleccion
        etiqueta="Estado"
        ayuda="Si se perdió estando a cargo de alguien, ponela Extraviada: así queda dicho quién la tuvo por última vez."
        value={estado}
        opciones={estados}
        onChange={(e) => setEstado(e.target.value as PeregrinaEstado)}
      />

      <CampoDeFechaDeConsagracion
        etiqueta="Fecha de consagración de la imagen"
        valor={fechaConsagracion}
        error={validacion.error("fechaConsagracion")}
        onValor={(v) => {
          setFechaConsagracion(v);
          validacion.alEscribir("fechaConsagracion");
        }}
        onSalir={(v) => {
          if (v) validacion.alSalir("fechaConsagracion", v);
        }}
      />

      <SelectorDeTerritorio
        value={diocesisLocalidadId}
        onChange={setDiocesisLocalidadId}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar los cambios"}
        </Boton>
        <Boton tono="secundario" disabled={pendiente} onClick={alCancelar}>
          No, volver
        </Boton>
      </div>
    </form>
  );
}
