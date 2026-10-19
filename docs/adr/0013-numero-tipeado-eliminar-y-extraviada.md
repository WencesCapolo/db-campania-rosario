# El número del Código se tipea, una Peregrina se puede eliminar, y la baja se llama Extraviada

Cuatro pedidos de la Campaña, del 2026-10-13, que deshacen partes de decisiones anteriores. Van juntos porque los cuatro dicen lo mismo de distintas formas: el sistema tiene que seguir a lo que está escrito en las imágenes y en los papeles, y no al revés.

## El número del Código se escribe

Hasta acá un Código nunca se tipeaba: el sistema tomaba el máximo de la Provincia y la Modalidad y sumaba uno. Pero muchas imágenes ya tienen un número escrito con el formato de la Campaña, y no es el que el sistema les daría — se numeraron a mano, con huecos, y en otro orden.

**Se tipea sólo el número.** La Provincia y la Modalidad siguen saliendo del territorio y de la Modalidad elegidos, así que nadie escribe las letras y el formato `[Provincia Modalidad Número]` sigue garantizado. El número es opcional: vacío, se toma el siguiente al más alto, como siempre. Va de 1 a 9999 porque se rellena a cuatro cifras.

**La única regla es que el Código no exista.** No se controla que siga al anterior. Cuentan todas las imágenes del país — las extraviadas también, porque su Código sigue escrito en la estatua, y las de otro territorio también, porque el índice único es sobre `codigo` y no sobre el par territorio-código. El servicio pregunta antes de escribir, para dar un mensaje que nombre el Código, y el índice único es la garantía: dos personas que tipean el mismo número a la vez reciben la misma frase (`codigoRepetidoEn`).

El número tipeado también vale al ponerle Código a una imagen vieja (`generarCodigo`) y al editar una Peregrina. Al editar, **sólo un número cambiado rearma el Código**, con la Provincia y la Modalidad que la imagen tenga al guardar; si el número no se toca, el Código queda como está escrito aunque cambien la Modalidad o el territorio — la misma regla de siempre. Vaciar el número le saca el Código, y se rechaza si no le queda la Numeración anterior: `peregrina_tiene_identificacion` lo rechazaría igual, pero con un mensaje que nadie entiende.

`nextCodigoNum` no cambió: sigue siendo el máximo más uno, así que un número alto tipeado corre la secuencia. Es lo que se quiere: el siguiente automático nunca choca con uno escrito.

## Eliminar, con su historial

«No se borra nada» tenía una razón: cada Asignación tiene que seguir resolviendo a un Código real. La Campaña pidió igual poder eliminar una Peregrina **aunque haya estado a cargo de alguien**, con sólo un aviso — primero se hizo sólo para las que nunca tuvieron Asignación, y se amplió el mismo día.

`PeregrinaService.eliminar` borra la Peregrina y todas sus Asignaciones, abiertas o cerradas, en una transacción: la clave foránea, sin cascada, rechazaría el borrado de la imagen sola, y una Asignación sin imagen es una fila de ids. Los punteros denormalizados viven en la fila de la Peregrina y se van con ella.

**Lo que cuesta, y por eso el aviso:** cada Misionero que la tuvo pierde ese período de su ficha, y la pregunta «¿quién la tenía?» deja de tener respuesta. El diálogo dice cuántos períodos se pierden, quién la tiene ahora si alguien la tiene, y que si se perdió conviene marcarla como extraviada, que no pierde nada. Lo dice la pantalla; el servicio hace lo confirmado.

Misionero, Matrimonio y Usuario siguen sin eliminar.

## La baja de una Peregrina se llama Extraviada

La Campaña da de baja una imagen cuando se perdió, así que el botón dice «Marcar como extraviada» y la vuelta, «Apareció: recuperarla». El mecanismo es el mismo `bajaAt`, con la misma negativa mientras alguien la tiene. Lo que cambió es que **la misma escritura pone el Estado en `extraviada`**, y recuperarla lo vuelve a `activa`: si no, la ficha diría «Activa» al lado de «Fuera del inventario».

Quedan dos maneras de que una imagen esté extraviada, y son dos situaciones distintas:

- **Estado Extraviada con alguien a cargo.** Se perdió estando en una casa. La Asignación queda abierta a propósito, porque esa última persona es por donde se empieza a buscar (ADR 0004). Sigue en los listados.
- **Marcada como extraviada** (de baja). Nadie la tiene, y sale del inventario activo.

Por eso la negativa de marcarla mientras alguien la tiene ahora dice que se cambie el Estado: es lo que quien aprieta el botón quería hacer.

**Las marcadas se pueden encontrar** (2026-10-19). Una marcada sale de todas las listas pero su Código sigue ocupado. En producción eso dejó a alguien con «Ya hay una Peregrina con el Código CAB JOV 0023» y ninguna pantalla donde verla, ni la imagen para entregar. Ahora pasan tres cosas. El filtro `inventario=marcadas` («Inventario: Marcadas como extraviadas») es el único que alcanza filas de baja, y lo usan igual el listado y el tablero. Cuando el Código repetido es de una marcada que el Actor puede ver, la negativa lo dice y nombra ese filtro; si es de otro territorio, la frase sigue siendo la de siempre. Y la migración 0012 pasa a `extraviada` las bajas anteriores a esta decisión, que habían quedado «Activa».

## La Fecha de consagración

El Año de consagración de un Misionero pasa a ser una fecha, y una Peregrina tiene la suya, opcional, en todas las altas. Es una columna `date` leída como texto (`AAAA-MM-DD`) de punta a punta, para que ninguna zona horaria la corra un día.

La migración va en dos archivos, como pide CLAUDE.md: 0010 agrega las columnas y pasa cada año al 1 de enero de ese año, 0011 tira la columna vieja. Nada tipeado se pierde, y la distribución por año del tablero lee lo mismo — ahora con `extract(year from …)`. Un 1 de enero puede ser un año migrado o una fecha real; no se distingue, y se corrige editando.

`fechaDeConsagracionSchema` rechaza un día que no existe comprobando la vuelta completa: `new Date` convierte «1998-13-40» en una fecha de 1999 en lugar de rechazarla.

## Lo que no se hizo

- **No se adelanta cuál va a ser el siguiente número.** El formulario dice que vacío toma el siguiente libre y muestra el Código al guardar. Precargarlo pedía una lectura por cada cambio de Modalidad o territorio, y una carrera entre lo que alguien tipea y lo que llega del servidor.
- **No se puede tipear el Código entero.** Sólo el número: un Código con letras inventadas no se puede filtrar por Provincia ni por Modalidad.
- **No hay papelera.** Eliminar es definitivo, historial incluido; por eso el aviso.
