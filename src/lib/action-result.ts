import type { CodigoDeError } from "./errors";

/**
 * What a server action hands back to the UI.
 *
 * Defined once, here, and re-exported by every module's `*.types.ts`. It used to
 * be copy-pasted into four modules with four identical definitions, which meant
 * the failure branch could only ever carry a Spanish string — and a validation
 * message was indistinguishable from an authorization refusal.
 *
 * `codigo` is what makes them distinguishable. It is optional because a
 * validation message written at the router boundary does not need one; every
 * failure that came from a typed domain error carries it, because the mapping in
 * `aResultado` puts it there.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; codigo?: CodigoDeError };
