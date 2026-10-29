"use client";

import { createContext, useContext } from "react";
import type { Modalidad } from "./peregrina.schema";

/**
 * La Modalidad a la que está atado el rol de quien entró, o null si carga todas
 * — ADR 0016. Hoy sólo el Dirigente Joven tiene una, `JOV`.
 *
 * Un contexto y no una prop, porque las altas de Peregrina viven en cuatro
 * pantallas y dos diálogos, y la respuesta es la misma en todas: la resuelve el
 * layout una vez, en el servidor, con `modalidadPropia`. Es sólo forma: quien
 * decide es `exigirModalidad`, en el servicio.
 */
const Contexto = createContext<Modalidad | null>(null);

export function ModalidadPropiaProvider({
  modalidad,
  children,
}: {
  modalidad: Modalidad | null;
  children: React.ReactNode;
}) {
  return <Contexto.Provider value={modalidad}>{children}</Contexto.Provider>;
}

export function useModalidadPropia(): Modalidad | null {
  return useContext(Contexto);
}
