"use client";

import { useState, useSyncExternalStore } from "react";
import Boton from "@/components/Boton";
import { enlaceDeInvitacion } from "@/lib/auth/buzon";

/**
 * El Enlace de invitación, para copiarlo de un gesto.
 *
 * Es la pantalla de entrar con el Buzón ya escrito, y nada más: no lleva token, no
 * da acceso y no vence (historia 26). Quien invita lo manda por donde ya le habla a
 * esa persona — WhatsApp, casi siempre — y del otro lado nadie tipea una dirección
 * de correo que tiene que salir carácter por carácter igual a la guardada.
 *
 * El enlace de verdad, el que sí deja entrar, sale del correo y no de acá. Son dos
 * cosas distintas y vienen de lugares distintos: este se compone en el navegador de
 * quien invita, aquel lo manda Neon Auth al Buzón, dura una hora y sirve una sola
 * vez.
 *
 * ─── Por qué lo compone la pantalla ──────────────────────────────────────────
 *
 * Porque ningún servicio de este repo sabe que existen las rutas. La cadena de
 * módulos es de dominio de punta a punta, y una ruta adentro de `InvitacionService`
 * haría que una regla de negocio dependa de una dirección web. El enlace es una
 * vista derivada de un dato que el DTO ya trae — el Buzón — así que se arma acá,
 * con el origen del navegador. Consecuencia deliberada: esta feature no cambió
 * ningún servicio, ningún repositorio y ningún esquema.
 *
 * ─── El origen, y por qué llega tarde ────────────────────────────────────────
 *
 * `window.location.origin` no existe en el servidor, así que el render del
 * servidor dibuja la ruta relativa y el navegador la completa. Es a propósito: la
 * alternativa es que el servidor adivine el origen desde una cabecera, que en
 * Vercel cambia entre el alias de producción, el de la rama y la URL por deploy. El
 * navegador que está mirando la pantalla sabe la respuesta correcta sin
 * preguntarle a nadie.
 *
 * `useSyncExternalStore` y no un efecto que llame a `setState`: el origen es un
 * dato de una fuente de afuera de React que no cambia nunca, y eso es exactamente
 * lo que este hook lee —— sin la ronda de render de más que un efecto agrega, y sin
 * la discrepancia de hidratación que tendría leerlo derecho en el cuerpo. De ahí
 * que la suscripción no haga nada: no hay a qué suscribirse.
 */
const NO_CAMBIA = () => () => {};

export default function CopiarEnlaceDeInvitacion({ buzon }: { buzon: string }) {
  const origen = useSyncExternalStore(
    NO_CAMBIA,
    () => window.location.origin,
    () => null,
  );
  const [copiado, setCopiado] = useState(false);

  const enlace = enlaceDeInvitacion(origen, buzon);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles no queda nada roto: el enlace está en
      // pantalla, entero y seleccionable, que es de dónde se copiaba antes de que
      // existiera el botón.
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-base text-tinta-suave">
        Enlace de invitación — mandáselo por donde le hablás. No da acceso por sí
        solo.
      </p>

      {/* El enlace a la vista y entero. `break-all` porque un correo largo en un
          teléfono de 390 px se sale de la tarjeta, y medio enlace no se puede
          copiar a mano. `code` porque es algo que se copia tal cual. */}
      <code className="block rounded-control border-2 border-borde bg-fondo p-3 text-base break-all text-tinta">
        {enlace}
      </code>

      <Boton
        tono="secundario"
        onClick={copiar}
        /* El estado se anuncia por el texto del botón y no sólo por un color:
           «Copiado» es la confirmación, y vuelve a «Copiar el enlace» en cuanto
           la persona lo vuelve a apretar. */
        aria-live="polite"
      >
        {copiado ? "Copiado ✓" : "Copiar el enlace"}
      </Boton>
    </div>
  );
}
