# Un Buzón por función, no por territorio: todos ven el país, y la Modalidad acota lo que se escribe

2026-10-29. Reemplaza la parte territorial de ADR 0001 y 0003, y la idea de ADR 0011 de que un Buzón es de una Diócesis/Localidad.

## Lo que pasó

El modelo tenía un Buzón por territorio: un `referente_local` y un `responsable_diocesano` por Diócesis/Localidad, cada uno acotado a la suya. Para la Campaña eso significaba armar y traspasar decenas de cuentas de Gmail, y en la práctica no se armó ninguna. En producción había 3 admin y 3 asesores, y ningún Usuario ni Invitación de los dos rols territoriales.

La gente que usa el sistema es de mucha confianza, y lo que hay que simplificar es el manejo de Usuarios, no la seguridad entre Diócesis.

## La decisión

Dos Buzones compartidos, uno por función:

| Rol | Buzón | Ve | Escribe | Configura |
|---|---|---|---|---|
| `admin` | personal | el país | todo | sí |
| `asesor_nacional` | personal | el país | todo | sí |
| `responsable_diocesano` | uno, de todos los Responsables | el país | Peregrinas de **todas** las Modalidades, Misioneros, Asignaciones | no |
| `dirigente_joven` | uno, de todos los Dirigentes | el país | Peregrinas **`JOV`**, Misioneros, Asignaciones de imágenes `JOV` | no |

**Configurar** es Usuarios, Invitaciones y Territorio. **Cargar** es todo lo demás, incluido Borrar una Peregrina.

- **`referente_local` desaparece.** Su valor del enum pasa a ser `dirigente_joven` (un `RENAME VALUE` en la migración 0014). Si hubiera quedado una fila, se habría vuelto Dirigente Joven. No quedaba ninguna.
- **Ningún rol lleva territorio.** Los cuatro son nacionales en `derivarAlcance`. La migración limpia `diocesis_localidad_id` en Usuarios e Invitaciones pendientes.
- **Responsable Diocesano y Dirigente Joven comparten rango** (`superaEnRango`, en `db/schema/users.ts`). Ninguno administra al otro y ninguno invita a nadie. Los dos los invita un admin o un Asesor Nacional, una vez cada uno.
- **La Modalidad acota escrituras, no lecturas.** El Dirigente Joven lee cualquier Peregrina, cifra y Misionero. `exigirModalidad` (en `lib/authorization/capacidades.ts`) rechaza crear, editar, generar Código, borrar, asignar, entregar, devolver y corregir sobre una imagen que no es `JOV`. En una edición controla los dos extremos, la Modalidad que la imagen tiene y la que se le da, igual que antes con un cambio de territorio.
- **Un Misionero no tiene Modalidad**, y no se le agrega. El Dirigente Joven carga y edita a cualquier Misionero del país.

## Consecuencias

- **La pantalla no ofrece lo que el servicio rechaza.** Las listas para entregar (`PeregrinaService.listParaEntregar` y `listDisponibles`) traen sólo las Modalidades que el Actor carga. La ficha de una imagen de otra Modalidad se puede ver, pero no muestra Editar, Entregar, Devolver, Corregir, Generar Código ni Borrar, y en su lugar dice por qué. En las altas, la Modalidad no es un desplegable sino el texto «Jóvenes (JOV)», porque una lista de una opción no es una elección. La Modalidad la resuelve el layout una vez y baja por contexto (`ModalidadPropiaProvider`).
- **El Tablero y Peregrinas abren filtrados en `JOV`** para el Dirigente Joven (`filtroPropio`). Es un punto de partida y no un límite: si se saca el filtro, se ve todo.
- **«Registrada por» deja de decir dónde.** Una Asignación muestra el territorio del Usuario que la registró, y estos cuatro rols no tienen. Se aceptó a sabiendas: con un Buzón compartido, el registro no podía decir *quién* y ahora tampoco dice *dónde*. Las Asignaciones viejas siguen resolviendo.
- **El registro de denegaciones** anota rol y operación. El territorio del Actor queda siempre en null.
- **El filtro territorial queda sin rol que lo use.** La rama `diocesis` de `Alcance`, el fail-closed por falta de territorio y el par rol↔territorio de las Invitaciones siguen en el código, pero ningún rol llega a ellos. Sacarlos es un paso aparte, para que este cambio de permisos se lea limpio.
- **Y después se sacó.** En el paso siguiente se borró `Alcance` entero (`derivarAlcance`, `exigirDentroDelAlcance` y compañía): ningún repositorio recibe un alcance, ningún servicio lo deriva, y las listas de selección son el país. Se fueron también el motivo `sin-territorio`, las columnas `diocesis_localidad_id` de `users` y de `invitacion` (migración 0015), los campos de territorio del registro de denegaciones y los selectores de territorio de Usuarios. Un territorio es sólo un filtro que alguien elige; la autorización que queda vive entera en `lib/authorization/capacidades.ts`.

## Opciones consideradas

**Acotar también las lecturas por Modalidad.** Se rechazó. Agregaba un segundo eje de alcance a cada lectura, cifra y plan de índice (ADR 0007), y dejaba casos sin buena respuesta: un Misionero «ocupado» con una imagen que el Dirigente no puede ver, o historiales con huecos. Contra gente de confianza no protege de nada.

**Mantener los rols territoriales al lado de los nuevos.** Se rechazó. Eran cuatro rols de carga para un sistema que usa dos, y el objetivo del cambio es tener menos cuentas.

**Darle una Modalidad al Misionero.** Se rechazó. Un Misionero es «de Jóvenes» sólo porque tiene o tuvo una imagen `JOV`, y esa relación ya la registra la Asignación.
