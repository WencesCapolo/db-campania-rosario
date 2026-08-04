/**
 * El Buzón en la dirección: `?buzon=`.
 *
 * Un Enlace de invitación es la pantalla de entrar con el Buzón ya escrito, y eso
 * es todo lo que es. No lleva token, no da acceso y no vence: lo único que hace es
 * ahorrarle a quien fue invitado el tipeo de una dirección que tiene que salir
 * carácter por carácter igual a la que quedó guardada — `normalizarEmail` recorta y
 * baja a minúsculas, y nada más, así que un punto de más en un Gmail termina en
 * `/sin-autorizacion` sin explicación (historia 27).
 *
 * Por qué vive acá y no en `InvitacionService`: ningún servicio de este repo sabe
 * que existen las rutas. La cadena de módulos es de dominio de punta a punta, y una
 * regla de negocio que dependa de una dirección web es una regla que hay que tocar
 * el día que cambie el `basePath` del paquete de auth. El enlace es una vista
 * derivada de un dato que el DTO ya trae, así que se arma en la capa que dibuja.
 *
 * Las dos mitades están en el mismo archivo a propósito: quien escribe el parámetro
 * y quien lo lee tienen que estar de acuerdo sobre el nombre y sobre la
 * codificación, y separarlas es la forma más barata de que dejen de estarlo.
 */

/** El nombre del parámetro, escrito una sola vez. */
export const PARAMETRO_BUZON = "buzon";

/**
 * La ruta de la pantalla de entrar. Es la misma que usa `NeonAuthUIProvider` por
 * su `basePath`, y por eso está escrita como está: montada en otro segmento, cada
 * enlace que dibuja el paquete da 404 (commit 63a064a).
 */
export const RUTA_DE_ENTRAR = "/auth/sign-in";

/**
 * El Enlace de invitación.
 *
 * Absoluto cuando se sabe el origen, porque se copia y se manda por WhatsApp,
 * donde una ruta relativa no es nada. Y relativo cuando no se sabe, que es el
 * primer render del servidor: `window.location.origin` no existe ahí, y la
 * alternativa —— adivinar el origen desde una cabecera —— cambia en Vercel entre el
 * alias de producción, el de la rama y la URL por deploy.
 *
 * `URL` codifica el Buzón por nosotros en los dos casos: el `+` y el `#` que un
 * correo puede llevar no sobreviven a una concatenación a mano.
 */
export function enlaceDeInvitacion(
  origen: string | null,
  buzon: string,
): string {
  // La base descartable existe sólo para que `URL` haga la codificación; cuando no
  // hay origen se le quita entera y queda la ruta con su parámetro.
  const base = origen ?? "https://origen.invalido";
  const url = new URL(RUTA_DE_ENTRAR, base);
  url.searchParams.set(PARAMETRO_BUZON, buzon);
  return origen ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * A dónde vuelve la persona después de abrir el enlace, absoluto.
 *
 * Absoluto y no `/dashboard`, y esto es lo único de este archivo que puede mandar
 * a alguien al lugar equivocado. El enlace lo abre un correo, así que el que
 * vuelve no es el navegador que lo pidió: quien resuelve la ruta relativa es el
 * servidor de auth, que vive en otro dominio —— el de Neon —— y ahí `/dashboard` no
 * es ninguna pantalla de esta aplicación. El formulario del paquete arma la
 * dirección entera por la misma razón, y esta función es esa misma cuenta escrita
 * donde se puede probar.
 *
 * El origen sale del navegador que está pidiendo el enlace, y por eso el que se
 * despliega manda al dominio desplegado y el de desarrollo manda a localhost, sin
 * que ninguno de los dos tenga que saber cuál es. Un dominio escrito a mano acá
 * sería el dominio de producción tapando el de la rama, que en Vercel son
 * distintos y los dos están en la lista de dominios de confianza de Neon Auth.
 */
export function destinoAbsoluto(origen: string, ruta: string): string {
  return new URL(ruta, origen).toString();
}

/**
 * El Buzón que trae la dirección, o cadena vacía.
 *
 * Vacío y no `null`: lo que sale de acá es el valor inicial de un campo
 * controlado, y un `null` ahí convierte el campo en no controlado en el primer
 * render y avisa por consola en el segundo.
 *
 * No valida nada. Que la dirección sea un correo lo dice el mismo Zod que valida
 * el campo, y que sea *el* Buzón invitado lo dice `aceptarSiHayPendiente` cuando la
 * persona ya entró. Una dirección escrita a mano en la barra del navegador no puede
 * conseguir nada acá que no consiga tipeándola en el campo.
 */
export function leerBuzon(
  parametros: URLSearchParams | { get(clave: string): string | null } | null,
): string {
  return parametros?.get(PARAMETRO_BUZON)?.trim().toLowerCase() ?? "";
}
