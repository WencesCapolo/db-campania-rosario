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
import type {
  ActionResult,
  AsignacionDTO,
  TenedorResueltoDTO,
  TenenciaDeTenedorDTO,
} from "./asignacion.types";
import { aResultado } from "@/lib/errors";
import { FILAS_POR_PAGINA } from "@/lib/paginacion";
import { z } from "zod";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  tenedorSchema,
  type TenedorDTO,
} from "@/modules/misionero/matrimonio.types";
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
 * Los Tenedores con las manos libres — la tarjeta del tablero, y el filtro «sin
 * imagen» del listado.
 *
 * Tenedores y no Misioneros: un matrimonio con las manos libres es **una** fila,
 * no dos, y ninguno de los dos esposos aparece por su cuenta (ADR 0010). Contaba
 * personas hasta que se lo rekeyeó, y entonces una pareja sin imagen figuraba dos
 * veces en una tarjeta que dice contar a quienes pueden recibir una.
 *
 * Scoped por el territorio del *Tenedor* y no por el de una imagen: la pregunta
 * es quién de acá podría recibir una. El de un matrimonio es el del esposo A.
 */
export async function getTenedoresSinPeregrinaAction(): Promise<
  TenedorResueltoDTO[]
> {
  const actor = await getCurrentUser();
  return AsignacionService.listarTenedoresSinPeregrina(actor);
}

/**
 * Los Tenedores que tienen alguna imagen a cargo — el filtro «sólo los que
 * tienen alguna» del listado.
 *
 * El mismo scope que su gemela: por el territorio del *Tenedor*. Una Peregrina
 * que se movió de Diócesis sigue estando en la casa donde está.
 */
export async function getTenedoresConPeregrinaAction(): Promise<
  TenedorResueltoDTO[]
> {
  const actor = await getCurrentUser();
  return AsignacionService.listarTenedoresConPeregrina(actor);
}

/**
 * Qué imagen tiene cada Tenedor de una página — la columna «¿Tiene imagen?».
 *
 * Lleva Tenedores enteros y no ids sueltos, y eso no es ceremonia: el id de una
 * persona y el de un matrimonio viven en espacios distintos, así que un id solo
 * no dice contra qué columna buscarse. Mientras llevó ids de Misionero, la fila
 * de una pareja preguntaba por un id que no existe en `misionero` y la celda
 * contestaba «Ninguna» con la imagen adentro de la casa.
 *
 * La lista se parsea acá como todo lo demás, y viene topeada por el tamaño de
 * página: esto contesta por las filas que se están mostrando, no por un
 * territorio entero de una vez.
 */
export async function getTenenciasDeTenedoresAction(
  tenedores: unknown
): Promise<TenenciaDeTenedorDTO[]> {
  const actor = await getCurrentUser();
  const parsed = tenedoresDeUnaPaginaSchema.parse(tenedores ?? []);
  return AsignacionService.tenenciasDeTenedores(actor, parsed);
}

const tenedoresDeUnaPaginaSchema = z
  .array(tenedorSchema)
  .max(FILAS_POR_PAGINA);

/**
 * The two lists the stepped assignment flow needs, in one round trip.
 *
 * "Paso 1: Elegir Misionero" then "Paso 2: Elegir Imagen" — fetching them
 * together means the second step does not wait on a request when the first is
 * answered, which on a phone in a parish hall is the difference between one
 * pause and two.
 */
export async function getOpcionesParaAsignarAction(): Promise<{
  tenedores: TenedorDTO[];
  peregrinas: PeregrinaDTO[];
}> {
  const actor = await getCurrentUser();
  // Every Peregrina, not only the free ones: each carries its tenencia actual, so
  // the flow can tell whoever is holding the phone that the image is out and who
  // has it — and then close that period instead of refusing. Hiding held images
  // would make "she passed it on to me" an unrepresentable sentence, which is user
  // story 1.
  //
  // El roster colapsado y no `listAll`, que sigue contestando en personas: acá se
  // ofrece **quién puede recibir una imagen**, y un Misionero casado no puede
  // recibirla solo (ADR 0010). `asignar` lo rechaza igual, pero ofrecer una opción
  // que siempre termina en un rechazo es peor bug que el rechazo — y ponerla en el
  // picker es ponerla en el listado, que es la tercera fila que el Matrimonio vino
  // a sacar.
  const [tenedores, peregrinas] = await Promise.all([
    MisioneroService.listFiltrados(actor, {}),
    PeregrinaService.listAll(actor),
  ]);
  return { tenedores, peregrinas };
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

  if (result.ok) {
    revalidarTenencia(parsed.data.peregrinaId, result.data.tenedor);
  }

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
    revalidarTenencia(parsed.data.peregrinaId, result.data.abierta.tenedor);
    // The outgoing Tenedor's own page changed too.
    revalidarTenedor(result.data.cerrada.tenedor);
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
    revalidarTenencia(parsed.data.peregrinaId, result.data.tenedor);
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
    revalidarTenencia(result.data.peregrina.id, result.data.tenedor);
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Every surface that shows who has what, after a change of charge. */
function revalidarTenencia(
  peregrinaId: string,
  tenedor: TenedorResueltoDTO
): void {
  revalidatePath("/peregrina");
  revalidatePath(`/peregrina/${peregrinaId}`);
  revalidatePath(`/peregrina/${peregrinaId}/historial`);
  revalidatePath("/misionero");
  revalidarTenedor(tenedor);
}

/**
 * La página del Tenedor, sea de quién sea.
 *
 * Para un Matrimonio se invalidan **también** las de los dos cónyuges: cada
 * persona tiene su propia página, y lo que muestra de lo que tiene a cargo ahora
 * pasa por la pareja. Invalidar sólo `/misionero/<matrimonio>` dejaría las dos
 * páginas de las personas mostrando lo de ayer.
 */
function revalidarTenedor(tenedor: TenedorResueltoDTO): void {
  if (tenedor.tipo === "persona") {
    revalidatePath(`/misionero/${tenedor.id}`);
    return;
  }
  revalidatePath(`/matrimonio/${tenedor.id}`);
  revalidatePath(`/misionero/${tenedor.matrimonio.misioneroA.id}`);
  revalidatePath(`/misionero/${tenedor.matrimonio.misioneroB.id}`);
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
