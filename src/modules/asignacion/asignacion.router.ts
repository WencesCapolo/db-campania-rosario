"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import { AsignacionService } from "./asignacion.service";
import {
  asignarSchema,
  corregirSchema,
  devolverSchema,
  entregarSchema,
} from "./asignacion.types";
import type { ActionResult, AsignacionDTO } from "./asignacion.types";
import { aResultado } from "@/lib/errors";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import type { MisioneroDTO } from "@/modules/misionero/misionero.types";
import type { PeregrinaDTO } from "@/modules/peregrina/peregrina.types";

/**
 * AsignacionRouter — Next.js server actions
 *
 * Responsibility: resolve the Actor, parse input with Zod so nothing invalid
 * reaches a service, delegate, revalidate the cache, and map thrown domain errors
 * onto a result. No business logic lives here.
 *
 * This is now the *only* way charge of a Peregrina changes. The old
 * `assignPeregrinaAction` on the Misionero router is gone: it overwrote a pointer,
 * which lost the previous holder and skipped the invariant.
 *
 * Reads let the error through to the page's error boundary rather than swallowing
 * it into an empty list. A chain of custody somebody may not see must not render
 * as "sin historial", which would confirm the record exists.
 */

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getHistorialDePeregrinaAction(
  peregrinaId: string
): Promise<AsignacionDTO[]> {
  const actor = await getCurrentUser();
  return AsignacionService.historialDePeregrina(actor, peregrinaId);
}

export async function getHistorialDeMisioneroAction(
  misioneroId: string
): Promise<AsignacionDTO[]> {
  const actor = await getCurrentUser();
  return AsignacionService.historialDeMisionero(actor, misioneroId);
}

export async function getTenenciaActualAction(
  peregrinaId: string
): Promise<AsignacionDTO | null> {
  const actor = await getCurrentUser();
  return AsignacionService.tenenciaActual(actor, peregrinaId);
}

export async function getPeregrinasNuncaAsignadasAction(): Promise<
  { id: string; codigo: string }[]
> {
  const actor = await getCurrentUser();
  return AsignacionService.listarNuncaAsignadas(actor);
}

/**
 * Los Misioneros con las manos libres — la tarjeta del tablero, y el filtro «sin
 * imagen» del listado de Misioneros.
 *
 * Scoped por el territorio de la *persona* y no por el de una imagen: la pregunta
 * es quién de acá podría recibir una.
 */
export async function getMisionerosSinPeregrinaAction(): Promise<
  { id: string; nombre: string; apellido: string }[]
> {
  const actor = await getCurrentUser();
  return AsignacionService.listarMisionerosSinPeregrina(actor);
}

/**
 * The two lists the stepped assignment flow needs, in one round trip.
 *
 * "Paso 1: Elegir Misionero" then "Paso 2: Elegir Imagen" — fetching them
 * together means the second step does not wait on a request when the first is
 * answered, which on a phone in a parish hall is the difference between one
 * pause and two.
 */
export async function getOpcionesParaAsignarAction(): Promise<{
  misioneros: MisioneroDTO[];
  peregrinas: PeregrinaDTO[];
}> {
  const actor = await getCurrentUser();
  // Every Peregrina, not only the free ones: each carries its tenencia actual, so
  // the flow can tell whoever is holding the phone that the image is out and who
  // has it — and then close that period instead of refusing. Hiding held images
  // would make "she passed it on to me" an unrepresentable sentence, which is user
  // story 1.
  const [misioneros, peregrinas] = await Promise.all([
    MisioneroService.listAll(actor),
    PeregrinaService.listAll(actor),
  ]);
  return { misioneros, peregrinas };
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function asignarAction(
  input: unknown
): Promise<ActionResult<AsignacionDTO>> {
  const actor = await getCurrentUser();

  const parsed = asignarSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    AsignacionService.asignar(actor, parsed.data)
  );

  if (result.ok) revalidarTenencia(parsed.data.peregrinaId, parsed.data.misioneroId);

  return result;
}

export async function entregarAction(
  input: unknown
): Promise<ActionResult<{ cerrada: AsignacionDTO; abierta: AsignacionDTO }>> {
  const actor = await getCurrentUser();

  const parsed = entregarSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    AsignacionService.entregar(actor, parsed.data)
  );

  if (result.ok) {
    revalidarTenencia(parsed.data.peregrinaId, parsed.data.misioneroId);
    // The outgoing Misionero's own page changed too.
    revalidatePath(`/misionero/${result.data.cerrada.misionero.id}`);
  }

  return result;
}

export async function devolverAction(
  input: unknown
): Promise<ActionResult<AsignacionDTO>> {
  const actor = await getCurrentUser();

  const parsed = devolverSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    AsignacionService.devolver(actor, parsed.data)
  );

  if (result.ok) {
    revalidarTenencia(parsed.data.peregrinaId, result.data.misionero.id);
  }

  return result;
}

export async function corregirAsignacionAction(
  input: unknown
): Promise<ActionResult<AsignacionDTO>> {
  const actor = await getCurrentUser();

  const parsed = corregirSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    AsignacionService.corregir(actor, parsed.data)
  );

  if (result.ok) {
    revalidarTenencia(result.data.peregrina.id, result.data.misionero.id);
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Every surface that shows who has what, after a change of charge. */
function revalidarTenencia(peregrinaId: string, misioneroId: string): void {
  revalidatePath("/peregrina");
  revalidatePath(`/peregrina/${peregrinaId}`);
  revalidatePath(`/peregrina/${peregrinaId}/historial`);
  revalidatePath("/misionero");
  revalidatePath(`/misionero/${misioneroId}`);
}

/**
 * Users see one message at a time, and the first failing field is the one
 * their cursor is nearest.
 */
function invalido(error: { issues: { message: string }[] }): {
  ok: false;
  error: string;
  codigo: "validacion";
} {
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Datos inválidos.",
    codigo: "validacion",
  };
}
