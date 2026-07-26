import type { ActionResult } from "./action-result";

/**
 * Typed domain errors, and the one place they become responses.
 *
 * A service throws. A router calls `aResultado`. Nothing in between decides how
 * a failure is worded or which shape it takes, which is the point: an
 * authorization refusal and a mistyped año must not arrive at the UI looking
 * identical, and they did before this file existed.
 */

export type CodigoDeError =
  | "no_autorizado"
  | "no_encontrado"
  | "validacion"
  | "conflicto";

export class ErrorDeDominio extends Error {
  readonly codigo: CodigoDeError;

  /**
   * The message shown to the Usuario. Spanish, always — this is not an internal
   * string that a translation layer picks up later. There is no such layer.
   */
  readonly mensaje: string;

  constructor(codigo: CodigoDeError, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.name = new.target.name;
  }
}

/**
 * The Actor may not do this, or may not do it here.
 *
 * Every construction of this error is logged by the caller that raises it — see
 * `registrarDenegacion`. A refusal nobody can find in a log is a
 * misconfiguration nobody can diagnose.
 */
export class NoAutorizadoError extends ErrorDeDominio {
  constructor(mensaje: string = SIN_PERMISOS) {
    super("no_autorizado", mensaje);
  }
}

export class NoEncontradoError extends ErrorDeDominio {
  constructor(mensaje: string) {
    super("no_encontrado", mensaje);
  }
}

export class ValidacionError extends ErrorDeDominio {
  constructor(mensaje: string) {
    super("validacion", mensaje);
  }
}

/** The request is well-formed but the world says no — a duplicate, a race. */
export class ConflictoError extends ErrorDeDominio {
  constructor(mensaje: string) {
    super("conflicto", mensaje);
  }
}

// ── Mensajes ──────────────────────────────────────────────────────────────────
// Kept together so the wording is consistent wherever a refusal surfaces. These
// are read by people entering records by hand: they say what the boundary is,
// and who can move it, rather than "forbidden".

export const SIN_PERMISOS =
  "No tenés permisos para hacer esto. Si necesitás hacerlo, pedíselo a quien te dio el acceso.";

export const FUERA_DE_TERRITORIO =
  "Ese registro es de otro territorio, así que no podés verlo ni modificarlo.";

export const SIN_AUTORIZACION =
  "Tu cuenta todavía no está autorizada para usar el sistema. " +
  "Pedile a un Asesor Nacional o a tu Responsable Diocesano que te invite.";

export const CUENTA_DADA_DE_BAJA =
  "Tu acceso fue dado de baja. Si esto es un error, pedíselo a un Asesor Nacional.";

export const SIN_TERRITORIO_ASIGNADO =
  "Tu usuario no tiene una Diócesis/Localidad asignada, así que no se puede " +
  "determinar qué te corresponde ver. Pedile a un Asesor Nacional que la asigne.";

// ── La única traducción de error a respuesta ───────────────────────────────────

/**
 * Runs a service call and maps whatever it throws onto an `ActionResult`.
 *
 * Routers wrap every delegation in this. A domain error becomes its own Spanish
 * message and its `codigo`; anything else is a bug, so it is logged in full and
 * reported as a generic failure rather than leaking a stack trace or a database
 * message into the UI.
 */
export async function aResultado<T>(
  operacion: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operacion() };
  } catch (error) {
    if (error instanceof ErrorDeDominio) {
      return { ok: false, error: error.mensaje, codigo: error.codigo };
    }

    console.error("[error-inesperado]", error);
    return {
      ok: false,
      error: "Algo falló al guardar. Probá de nuevo en un momento.",
    };
  }
}

/**
 * The same mapping for a service that already returns an `ActionResult` —
 * validation failures it reports itself, authorization failures it throws.
 */
export async function aResultadoPlano<T>(
  operacion: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  const resultado = await aResultado(operacion);
  return resultado.ok ? resultado.data : resultado;
}
