import type { PeregrinaEstado, PeregrinaTipo, Region, Modalidad } from "./peregrina.schema";

// ── DTO (what the UI receives) ────────────────────────────────────────────────

export interface PeregrinaDTO {
  id: string;
  codigo: string;
  tipo: PeregrinaTipo;
  estado: PeregrinaEstado;
  region: Region;
  provincia: string;
  diocesisLocalidad: string;
  modalidad: Modalidad;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CreatePeregrinaInput {
  tipo: PeregrinaTipo;
  region: Region;
  provincia: string;
  diocesisLocalidad: string;
  modalidad: Modalidad;
}

export interface UpdatePeregrinaInput {
  tipo?: PeregrinaTipo;
  estado?: PeregrinaEstado;
  region?: Region;
  provincia?: string;
  diocesisLocalidad?: string;
  modalidad?: Modalidad;
}

// ── Result pattern ────────────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
