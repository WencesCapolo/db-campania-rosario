import Link from "next/link";
import PrototipoSwitcher from "./PrototipoSwitcher";
import PrototipoVarianteA from "./PrototipoVarianteA";
import PrototipoVarianteB from "./PrototipoVarianteB";
import PrototipoVarianteC from "./PrototipoVarianteC";
import { PEREGRINAS_DE_PROTOTIPO } from "./prototipo-datos";

/**
 * PROTOTIPO — three design variants for the shell and the Peregrina list,
 * switchable with `?variant=`. Throwaway: once one has won, the losers and the
 * switcher are deleted and the winner is rewritten properly as the real page.
 *
 * The page underneath is still the stub issue #1 left. Issue #4 replaces it with
 * the real list once the visual language is settled — building it first would
 * mean building it twice.
 *
 * Data is fixtures, not the database. The question is what this should look
 * like, and a read-only prototype should not require somebody to have typed
 * eight Peregrinas into a real Neon project first.
 */

const VARIANTES = [
  { clave: "A", nombre: "Panel" },
  { clave: "B", nombre: "Fichas" },
  { clave: "C", nombre: "Pregunta primero" },
];

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;

  if (!variant) {
    return (
      <main className="mx-auto max-w-xl space-y-5 p-6 text-lg text-neutral-900">
        <h1 className="text-3xl font-bold">Peregrinas</h1>
        <p className="leading-relaxed">
          Esta pantalla todavía no está construida. Issue #4 la arma sobre el
          sistema de diseño, y ahora mismo hay tres variantes para elegir.
        </p>
        <Link
          href="/peregrina?variant=A"
          className="inline-flex min-h-12 items-center rounded-lg border-2 border-neutral-900 bg-neutral-900 px-4 text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
        >
          Ver las variantes
        </Link>
      </main>
    );
  }

  const elegida = VARIANTES.some((v) => v.clave === variant) ? variant : "A";

  return (
    <>
      {elegida === "A" && (
        <PrototipoVarianteA peregrinas={PEREGRINAS_DE_PROTOTIPO} />
      )}
      {elegida === "B" && (
        <PrototipoVarianteB peregrinas={PEREGRINAS_DE_PROTOTIPO} />
      )}
      {elegida === "C" && (
        <PrototipoVarianteC peregrinas={PEREGRINAS_DE_PROTOTIPO} />
      )}
      <PrototipoSwitcher variantes={VARIANTES} actual={elegida} />
    </>
  );
}
