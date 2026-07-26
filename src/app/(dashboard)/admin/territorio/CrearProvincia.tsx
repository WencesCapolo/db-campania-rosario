"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import Dialogo from "@/components/Dialogo";
import { crearProvinciaAction } from "@/modules/territorio/territorio.router";
import { REGIONES } from "@/modules/territorio/territorio.schema";

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
 */

export default function CrearProvincia() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [abreviatura, setAbreviatura] = useState("");
  const [region, setRegion] = useState<string>(REGIONES[0]);
  const [error, setError] = useState<string | null>(null);

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
                region,
              });
              if (!resultado.ok) {
                setError(resultado.error);
                return;
              }
              setNombre("");
              setAbreviatura("");
              control.cerrar();
              router.refresh();
            });
          }}
        >
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <Campo
            etiqueta="Abreviatura"
            ayuda="Dos a cuatro letras. Va en cada Código de esta Provincia — «CBA» en «CBA JOV 0001» — y no se puede repetir."
            value={abreviatura}
            onChange={(e) => setAbreviatura(e.target.value.toUpperCase())}
            maxLength={4}
            error={error}
            required
          />

          <Eleccion
            etiqueta="Región"
            opciones={REGIONES.map((r) => ({ valor: r, etiqueta: r }))}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
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
