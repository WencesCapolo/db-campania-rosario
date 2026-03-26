import type { MisioneroEstado, CentroTipo } from "./misionero.schema";

// ── DTO (what the UI receives) ────────────────────────────────────────────────

export interface MisioneroDTO {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  estado: MisioneroEstado;
  region: string;
  provincia: string;
  diocesisLocalidad: string;
  centroTipo: CentroTipo | null;
  centroNombre: string | null;
  anioConsagracion: number | null;
  /** { [year: string]: string } */
  resumenesAnuales: Record<string, string>;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CreateMisioneroInput {
  nombre: string;
  apellido: string;
  telefono?: string | null;
  region: string;
  provincia: string;
  diocesisLocalidad: string;
  centroTipo?: CentroTipo | null;
  centroNombre?: string | null;
  anioConsagracion?: number | null;
}

export interface UpdateMisioneroInput {
  nombre?: string;
  apellido?: string;
  telefono?: string | null;
  estado?: MisioneroEstado;
  region?: string;
  provincia?: string;
  diocesisLocalidad?: string;
  centroTipo?: CentroTipo | null;
  centroNombre?: string | null;
  anioConsagracion?: number | null;
  /** FK to peregrina — null unassigns */
  peregrinaId?: string | null;
}

export interface AddResumenAnualInput {
  misioneroId: string;
  year: number;
  resumen: string;
}

// ── Result pattern ────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
