"use client";

import { useState } from "react";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import { paraCampoDeFecha } from "@/lib/formato";
import {
  useValidacionAlSalir,
  type ValidacionAlSalir,
} from "@/lib/validacion-al-salir";
import type { Modalidad, PeregrinaTipo } from "./peregrina.schema";
import {
  MODALIDADES,
  MODALIDAD_LABELS,
  TIPO_LABELS,
  createPeregrinaSchema,
  type CreatePeregrinaInput,
} from "./peregrina.types";

/**
 * Los campos de una Peregrina, para las tres pantallas que dan de alta una: el
 * alta del listado, `/peregrina/new` y la imagen que se lleva un Misionero recién
 * cargado. Eran tres copias de Tipo y Modalidad, y la tercera se había quedado
 * sin la imagen vieja — que es exactamente lo que pasa con las copias.
 *
 * El territorio no está acá: cada pantalla lo resuelve a su manera, y en el alta
 * del Misionero es el de la persona.
 *
 * Dos rotulaciones (ADR 0012). La `nueva` pide un **número** opcional — ADR
 * 0013: si la imagen ya tiene uno escrito se tipea, y si no, el sistema le da el
 * siguiente libre. El Código lo arma el servidor con la Provincia y la Modalidad,
 * así que nadie tipea las letras. La `vieja` pide la Numeración anterior tal como
 * se lee. Las dos piden la Fecha de consagración, opcional.
 *
 * Todo se valida al salir contra `createPeregrinaSchema`, el mismo que parsea el
 * router (ADR 0008).
 */

export type Rotulacion = "nueva" | "vieja";

export interface DatosDePeregrina {
  /** Texto, porque es lo que hay en la caja; se vuelve número al guardar. */
  numero: string;
  numeracionAnterior: string;
  fechaConsagracion: string;
  tipo: PeregrinaTipo;
  modalidad: Modalidad;
}

const INICIALES: DatosDePeregrina = {
  numero: "",
  numeracionAnterior: "",
  fechaConsagracion: "",
  tipo: "peregrina",
  modalidad: "JOV",
};

// Desde el enum a través de la tabla de etiquetas, nunca a mano: son dieciséis
// Modalidades, y una segunda copia de la lista es un segundo lugar donde falta una.
const MODALIDADES_ELEGIBLES = MODALIDADES.map((m) => ({
  valor: m,
  // El código de tres letras va al lado del nombre porque es la parte que termina
  // en el Código, y quien compara una imagen con la pantalla lee el código.
  etiqueta: `${MODALIDAD_LABELS[m]} (${m})`,
}));

const TIPOS = (["peregrina", "auxiliar"] as const).map((t) => ({
  valor: t,
  etiqueta: TIPO_LABELS[t],
}));

const NUMERO_ENTERO = "El número tiene que ser un número entero, sin letras.";

/** Lo que se le manda al router, sin el territorio. */
export type DatosParaAlta = Omit<CreatePeregrinaInput, "diocesisLocalidadId">;

export interface CamposDePeregrina {
  datos: DatosDePeregrina;
  cambiar: (cambios: Partial<DatosDePeregrina>) => void;
  validacion: ValidacionAlSalir<CreatePeregrinaInput>;
  /**
   * Los datos listos para el router, o null después de marcar lo que falta.
   * Comprueba lo mismo que el salir de cada campo, para que nadie pueda guardar
   * sin haber pasado por ellos.
   */
  paraAlta: (rotulacion: Rotulacion) => DatosParaAlta | null;
  /**
   * Lo que cambia de una imagen del lote a la siguiente: el número, la
   * numeración y la fecha. Tipo y Modalidad quedan, porque el lote es uno.
   */
  siguienteDelLote: () => void;
}

export function useCamposDePeregrina(): CamposDePeregrina {
  const [datos, setDatos] = useState<DatosDePeregrina>(INICIALES);
  const validacion = useValidacionAlSalir(createPeregrinaSchema);

  function paraAlta(rotulacion: Rotulacion): DatosParaAlta | null {
    let valido = true;
    const resultado: DatosParaAlta = {
      tipo: datos.tipo,
      modalidad: datos.modalidad,
      fechaConsagracion: datos.fechaConsagracion || null,
    };

    if (rotulacion === "vieja") {
      const r = createPeregrinaSchema.shape.numeracionAnterior.safeParse(
        datos.numeracionAnterior,
      );
      if (!r.success || r.data === undefined) {
        validacion.alSalir("numeracionAnterior", datos.numeracionAnterior);
        valido = false;
      } else {
        resultado.numeracionAnterior = r.data;
      }
    } else {
      const texto = datos.numero.trim();
      if (texto) {
        if (!/^\d+$/.test(texto)) {
          validacion.marcar("numero", NUMERO_ENTERO);
          valido = false;
        } else {
          const r = createPeregrinaSchema.shape.numero.safeParse(Number(texto));
          if (!r.success) {
            validacion.alSalir("numero", Number(texto));
            valido = false;
          } else {
            resultado.numero = r.data;
          }
        }
      }
    }

    if (datos.fechaConsagracion) {
      const r = createPeregrinaSchema.shape.fechaConsagracion.safeParse(
        datos.fechaConsagracion,
      );
      if (!r.success) {
        validacion.alSalir("fechaConsagracion", datos.fechaConsagracion);
        valido = false;
      }
    }

    return valido ? resultado : null;
  }

  return {
    datos,
    cambiar: (cambios) => setDatos((d) => ({ ...d, ...cambios })),
    validacion,
    paraAlta,
    siguienteDelLote: () => {
      setDatos((d) => ({
        ...d,
        numero: "",
        numeracionAnterior: "",
        fechaConsagracion: "",
      }));
      validacion.limpiar();
    },
  };
}

export default function CamposDePeregrinaForm({
  campos,
  rotulacion,
}: {
  campos: CamposDePeregrina;
  rotulacion: Rotulacion;
}) {
  const { datos, cambiar, validacion } = campos;

  return (
    <div className="space-y-5">
      {rotulacion === "vieja" ? (
        <Campo
          etiqueta="Numeración anterior"
          ayuda="Escribila tal como está en la imagen. Por ejemplo: «Peregrina 7», «Rosario-12», «15»."
          autoComplete="off"
          value={datos.numeracionAnterior}
          error={validacion.error("numeracionAnterior")}
          onChange={(e) => {
            cambiar({ numeracionAnterior: e.target.value });
            validacion.alEscribir("numeracionAnterior");
          }}
          onBlur={(e) =>
            validacion.alSalir("numeracionAnterior", e.target.value)
          }
        />
      ) : (
        <Campo
          etiqueta="Número (opcional)"
          ayuda="Si la imagen ya tiene un número escrito, ponelo. Si lo dejás vacío, se le da el siguiente libre. Las letras del Código salen de la Provincia y la Modalidad."
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={datos.numero}
          error={validacion.error("numero")}
          onChange={(e) => {
            cambiar({ numero: e.target.value });
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
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Eleccion
          etiqueta="Tipo"
          value={datos.tipo}
          opciones={TIPOS}
          alElegir={(valor) => cambiar({ tipo: valor as PeregrinaTipo })}
        />

        <Eleccion
          etiqueta="Modalidad"
          value={datos.modalidad}
          opciones={MODALIDADES_ELEGIBLES}
          alElegir={(valor) =>
            cambiar({ modalidad: valor as Modalidad })
          }
        />
      </div>

      <CampoDeFechaDeConsagracion
        etiqueta="Fecha de consagración de la imagen (opcional)"
        valor={datos.fechaConsagracion}
        error={validacion.error("fechaConsagracion")}
        onValor={(v) => {
          cambiar({ fechaConsagracion: v });
          validacion.alEscribir("fechaConsagracion");
        }}
        onSalir={(v) => {
          if (v) validacion.alSalir("fechaConsagracion", v);
        }}
      />
    </div>
  );
}

/**
 * Una Fecha de consagración: un `<input type="date">` nativo, que en un teléfono
 * abre el calendario del sistema. Vacío es «no se sabe», y está bien. Lo usan la
 * Peregrina y el Misionero (ADR 0013).
 */
export function CampoDeFechaDeConsagracion({
  etiqueta,
  valor,
  error,
  onValor,
  onSalir,
}: {
  etiqueta: string;
  valor: string;
  error?: string;
  onValor: (valor: string) => void;
  onSalir: (valor: string) => void;
}) {
  return (
    <Campo
      etiqueta={etiqueta}
      ayuda="Si no la sabés, dejala vacía: se puede completar después."
      type="date"
      min="1900-01-01"
      max={paraCampoDeFecha(new Date())}
      value={valor}
      error={error}
      onChange={(e) => onValor(e.target.value)}
      onBlur={(e) => onSalir(e.target.value)}
    />
  );
}
