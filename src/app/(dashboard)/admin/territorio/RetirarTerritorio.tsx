"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Boton from "@/components/Boton";
import Dialogo from "@/components/Dialogo";
import type { ActionResult } from "@/lib/action-result";
import type { UsoTerritorio } from "@/modules/territorio/territorio.types";

/**
 * Retirar un territorio, con la cuenta de lo que lo usa mostrada primero.
 *
 * The count comes first, and it is the whole design of this control — user
 * story 10. A territory is not a row somebody owns; it is a row that a hundred
 * Peregrinas and Misioneros point at, and the person retiring it usually cannot
 * say how many. So the dialog does not ask "are you sure" and then fail: it
 * asks the database, shows what depends on this territory, and only then offers
 * the button — or explains why there is no button.
 *
 * `TerritorioService` refuses the baja while anything still references it. That
 * rule is not repeated here. What is here is the courtesy of finding out before
 * the person commits to it, rather than after.
 *
 * The count is fetched when the dialog opens rather than with the page, because
 * a list of thirty territories would otherwise be sixty extra queries to render
 * numbers nobody asked for.
 */

export default function RetirarTerritorio({
  nombre,
  que,
  contarUso,
  retirar,
}: {
  nombre: string;
  /** "la Provincia" or "la Diócesis/Localidad" — used in the copy. */
  que: string;
  contarUso: () => Promise<ActionResult<UsoTerritorio>>;
  retirar: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [uso, setUso] = useState<UsoTerritorio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enUso = uso !== null && (uso.peregrinas > 0 || uso.misioneros > 0);

  return (
    <Dialogo
      titulo={`¿Retirar ${que}?`}
      alCerrar={() => {
        setError(null);
        setUso(null);
      }}
      disparador={(control) => (
        <Boton
          tono="secundario"
          onClick={() => {
            control.abrir();
            empezar(async () => {
              const resultado = await contarUso();
              if (resultado.ok) setUso(resultado.data);
              else setError(resultado.error);
            });
          }}
        >
          Retirar
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            <strong>{nombre}</strong>.
          </p>

          {uso === null && !error && (
            <p className="mt-3 text-base text-tinta-suave" aria-live="polite">
              Buscando qué depende de este territorio…
            </p>
          )}

          {uso !== null && (
            <p className="mt-3 text-base leading-relaxed" aria-live="polite">
              {enUso ? (
                <>
                  No se puede retirar: hay{" "}
                  {cuenta(uso.peregrinas, "imagen", "imágenes")} y{" "}
                  {cuenta(uso.misioneros, "Misionero", "Misioneros")} en este
                  territorio. Mové o dá de baja esos registros primero —
                  retirarlo ahora dejaría historial apuntando a un lugar que no
                  existe.
                </>
              ) : (
                <>
                  No hay imágenes ni Misioneros en este territorio, así que se
                  puede retirar. Deja de ofrecerse al cargar registros nuevos y
                  no se borra: el historial que lo menciona sigue resolviendo.
                </>
              )}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-control border-2 border-peligro bg-alerta-fondo p-4 text-base font-semibold text-alerta-tinta"
            >
              <span aria-hidden>✕</span>
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {uso !== null && !enUso && (
              <Boton
                tono="peligro"
                disabled={pendiente}
                onClick={() =>
                  empezar(async () => {
                    setError(null);
                    const resultado = await retirar();
                    if (!resultado.ok) {
                      setError(resultado.error);
                      return;
                    }
                    control.cerrar();
                    router.refresh();
                  })
                }
              >
                {pendiente ? "Retirando…" : "Sí, retirar"}
              </Boton>
            )}

            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={control.cerrar}
            >
              {enUso ? "Entendido" : "No, volver"}
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}

function cuenta(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}
