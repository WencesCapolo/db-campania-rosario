# El número del Código se tipea, una imagen sin historial se elimina, y la baja se llama Extraviada

Cuatro pedidos de la Campaña, del 2026-10-13, que deshacen partes de decisiones anteriores. Van juntos porque los cuatro dicen lo mismo de distintas formas: el sistema tiene que seguir a lo que está escrito en las imágenes y en los papeles, y no al revés.

## El número del Código se escribe

Hasta acá un Código nunca se tipeaba: el sistema tomaba el máximo de la Provincia y la Modalidad y sumaba uno. Pero muchas imágenes ya tienen un número escrito con el formato de la Campaña, y no es el que el sistema les daría — se numeraron a mano, con huecos, y en otro orden.

**Se tipea sólo el número.** La Provincia y la Modalidad siguen saliendo del territorio y de la Modalidad elegidos, así que nadie escribe las letras y el formato `[Provincia Modalidad Número]` sigue garantizado. El número es opcional: vacío, se toma el siguiente al más alto, como siempre. Va de 1 a 9999 porque se rellena a cuatro cifras.

**La única regla es que el Código no exista.** No se controla que siga al anterior. Cuentan todas las imágenes del país — las extraviadas también, porque su Código sigue escrito en la estatua, y las de otro territorio también, porque el índice único es sobre `codigo` y no sobre el par territorio-código. El servicio pregunta antes de escribir, para dar un mensaje que nombre el Código, y el índice único es la garantía: dos personas que tipean el mismo número a la vez reciben la misma frase (`codigoRepetidoEn`).

El número tipeado también vale al ponerle Código a una imagen vieja (`generarCodigo`) y al editar una Peregrina. Al editar, **sólo un número cambiado rearma el Código**, con la Provincia y la Modalidad que la imagen tenga al guardar; si el número no se toca, el Código queda como está escrito aunque cambien la Modalidad o el territorio — la misma regla de siempre. Vaciar el número le saca el Código, y se rechaza si no le queda la Numeración anterior: `peregrina_tiene_identificacion` lo rechazaría igual, pero con un mensaje que nadie entiende.

`nextCodigoNum` no cambió: sigue siendo el máximo más uno, así que un número alto tipeado corre la secuencia. Es lo que se quiere: el siguiente automático nunca choca con uno escrito.

## Eliminar, sólo sin historial

«No se borra nada» tenía una razón: cada Asignación tiene que seguir resolviendo a un Código real. Esa razón no alcanza a una imagen que **nunca estuvo a cargo de nadie** — cargada dos veces, o por error — y para esa existe ahora `PeregrinaService.eliminar`, que la borra de verdad.

Se rechaza en cuanto tuvo una Asignación, abierta o cerrada, y el rechazo dice que se la marque como extraviada. La comprobación es sin alcance, como la de la baja: un período registrado desde otro territorio también es historia. Y el `delete` lleva su propio `not exists` contra `asignacion`, porque entre la pregunta y el borrado alguien puede entregarla; la clave foránea, sin cascada, es la tercera red.

La pantalla sólo ofrece «Eliminar» cuando el historial que ve está vacío. Es una cortesía: el servicio decide.

Misionero, Matrimonio y Usuario siguen sin eliminar.

## La baja de una Peregrina se llama Extraviada

La Campaña da de baja una imagen cuando se perdió, así que el botón dice «Marcar como extraviada» y la vuelta, «Apareció: recuperarla». El mecanismo es el mismo `bajaAt`, con la misma negativa mientras alguien la tiene. Lo que cambió es que **la misma escritura pone el Estado en `extraviada`**, y recuperarla lo vuelve a `activa`: si no, la ficha diría «Activa» al lado de «Fuera del inventario».

Quedan dos maneras de que una imagen esté extraviada, y son dos situaciones distintas:

- **Estado Extraviada con alguien a cargo.** Se perdió estando en una casa. La Asignación queda abierta a propósito, porque esa última persona es por donde se empieza a buscar (ADR 0004). Sigue en los listados.
- **Marcada como extraviada** (de baja). Nadie la tiene, y sale del inventario activo.

Por eso la negativa de marcarla mientras alguien la tiene ahora dice que se cambie el Estado: es lo que quien aprieta el botón quería hacer.

## La Fecha de consagración

El Año de consagración de un Misionero pasa a ser una fecha, y una Peregrina tiene la suya, opcional, en todas las altas. Es una columna `date` leída como texto (`AAAA-MM-DD`) de punta a punta, para que ninguna zona horaria la corra un día.

La migración va en dos archivos, como pide CLAUDE.md: 0010 agrega las columnas y pasa cada año al 1 de enero de ese año, 0011 tira la columna vieja. Nada tipeado se pierde, y la distribución por año del tablero lee lo mismo — ahora con `extract(year from …)`. Un 1 de enero puede ser un año migrado o una fecha real; no se distingue, y se corrige editando.

`fechaDeConsagracionSchema` rechaza un día que no existe comprobando la vuelta completa: `new Date` convierte «1998-13-40» en una fecha de 1999 en lugar de rechazarla.

## Lo que no se hizo

- **No se adelanta cuál va a ser el siguiente número.** El formulario dice que vacío toma el siguiente libre y muestra el Código al guardar. Precargarlo pedía una lectura por cada cambio de Modalidad o territorio, y una carrera entre lo que alguien tipea y lo que llega del servidor.
- **No se puede tipear el Código entero.** Sólo el número: un Código con letras inventadas no se puede filtrar por Provincia ni por Modalidad.
- **No hay papelera.** Eliminar es definitivo; por eso se limita a lo que no tiene historia.
