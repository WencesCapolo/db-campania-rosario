"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Dialogo from "@/components/Dialogo";
import { crearProvinciaAction } from "@/modules/territorio/territorio.router";
import { crearProvinciaSchema } from "@/modules/territorio/territorio.types";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * Agregar una Provincia.
 *
 * Behind a dialog rather than on the page, because the 24 are seeded and this
 * is close to a never operation — a form permanently occupying the screen would
 * suggest otherwise. Adding a Diócesis/Localidad is the daily job and sits in
 * the open.
 *
 * The abbreviation is the part worth being careful about: it goes into every
 * Código this Provincia ever generates, and Códigos are globally unique, so two
 * Provincias sharing one would collide. The service enforces that; the field
 * just says so before somebody types the wrong thing.
 *
 * There is no Región field. A Provincia does not have one — the Campaña's
 * regions cut across provincial borders, so Región is asked for when adding a
 * Diócesis/Localidad, which is the level that actually belongs to one.
 */

export default function CrearProvincia() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [abreviatura, setAbreviatura] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The abbreviation has three rules — two to four characters, letters only, and
  // uniqueness — and only the third needs the server. The first two are told at
  // the moment the field is left, from the same schema the router parses.
  const validacion = useValidacionAlSalir(crearProvinciaSchema);

  return (
    <Dialogo
      titulo="Agregar una Provincia"
      etiquetaDelDisparador="Agregar una Provincia"
      alCerrar={() => setError(null)}
    >
      {(control) => (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            empezar(async () => {
              const resultado = await crearProvinciaAction({
                nombre,
                abreviatura,
              });
              if (!resultado.ok) {
                setError(resultado.error);
                return;
              }
              setNombre("");
              setAbreviatura("");
              validacion.limpiar();
              control.cerrar();
              router.refresh();
            });
          }}
        >
          <Campo
            etiqueta="Nombre"
            value={nombre}
            error={validacion.error("nombre")}
            onChange={(e) => {
              setNombre(e.target.value);
              validacion.alEscribir("nombre");
            }}
            onBlur={(e) => validacion.alSalir("nombre", e.target.value)}
            required
          />

          <Campo
            etiqueta="Abreviatura"
            ayuda="Dos a cuatro letras. Va en cada Código de esta Provincia — «CBA» en «CBA JOV 0001» — y no se puede repetir."
            value={abreviatura}
            maxLength={4}
            // The field's own rules first, then the refusal from the service —
            // which is the one rule about this abbreviation that no client can
            // know, because it is about the other Provincias.
            error={validacion.error("abreviatura") ?? error}
            onChange={(e) => {
              setAbreviatura(e.target.value.toUpperCase());
              validacion.alEscribir("abreviatura");
              setError(null);
            }}
            onBlur={(e) => validacion.alSalir("abreviatura", e.target.value)}
            required
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Boton type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </Boton>
            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={control.cerrar}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
