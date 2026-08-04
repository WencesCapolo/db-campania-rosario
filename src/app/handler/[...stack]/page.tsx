"use client";

import * as React from "react";
import Image from "next/image";
import { AuthView } from "@neondatabase/auth/react/ui";
import { LOCALIZACION_AUTH } from "@/lib/auth/localizacion";

/**
 * Entrar, crear cuenta, recuperar la contraseña.
 *
 * Los formularios los dibuja Neon Auth y no nosotros, y eso es deliberado: son
 * las pantallas que tocan credenciales, y reescribirlas a mano sería reescribir
 * también el reenvío del correo de confirmación, el token de recuperación y el
 * segundo factor. Lo que sí es nuestro es cómo se ven — el paquete acepta un
 * `cardHeader` propio y una clase por pieza, así que la tarjeta termina siendo
 * la misma tarjeta de Inicio.
 *
 * ─── Por qué el encabezado es nuestro ────────────────────────────────────────
 *
 * `cardHeader` reemplaza el título y la bajada del paquete, que son un texto por
 * vista. Así que el título lo elegimos nosotros, por ruta, y arriba va el
 * retrato del Padre Pozzobón con el mismo tratamiento de Inicio: el marco de
 * 3 px, el filete dorado y el azul institucional. Alguien que llega acá desde el
 * sitio de la Campaña tiene que reconocer dónde está antes de leer.
 *
 * El resto del tema entra por los tokens de shadcn que el paquete lee —
 * `--primary`, `--border`, `--input` — declarados una sola vez en globals.css.
 * Las clases de acá son lo que los tokens no alcanzan a decir: el alto mínimo de
 * 48 px de cada control, el cuerpo de 18 px y los bordes de 2 px.
 */

type Portada = { titulo: string; bajada?: string };

/*
 * El título por ruta. Las claves son los segmentos que usa Neon Auth
 * (`authViewPaths`), y la de entrar es también el default: una ruta que no
 * conocemos cae en la pantalla que el paquete también elige por defecto.
 */
const PORTADAS: Record<string, Portada> = {
  "sign-in": {
    titulo: "Entrar",
    bajada: "Ingresá tu correo y tu contraseña",
  },
  "sign-up": {
    titulo: "Crear cuenta",
    bajada: "Completá tus datos para crear la cuenta",
  },
  "forgot-password": {
    titulo: "¿Olvidaste la contraseña?",
    bajada: "Ingresá tu correo y te mandamos un enlace para elegir una nueva",
  },
  "reset-password": {
    titulo: "Contraseña nueva",
    bajada: "Escribí abajo la contraseña que vas a usar de ahora en más",
  },
  "magic-link": {
    titulo: "Entrar por correo",
    bajada: "Ingresá tu correo y te mandamos un enlace para entrar",
  },
  "email-otp": {
    titulo: "Entrar con un código",
    bajada: "Ingresá tu correo y te mandamos un código",
  },
  "two-factor": {
    titulo: "Segundo paso",
    bajada: "Ingresá el código para terminar de entrar",
  },
  "accept-invitation": { titulo: "Tu invitación" },
  "sign-out": { titulo: "Saliendo…" },
  callback: { titulo: "Un momento…" },
};

/*
 * Las clases, por pieza. Están acá y no en globals.css porque son de esta
 * pantalla: el paquete no expone selectores estables, expone un `classNames`.
 *
 * `min-h-12` en todo lo que se toca — 54 px con la raíz en 18 px — y `text-base`
 * en los campos, porque el paquete los deja en 14 px y esta gente entra cada
 * registro a mano. El foco no se declara: la regla de globals.css alcanza a
 * cualquier input y a cualquier button, incluidos estos.
 */
const CLASES = {
  base: "w-full max-w-none gap-0 overflow-hidden rounded-marco border-2 border-borde-suave bg-papel py-0 shadow-none",
  header:
    "gap-0 border-b-2 border-borde-suave bg-lienzo px-5 pt-10 pb-7 text-center sm:px-6",
  content: "gap-6 px-5 py-7 sm:px-6",
  footer:
    "justify-center gap-2 border-t-2 border-borde-suave bg-lienzo px-5 py-4 text-base text-tinta-suave sm:px-6",
  footerLink: "min-h-12 text-base font-semibold text-azul underline",
  form: {
    label: "text-base font-semibold text-tinta",
    input:
      "min-h-12 rounded-control border-2 border-borde-fuerte bg-papel text-base text-tinta",
    otpInput: "min-h-12 border-2 border-borde-fuerte text-base text-tinta",
    error: "text-base text-alerta-tinta",
    description: "text-base text-tinta-suave",
    button: "min-h-12 rounded-control text-base font-semibold",
    primaryButton:
      "min-h-12 rounded-control border-2 border-azul-noche bg-azul text-base font-semibold text-white hover:bg-azul-noche",
    secondaryButton:
      "min-h-12 rounded-control border-2 border-azul bg-papel text-base font-semibold text-azul hover:bg-lienzo",
    outlineButton:
      "min-h-12 rounded-control border-2 border-azul bg-papel text-base font-semibold text-azul hover:bg-lienzo",
    /* `flex items-center` y no sólo `min-h-12`: el alto mínimo es el blanco que
       necesita un dedo, y sin centrar deja el texto pegado arriba de la etiqueta
       "Contraseña" que comparte la línea. */
    forgotPasswordLink:
      "flex min-h-12 items-center text-base font-semibold text-azul underline",
    checkbox: "border-2 border-borde-fuerte",
  },
};

export default function StackHandlerPage({
  params,
}: {
  params: Promise<{ stack: string[] }>;
}) {
  const { stack } = React.use(params);
  const path = stack?.[0] || "sign-in";
  const portada = PORTADAS[path] ?? PORTADAS["sign-in"];

  return (
    /* El mismo centrado óptico de Inicio: los `p*` desparejos dejan la tarjeta
       arriba del centro exacto, y `pt-6` es el piso cuando la pantalla es más
       baja que la tarjeta. Acá no hay barra arriba, pero el teclado del teléfono
       ocupa la mitad de abajo, que produce el mismo desequilibrio. */
    <div className="flex min-h-screen items-center justify-center bg-lienzo px-5 pt-6 pb-16">
      <main className="w-full max-w-md">
        <AuthView
          pathname={path}
          localization={LOCALIZACION_AUTH}
          classNames={CLASES}
          cardHeader={
            <>
              {/* El retrato del Padre Pozzobón con la Peregrina, el mismo de
                  Inicio y el mismo del sitio. Va `alt=""` y `aria-hidden`: es la
                  identidad de la pantalla y no un dato, y a quien navega con
                  lector de pantalla no le agrega nada antes del formulario. */}
              <Image
                src="/pozzobon.png"
                alt=""
                width={320}
                height={320}
                priority
                aria-hidden
                className="mx-auto h-20 w-20"
              />

              <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-oro-tinta uppercase sm:text-sm">
                Campaña del Rosario
              </p>

              <h1 className="mt-3 font-stretch-condensed text-4xl leading-tight font-bold text-azul">
                {portada.titulo}
              </h1>

              {portada.bajada && (
                <p className="mt-3 text-base leading-snug text-tinta-suave">
                  {portada.bajada}
                </p>
              )}

              {/* El filete dorado del sitio, corto y centrado: cierra el
                  encabezado. Es decoración y no lleva nada encima — #ac954f da
                  2.9:1, que no alcanza ni para una regla que diga algo. */}
              <hr className="mx-auto mt-7 w-16 border-t-4 border-oro" />
            </>
          }
        />
      </main>
    </div>
  );
}
