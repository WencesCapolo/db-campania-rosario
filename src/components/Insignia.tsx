/**
 * Insignia — a small piece of status.
 *
 * Every tone carries a glyph as well as a colour, and the glyph is not
 * decoration: roughly one man in twelve cannot separate the red from the green,
 * and a status that exists only as a hue is invisible to them. The word is
 * always there too, so the glyph is reinforcement rather than a second thing to
 * learn — which is why it is `aria-hidden`, and why there is no icon-only
 * variant to reach for.
 */

export type TonoDeInsignia = "exito" | "aviso" | "alerta" | "neutro";

const TONOS: Record<TonoDeInsignia, { clases: string; glifo: string }> = {
  exito: {
    clases: "border-exito-tinta bg-exito-fondo text-exito-tinta",
    glifo: "●",
  },
  aviso: {
    clases: "border-aviso-tinta bg-aviso-fondo text-aviso-tinta",
    glifo: "▲",
  },
  alerta: {
    clases: "border-alerta-tinta bg-alerta-fondo text-alerta-tinta",
    glifo: "✕",
  },
  neutro: {
    clases: "border-neutro-tinta bg-neutro-fondo text-neutro-tinta",
    glifo: "—",
  },
};

export default function Insignia({
  tono = "neutro",
  children,
}: {
  tono?: TonoDeInsignia;
  children: React.ReactNode;
}) {
  const { clases, glifo } = TONOS[tono];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-control border-2 px-2 py-1 text-base font-semibold ${clases}`}
    >
      <span aria-hidden>{glifo}</span>
      {children}
    </span>
  );
}
