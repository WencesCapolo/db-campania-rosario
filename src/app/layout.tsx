import type { Metadata } from "next";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { LOCALIZACION_AUTH } from "@/lib/auth/localizacion";
import "@neondatabase/auth/ui/css";
import "./globals.css";
import { openSans } from "./fuentes";

export const metadata: Metadata = {
  title: "Base de Datos Campaña del Rosario",
  description:
    "Sistema de gestión de Peregrinas y Misioneros — Campaña del Rosario Argentina",
};

/**
 * Root layout — wraps the entire app with Stack Auth's provider.
 * The StackProvider makes useUser() and useStackApp() available client-side.
 * StackTheme injects Stack Auth's built-in sign-in/sign-up UI styles.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // La variable de la fuente va en el <html> y no en un div: `body` la lee
    // desde --font-marca, así que toda la app comparte una sola cara, incluidas
    // las pantallas de Neon Auth que no pasan por nuestro shell.
    /*
     * `suppressHydrationWarning` va sólo en el <html> y sólo por sus atributos.
     *
     * Lo que rompía la hidratación en cada carga no era nuestro código: el modo
     * oscuro automático del navegador — o una extensión — le agrega `dark` y
     * `color-scheme: dark` a este elemento antes de que React hidrate, y React
     * compara con lo que mandó el servidor y avisa. El aviso no se puede arreglar
     * desde acá porque el cambio no es nuestro; lo que sí se arregla es el efecto,
     * y eso está en globals.css, que ahora declara `color-scheme: light`.
     *
     * Es una supresión de un nivel: no se hereda a los hijos, así que una
     * discrepancia real adentro de la app sigue avisando.
     */
    <html lang="es" suppressHydrationWarning className={openSans.variable}>
      <body>
        <NeonAuthUIProvider
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authClient={authClient as any}
          redirectTo="/dashboard"
          /*
           * Claro, y declarado en lugar de heredado.
           *
           * El default del proveedor es `system`, que con el teléfono en oscuro
           * le pone `dark` al <html> y pinta las pantallas de Neon Auth con su
           * paleta oscura — arriba de una aplicación que es clara en todas las
           * demás. Es la misma media verdad que el bloque borrado de
           * `prefers-color-scheme` en globals.css: el día que haya modo oscuro
           * de verdad, esto vuelve a `system` junto con la otra mitad de la
           * tabla de contraste.
           */
          defaultTheme="light"
          /*
           * Lo que hay y lo que no, declarado acá una sola vez.
           *
           * `credentials` en falso es la mitad de adentro de una decisión cuya
           * mitad de afuera está en Neon Auth: `email_and_password` está apagado
           * allá, y apagarlo sólo acá dejaba la ruta de alta contestando igual
           * —— con ella, el agujero que cerró ADR 0011: quien supiera un Buzón
           * invitado se creaba una cuenta con esa dirección y una contraseña
           * propia, y se quedaba con el Rol de otro.
           *
           * Dos mecánicas del paquete regalan trabajo y por eso no hay nada más
           * escrito acá: sin credenciales, la vista de entrar va sola a la del
           * enlace; y el pie de «Crear cuenta» lo dibuja la conjunción de
           * credenciales y alta, así que se va solo con `signUp` en falso.
           *
           * `signUp` en falso es la pantalla, no la política: del lado de Neon,
           * `magic_link.disable_sign_up` queda en falso y tiene que quedar —— una
           * persona recién invitada todavía no tiene identidad, y con el alta
           * cerrada no podría entrar nunca. La primera entrada *es* el alta.
           */
          credentials={false}
          magicLink
          signUp={false}
          social={{ providers: ["google"] }}
          /* El castellano de las pantallas de credenciales. Va en el proveedor
             y no en cada pantalla para que también alcance a las de cuenta. */
          localization={LOCALIZACION_AUTH}
        >
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
