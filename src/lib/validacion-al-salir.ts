"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";

/**
 * Validación al salir del campo — story 15.
 *
 * The complaint being answered is precise: somebody fills in eight fields, presses
 * Guardar, and is shown eight errors at once, none of which is where their eyes
 * are. Told at the moment they leave a field, the same person fixes one thing
 * while it is still the thing they were thinking about.
 *
 * Three rules, and each is a deliberate choice about *when* rather than about
 * what:
 *
 *  - **On blur, never on keystroke.** "El nombre es obligatorio" appearing after
 *    the first letter of a name is an accusation, and by the third letter it is
 *    already wrong. Blur is the moment the person has declared the field finished.
 *  - **Typing clears an error, it does not create one.** Once the message is on
 *    screen it is about a value that no longer exists, so it goes as soon as the
 *    value changes; the next blur decides whether it comes back.
 *  - **The Zod schema is the judge.** The same schema the router parses, so the
 *    message shown as somebody leaves the field is the exact message the server
 *    would have produced. Two sources for one rule is how a form accepts what the
 *    service then refuses.
 *
 * The value is passed in already converted, because the DOM has strings and the
 * schemas have numbers and nulls: an Año de consagración leaves the input as
 * `"19"` and the schema expects a number, so the call site — which knows that an
 * empty field means "not recorded" and not zero — does the conversion. That
 * conversion is the same expression the submit path uses.
 */

type Errores<T> = Partial<Record<keyof T & string, string>>;

export interface ValidacionAlSalir<T> {
  /** The message for a field, or `undefined` — what `Campo` takes as `error`. */
  error: (campo: keyof T & string) => string | undefined;
  /** Validate one field, at the moment it is left. */
  alSalir: (campo: keyof T & string, valor: unknown) => void;
  /** Drop a field's message, because its value has changed under it. */
  alEscribir: (campo: keyof T & string) => void;
  /**
   * A message the form produced itself, for a rule about the *input* rather than
   * about the domain.
   *
   * There is one such rule: an Año de consagración is four digits in a text box
   * and a number in the schema, and `Number("mil")` is `NaN`, which Zod refuses
   * in English. The Campaña's forms are Spanish, so the shape of the typing is
   * checked at the call site and the domain rule — not before 1900, not in the
   * future — stays in the schema where the service reads it.
   */
  marcar: (campo: keyof T & string, mensaje: string) => void;
  /** Everything valid so far — false while any message is on screen. */
  hayErrores: boolean;
  /** After a successful save, so "Guardar y agregar otra" starts clean. */
  limpiar: () => void;
}

export function useValidacionAlSalir<
  Shape extends z.ZodRawShape,
  T = z.infer<z.ZodObject<Shape>>,
>(schema: z.ZodObject<Shape>): ValidacionAlSalir<T> {
  const [errores, setErrores] = useState<Errores<T>>({});

  const alSalir = useCallback(
    (campo: keyof T & string, valor: unknown) => {
      const mensaje = mensajeDelCampo(schema, campo, valor);
      setErrores((previos) => ({ ...previos, [campo]: mensaje }));
    },
    [schema]
  );

  const alEscribir = useCallback((campo: keyof T & string) => {
    setErrores((previos) =>
      previos[campo] === undefined ? previos : { ...previos, [campo]: undefined }
    );
  }, []);

  const marcar = useCallback((campo: keyof T & string, mensaje: string) => {
    setErrores((previos) => ({ ...previos, [campo]: mensaje }));
  }, []);

  const error = useCallback(
    (campo: keyof T & string) => errores[campo],
    [errores]
  );

  const limpiar = useCallback(() => setErrores({}), []);

  return {
    error,
    alSalir,
    alEscribir,
    marcar,
    hayErrores: Object.values(errores).some((m) => m !== undefined),
    limpiar,
  };
}

/**
 * One field against its own rule, and nothing about the rest of the form.
 *
 * A field the schema does not describe validates as fine rather than throwing. It
 * is a typo in a call site, and turning it into a crash on blur would take the
 * whole form down over a mislabelled input; the router still parses the object,
 * so nothing invalid can be saved because of it.
 */
function mensajeDelCampo(
  schema: z.ZodObject<z.ZodRawShape>,
  campo: string,
  valor: unknown
): string | undefined {
  // `shape` is typed as Zod's internal `$ZodType`, which has no `safeParse` on it
  // — the cast is to the public type the value already is at runtime, and it is
  // the only one in this file.
  const regla = schema.shape[campo] as z.ZodType | undefined;
  if (!regla) return undefined;

  const resultado = regla.safeParse(valor);
  if (resultado.success) return undefined;

  // The first issue only. A field with two problems has one the person can act
  // on, and it is the first.
  return resultado.error.issues[0]?.message ?? "Ese valor no es válido.";
}
