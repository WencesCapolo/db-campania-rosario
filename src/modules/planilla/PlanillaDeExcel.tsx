"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton, { BotonDescarga } from "@/components/Boton";
import Campo from "@/components/Campo";
import Dialogo from "@/components/Dialogo";
import Mensaje from "@/components/Mensaje";
import { MODALIDAD_LABELS } from "@/modules/peregrina/peregrina.types";
import { useModalidadPropia } from "@/modules/peregrina/ModalidadPropia";
import {
  importarPlanillaAction,
  revisarPlanillaAction,
} from "@/modules/planilla/planilla.router";
import type {
  RevisionDTO,
  TotalesDeCargaDTO,
} from "@/modules/planilla/planilla.types";
import { Revision, cantidad, resumen } from "./RevisionDePlanilla";

/**
 * Planilla de Excel — un botón en el encabezado de Peregrinas y de Misioneros,
 * y el mismo diálogo en las dos (ADR 0017).
 *
 * Primero pregunta qué se quiere hacer, y después avanza un paso por vez:
 *
 *   Importar  → 2. Bajar la plantilla → 3. Subirla para revisar → 4. Confirmar
 *   Exportar  → 2. Elegir qué lista se baja
 *
 * Importar: el archivo queda en el estado y no en el servidor. Revisar no
 * escribe nada; cargar sube el mismo archivo otra vez y el servidor lo revisa
 * de nuevo antes de escribir, todo o nada. Si alguien elige otro archivo, la
 * revisión anterior se descarta, porque describía otra cosa.
 *
 * Exportar: las dos listas, desde cualquiera de las dos pantallas. La de la
 * pantalla en que se está puede llevar los filtros que tiene puestos; la otra
 * va entera, porque sus filtros no están a la vista.
 *
 * Cerrar el diálogo lo deja como nuevo: cada vez que se abre arranca en la
 * pregunta, sin archivo y sin revisión.
 */

export type PantallaDePlanilla = "peregrina" | "misionero";

export const RUTA_DE_PLANTILLA = "/misionero/plantilla";

export default function PlanillaDeExcel(props: {
  pantalla: PantallaDePlanilla;
  /** Los filtros de la pantalla, como query string sin «?». */
  consultaDeFiltros: string;
  /** Cuántas filas trae la lista con esos filtros: el agregado, no la página. */
  total: number;
  filtrado: boolean;
}) {
  // Una clave nueva por cada cierre: el contenido se monta de cero.
  const [vez, setVez] = useState(0);

  return (
    <Dialogo
      titulo="Planilla de Excel"
      amplio
      conCerrar
      // Un toque al costado no tira el archivo elegido ni la revisión.
      cerrarConElFondo={false}
      alCerrar={() => setVez((v) => v + 1)}
      disparador={({ abrir }) => (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-control border-2 border-azul bg-papel px-5 text-base font-semibold text-azul hover:bg-lienzo"
        >
          <span aria-hidden>▦</span> Planilla de Excel
        </button>
      )}
    >
      {({ cerrar }) => <Pasos key={vez} {...props} cerrar={cerrar} />}
    </Dialogo>
  );
}

type Paso =
  | { n: "elegir" }
  | { n: "exportar" }
  | { n: "plantilla" }
  | { n: "subir" }
  | { n: "revisada"; revision: RevisionDTO }
  | { n: "cargada"; totales: TotalesDeCargaDTO };

const NUMERO: Record<Paso["n"], { n: number; de?: number; nombre: string }> = {
  elegir: { n: 1, nombre: "Elegir qué hacer" },
  exportar: { n: 2, de: 2, nombre: "Elegir qué se exporta" },
  plantilla: { n: 2, de: 4, nombre: "Bajar la plantilla" },
  subir: { n: 3, de: 4, nombre: "Subirla para revisar" },
  revisada: { n: 4, de: 4, nombre: "Confirmar" },
  cargada: { n: 4, de: 4, nombre: "Listo" },
};

function Pasos({
  pantalla,
  consultaDeFiltros,
  total,
  filtrado,
  cerrar,
}: {
  pantalla: PantallaDePlanilla;
  consultaDeFiltros: string;
  total: number;
  filtrado: boolean;
  cerrar: () => void;
}) {
  const router = useRouter();
  const propia = useModalidadPropia();
  const [paso, setPaso] = useState<Paso>({ n: "elegir" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const ir = (p: Paso) => {
    setError(null);
    setPaso(p);
  };

  const enviar = (accion: "revisar" | "cargar") => {
    if (!archivo) {
      setError("Elegí la planilla que querés subir.");
      return;
    }
    setError(null);
    const datos = new FormData();
    datos.set("archivo", archivo);

    empezar(async () => {
      if (accion === "revisar") {
        const r = await revisarPlanillaAction(datos);
        if (r.ok) setPaso({ n: "revisada", revision: r.data });
        else setError(r.error);
        return;
      }
      const r = await importarPlanillaAction(datos);
      if (r.ok) setPaso({ n: "cargada", totales: r.data });
      else setError(r.error);
    });
  };

  if (paso.n === "cargada") {
    return (
      <div className="mt-4 space-y-4">
        <Mensaje tono="exito">
          <p className="font-semibold">La planilla se cargó.</p>
          <p>{resumen(paso.totales, "Se cargaron")}</p>
        </Mensaje>
        <Boton
          onClick={() => {
            cerrar();
            // Las filas nuevas aparecen en la lista de abajo.
            router.refresh();
          }}
        >
          Listo, ver la lista
        </Boton>
      </div>
    );
  }

  const numero = NUMERO[paso.n];
  const filtrada = (de: PantallaDePlanilla) =>
    de === pantalla && filtrado
      ? {
          href: `/${pantalla}/planilla?${consultaDeFiltros}`,
          texto: `Sólo ${queSeBaja(pantalla, total)} de estos filtros`,
        }
      : null;

  return (
    <div className="mt-4 space-y-6">
      {/* El avance: el número y el nombre del paso, no sólo la barra. Hasta
          elegir no se sabe cuántos pasos son, así que el primero no dice «de». */}
      <div className="space-y-2">
        <p className="text-base font-semibold text-tinta">
          Paso {numero.n}
          {numero.de ? ` de ${numero.de}` : ""}: {numero.nombre}
        </p>
        {numero.de && (
          <ol className="flex gap-2" aria-hidden>
            {Array.from({ length: numero.de }, (_, i) => (
              <li
                key={i}
                className={`h-2 flex-1 rounded-full ${i < numero.n ? "bg-azul" : "bg-borde"}`}
              />
            ))}
          </ol>
        )}
      </div>

      {paso.n === "elegir" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Opcion
            titulo="Importar Planilla"
            bajada="Misioneros y Peregrinas"
            onClick={() => ir({ n: "plantilla" })}
          />
          <Opcion
            titulo="Exportar Planilla"
            bajada="Misioneros y Peregrinas"
            onClick={() => ir({ n: "exportar" })}
          />
        </div>
      )}

      {paso.n === "exportar" && (
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-tinta-suave">
            Una fila por cada una. Es para mirar o imprimir: no se vuelve a
            subir.
          </p>
          <ListaParaExportar
            titulo="Peregrinas"
            todo="Todas las Peregrinas"
            hrefTodo="/peregrina/planilla"
            filtrada={filtrada("peregrina")}
          />
          <ListaParaExportar
            titulo="Misioneros"
            todo="Todos los Misioneros"
            hrefTodo="/misionero/planilla"
            filtrada={filtrada("misionero")}
          />
          <Pie>
            <Boton tono="secundario" onClick={() => ir({ n: "elegir" })}>
              ← Volver
            </Boton>
          </Pie>
        </div>
      )}

      {paso.n === "plantilla" && (
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-tinta-suave">
            Cada fila es un Misionero nuevo y, si se le asigna una imagen, esa
            imagen: una ya cargada, por su Código, o una nueva, que queda
            registrada. Si una fila tiene un error no se carga ninguna.
          </p>
          <p className="text-base leading-relaxed text-tinta-suave">
            Bajá la plantilla y llenala en Excel: una fila por Misionero.
            {propia &&
              ` Tu usuario carga sólo imágenes de ${MODALIDAD_LABELS[propia]}.`}
          </p>
          <BotonDescarga href={RUTA_DE_PLANTILLA}>
            Descargar la plantilla
          </BotonDescarga>
          <Pie>
            <Boton tono="secundario" onClick={() => ir({ n: "elegir" })}>
              ← Volver
            </Boton>
            <Boton onClick={() => ir({ n: "subir" })}>
              Ya llené la planilla →
            </Boton>
          </Pie>
        </div>
      )}

      {paso.n === "subir" && (
        <div className="space-y-4">
          <p className="text-base leading-relaxed text-tinta-suave">
            Todavía no se carga nada: el sistema dice qué filas están bien y
            qué corregir en las demás.
          </p>
          <Campo
            etiqueta="La planilla llena"
            ayuda="Un archivo de Excel (.xlsx), de hasta 500 filas."
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          {error && <Mensaje tono="alerta">{error}</Mensaje>}
          <Pie>
            <Boton tono="secundario" onClick={() => ir({ n: "plantilla" })}>
              ← Volver
            </Boton>
            <Boton disabled={pendiente} onClick={() => enviar("revisar")}>
              {pendiente ? "Revisando…" : "Revisar la planilla"}
            </Boton>
          </Pie>
        </div>
      )}

      {paso.n === "revisada" && (
        <div className="space-y-4">
          <p className="text-base text-tinta-suave">
            Archivo:{" "}
            <span className="font-semibold text-tinta">{archivo?.name}</span>
          </p>
          <Revision revision={paso.revision} />
          {error && <Mensaje tono="alerta">{error}</Mensaje>}
          <Pie>
            <Boton
              tono="secundario"
              onClick={() => {
                // Otro archivo es otra revisión: la de ahora no vale para él.
                setArchivo(null);
                ir({ n: "subir" });
              }}
            >
              ← Subir otro archivo
            </Boton>
            {paso.revision.lista && (
              <Boton disabled={pendiente} onClick={() => enviar("cargar")}>
                {pendiente
                  ? "Cargando…"
                  : `Cargar ${cantidad(paso.revision.totales.misioneros, "Misionero", "Misioneros")}`}
              </Boton>
            )}
          </Pie>
        </div>
      )}
    </div>
  );
}

function queSeBaja(pantalla: PantallaDePlanilla, total: number): string {
  if (pantalla === "peregrina") {
    return total === 1 ? "1 imagen" : `las ${total} imágenes`;
  }
  return total === 1
    ? "1 persona o matrimonio"
    : `las ${total} personas y matrimonios`;
}

function Opcion({
  titulo,
  bajada,
  onClick,
}: {
  titulo: string;
  bajada: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 flex-col items-start gap-1 rounded-control border-2 border-borde-fuerte bg-papel p-4 text-left hover:border-azul hover:bg-lienzo"
    >
      <span className="flex w-full items-center justify-between gap-2 text-lg font-bold text-azul">
        {titulo} <span aria-hidden>→</span>
      </span>
      <span className="text-base leading-relaxed text-tinta-suave">
        {bajada}
      </span>
    </button>
  );
}

function ListaParaExportar({
  titulo,
  todo,
  hrefTodo,
  filtrada,
}: {
  titulo: string;
  todo: string;
  hrefTodo: string;
  filtrada: { href: string; texto: string } | null;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-bold text-tinta">{titulo}</h3>
      <div className="flex flex-col gap-3">
        {filtrada && (
          <BotonDescarga href={filtrada.href} anchoCompleto>
            {filtrada.texto}
          </BotonDescarga>
        )}
        <BotonDescarga
          href={hrefTodo}
          tono={filtrada ? "secundario" : "principal"}
          anchoCompleto
        >
          {filtrada ? `${todo}, sin filtros` : todo}
        </BotonDescarga>
      </div>
    </section>
  );
}

function Pie({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-t-2 border-borde pt-4">
      {children}
    </div>
  );
}
