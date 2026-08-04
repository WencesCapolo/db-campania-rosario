import {
  valorDeTenedor,
  type Tenedor,
  type TenedorDTO,
} from "@/modules/misionero/matrimonio.types";
import { nombreDeTenedorEnLista } from "./formato";
import type { Opcion } from "@/components/Eleccion";

/**
 * Un Tenedor en pantalla: su `<option>`, y su página — ADR 0010.
 *
 * Los dos pickers que eligen quién tiene una imagen — el paso 1 del flujo de
 * entrega y la corrección de un período — leen la **misma** lista colapsada:
 * personas que no son cónyuge de nadie, más matrimonios, cada uno una fila. Un
 * Misionero casado no se ofrece nunca solo, porque `AsignacionService.asignar`
 * lo rechaza y una opción que siempre se rechaza es peor que el rechazo.
 *
 * Está acá y no en cada pantalla porque son dos pantallas: el día que una diga
 * «Pérez, Ana y Juan» y la otra «Ana Pérez» ya no se van a leer como la misma
 * pregunta. El valor lo arma `valorDeTenedor` y la etiqueta
 * `nombreDeTenedorEnLista`, que son las dos reglas que ya existen — acá no se
 * decide nada, sólo se juntan.
 */

/**
 * La página del Tenedor: la de la persona, o la de la pareja.
 *
 * Cada clase tiene la suya, y son distintas — la de un Matrimonio muestra a los
 * dos cónyuges con su propio Año de consagración. Está acá y no en cada pantalla
 * porque el `revalidatePath` del router arma las mismas dos rutas, y una lista
 * que linkee a `/misionero/<id de matrimonio>` da un 404 sin decir por qué.
 *
 * Acepta cualquier cosa con `tipo` e `id` — el `Tenedor` de un formulario y el
 * `TenedorResueltoDTO` de una lectura, que lleva los dos afuera de la rama
 * justamente para esto.
 */
export function hrefDeTenedor(t: Tenedor): string {
  return t.tipo === "persona" ? `/misionero/${t.id}` : `/matrimonio/${t.id}`;
}

/** El `Tenedor` que las cuatro acciones de cargo esperan. */
export function tenedorDeDTO(t: TenedorDTO): Tenedor {
  return t.tipo === "persona"
    ? { tipo: "persona", id: t.persona.id }
    : { tipo: "matrimonio", id: t.matrimonio.id };
}

/**
 * El territorio del Tenedor.
 *
 * Un Matrimonio no tiene territorio propio: es el del cónyuge A, y está bien
 * definido porque el formulario lo carga una sola vez para los dos (ADR 0010).
 */
export function territorioDeTenedor(t: TenedorDTO): string {
  return t.tipo === "persona"
    ? t.persona.diocesisLocalidad.nombre
    : t.matrimonio.misioneroA.diocesisLocalidad.nombre;
}

export function opcionDeTenedor(t: TenedorDTO): Opcion {
  return {
    valor: valorDeTenedor(tenedorDeDTO(t)),
    etiqueta: nombreDeTenedorEnLista(t),
  };
}

/** La misma opción, con la Diócesis/Localidad detrás — dos «Pérez, Ana». */
export function opcionDeTenedorConTerritorio(t: TenedorDTO): Opcion {
  const { valor, etiqueta } = opcionDeTenedor(t);
  return { valor, etiqueta: `${etiqueta} — ${territorioDeTenedor(t)}` };
}
