"use client";

import CampoDeBusqueda from "@/components/CampoDeBusqueda";
import { useBusquedaEnVivo } from "@/lib/busqueda-en-vivo";

/**
 * El buscador de la lista de Usuarios: busca mientras se escribe (ADR 0015).
 *
 * La pestaña elegida —«Pendientes», «Activos»— sigue en la dirección, porque
 * `useBusquedaEnVivo` toca sólo `buscar` y deja el resto como está.
 */
export default function BuscarUsuarios({ buscar }: { buscar: string }) {
  const busqueda = useBusquedaEnVivo({
    clave: "buscar",
    enLaDireccion: buscar,
    destino: "/admin/users",
  });

  return (
    <CampoDeBusqueda
      etiqueta="Buscar por Buzón, nombre o territorio"
      {...busqueda}
    />
  );
}
