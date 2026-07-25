"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/get-current-user";
import { TerritorioService } from "./territorio.service";
import {
  crearDiocesisLocalidadSchema,
  crearProvinciaSchema,
  renombrarDiocesisLocalidadSchema,
  renombrarProvinciaSchema,
} from "./territorio.types";
import type {
  ActionResult,
  DiocesisLocalidadDTO,
  ProvinciaDTO,
  UsoTerritorio,
} from "./territorio.types";
import type { Region } from "./territorio.schema";

/**
 * TerritorioRouter — Next.js server actions.
 *
 * Resolves the Actor, parses input with Zod so nothing invalid reaches a
 * service, delegates, revalidates. No business logic.
 */

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getRegionesAction(): Promise<readonly Region[]> {
  const actor = await getCurrentUser();
  return TerritorioService.listarRegiones(actor);
}

export async function getProvinciasAction(): Promise<ProvinciaDTO[]> {
  const actor = await getCurrentUser();
  return TerritorioService.listarProvincias(actor);
}

export async function getDiocesisLocalidadesAction(
  provinciaId?: string
): Promise<DiocesisLocalidadDTO[]> {
  const actor = await getCurrentUser();
  return TerritorioService.listarDiocesisLocalidades(actor, { provinciaId });
}

export async function getUsoDiocesisLocalidadAction(
  id: string
): Promise<UsoTerritorio> {
  const actor = await getCurrentUser();
  return TerritorioService.usoDeDiocesisLocalidad(actor, id);
}

export async function getUsoProvinciaAction(id: string): Promise<UsoTerritorio> {
  const actor = await getCurrentUser();
  return TerritorioService.usoDeProvincia(actor, id);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function crearProvinciaAction(
  input: unknown
): Promise<ActionResult<ProvinciaDTO>> {
  const actor = await getCurrentUser();

  const parsed = crearProvinciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const result = await TerritorioService.crearProvincia(actor, parsed.data);
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

export async function renombrarProvinciaAction(
  input: unknown
): Promise<ActionResult<ProvinciaDTO>> {
  const actor = await getCurrentUser();

  const parsed = renombrarProvinciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const result = await TerritorioService.renombrarProvincia(actor, parsed.data);
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

export async function darDeBajaProvinciaAction(
  id: string
): Promise<ActionResult<ProvinciaDTO>> {
  const actor = await getCurrentUser();

  const result = await TerritorioService.darDeBajaProvincia(actor, id);
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

export async function crearDiocesisLocalidadAction(
  input: unknown
): Promise<ActionResult<DiocesisLocalidadDTO>> {
  const actor = await getCurrentUser();

  const parsed = crearDiocesisLocalidadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const result = await TerritorioService.crearDiocesisLocalidad(actor, parsed.data);
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

export async function renombrarDiocesisLocalidadAction(
  input: unknown
): Promise<ActionResult<DiocesisLocalidadDTO>> {
  const actor = await getCurrentUser();

  const parsed = renombrarDiocesisLocalidadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primerError(parsed.error) };

  const result = await TerritorioService.renombrarDiocesisLocalidad(
    actor,
    parsed.data
  );
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

export async function darDeBajaDiocesisLocalidadAction(
  id: string
): Promise<ActionResult<DiocesisLocalidadDTO>> {
  const actor = await getCurrentUser();

  const result = await TerritorioService.darDeBajaDiocesisLocalidad(actor, id);
  if (result.ok) revalidatePath("/admin/territorio");

  return result;
}

/**
 * Users see one message at a time, and the first failing field is the one
 * their cursor is nearest.
 */
function primerError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}
