"use client";

import { PanelDeError } from "@/components/EstadosAsincronicos";

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
 * The copy is not repeated here any more. It was written out twice — once in this
 * file and once as `PanelDeError`'s default — which is how the two would have
 * come to disagree about what a refusal looks like. This is the boundary; the
 * panel is the wording, and `reset` is what makes it a retry rather than a dead
 * end.
 *
 * `PanelDeError` renders an `<h2>`, so the page keeps an `<h1>` of its own: a
 * document whose outline starts at level two is a document a screen-reader user
 * cannot navigate. The heading is `sr-only` because the panel is already
 * carrying the same sentence visually, and saying it twice on screen reads as a
 * stutter.
 */
export default function ErrorDelTablero({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 py-6">
      <h1 className="sr-only">No se pudo mostrar</h1>

      <PanelDeError alReintentar={reset} referencia={error.digest} />
    </main>
  );
}
