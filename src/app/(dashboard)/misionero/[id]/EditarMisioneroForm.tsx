"use client";

import { useState, useTransition } from "react";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { updateMisioneroAction } from "@/modules/misionero/misionero.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type { CentroTipo } from "@/modules/misionero/misionero.schema";
import {
  CENTRO_LABELS,
  CENTRO_TIPOS,
  updateMisioneroSchema,
  type MisioneroDTO,
} from "@/modules/misionero/misionero.types";
import { CampoDeFechaDeConsagracion } from "@/modules/peregrina/CamposDePeregrina";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";
import DialogoDeEdicion from "@/components/DialogoDeEdicion";
import { nombreCompleto } from "@/lib/formato";

/**
 * Corregir los datos de un Misionero ya cargado, en un diálogo sobre su ficha.
 *
 * Los mismos campos que el alta, llenos con lo que hay, y un solo botón. Se
 * manda todo de una vez — una caja vaciada llega como null y borra el dato —
 * porque lo que se ve en el formulario es lo que tiene que quedar.
 *
 * Una persona casada no ve territorio ni Centro: son de la casa (ADR 0010), y se
 * corrigen en la ficha del matrimonio para los dos a la vez. El servicio rechaza
 * lo mismo; esconderlo es para no ofrecer algo que va a decir que no.
 */

const CENTROS = CENTRO_TIPOS.map((t) => ({
  valor: t,
  etiqueta: CENTRO_LABELS[t],
}));

/**
 * El botón y el diálogo, del lado del cliente. La ficha es un componente de
 * servidor y no le puede pasar una función a `DialogoDeEdicion` — Next no
 * serializa funciones hacia el cliente, y la ficha entera fallaba. La ficha pasa
 * sólo datos, y el armado del diálogo vive acá.
 */
export function EditarMisionero({
  misionero,
  casado,
}: {
  misionero: MisioneroDTO;
  casado: boolean;
}) {
  return (
    <DialogoDeEdicion titulo={`Editar a ${nombreCompleto(misionero)}`}>
      {(acciones) => (
        <EditarMisioneroForm misionero={misionero} casado={casado} {...acciones} />
      )}
    </DialogoDeEdicion>
  );
}

export default function EditarMisioneroForm({
  misionero,
  casado,
  alGuardar,
  alCancelar,
}: {
  misionero: MisioneroDTO;
  casado: boolean;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [pendiente, empezar] = useTransition();
  const validacion = useValidacionAlSalir(updateMisioneroSchema);

  const [nombre, setNombre] = useState(misionero.nombre);
  const [apellido, setApellido] = useState(misionero.apellido);
  const [telefono, setTelefono] = useState(misionero.telefono ?? "");
  const [email, setEmail] = useState(misionero.email ?? "");
  const [fechaConsagracion, setFechaConsagracion] = useState(
    misionero.fechaConsagracion ?? "",
  );
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    misionero.diocesisLocalidad.id,
  );
  const [centroTipo, setCentroTipo] = useState<CentroTipo | "">(
    misionero.centroTipo ?? "",
  );
  const [centroNombre, setCentroNombre] = useState(misionero.centroNombre ?? "");
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);

    if (!casado && !diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    empezar(async () => {
      const resultado = await updateMisioneroAction(misionero.id, {
        nombre,
        apellido,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        fechaConsagracion: fechaConsagracion || null,
        ...(!casado && {
          diocesisLocalidadId,
          centroTipo: centroTipo || null,
          centroNombre: centroNombre.trim() || null,
        }),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      alGuardar();
    });
  }

  /** Lo que comparten las cajas de texto: avisar al salir, callar al escribir. */
  const campo = (
    nombreDelCampo: "nombre" | "apellido" | "telefono" | "email" | "centroNombre",
    valor: string,
    setValor: (v: string) => void,
  ) => ({
    value: valor,
    error: validacion.error(nombreDelCampo),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValor(e.target.value);
      validacion.alEscribir(nombreDelCampo);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const texto = e.target.value.trim();
      // Vacío en un dato opcional es «no se sabe», y llega como null.
      const obligatorio =
        nombreDelCampo === "nombre" || nombreDelCampo === "apellido";
      validacion.alSalir(
        nombreDelCampo,
        texto === "" && !obligatorio ? null : texto,
      );
    },
  });

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
        etiqueta="Nombre"
        required
        autoComplete="given-name"
        {...campo("nombre", nombre, setNombre)}
      />
      <Campo
        etiqueta="Apellido"
        required
        autoComplete="family-name"
        {...campo("apellido", apellido, setApellido)}
      />
      <Campo
        etiqueta="Teléfono"
        ayuda="Opcional."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        {...campo("telefono", telefono, setTelefono)}
      />
      <Campo
        etiqueta="Email"
        ayuda="Opcional."
        type="email"
        inputMode="email"
        autoComplete="email"
        {...campo("email", email, setEmail)}
      />

      <CampoDeFechaDeConsagracion
        etiqueta="Fecha de consagración"
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

      {casado ? (
        <p className="text-base leading-relaxed text-tinta-suave">
          Es parte de un matrimonio: el territorio y el Centro son de los dos, y
          se cambian desde la ficha del matrimonio.
        </p>
      ) : (
        <>
          <SelectorDeTerritorio
            value={diocesisLocalidadId}
            onChange={setDiocesisLocalidadId}
          />

          <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
            <legend className="px-2 text-base font-bold text-tinta">
              Centro (opcional)
            </legend>

            <Eleccion
              etiqueta="Tipo de centro"
              vacia="Sin especificar"
              value={centroTipo}
              opciones={CENTROS}
              onChange={(e) => setCentroTipo(e.target.value as CentroTipo | "")}
            />

            <Campo
              etiqueta="Nombre del centro"
              {...campo("centroNombre", centroNombre, setCentroNombre)}
            />
          </fieldset>
        </>
      )}

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
