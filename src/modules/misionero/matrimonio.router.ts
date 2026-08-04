"use server";

import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import { MatrimonioService } from "./matrimonio.service";
import {
  createMatrimonioSchema,
  updateMatrimonioSchema,
  type MatrimonioDTO,
} from "./matrimonio.types";
import { filtrosDeMisioneroSchema } from "./misionero.types";
import type { ActionResult } from "./misionero.types";
import { aResultado } from "@/lib/errors";
import { paginaSchema, type Pagina } from "@/lib/paginacion";

/**
 * MatrimonioRouter — Next.js server actions
 *
 * Responsibility: resolve the Actor, parse input with Zod, delegate, revalidate,
 * and map thrown domain errors onto a result. No business logic lives here.
 *
 * `/misionero` is revalidated by every write, not only `/matrimonio`: a couple
 * *is* a row of the Misionero roster, and its two spouses are two rows that stop
 * being there. Entering a Matrimonio changes that list by three.
 */

export async function getMatrimonioByIdAction(
  id: string
): Promise<MatrimonioDTO> {
  const actor = await getCurrentUser();
  return MatrimonioService.get(actor, id);
}

/** The couples, one page at a time — the filters are the shared ones. */
export async function getMatrimoniosPaginadosAction(
  filtros: unknown,
  pagina: unknown
): Promise<Pagina<MatrimonioDTO>> {
  const actor = await getCurrentUser();
  const parsedFiltros = filtrosDeMisioneroSchema.parse(filtros ?? {});
  const parsedPagina = paginaSchema.parse(pagina ?? 1);
  return MatrimonioService.listPagina(actor, parsedFiltros, parsedPagina);
}

export async function createMatrimonioAction(
  input: unknown
): Promise<ActionResult<MatrimonioDTO>> {
  const actor = await getCurrentUser();

  const parsed = createMatrimonioSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    MatrimonioService.create(actor, parsed.data)
  );

  if (result.ok) revalidatePath("/misionero");

  return result;
}

export async function updateMatrimonioAction(
  id: string,
  input: unknown
): Promise<ActionResult<MatrimonioDTO>> {
  const actor = await getCurrentUser();

  const parsed = updateMatrimonioSchema.safeParse(input);
  if (!parsed.success) return invalido(parsed.error);

  const result = await aResultado(() =>
    MatrimonioService.update(actor, id, parsed.data)
  );

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/matrimonio/${id}`);
  }

  return result;
}

/**
 * Ends a Matrimonio.
 *
 * There is no delete action, for the reason there is none for a Misionero:
 * destroying the row would destroy the answer to "who had this image", which is
 * what every closed Asignación pointing here is for.
 */
export async function darDeBajaMatrimonioAction(
  id: string
): Promise<ActionResult<MatrimonioDTO>> {
  const actor = await getCurrentUser();
  const result = await aResultado(() => MatrimonioService.baja(actor, id));

  if (result.ok) {
    revalidatePath("/misionero");
    revalidatePath(`/matrimonio/${id}`);
  }

  return result;
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
