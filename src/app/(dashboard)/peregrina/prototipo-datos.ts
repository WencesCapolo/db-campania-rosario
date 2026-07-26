import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * PROTOTIPO — throwaway. Delete with the variants once one has won.
 *
 * Fixtures rather than the database on purpose: the question these variants
 * answer is "what should this look like", and a read-only prototype must not
 * depend on somebody having typed twelve Peregrinas into a real Neon project
 * first. The shapes are the real `PeregrinaDTO`, so a variant cannot quietly
 * render a field the actual service does not return.
 *
 * The mix is deliberate and is the interesting part of the judging:
 *   - an `extraviada` image that still has an open Asignación, because the last
 *     holder is the only lead anybody has and no variant may hide it,
 *   - an `inactiva` one, the legacy Estado that must keep displaying,
 *   - images with nobody holding them, which is the common case,
 *   - a long Misionero name, because that is what breaks a table.
 */

const CORDOBA = {
  id: "prov-cba",
  nombre: "Córdoba",
  abreviatura: "CBA",
  region: "CENTRO" as const,
  deBaja: false,
};

const diocesis = (id: string, nombre: string) => ({
  id,
  nombre,
  deBaja: false,
  provincia: CORDOBA,
  region: CORDOBA.region,
});

const VILLA_MARIA = diocesis("dl-vm", "Villa María");
const RIO_CUARTO = diocesis("dl-rc", "Río Cuarto");
const CORDOBA_CAPITAL = diocesis("dl-cc", "Córdoba Capital");

const base = {
  provincia: CORDOBA.nombre,
  region: CORDOBA.region,
  deBaja: false,
  createdById: "sistema",
  createdAt: new Date("2026-02-01T12:00:00Z"),
  updatedAt: new Date("2026-07-01T12:00:00Z"),
};

export const PEREGRINAS_DE_PROTOTIPO: PeregrinaDTO[] = [
  {
    ...base,
    id: "p-1",
    codigo: "CBA JOV 0001",
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: VILLA_MARIA,
    tenenciaActual: {
      misioneroId: "m-1",
      nombre: "María Soledad",
      apellido: "Fernández Iturraspe",
      deBaja: false,
    },
  },
  {
    ...base,
    id: "p-2",
    codigo: "CBA JOV 0002",
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: VILLA_MARIA,
    tenenciaActual: null,
  },
  {
    ...base,
    id: "p-3",
    codigo: "CBA FAM 0001",
    tipo: "peregrina",
    estado: "extraviada",
    modalidad: "FAM",
    diocesisLocalidad: RIO_CUARTO,
    // Open on purpose. An extraviada image keeps its Asignación open, because
    // closing it deletes the answer to "who had it".
    tenenciaActual: {
      misioneroId: "m-2",
      nombre: "Jorge",
      apellido: "Pereyra",
      deBaja: false,
    },
  },
  {
    ...base,
    id: "p-4",
    codigo: "CBA FAM 0002",
    tipo: "auxiliar",
    estado: "en_reparacion",
    modalidad: "FAM",
    diocesisLocalidad: RIO_CUARTO,
    tenenciaActual: null,
  },
  {
    ...base,
    id: "p-5",
    codigo: "CBA INF 0001",
    tipo: "peregrina",
    estado: "activa",
    modalidad: "INF",
    diocesisLocalidad: CORDOBA_CAPITAL,
    tenenciaActual: {
      misioneroId: "m-3",
      nombre: "Ana",
      apellido: "Gutiérrez",
      deBaja: false,
    },
  },
  {
    ...base,
    id: "p-6",
    codigo: "CBA ADU 0001",
    tipo: "peregrina",
    estado: "inactiva",
    modalidad: "ADU",
    diocesisLocalidad: CORDOBA_CAPITAL,
    tenenciaActual: null,
  },
  {
    ...base,
    id: "p-7",
    codigo: "CBA ADU 0002",
    tipo: "auxiliar",
    estado: "activa",
    modalidad: "ADU",
    diocesisLocalidad: VILLA_MARIA,
    tenenciaActual: {
      misioneroId: "m-4",
      nombre: "Roberto Carlos",
      apellido: "Del Valle Sarmiento",
      deBaja: false,
    },
  },
  {
    ...base,
    id: "p-8",
    codigo: "CBA JOV 0003",
    tipo: "peregrina",
    estado: "activa",
    modalidad: "JOV",
    diocesisLocalidad: CORDOBA_CAPITAL,
    tenenciaActual: null,
  },
];

export const MODALIDAD_LABELS: Record<string, string> = {
  JOV: "Jóvenes",
  FAM: "Familias",
  INF: "Infancia",
  ADU: "Adultos",
};

export const TIPO_LABELS: Record<string, string> = {
  peregrina: "Peregrina",
  auxiliar: "Auxiliar",
};
