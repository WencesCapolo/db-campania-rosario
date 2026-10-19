# Una Peregrina no tiene baja: Extraviada es un Estado, y lo que no existe se borra

2026-10-19. Reemplaza la parte de ADR 0013 que llamaba «Extraviada» a la baja de una Peregrina.

## Lo que pasó

ADR 0013 le dio a la baja de una Peregrina el nombre de la Campaña: «marcarla como extraviada». La misma escritura ponía el Estado en `extraviada` y la sacaba de todas las listas. Quedaron así dos cosas con un mismo nombre:

- **Estado Extraviada**: la imagen sigue en las listas y la tiene, o no, la última persona.
- **Marcada como extraviada**: la imagen no aparece en ninguna lista, en ninguna cifra, en ningún filtro ni en la entrega, pero su Código sigue ocupado.

En producción un admin cargó CAB JOV 0010–0030 en el territorio equivocado y las dio de baja para cargarlas de nuevo. Al intentarlo, el sistema contestó «Ya hay una Peregrina con el Código CAB JOV 0023» y no había pantalla donde verla. El filtro «Estado: Extraviada» tampoco la mostraba, porque buscaba el Estado y no la baja. Un parche del mismo día agregó un filtro «Inventario: Marcadas como extraviadas», y la confusión siguió: había dos filtros para una sola palabra.

## La decisión

La Campaña fijó el vocabulario, y vale para todo el sistema:

- **Extraviada** = perdida por ahora, haya estado asignada o no. Es **sólo un Estado**. La imagen sigue en el inventario, en el tablero y en el filtro «Estado: Extraviada»; volver a Activa es editarla.
- **Borrar** = deja de existir en el sistema. Es el hard delete que ADR 0013 llamaba eliminar (`PeregrinaService.borrar`), con su historial y detrás del mismo aviso.

No hay una tercera cosa. Se va la columna `peregrina.baja_at` (migración 0013), y con ella `darDeBaja`, `reactivar`, el filtro `inventario` y la etiqueta «Fuera del inventario». Las imágenes que estaban de baja vuelven a las listas con Estado Extraviada, que la migración 0012 ya les había puesto.

## Consecuencias

- **El Código repetido siempre se puede encontrar.** Toda imagen está en alguna lista, así que la negativa sólo agrega «buscala por su Código en Peregrinas».
- **El índice del tablero deja de ser parcial.** `peregrina_activas_por_territorio_idx` (`where baja_at is null`) pasa a ser `peregrina_por_territorio_idx`, con las mismas columnas. `tablero.planes.test.ts` lo exige por nombre.
- **El uso de un territorio cuenta todas sus Peregrinas.** Una Diócesis con imágenes se retira después de moverlas o borrarlas, no por haberlas dado de baja.
- **El módulo peregrina ya no importa el repositorio de asignacion.** La única razón era el control de «no se da de baja una imagen que alguien tiene». La cadena de imports vuelve a ser de un solo sentido.
- **Una Extraviada se puede entregar.** Es el caso de una que apareció en otra casa: se entrega y después se edita su Estado.
- Misionero, Matrimonio, Usuario y los territorios siguen teniendo baja; nada de esto los toca.
