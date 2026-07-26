"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton from "@/components/Boton";
import Campo from "@/components/Campo";
import Eleccion from "@/components/Eleccion";
import { crearDiocesisLocalidadAction } from "@/modules/territorio/territorio.router";
import type { ProvinciaDTO } from "@/modules/territorio/territorio.types";
import { REGIONES } from "@/modules/territorio/territorio.schema";

/**
 * Agregar una Diócesis/Localidad.
 *
 * The screen the system could not be used without. Provincias are seeded, but a
 * Diócesis/Localidad is local knowledge nobody can ship a table of — and every
 * Peregrina, every Misionero and every Usuario with a territorial rol points at
 * one, so with none of them the whole application is unusable and says nothing
 * about why.
 *
 * "Guardar y agregar otra" because these get typed in a batch, and focus returns
 * to the name field afterwards so the next one can be typed without reaching for
 * the mouse — story 13, the same reason the Peregrina form has it.
 *
 * The confirmation names what was created rather than saying "listo", so
 * somebody entering fifteen of them can see the fourteenth landed.
 *
 * Región is asked for here and not derived from the Provincia, because it is
 * not derivable: Santa Fe holds Diócesis in NEA and in CENTRO, Buenos Aires
 * holds Diócesis in BS. AS and in R. PAM. The person adding it is the one who
 * knows which.
 */

export default function CrearDiocesis({
  provincias,
}: {
  provincias: ProvinciaDTO[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [nombre, setNombre] = useState("");
  const [provinciaId, setProvinciaId] = useState(provincias[0]?.id ?? "");
  const [region, setRegion] = useState<string>(REGIONES[0]);
  const [error, setError] = useState<string | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);

  function guardar(seguirCargando: boolean) {
    setError(null);
    setUltima(null);

    empezar(async () => {
      const resultado = await crearDiocesisLocalidadAction({
        nombre,
        provinciaId,
        region,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setUltima(
        `${resultado.data.nombre} (${resultado.data.provincia.nombre})`
      );
      setNombre("");
      router.refresh();

      if (seguirCargando) {
        document.getElementById("nombre-de-diocesis")?.focus();
      }
    });
  }

  if (provincias.length === 0) {
    return (
      <p className="text-base leading-relaxed text-tinta-suave">
        No hay Provincias activas. Agregá una antes de cargar
        Diócesis/Localidades.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
      }}
    >
      {ultima && (
        <p
          role="status"
          className="rounded-control border-2 border-exito-tinta bg-exito-fondo p-4 text-base font-semibold text-exito-tinta"
        >
          Se agregó {ultima}.
        </p>
      )}

      <Campo
        id="nombre-de-diocesis"
        etiqueta="Nombre de la Diócesis o Localidad"
        ayuda="Como se la nombra en la Campaña, por ejemplo «Villa María»."
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        error={error}
        required
      />

      <Eleccion
        etiqueta="Provincia"
        opciones={provincias.map((p) => ({
          valor: p.id,
          etiqueta: `${p.nombre} (${p.abreviatura})`,
        }))}
        value={provinciaId}
        onChange={(e) => setProvinciaId(e.target.value)}
      />

      <Eleccion
        etiqueta="Región"
        ayuda="La Región pastoral de esta Diócesis, que no siempre es la de su Provincia: Reconquista es NEA y Rosario es CENTRO, y las dos están en Santa Fe."
        opciones={REGIONES.map((r) => ({ valor: r, etiqueta: r }))}
        value={region}
        onChange={(e) => setRegion(e.target.value)}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Boton type="submit" disabled={pendiente || !nombre.trim()}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Boton>
        <Boton
          tono="secundario"
          disabled={pendiente || !nombre.trim()}
          onClick={() => guardar(true)}
        >
          Guardar y agregar otra
        </Boton>
      </div>
    </form>
  );
}
