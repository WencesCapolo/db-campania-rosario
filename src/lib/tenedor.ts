/**
 * Un Tenedor con los nombres ya resueltos — la respuesta a «¿quién tiene esta
 * imagen?», que es **una** y no dos (ADR 0010).
 *
 * Vive acá y no en un módulo por una razón de dirección: la cadena va
 * `territorio → misionero → peregrina → asignacion`, y las dos puntas que
 * contestan esa pregunta son `peregrina` (el puntero denormalizado) y
 * `asignacion` (el período). Peregrina no puede importar asignacion sin dar
 * vuelta la cadena, así que ninguno de los dos puede ser el dueño del tipo.
 *
 * Tampoco es el `TenedorDTO` de `misionero/matrimonio.types`: ese lleva
 * `MisioneroDTO` y `MatrimonioDTO` enteros, con territorio resuelto, y una
 * columna «quién la tiene» de doscientas filas no quiere pagar dos joins más
 * por fila para renderizar un nombre.
 *
 * `nombreDeTenedor` en `lib/formato.ts` consume exactamente esta forma, y es el
 * único lugar que decide cómo se escribe.
 */
export interface PersonaDeTenedorDTO {
  id: string;
  nombre: string;
  apellido: string;
  /**
   * Se fue de la Campaña. Sigue resolviendo por nombre dentro de cada
   * Asignación que tuvo — user story 15, y la razón de que nada se destruya.
   */
  deBaja: boolean;
}

/**
 * `id` y `deBaja` están en las dos ramas a propósito, fuera del objeto anidado.
 *
 * `id` es el id **del Tenedor**: el del Misionero o el del Matrimonio, que es lo
 * que `valorDeTenedor` necesita para armar un `<option>` y lo que un
 * `revalidatePath` necesita para saber qué página cambió. Leerlo sin discriminar
 * la unión es la mitad de los usos.
 *
 * `deBaja` es la baja del Tenedor: la de la persona, o la del Matrimonio. La de
 * cada cónyuge sigue estando adentro, porque un Matrimonio activo con un cónyuge
 * dado de baja es un estado que alguien tiene que poder ver.
 */
export type TenedorResueltoDTO =
  | {
      tipo: "persona";
      id: string;
      deBaja: boolean;
      persona: PersonaDeTenedorDTO;
    }
  | {
      tipo: "matrimonio";
      id: string;
      deBaja: boolean;
      matrimonio: {
        misioneroA: PersonaDeTenedorDTO;
        misioneroB: PersonaDeTenedorDTO;
      };
    };
