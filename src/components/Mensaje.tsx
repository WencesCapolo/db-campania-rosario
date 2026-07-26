/**
 * Mensaje — a sentence the screen needs somebody to read.
 *
 * The three-quarters of a page's copy that is neither a heading nor a field: the
 * Código that was just generated and has to be written on a statue, the reason an
 * Extraviada image still shows a holder, the refusal a form got back from a
 * service.
 *
 * Every one of those was a hand-rolled `<p className="rounded-lg border-2 …">`
 * on some screen, and they had drifted: three different borders, two different
 * reds, and — the part that matters — `role` chosen by whoever wrote the line. A
 * confirmation announced as an alert interrupts a screen reader mid-sentence; a
 * refusal announced as a status is never read out at all. So the role is
 * *derived* from the tone here rather than passed in: `alerta` is the only tone
 * that interrupts, and it is exactly the tone that should.
 *
 * `Insignia`'s tones and glyphs, reused deliberately — a badge saying "Extraviada"
 * and the panel explaining what that means should not be different colours. And
 * as there, the glyph is reinforcement for anybody who cannot use the hue, never
 * the only carrier of the message.
 */

export type TonoDeMensaje = "exito" | "aviso" | "alerta" | "neutro";

const TONOS: Record<TonoDeMensaje, { clases: string; glifo: string }> = {
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

export default function Mensaje({
  tono = "neutro",
  children,
}: {
  tono?: TonoDeMensaje;
  children: React.ReactNode;
}) {
  const { clases, glifo } = TONOS[tono];

  return (
    <div
      // Only a genuine problem interrupts. Everything else is announced when the
      // screen reader next comes to rest.
      role={tono === "alerta" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-control border-2 p-4 text-base leading-relaxed ${clases}`}
    >
      <span aria-hidden className="pt-px font-bold">
        {glifo}
      </span>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
