# Desplegables propios, un solo campo para buscar y elegir, y búsqueda mientras se escribe

2026-10-19. Reemplaza «`<select>` nativo» de CLAUDE.md y de `Eleccion`. El `<dialog>` sigue siendo nativo.

## Lo que pasó

Había tres quejas, y las tres eran sobre la misma pantalla vista desde distintos lados.

- **El `<select>` nativo no parecía de la app.** Cerrado era un control del sistema al lado de campos con nuestro borde, y abierto en una computadora era una lista gris del navegador. Se había elegido a propósito, porque el teléfono abre el selector del sistema, que ya es accesible. Lo que el usuario pidió fue que el formulario se vea parejo.
- **Elegir a alguien en una lista larga eran dos controles.** En el flujo de entrega y en «Entregar una imagen», un campo «Buscar por nombre» achicaba un `<select>` que estaba debajo. Se escribía en uno y se elegía en otro, y el segundo no mostraba lo que se había escrito.
- **Las listas buscaban con un botón «Buscar».** Escribir y no ver ningún cambio hasta tocar un botón se sentía roto. En el teléfono el botón quedaba debajo del teclado.

Las tres se probaron como prototipos descartables, con variantes que se podían cambiar en la misma pantalla. Las variantes que no ganaron están en la rama `prototipo/desplegables-y-busqueda`.

## La decisión

1. **`Eleccion` es un desplegable propio.** Es un botón con `role="combobox"` que abre una lista (`role="listbox"`) debajo, según el patrón «select-only combobox» del APG. Cerrado se ve como un `Campo`: el mismo borde de 2 px y la misma altura. Abierto, la lista tiene un borde suave y sombra, y filas de 48 px (`min-h-11`), que es el mínimo y no más. La opción elegida va en azul, con ✓. La opción por la que se pasa con el teclado se pinta de `lienzo`. Se maneja con ↑ ↓ Inicio Fin, Enter, Escape y Tab, y escribir letras salta a la opción que empieza así. Las opciones siguen llegando como datos y no como hijos, por la misma razón de antes (el Estado se arma con `ESTADOS_SELECCIONABLES`).
2. **`Buscador` es un solo campo que busca y elige.** Es un `<input role="combobox">` con su lista: escribir la achica, con la regla de `coincide`, y lo que coincide se resalta. Si queda una sola opción, se elige sola. Lo elegido queda escrito en el campo y confirmado en un recuadro debajo. Cuando nada coincide, lo dice debajo del campo y no en una lista vacía. Se usa en toda lista que puede tener cientos de opciones: las Peregrinas y los Tenedores.
3. **Las listas buscan mientras se escribe.** `CampoDeBusqueda` y `useBusquedaEnVivo` escriben en la dirección después de una pausa de 350 ms, y Enter busca en el momento. La búsqueda sigue viviendo en la dirección (ADR 0007), pero se escribe con `router.replace` y no con `push`, para que «Atrás» no deshaga la búsqueda letra por letra. Una búsqueda nueva vuelve a la página 1 (ADR 0008). Mientras el servidor responde, el campo dice «Buscando…».

## Consecuencias

- **La accesibilidad de la lista pasa a ser nuestra.** Antes la daba el navegador. Ahora la sostienen las pruebas del proyecto `navegador`: la altura de cada fila, el foco que nunca sale del control y el nombre accesible de cada opción.
- **En el teléfono ya no aparece el selector del sistema.** La lista se abre debajo del campo y se desplaza para quedar a la vista. Es el costo que se aceptó a cambio de que el formulario sea parejo.
- **`onChange` pasa a ser `alElegir(valor)`.** El control no es un `<select>`, así que no hay un evento del DOM que pasar. Con `name`, el valor viaja en un `<input type="hidden">`.
- **Las pruebas eligen con clics.** `userEvent.selectOptions` no sirve sobre un botón: `src/test/elegir.ts` abre el control y toca la opción por su nombre.
