"use client";

/**
 * The dashboard's error boundary.
 *
 * Reads throw now. A Referente Local who opens a record from another territory
 * gets a refusal rather than an empty list, because a blank table where a
 * refusal belongs is a lie — and without a boundary that refusal would render as
 * Next's default error page.
 *
 * The message is generic on purpose, and not by omission: Next replaces a server
 * error's message with a digest in production, so anything specific shown here
 * would be a guess that is wrong as often as it is right. The specific wording
 * lives where it can be trusted — in the action results the forms render, and in
 * the authorization log.
 *
 * Plain styling; issue #4 restyles.
 */
export default function ErrorDelTablero({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 text-lg">
      <h1 className="text-3xl font-bold text-neutral-900">No se pudo mostrar</h1>

      <p className="text-lg leading-relaxed text-neutral-900">
        Puede ser que eso pertenezca a otro territorio, o que algo haya fallado al
        buscarlo. Si es de tu Diócesis/Localidad y sigue sin aparecer, avisale a un
        Asesor Nacional.
      </p>

      <button
        type="button"
        onClick={reset}
        className="min-h-12 rounded-lg border-2 border-neutral-900 bg-neutral-900 px-4 text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-700"
      >
        Probar de nuevo
      </button>

      {error.digest ? (
        <p className="text-base text-neutral-700">
          Si tenés que reportarlo, este es el número: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
