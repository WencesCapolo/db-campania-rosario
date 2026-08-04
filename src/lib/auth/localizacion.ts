/**
 * Las pantallas de Neon Auth, en castellano.
 *
 * El paquete trae sus textos en inglés y los expone como un objeto plano que se
 * puede pisar clave por clave — así que esto no es una traducción de la
 * biblioteca sino la lista de las claves que esta aplicación llega a mostrar:
 * entrar por el enlace del Buzón, entrar con Google, y los errores que el servidor
 * devuelve por su nombre. Lo que no está acá queda en inglés, y eso es a propósito:
 * una clave escrita a mano que la biblioteca dejó de usar es una traducción que
 * nadie ve y que igual hay que mantener.
 *
 * Por eso salieron todas las de contraseña. No hay contraseñas: `credentials` está
 * en falso en el proveedor y `email_and_password` apagado en Neon Auth, así que
 * crear cuenta, recuperar la contraseña y elegir una nueva son pantallas que ya no
 * se pueden alcanzar. Una traducción para una pantalla apagada es exactamente la
 * clave que este archivo dice no tener (ADR 0011).
 *
 * El tuteo es el mismo de todo el sistema — "Ingresá", no "Ingrese".
 */
export const LOCALIZACION_AUTH = {
  /* ── Entrar ─────────────────────────────────────────────────────────── */
  SIGN_IN: "Entrar",
  SIGN_IN_ACTION: "Entrar",
  SIGN_IN_DESCRIPTION: "Te mandamos un enlace al correo del Buzón",
  SIGN_IN_WITH: "Entrar con",
  SIGN_OUT: "Salir",

  /* ── El enlace al Buzón ─────────────────────────────────────────────────
     El paquete lo llama «magic link». Acá no se nombra la magia: se nombra lo
     que la persona va a hacer, que es abrir un correo. */
  MAGIC_LINK: "Enlace al correo",
  MAGIC_LINK_ACTION: "Mandarme el enlace",
  MAGIC_LINK_DESCRIPTION: "Te mandamos un enlace al correo del Buzón",
  MAGIC_LINK_EMAIL:
    "Listo: buscá en el correo del Buzón el enlace para entrar. Dura una hora y sirve una sola vez.",

  /* ── Los campos ─────────────────────────────────────────────────────── */
  EMAIL: "Correo del Buzón",
  EMAIL_PLACEHOLDER: "nombre@ejemplo.com",
  EMAIL_REQUIRED: "Falta el correo del Buzón",
  EMAIL_INSTRUCTIONS: "Escribí un correo electrónico válido.",
  IS_REQUIRED: "es obligatorio",
  IS_INVALID: "no es válido",

  /* ── El pie de la tarjeta ───────────────────────────────────────────── */
  GO_BACK: "Volver",
  CANCEL: "Cancelar",
  CONTINUE: "Continuar",
  OR_CONTINUE_WITH: "O si no",

  /* ── Los errores del servidor ───────────────────────────────────────────
     Llegan por su nombre y no por su texto, así que se traducen acá y no en
     cada pantalla. Los de contraseña se quedan: son nombres que el servidor
     puede seguir devolviendo mientras exista una identidad vieja, y traducir un
     nombre no es lo mismo que dibujar una pantalla. */
  INVALID_EMAIL: "El correo electrónico no es válido",
  INVALID_EMAIL_OR_PASSWORD: "El correo o la contraseña no son correctos",
  EMAIL_NOT_VERIFIED: "Todavía no confirmaste tu correo",
  USER_NOT_FOUND: "No encontramos esa cuenta",
  USER_ALREADY_EXISTS: "Ya hay una cuenta con ese correo",
  USER_BANNED: "Esta cuenta está dada de baja",
  SESSION_EXPIRED: "La sesión venció. Entrá de nuevo.",
  INVALID_TOKEN: "El enlace no es válido, ya venció o ya se usó",
  TOO_MANY_ATTEMPTS: "Demasiados intentos. Probá de nuevo en un rato.",
  RATE_LIMIT_EXCEEDED: "Demasiados intentos. Probá de nuevo en un rato.",
  UNEXPECTED_ERROR: "Algo salió mal. Probá de nuevo.",
  UNKNOWN_ERROR: "Algo salió mal. Probá de nuevo.",
  SERVICE_UNAVAILABLE: "El servicio no está disponible en este momento",
} as const;
