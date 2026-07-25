import { db } from "@/db";
import { users } from "@/db/schema/users";
import type { Role } from "@/db/schema/users";
import {
  diocesisLocalidad,
  provincia,
} from "@/modules/territorio/territorio.schema";
import type { Region } from "@/modules/territorio/territorio.schema";
import { peregrina } from "@/modules/peregrina/peregrina.schema";
import type { Modalidad, PeregrinaTipo } from "@/modules/peregrina/peregrina.schema";
import { misionero } from "@/modules/misionero/misionero.schema";
import type { CurrentUser } from "@/modules/user/user.types";

/**
 * Fixtures for the service-seam suite.
 *
 * The one seam is the service: a test fabricates an Actor, calls
 * `Service.method(actor, input)` against a real Postgres, and asserts on what
 * comes back. Nothing here reaches into a repository to assert on row shapes.
 */

let contador = 0;
function siguiente(): number {
  contador += 1;
  return contador;
}

// ── Actor ─────────────────────────────────────────────────────────────────────

/**
 * Creates a real Usuario row and returns the Actor for it.
 *
 * The row is real because every entity carries `createdById` as a foreign key —
 * an Actor with no row cannot create anything, which is exactly the property
 * issue #2 will come to rely on.
 */
export async function crearActor(opts: {
  rol: Role;
  diocesisLocalidadId?: string | null;
}): Promise<CurrentUser> {
  const id = `usuario-de-prueba-${siguiente()}`;

  await db.insert(users).values({
    id,
    role: opts.rol,
    diocesisLocalidadId: opts.diocesisLocalidadId ?? null,
  });

  return {
    id,
    role: opts.rol,
    email: `${id}@ejemplo.test`,
    displayName: null,
    diocesisLocalidadId: opts.diocesisLocalidadId ?? null,
  };
}

/**
 * The system actor: an explicit, visible stand-in for the operations that are
 * genuinely unscoped — seeds, migrations, cron. ADR 0001 requires the intent to
 * be legible rather than implied by an absent parameter.
 */
export async function crearActorDeSistema(): Promise<CurrentUser> {
  return crearActor({ rol: "admin" });
}

// ── Territorio ────────────────────────────────────────────────────────────────

export async function crearProvincia(opts: {
  nombre: string;
  abreviatura: string;
  region: Region;
}): Promise<{ id: string; nombre: string; abreviatura: string; region: Region }> {
  const [row] = await db
    .insert(provincia)
    .values({
      nombre: opts.nombre,
      abreviatura: opts.abreviatura,
      region: opts.region,
    })
    .returning();
  if (!row) throw new Error("No se pudo crear la Provincia de prueba");
  return {
    id: row.id,
    nombre: row.nombre,
    abreviatura: row.abreviatura,
    region: row.region,
  };
}

export async function crearDiocesisLocalidad(opts: {
  nombre: string;
  provinciaId: string;
}): Promise<{ id: string; nombre: string }> {
  const [row] = await db
    .insert(diocesisLocalidad)
    .values({ nombre: opts.nombre, provinciaId: opts.provinciaId })
    .returning();
  if (!row) throw new Error("No se pudo crear la Diócesis/Localidad de prueba");
  return { id: row.id, nombre: row.nombre };
}

/**
 * Two Provincias in different Regiones, each with two Diócesis.
 *
 * Deliberately a country and not a single territory: a scoping test that only
 * has one Provincia to look at cannot prove that the other one stays invisible,
 * and the negative half is the test.
 */
export async function crearTerritorioDePrueba() {
  const cordoba = await crearProvincia({
    nombre: "Córdoba",
    abreviatura: "CBA",
    region: "CENTRO",
  });
  const neuquen = await crearProvincia({
    nombre: "Neuquén",
    abreviatura: "NEU",
    region: "R. PAT",
  });

  return {
    cordoba,
    neuquen,
    villaMaria: await crearDiocesisLocalidad({
      nombre: "Villa María",
      provinciaId: cordoba.id,
    }),
    rioCuarto: await crearDiocesisLocalidad({
      nombre: "Río Cuarto",
      provinciaId: cordoba.id,
    }),
    zapala: await crearDiocesisLocalidad({
      nombre: "Zapala",
      provinciaId: neuquen.id,
    }),
    chosMalal: await crearDiocesisLocalidad({
      nombre: "Chos Malal",
      provinciaId: neuquen.id,
    }),
  };
}

export type TerritorioDePrueba = Awaited<
  ReturnType<typeof crearTerritorioDePrueba>
>;

// ── Peregrina y Misionero ─────────────────────────────────────────────────────
// These insert directly rather than going through their services, because they
// are the *setup* for a territorio test, not the thing under test. A test of
// Peregrina's own behaviour calls PeregrinaService.

export async function crearPeregrinaDirecta(opts: {
  diocesisLocalidadId: string;
  createdById: string;
  modalidad?: Modalidad;
  tipo?: PeregrinaTipo;
}): Promise<{ id: string; codigo: string }> {
  const n = siguiente();
  const [row] = await db
    .insert(peregrina)
    .values({
      codigo: `TST ${opts.modalidad ?? "JOV"} ${String(n).padStart(4, "0")}`,
      codigoNum: n,
      tipo: opts.tipo ?? "peregrina",
      estado: "activa",
      modalidad: opts.modalidad ?? "JOV",
      diocesisLocalidadId: opts.diocesisLocalidadId,
      createdById: opts.createdById,
    })
    .returning();
  if (!row) throw new Error("No se pudo crear la Peregrina de prueba");
  return { id: row.id, codigo: row.codigo };
}

export async function crearMisioneroDirecto(opts: {
  diocesisLocalidadId: string;
  createdById: string;
  nombre?: string;
  apellido?: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(misionero)
    .values({
      nombre: opts.nombre ?? "María",
      apellido: opts.apellido ?? `Pérez ${siguiente()}`,
      estado: "activo",
      diocesisLocalidadId: opts.diocesisLocalidadId,
      createdById: opts.createdById,
    })
    .returning();
  if (!row) throw new Error("No se pudo crear el Misionero de prueba");
  return { id: row.id };
}
