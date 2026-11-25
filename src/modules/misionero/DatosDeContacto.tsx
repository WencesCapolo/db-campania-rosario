import type { ReactNode } from "react";
import type { MisioneroDTO } from "./misionero.types";
import { fechaDeConsagracion } from "@/lib/consagracion";
import { enlaceDeWhatsApp } from "@/lib/whatsapp";

const ENLACE = "inline-flex min-h-12 items-center text-accion underline";

/** Cada dato en su renglón aunque falte: uno ausente parece un error. */
export default function DatosDeContacto({
  misionero: m,
}: {
  misionero: MisioneroDTO;
}) {
  const chat = m.whatsapp && enlaceDeWhatsApp(m.whatsapp);

  return (
    <dl className="space-y-1 text-base">
      <Dato titulo="Teléfono">
        {m.telefono && (
          <a href={`tel:${m.telefono}`} className={ENLACE}>
            {m.telefono}
          </a>
        )}
      </Dato>
      <Dato titulo="WhatsApp">
        {m.whatsapp && (
          <span className="flex flex-wrap items-center gap-x-4">
            {m.whatsapp}
            {chat && (
              <a
                href={chat}
                target="_blank"
                rel="noopener noreferrer"
                className={ENLACE}
              >
                Escribir por WhatsApp
              </a>
            )}
          </span>
        )}
      </Dato>
      <Dato titulo="Email">
        {m.email && (
          <a href={`mailto:${m.email}`} className={`${ENLACE} break-all`}>
            {m.email}
          </a>
        )}
      </Dato>
      <Dato titulo="Fecha de consagración">
        {m.fechaConsagracion && fechaDeConsagracion(m.fechaConsagracion)}
      </Dato>
    </dl>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="font-semibold text-tinta-suave">{titulo}:</dt>
      <dd className="text-tinta">
        {children || <span className="text-tinta-suave">Sin registrar</span>}
      </dd>
    </div>
  );
}
