/**
 * Las pantallas de Neon Auth, en castellano.
 *
 * El paquete trae sus textos en inglés y los expone como un objeto plano que se
 * puede pisar clave por clave — así que esto no es una traducción de la
 * biblioteca sino la lista de las claves que esta aplicación llega a mostrar:
 * entrar, crear cuenta, recuperar y elegir contraseña, y los errores que el
 * servidor devuelve por su nombre. Lo que no está acá queda en inglés, y eso es
 * a propósito: una clave escrita a mano que la biblioteca dejó de usar es una
 * traducción que nadie ve y que igual hay que mantener.
 *
 * El tuteo es el mismo de todo el sistema — "Ingresá", no "Ingrese".
 */
export const LOCALIZACION_AUTH = {
  /* ── Entrar ─────────────────────────────────────────────────────────── */
  SIGN_IN: "Entrar",
  SIGN_IN_ACTION: "Entrar",
  SIGN_IN_DESCRIPTION: "Ingresá tu correo y tu contraseña",
  SIGN_IN_USERNAME_DESCRIPTION: "Ingresá tu usuario o tu correo",
  SIGN_IN_WITH: "Entrar con",

  /* ── Crear cuenta ───────────────────────────────────────────────────── */
  SIGN_UP: "Crear cuenta",
  SIGN_UP_ACTION: "Crear la cuenta",
  SIGN_UP_DESCRIPTION: "Completá tus datos para crear la cuenta",
  SIGN_UP_EMAIL: "Te mandamos un correo con el enlace para confirmar.",

  /* ── Los campos ─────────────────────────────────────────────────────── */
  EMAIL: "Correo electrónico",
  EMAIL_PLACEHOLDER: "nombre@ejemplo.com",
  EMAIL_REQUIRED: "Falta el correo electrónico",
  EMAIL_INSTRUCTIONS: "Escribí un correo electrónico válido.",
  NAME: "Nombre",
  NAME_PLACEHOLDER: "Nombre y apellido",
  PASSWORD: "Contraseña",
  PASSWORD_PLACEHOLDER: "Contraseña",
  PASSWORD_REQUIRED: "Falta la contraseña",
  CONFIRM_PASSWORD: "Repetir la contraseña",
  CONFIRM_PASSWORD_PLACEHOLDER: "Repetir la contraseña",
  CONFIRM_PASSWORD_REQUIRED: "Falta repetir la contraseña",
  PASSWORDS_DO_NOT_MATCH: "Las dos contraseñas no son iguales",
  NEW_PASSWORD: "Contraseña nueva",
  NEW_PASSWORD_PLACEHOLDER: "Contraseña nueva",
  NEW_PASSWORD_REQUIRED: "Falta la contraseña nueva",
  CURRENT_PASSWORD: "Contraseña actual",
  CURRENT_PASSWORD_PLACEHOLDER: "Contraseña actual",
  REMEMBER_ME: "Mantener la sesión abierta",
  IS_REQUIRED: "es obligatorio",
  IS_INVALID: "no es válido",

  /* ── Recuperar la contraseña ────────────────────────────────────────── */
  FORGOT_PASSWORD: "Recuperar la contraseña",
  /* Corto a propósito: va en la misma línea que la etiqueta "Contraseña", y con
     el texto largo se parte en dos renglones y desalinea el campo. */
  FORGOT_PASSWORD_LINK: "¿La olvidaste?",
  FORGOT_PASSWORD_ACTION: "Mandarme el enlace",
  FORGOT_PASSWORD_DESCRIPTION:
    "Ingresá tu correo y te mandamos un enlace para elegir una contraseña nueva",
  FORGOT_PASSWORD_EMAIL:
    "Te mandamos un correo con el enlace para elegir una contraseña nueva.",
  RESET_PASSWORD: "Elegir una contraseña nueva",
  RESET_PASSWORD_ACTION: "Guardar la contraseña",
  RESET_PASSWORD_DESCRIPTION: "Escribí abajo tu contraseña nueva",
  RESET_PASSWORD_SUCCESS: "Listo: la contraseña quedó cambiada.",
  CHANGE_PASSWORD: "Cambiar la contraseña",
  CHANGE_PASSWORD_DESCRIPTION:
    "Ingresá tu contraseña actual y la contraseña nueva.",
  CHANGE_PASSWORD_INSTRUCTIONS: "Usá 8 caracteres como mínimo.",
  CHANGE_PASSWORD_SUCCESS: "Listo: la contraseña quedó cambiada.",
  SET_PASSWORD: "Poner una contraseña",

  /* ── El pie de la tarjeta ───────────────────────────────────────────── */
  DONT_HAVE_AN_ACCOUNT: "¿No tenés cuenta?",
  ALREADY_HAVE_AN_ACCOUNT: "¿Ya tenés cuenta?",
  GO_BACK: "Volver",
  CANCEL: "Cancelar",
  CONTINUE: "Continuar",
  OR_CONTINUE_WITH: "O si no",

  /* ── Confirmar el correo ────────────────────────────────────────────── */
  VERIFY_YOUR_EMAIL: "Confirmá tu correo",
  VERIFY_YOUR_EMAIL_DESCRIPTION:
    "Buscá en tu correo el mensaje con el enlace de confirmación. Si no te llegó, tocá el botón de abajo para que se mande de nuevo.",
  RESEND_VERIFICATION_EMAIL: "Mandar el correo de nuevo",
  EMAIL_VERIFICATION: "Buscá en tu correo el enlace de confirmación.",

  /* ── Los errores del servidor ───────────────────────────────────────────
     Llegan por su nombre y no por su texto, así que se traducen acá y no en
     cada pantalla. El de credenciales es a propósito el mismo para un correo
     que no existe y para una contraseña equivocada. */
  INVALID_EMAIL_OR_PASSWORD: "El correo o la contraseña no son correctos",
  INVALID_USERNAME_OR_PASSWORD: "El usuario o la contraseña no son correctos",
  INVALID_EMAIL: "El correo electrónico no es válido",
  INVALID_PASSWORD: "La contraseña no es correcta",
  EMAIL_NOT_VERIFIED: "Todavía no confirmaste tu correo",
  USER_NOT_FOUND: "No encontramos esa cuenta",
  USER_ALREADY_EXISTS: "Ya hay una cuenta con ese correo",
  USER_BANNED: "Esta cuenta está dada de baja",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga",
  SESSION_EXPIRED: "La sesión venció. Entrá de nuevo.",
  INVALID_TOKEN: "El enlace no es válido o ya venció",
  TOO_MANY_ATTEMPTS: "Demasiados intentos. Probá de nuevo en un rato.",
  RATE_LIMIT_EXCEEDED: "Demasiados intentos. Probá de nuevo en un rato.",
  UNEXPECTED_ERROR: "Algo salió mal. Probá de nuevo.",
  UNKNOWN_ERROR: "Algo salió mal. Probá de nuevo.",
  SERVICE_UNAVAILABLE: "El servicio no está disponible en este momento",
} as const;
