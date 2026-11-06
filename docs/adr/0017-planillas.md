# Planillas: exportar lo que se ve, importar Misioneros con su imagen, todo o nada

2026-11-05. Levanta dos cosas que el plan de producción había dejado afuera: «No export to spreadsheet» y «Data entry: manual only. No importer».

## Lo que pasó

Cargar de a uno es engorroso cuando llegan veinte o treinta Misioneros juntos. El usuario lo pidió así (nota de voz del 2026-11-01): una planilla de Excel con una persona por fila, con su peregrina y los datos en columnas, que se vuelque sola a la plataforma; y poder bajar a Excel lo que la plataforma ya tiene.

## La decisión

**Exportar.** Peregrinas y Misioneros se descargan como `.xlsx`, con los mismos filtros que la pantalla tiene puestos en la dirección. Es una lectura más: todos los rols ven el país (ADR 0016), así que todos exportan. La de Misioneros tiene una fila por **persona**, no por Tenedor: una planilla se ordena y se filtra por apellido, y un matrimonio en una sola celda no se puede ordenar. La columna «Matrimonio con» dice quién es el cónyuge, y «Imágenes a cargo» repite las de la casa en los dos.

**Importar.** Una planilla, una fila por Misionero nuevo. La fila puede traer además una imagen:

- **El Código de una imagen ya cargada**: se le entrega esa imagen. Tiene que existir, no tenerla nadie y ser de una Modalidad que el Actor carga.
- **Los datos de una imagen nueva** (Modalidad, Tipo, número o Numeración anterior, Fecha de consagración): se registra en la Diócesis/Localidad del Misionero, con las mismas tres formas de Código que el alta (ADR 0012, 0013), y se le entrega.
- **Nada**: sólo el Misionero.

Las reglas, elegidas por el usuario:

- **Sólo crea.** No modifica Misioneros ni Peregrinas que ya existen, y no hay ida y vuelta exportar → editar → importar. Corregir sigue siendo en la plataforma.
- **Todo o nada.** Primero se **revisa**: cada fila queda marcada bien o con sus motivos. Si una sola tiene un error no se carga ninguna; se corrige el Excel y se vuelve a subir. Al confirmar, la planilla se revisa de nuevo y se escribe en **una** transacción, así que volver a subirla nunca deja la mitad cargada ni duplica la otra mitad.
- **Un aviso no frena.** Un Misionero que ya existe con el mismo nombre en la misma Diócesis/Localidad, o dos filas iguales en la planilla, se avisan pero se cargan: puede ser otra persona, y quien sabe es quien carga.
- **Matrimonios, no.** Se arman después en la plataforma, desde los dos Misioneros.

**Dónde vive: un diálogo, no una pantalla.** Peregrinas y Misioneros llevan en el encabezado el mismo botón, «Planilla de Excel», que abre el mismo diálogo (`PlanillaDeExcel`). Primero pregunta: **Importar Planilla** o **Exportar Planilla**. Después avanza un paso por vez — importar: bajar la plantilla, subirla para revisar, confirmar; exportar: elegir la lista. Exportar ofrece las dos listas desde cualquiera de las dos pantallas; la de la pantalla en que se está puede llevar sus filtros, la otra va entera. Hubo una pantalla aparte, `/misionero/importar`, y se sacó el 2026-11-06 a pedido del usuario: ir y volver para algo que nace en el listado. Las descargas siguen siendo rutas (`/peregrina/planilla`, `/misionero/planilla`, `/misionero/plantilla`), porque son la respuesta con el archivo y no una pantalla.

**La plantilla** se descarga del mismo diálogo y es por Actor: Diócesis/Localidad, Modalidad, Tipo y Centro son desplegables de Excel armados desde la base y desde los enums, y la Modalidad trae sólo las que el Actor carga. Los títulos de las columnas son lo que se lee; el orden y las columnas opcionales que falten no importan.

## Consecuencias

- **Una cuarta forma de abrir una Asignación.** Las otras tres pasan por `AsignacionService`. Esta la abre `PlanillaRepository.cargar`, dentro de la transacción de la importación, con `AsignacionRepository.abrirEn` — la misma escritura que `abrir`, que sigue siendo el único lugar donde se toca el puntero `misioneroActualId`. Las guardas de `asignar` (la imagen existe, no la tiene nadie, la Modalidad la carga el Actor, el Tenedor no está casado) se aplican en la revisión; el índice único parcial sigue siendo la última palabra si dos personas entregan la misma imagen a la vez.
- **`exigirModalidad` corre en la importación** con la Modalidad de cada imagen de la planilla, antes de escribir nada, y registra la denegación como cualquier otra escritura. En la revisión la misma regla aparece como el error de la fila, para que la pantalla diga cuál es.
- **El Código de una imagen nueva sin número** se calcula al revisar: el siguiente de su Provincia y Modalidad, salteando los que la misma planilla escribe a mano. Si otra persona registra uno igual entre la revisión y la carga, el índice único lo rechaza y la carga entera vuelve atrás con un mensaje que lo dice.
- **Límites.** Hasta 500 filas y 2 MB por planilla, y sólo `.xlsx`. Las server actions aceptan hasta 3 MB (`next.config.ts`), así lo que pase de 2 llega y el servicio lo rechaza con una frase en lugar de que Next corte el pedido.
- **Una dependencia nueva**, `exceljs`, sólo en el servidor: lee y escribe `.xlsx` con desplegables, que es lo que hace usable la plantilla.

## Opciones consideradas

- **Cargar las filas buenas y avisar las malas.** Descartada por el usuario: al volver a subir la planilla completa se duplican las que ya entraron.
- **Dos hojas, Misioneros y Peregrinas, sin entregas.** Descartada: el pedido es «misioneros con su peregrina», y la entrega es la mitad del trabajo.
- **También modificar lo existente.** Descartada por ahora: entregas, cambios de Modalidad y ediciones hechas mientras tanto hacen de cada fila un conflicto posible, y las correcciones ya tienen su pantalla con sus controles.
- **CSV.** Más simple de leer, pero no lleva desplegables, Excel lo abre con la codificación equivocada y las fechas cambian según la configuración regional de cada computadora.
