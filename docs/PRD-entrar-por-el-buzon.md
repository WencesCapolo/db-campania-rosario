# PRD — Entrar por el Buzón

Decidido el 2026-08-04, en una sesión de grilling. La decisión está en
`docs/adr/0011-entrar-es-un-enlace-al-buzon.md` y el vocabulario en `CONTEXT.md`
(**Buzón**, **Invitación**, **Enlace de invitación**). Este PRD es cómo se
construye; el ADR es por qué.

## Problema

Hoy, para quedarse con el Rol y el territorio de una Invitación basta con **saber
la dirección invitada**. Nadie prueba nunca que ese buzón sea suyo.

ADR 0003 empareja una Invitación por email y nada más — la id de Neon Auth no
existe todavía cuando se escribe la invitación, así que la dirección es la única
llave. Eso vale exactamente en la medida en que quien entra demuestre que el buzón
es suyo, y no lo demuestra: upstream está habilitado el alta con contraseña, con
`requireEmailVerification` y `sendVerificationEmailOnSignUp` en falso. Cualquiera
que conozca o adivine `responsable.cordoba@…` se crea una cuenta con esa dirección
y una contraseña propia, y `getCurrentUser()` le entrega el Rol y el territorio que
alguien había reservado para otra persona. El privilegio no vive en la Invitación:
vive en saber una dirección.

Al lado de eso hay un problema más chico y más cotidiano. Las contraseñas las
sostiene gente grande que entra cada registro a mano, y cada una que se olvida es
un llamado por teléfono: crear cuenta, recuperar, elegir una nueva, tres pantallas
que existen sólo porque existe la contraseña.

Y hay un tercero, que es el que hace que el primero no se arregle solo: a la
persona invitada **nadie le avisa**. `invitar` escribe una fila y no manda nada. Se
entera por teléfono, y después tiene que escribir la dirección igual que la
escribió quien la invitó — `normalizarEmail` sólo recorta y baja a minúsculas, así
que un punto de más en un Gmail termina en `/sin-autorizacion` sin explicación.

## Solución

Entrar es un enlace al Buzón. No hay contraseñas.

El Buzón es la dirección con la que se entra, y pertenece a una Diócesis/Localidad
antes que a una persona: un acceso por territorio, que se traspasa a quien sigue
cambiándole la contraseña al correo. Recibir el enlace en ese buzón **es** la
prueba de pertenencia que ADR 0003 daba por supuesta, y con eso emparejar por email
vuelve a ser sólido.

No hay pantalla de crear cuenta. La primera entrada *es* el alta: la persona pide un
enlace, lo abre, Neon Auth crea la identidad, y `getCurrentUser()` encuentra la
Invitación pendiente y crea el Usuario.

Quien invita copia un **Enlace de invitación** y lo manda por donde ya le habla a
esa persona. Ese enlace abre la pantalla de entrar con el Buzón ya escrito, así que
nadie tipea la dirección. No lleva token y no da acceso: apretar el botón manda el
enlace de verdad al Buzón. Los dos enlaces son cosas distintas y vienen de lugares
distintos — el de invitación sale de la app, el de entrar sale del correo, dura una
hora y sirve una sola vez. Quien pueda abrir el Buzón puede reenviar ese segundo
enlace, y así entra alguien que todavía no recibió la contraseña del correo.

Google queda habilitado: el Buzón de una Localidad suele ser un Gmail parroquial, y
ahí un toque es mejor que una vuelta por el correo.

## Historias de usuario

La numeración sigue desde 23, que es la más alta en uso — las pruebas citan las
historias por número y no se pueden pisar.

24. Como Asesor Nacional, quiero invitar a un Responsable Diocesano escribiendo el
    Buzón de su Diócesis, para que el acceso quede atado al territorio y no a una
    persona que puede irse.
25. Como quien invita, quiero copiar un Enlace de invitación de un solo gesto, para
    mandárselo por WhatsApp a quien invité sin dictarle una dirección por teléfono.
26. Como quien invita, quiero que ese enlace no dé acceso por sí solo, para poder
    mandarlo por donde sea sin pensar en quién más lo ve.
27. Como persona invitada, quiero abrir el Enlace de invitación y encontrar mi Buzón
    ya escrito, para no equivocarme en un punto y quedar afuera sin saber por qué.
28. Como persona invitada, quiero apretar un botón y recibir un enlace en el Buzón,
    para entrar sin que nadie me haya dado una contraseña.
29. Como persona invitada, quiero que mi primera entrada me deje adentro con mi Rol
    y mi territorio, para no tener que pedirle a nadie que me "active".
30. Como Referente Local que todavía no tiene la contraseña del Buzón, quiero que
    quien la tenga me reenvíe el enlace del correo, para poder entrar la primera vez.
31. Como Referente Local, quiero que el enlace me sirva un rato y no cinco minutos,
    para que me alcance el tiempo de encontrar el teléfono y los anteojos.
32. Como Referente Local, quiero que un enlace ya usado no sirva de nuevo, para que
    el que quedó en el historial de WhatsApp no sea una llave.
33. Como Referente Local que usa la app cada semana, quiero no volver a ver la
    pantalla de entrar, porque la sesión se corre sola con el uso.
34. Como Referente Local con el Buzón en la mano, quiero pedirme el enlace yo mismo,
    para no depender de que nadie esté disponible.
35. Como Referente Local que deja la tarea, quiero traspasar el acceso cambiándole
    la contraseña al correo, para que el territorio siga entrando y yo no.
36. Como Usuario cualquiera, quiero entrar con el Google del Buzón cuando es un
    Gmail, para entrar de un toque sin pasar por el correo.
37. Como Usuario que llegó con la cuenta de Google equivocada, quiero que la
    pantalla del rechazo me diga **con qué dirección** entré, para darme cuenta solo.
38. Como persona invitada que escribió mal la dirección, quiero lo mismo, para
    entender que el problema es la dirección y no la invitación.
39. Como Usuario, quiero no tener que elegir nunca una contraseña, para que no haya
    ninguna que olvidar ni ninguna que circule por WhatsApp.
40. Como Usuario, quiero que la pantalla de entrar sea un campo y un botón, para que
    no haya nada que decidir.
41. Como Usuario, quiero que la pantalla de entrar se vea como el resto de la
    Campaña, para reconocer dónde estoy antes de leer.
42. Como Usuario con poca vista, quiero que esa pantalla cumpla el piso de
    accesibilidad del proyecto, para poder usarla como uso las demás.
43. Como Usuario en un teléfono, quiero entrar con una mano, porque es el teléfono
    lo que tengo en la parroquia.
44. Como extraño que escribe una dirección cualquiera, quiero que el sistema no me
    dé nada, para que la Campaña no dependa de que nadie adivine mal.
45. Como Asesor Nacional, quiero que quien conozca un Buzón invitado no pueda
    quedarse con su Rol, para que el privilegio viva en la Invitación y no en un dato.
46. Como admin, quiero cortar un acceso en el acto dándole de baja al Usuario, para
    no depender de que se venza una sesión.
47. Como quien invita, quiero seguir viendo las Invitaciones pendientes, para saber
    quién todavía no entró y a quién hay que volver a avisarle.
48. Como quien invita, quiero que la pantalla me diga que el Buzón es la dirección
    de un territorio y no la de una persona, para no invitar el Gmail personal de
    alguien sin darme cuenta.

## Decisiones de implementación

### Upstream, en Neon Auth — y va primero

Cuatro cambios de configuración, y el primero es una **compuerta**: hoy
`sign-in/magic-link` da 404, así que todo lo demás se construiría sobre una ruta que
no existe. `PATCH …/auth/plugins/magic-link` está confirmado en la API.

1. Habilitar el plugin `magic_link`. La vigencia del enlace, una hora. Hay que
   resolver la unidad al hacerlo: `magic_link.expires_in` viene en `5` y al lado
   `phone_number.otp_expires_in` viene en `300`, así que una de las dos no está en
   la misma unidad.
2. `magic_link.disable_sign_up` queda en **falso**, y tiene que quedar: una persona
   recién invitada todavía no tiene identidad, y con el alta cerrada no podría
   entrar nunca.
3. `email_and_password.enabled` a **falso**. Esta es la mitad que cierra el agujero:
   apagarlo sólo en la pantalla deja la ruta de alta con contraseña contestando
   igual. Con esto termina el acceso por contraseña de la única identidad que
   existe, que queda cubierta por Google y por el enlace sobre el mismo Gmail.
4. El plugin `organization` a deshabilitado. No lo usa nada del repo y le pone un
   segundo significado a la palabra *invitación*, que es la palabra sobre la que se
   apoya ADR 0003.

Nada de esto lo prueba la suite. Se verifica a mano contra la app corriendo y con un
pedido a `sign-in/magic-link`, que tiene que contestar 400 y no 404.

### El proveedor y las pantallas

- El proveedor de la UI de Neon Auth declara: sin credenciales, con enlace mágico,
  sin alta, y Google entre los sociales. Dos mecánicas del paquete hacen la mayor
  parte del trabajo: sin credenciales manda la vista de entrar a la del enlace, y el
  pie de «Crear cuenta» lo dibuja la conjunción de credenciales y alta, así que se va
  solo.
- El formulario de esa pantalla es **nuestro**, y es la única pieza de credenciales
  escrita a mano: un campo y un botón, que lee el Buzón de la dirección y llama al
  cliente de auth. El formulario del paquete no se puede precargar — trae el email
  vacío adentro y de la dirección sólo lee a dónde volver.
- Las portadas por ruta quedan sólo en las vistas alcanzables. Se van crear cuenta,
  olvidé la contraseña, contraseña nueva, segundo paso, código por correo y aceptar
  invitación: cada una está ahora deshabilitada upstream o es inalcanzable.
- El castellano de esas pantallas sigue viviendo en un solo lugar, en el proveedor.
  Entran las cadenas del enlace y se retiran las de contraseña.

### El Enlace de invitación

Lo compone **la pantalla**, no el servicio, y la razón es arquitectónica antes que
práctica: ningún servicio de este repo sabe que existen las rutas. La cadena de
módulos es de dominio de punta a punta, y meter una ruta adentro de
`InvitacionService` haría que una regla de negocio dependa de una dirección web. El
enlace es una vista derivada de un dato que el DTO ya trae — el Buzón —, así que la
pantalla de administración de Usuarios lo arma con el origen del navegador y lo
ofrece con un control de copiar.

Consecuencia deliberada: **no hay cambio de servicio, de repositorio ni de esquema
en toda esta feature.** Lo único que puede salir mal es cómo se codifica la
dirección dentro de la dirección web, y eso se afirma sobre el control renderizado.

### El rechazo

`/sin-autorizacion` pasa a decir con qué dirección entró quien llegó. Es lo que
vuelve diagnosticables los dos modos de falla que se aceptaron a ojos abiertos: la
dirección mal escrita y la cuenta de Google equivocada. La pantalla lee la sesión
directamente — está afuera del grupo `(dashboard)` justamente para no resolver un
Actor, y sigue así.

### Lo que no se toca, y por qué

- **La app no manda ningún correo, y sigue sin mandar ninguno.** Quien invita avisa;
  la persona se pide su propio enlace. Así la jerarquía no depende de que se entregue
  un mail, que es la dependencia que ADR 0003 rechazó para los webhooks.
- **Las identidades sueltas se dejan.** Cualquiera que escriba una dirección
  cualquiera crea una identidad en `neon_auth`. Es inofensivo por ADR 0002: sin fila
  de Usuario no hay Rol y no se lee ni una Peregrina. No se barren, porque un barrido
  borraría a quien fue invitado y todavía no se enteró.
- **La sesión queda en siete días que se corren con el uso.** Se quisieron seis
  meses y Neon no lo expone: no hay campo de sesión en la configuración, no hay ruta
  en la API, y la que por nombre parece serlo acepta un solo campo, que es el nombre
  del proyecto de auth. Llegar a seis meses pediría emitir nosotros una cookie
  firmada arriba de la de Neon, o dejar Neon Auth administrado.
- **El traspaso del Buzón queda afuera del sistema**: se cambia la contraseña del
  correo. La sesión del teléfono anterior sirve hasta siete días más; cortar en el
  acto ya existe y es otra cosa — la baja del Usuario, que el rechazo aplica en el
  pedido siguiente sin importar qué cookie haya.

## Decisiones de prueba

Una buena prueba acá afirma sobre comportamiento externo: qué obtiene un Actor
cuando pide algo, no cómo se armó la consulta. `docs/TESTING.md` es explícito —
una sola costura, `Servicio.método(actor, entrada)` contra Postgres de verdad, sin
pruebas de repositorio.

**No hace falta ninguna costura nueva, y la cuenta no sube.** Como no cambia ningún
servicio, las costuras que ya existen cubren todo lo que es regla:

- `InvitacionService.invitar` y `InvitacionService.aceptarSiHayPendiente` ya tienen
  cobertura amplia — quién puede invitar a quién, el par rol/territorio, aceptar dos
  veces, mayúsculas y espacios en el email, una invitación revocada, y que el Usuario
  invitado trabaje en su territorio y no en otro. Ninguna de esas reglas cambia, y
  todas tienen que seguir pasando: son la red que dice que esta feature no movió
  ADR 0003 de lugar.
- Prior art para eso: el archivo de pruebas de invitación, y para la mitad
  territorial los archivos de alcance de los otros módulos.

Lo que sí se agrega es **un archivo en el proyecto `navegador`**, para la pantalla de
entrar, montada con la hoja de estilos real como el resto de esa suite:

- Que el Buzón llegue escrito cuando la dirección lo trae, y vacío cuando no.
- Que el control de copiar de la pantalla de Usuarios ofrezca la dirección con el
  Buzón bien codificado.
- Sin violaciones de axe; blancos de 48 px cumplidos; el recorrido con teclado
  completo; 18 px de cuerpo en el campo.
- Prior art: las pruebas del flujo de asignación y las de validación al salir, que
  ya hacen exactamente esto.

`src/app/contraste.test.ts` no necesita pares nuevos mientras la pantalla siga
usando los que ya usa. Si aparece un par nuevo, va ahí antes de mirarse en pantalla.

Fuera del alcance de las dos suites, y por eso a mano: los cuatro cambios upstream,
y cómo cae el CSS del paquete en la página — el proyecto `navegador` importa
`globals.css` por Vite y no por el pipeline de Next, así que un cambio en cómo una
utilidad llega a la página se verifica en la app corriendo.

## Fuera de alcance

- **El código de seis dígitos.** Se evaluó y se rechazó: es una cosa más para
  tipear. Está anotado en ADR 0011 con lo que se resignó, porque era el camino más
  barato — `sign-in/email-otp` ya está montado upstream — y porque un enlace abierto
  desde la aplicación de Gmail deja la sesión en el navegador interno de Gmail. Si
  eso aparece en la práctica, la salida ya está escrita.
- **Copiar el enlace de entrar desde la app.** No se puede: ninguna ruta de la API
  de Neon Auth administrado lo devuelve. Pediría Better Auth propio.
- **Seis meses de sesión**, por lo mismo.
- **Migrar los Usuarios que ya existen a Invitaciones.** Sigue fuera, como en
  ADR 0003.
- **Las variables de entorno de Preview en Vercel** y la rama de Neon que necesitan.
  Los deploys de Preview fallan por eso, y es otro trabajo.
- **La fila huérfana de `users`.** Hay dos filas contra una identidad. ADR 0002 § 13
  dice que la pantalla de Usuarios tiene que mostrar eso, y sólo existe la dirección
  contraria.
- **`findPorEmail` ignora `bajaAt`**, así que un Buzón dado de baja no se puede
  volver a invitar y el único camino de vuelta es reactivar, que el mensaje de error
  no sugiere.
- **El remitente propio.** Neon manda con su remitente compartido; la Campaña va a
  querer su dominio antes de que la entrega importe de verdad.

## Notas

- El orden importa y no es negociable: la compuerta primero. Si el plugin no se
  puede habilitar por API, se habilita por consola, y si no se puede, esta feature
  se detiene antes de tocar una pantalla.
- Los dominios de confianza ya están puestos para producción y para el alias de la
  rama `trabajo`. Cada rama nueva con deploy propio necesita el suyo, y las URLs por
  deploy no sirven porque cambian en cada build.
- La única identidad que existe hoy es la de quien desarrolla, con contraseña. Es
  todo el radio de explosión del punto 3.
