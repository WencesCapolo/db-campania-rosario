/**
 * Columnas — una serie en orden, de izquierda a derecha.
 *
 * Barras compara categorías, y su orden es el de la cifra. Esto es para lo que
 * tiene un orden propio, como los años, donde la forma de la serie — cuándo
 * creció, cuándo se cortó — es lo que se viene a mirar.
 *
 * Las mismas reglas que Barras: cada columna escribe su valor y su rótulo, así
 * que nadie estima nada contra un eje y no hay eje; todas las columnas son la
 * misma tinta; y el dibujo es un `<svg>` con la altura como atributo de
 * geometría, porque `style={{}}` no pasa el lint. Cada columna es un svg del
 * alto entero con el rectángulo apoyado abajo, y por eso el valor va debajo de
 * la columna y no encima: encima tendría que conocer la altura.
 *
 * Una lista y no una tabla. Para un lector de pantalla cada columna es una frase
 * entera — «2010 a 2014: 192 imágenes» — y el dibujo está `aria-hidden`.
 */

export interface Columna {
  /** El rótulo largo, para leer en voz alta: «2010 a 2014». */
  etiqueta: string;
  /** El rótulo corto, en dos renglones debajo de la columna. */
  arriba: string;
  abajo?: string;
  valor: number;
}

export default function Columnas({
  columnas,
  unidad,
}: {
  columnas: Columna[];
  unidad: { singular: string; plural: string };
}) {
  const maximo = Math.max(...columnas.map((c) => c.valor), 1);

  return (
    <ul className="flex gap-1.5 overflow-x-auto pb-1">
      {columnas.map((columna) => (
        <li
          key={columna.etiqueta}
          className="flex min-w-9 flex-1 flex-col items-center"
        >
          <span className="sr-only">
            {columna.etiqueta}: {columna.valor}{" "}
            {columna.valor === 1 ? unidad.singular : unidad.plural}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 10 100"
            preserveAspectRatio="none"
            className="h-40 w-full border-b-2 border-borde-fuerte"
          >
            <rect
              x="0"
              y={100 - (columna.valor / maximo) * 100}
              width="10"
              height={(columna.valor / maximo) * 100}
              className="fill-azul"
            />
          </svg>
          <span
            aria-hidden
            className="mt-1 text-sm font-bold tabular-nums text-tinta"
          >
            {columna.valor.toLocaleString("es-AR")}
          </span>
          <span
            aria-hidden
            className="text-center text-xs leading-tight text-tinta-suave"
          >
            {columna.arriba}
            {columna.abajo && (
              <>
                <br />
                {columna.abajo}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
