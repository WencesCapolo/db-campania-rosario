"use client";

import { useState, useTransition } from "react";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { updateMatrimonioAction } from "@/modules/misionero/matrimonio.router";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import type { CentroTipo } from "@/modules/misionero/misionero.schema";
import {
  CENTRO_LABELS,
  CENTRO_TIPOS,
  type MisioneroDTO,
} from "@/modules/misionero/misionero.types";
import {
  updateMatrimonioSchema,
  type MatrimonioDTO,
  type UpdateMatrimonioInput,
} from "@/modules/misionero/matrimonio.types";
import { CampoDeFechaDeConsagracion } from "@/modules/peregrina/CamposDePeregrina";
import {
  useValidacionAlSalir,
  type ValidacionAlSalir,
} from "@/lib/validacion-al-salir";

/**
 * Corregir los datos de un Matrimonio: los de cada uno y los de la casa.
 *
 * Un solo diálogo y un solo guardado, porque `MatrimonioService.update` mueve
 * a los dos en la misma transacción: el territorio cambia para la pareja o para
 * nadie (ADR 0010). Se manda todo — una caja vaciada borra el dato — porque lo
 * que se ve es lo que tiene que quedar.
 */

const CENTROS = CENTRO_TIPOS.map((t) => ({
  valor: t,
  etiqueta: CENTRO_LABELS[t],
}));

interface Persona {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  fechaConsagracion: string;
}

const desde = (m: MisioneroDTO): Persona => ({
  nombre: m.nombre,
  apellido: m.apellido,
  telefono: m.telefono ?? "",
  email: m.email ?? "",
  fechaConsagracion: m.fechaConsagracion ?? "",
});

type Validacion = ValidacionAlSalir<UpdateMatrimonioInput>;

/** Los campos de una de las dos personas, con el sufijo del esquema. */
function DatosDePersona({
  sufijo,
  deQuien,
  persona,
  onCambio,
  validacion,
}: {
  sufijo: "A" | "B";
  deQuien: string;
  persona: Persona;
  onCambio: (p: Persona) => void;
  validacion: Validacion;
}) {
  const de = ` (${deQuien})`;
  const caja = (
    clave: "nombre" | "apellido" | "telefono" | "email",
    obligatorio: boolean,
  ) => {
    const campo = `${clave}${sufijo}` as const;
    return {
      value: persona[clave],
      error: validacion.error(campo),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        onCambio({ ...persona, [clave]: e.target.value });
        validacion.alEscribir(campo);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        const texto = e.target.value.trim();
        validacion.alSalir(campo, texto === "" && !obligatorio ? null : texto);
      },
    };
  };

  return (
    <fieldset className="space-y-5 rounded-tarjeta border-2 border-borde p-5">
      <legend className="px-2 text-base font-bold text-tinta">
        {deQuien.charAt(0).toUpperCase() + deQuien.slice(1)}
      </legend>

      <Campo
        etiqueta={`Nombre${de}`}
        required
        autoComplete="given-name"
        {...caja("nombre", true)}
      />
      <Campo
        etiqueta={`Apellido${de}`}
        required
        autoComplete="family-name"
        {...caja("apellido", true)}
      />
      <Campo
        etiqueta={`Teléfono${de}`}
        ayuda="Opcional."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        {...caja("telefono", false)}
      />
      <Campo
        etiqueta={`Email${de}`}
        ayuda="Opcional."
        type="email"
        inputMode="email"
        autoComplete="email"
        {...caja("email", false)}
      />
      <CampoDeFechaDeConsagracion
        etiqueta={`Fecha de consagración${de}`}
        valor={persona.fechaConsagracion}
        error={validacion.error(`fechaConsagracion${sufijo}`)}
        onValor={(v) => {
          onCambio({ ...persona, fechaConsagracion: v });
          validacion.alEscribir(`fechaConsagracion${sufijo}`);
        }}
        onSalir={(v) => {
          if (v) validacion.alSalir(`fechaConsagracion${sufijo}`, v);
        }}
      />
    </fieldset>
  );
}

export default function EditarMatrimonioForm({
  matrimonio,
  alGuardar,
  alCancelar,
}: {
  matrimonio: MatrimonioDTO;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [pendiente, empezar] = useTransition();
  const validacion = useValidacionAlSalir(updateMatrimonioSchema);

  const [a, setA] = useState(desde(matrimonio.misioneroA));
  const [b, setB] = useState(desde(matrimonio.misioneroB));
  // Un Matrimonio no tiene territorio propio: es el del cónyuge A.
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    matrimonio.misioneroA.diocesisLocalidad.id,
  );
  const [centroTipo, setCentroTipo] = useState<CentroTipo | "">(
    matrimonio.centroTipo ?? "",
  );
  const [centroNombre, setCentroNombre] = useState(
    matrimonio.centroNombre ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);

    if (!diocesisLocalidadId) {
      setError("Elegí una Diócesis/Localidad.");
      return;
    }

    empezar(async () => {
      const resultado = await updateMatrimonioAction(matrimonio.id, {
        nombreA: a.nombre,
        apellidoA: a.apellido,
        telefonoA: a.telefono.trim() || null,
        emailA: a.email.trim() || null,
        fechaConsagracionA: a.fechaConsagracion || null,
        nombreB: b.nombre,
        apellidoB: b.apellido,
        telefonoB: b.telefono.trim() || null,
        emailB: b.email.trim() || null,
        fechaConsagracionB: b.fechaConsagracion || null,
        diocesisLocalidadId,
        centroTipo: centroTipo || null,
        centroNombre: centroNombre.trim() || null,
      });

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

      <DatosDePersona
        sufijo="A"
        deQuien="la primera persona"
        persona={a}
        onCambio={setA}
        validacion={validacion}
      />
      <DatosDePersona
        sufijo="B"
        deQuien="la segunda persona"
        persona={b}
        onCambio={setB}
        validacion={validacion}
      />

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
          value={centroNombre}
          error={validacion.error("centroNombre")}
          onChange={(e) => {
            setCentroNombre(e.target.value);
            validacion.alEscribir("centroNombre");
          }}
          onBlur={(e) =>
            validacion.alSalir("centroNombre", e.target.value.trim() || null)
          }
        />
      </fieldset>

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
