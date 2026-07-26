"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * PROTOTIPO — throwaway. Delete when the design variants are folded in.
 *
 * The dashboard shell is unstyled today: `dashboard.module.css` is a zero-byte
 * file, so every `styles.*` className resolves to `undefined`. Each design
 * variant brings its own chrome, and judging one against the broken shell
 * bolted above it would be judging the wrong thing — so the shell steps aside
 * while `?variant=` is in the URL.
 */

function Compuerta({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  if (searchParams.get("variant")) return null;
  return <>{children}</>;
}

export default function OcultarSiHayVariante({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <Compuerta>{children}</Compuerta>
    </Suspense>
  );
}
