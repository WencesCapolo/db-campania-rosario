"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * PROTOTIPO — throwaway. Delete with the variants once one has won.
 *
 * A floating bar for flipping between design variants. Deliberately ugly and
 * high-contrast dark so it reads as scaffolding rather than as part of any
 * design being judged.
 */

export interface VarianteDeclarada {
  clave: string;
  nombre: string;
}

export default function PrototipoSwitcher({
  variantes,
  actual,
}: {
  variantes: VarianteDeclarada[];
  actual: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const indice = Math.max(
    0,
    variantes.findIndex((v) => v.clave === actual)
  );

  function irA(delta: number) {
    const siguiente =
      variantes[(indice + delta + variantes.length) % variantes.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", siguiente.clave);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      // Don't steal arrow keys from anything the user is typing in.
      const activo = document.activeElement;
      if (
        activo instanceof HTMLInputElement ||
        activo instanceof HTMLTextAreaElement ||
        activo instanceof HTMLSelectElement ||
        (activo instanceof HTMLElement && activo.isContentEditable)
      ) {
        return;
      }

      irA(e.key === "ArrowLeft" ? -1 : 1);
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  });

  if (process.env.NODE_ENV === "production") return null;

  const variante = variantes[indice];

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 print:hidden">
      <div className="flex items-center gap-1 rounded-full border-2 border-white bg-neutral-900 p-1 text-white shadow-[0_10px_30px_rgba(0,0,0,.45)]">
        <button
          type="button"
          onClick={() => irA(-1)}
          aria-label="Variante anterior"
          className="flex size-12 items-center justify-center rounded-full text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        >
          ←
        </button>

        <span className="px-3 text-center text-base font-semibold tabular-nums">
          {variante.clave} — {variante.nombre}
          <span className="ml-2 font-normal text-white/60">
            {indice + 1}/{variantes.length}
          </span>
        </span>

        <button
          type="button"
          onClick={() => irA(1)}
          aria-label="Variante siguiente"
          className="flex size-12 items-center justify-center rounded-full text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        >
          →
        </button>
      </div>
    </div>
  );
}
