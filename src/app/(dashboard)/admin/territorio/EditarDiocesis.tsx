"use client";

import { useState, useTransition } from "react";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import DialogoDeEdicion from "@/components/DialogoDeEdicion";
import { editarDiocesisLocalidadAction } from "@/modules/territorio/territorio.router";
import {
  editarDiocesisLocalidadSchema,
  type DiocesisLocalidadDTO,
} from "@/modules/territorio/territorio.types";
import { REGIONES, type Region } from "@/modules/territorio/territorio.schema";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/** El nombre y la Región. La Provincia no se ofrece: el servicio no la cambia. */
export default function EditarDiocesis({
  diocesis,
}: {
  diocesis: DiocesisLocalidadDTO;
}) {
  return (
    <DialogoDeEdicion titulo={`Editar ${diocesis.nombre}`} etiqueta="Editar">
      {(acciones) => <Formulario diocesis={diocesis} {...acciones} />}
    </DialogoDeEdicion>
  );
}

function Formulario({
  diocesis,
  alGuardar,
  alCancelar,
}: {
  diocesis: DiocesisLocalidadDTO;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [pendiente, empezar] = useTransition();
  const validacion = useValidacionAlSalir(editarDiocesisLocalidadSchema);
  const [nombre, setNombre] = useState(diocesis.nombre);
  const [region, setRegion] = useState<Region>(diocesis.region);
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);
    empezar(async () => {
      const resultado = await editarDiocesisLocalidadAction({
        id: diocesis.id,
        nombre,
        region,
      });
      if (resultado.ok) alGuardar();
      else setError(resultado.error);
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
      {error && (
        <Mensaje tono="alerta">
          <p>{error}</p>
        </Mensaje>
      )}

      <p className="text-base text-tinta-suave">
        Provincia: {diocesis.provincia.nombre}
      </p>

      <Campo
        etiqueta="Nombre de la Diócesis o Localidad"
        required
        value={nombre}
        error={validacion.error("nombre")}
        onChange={(e) => {
          setNombre(e.target.value);
          validacion.alEscribir("nombre");
        }}
        onBlur={(e) => validacion.alSalir("nombre", e.target.value)}
      />

      <Eleccion
        etiqueta="Región"
        opciones={REGIONES.map((r) => ({ valor: r, etiqueta: r }))}
        value={region}
        alElegir={(valor) => setRegion(valor as Region)}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente || !nombre.trim()}>
          {pendiente ? "Guardando…" : "Guardar los cambios"}
        </Boton>
        <Boton tono="secundario" disabled={pendiente} onClick={alCancelar}>
          No, volver
        </Boton>
      </div>
    </form>
  );
}
