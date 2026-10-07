import type { ReactNode } from "react";
/**
 * Una sección plegable del alta.
 *
 * El botón dice «Abrir» o «Cerrar» con palabras y lleva borde, además de la
 * flecha: una flecha sola es una convención de quien navega seguido, y un
 * resumen sin borde no parece algo que se pueda tocar. La palabra cambia con
 * `group-open`, sin estado en el cliente.
 */
export default function SeccionDeAlta({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b-2 border-borde-suave last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 hover:bg-lienzo sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-stretch-condensed text-2xl leading-tight font-bold text-azul">
            {titulo}
          </span>
          <span className="mt-1 block text-base leading-relaxed text-tinta-suave">
            {bajada}
          </span>
        </span>
        <span className="flex min-h-12 shrink-0 items-center gap-2 rounded-control border-2 border-azul px-3 font-semibold text-azul">
          <span className="group-open:hidden">Abrir</span>
          <span className="hidden group-open:inline">Cerrar</span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="px-5 pt-2 pb-6 sm:px-6">{children}</div>
    </details>
  );
}
