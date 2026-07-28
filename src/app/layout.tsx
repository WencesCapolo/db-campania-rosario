import type { Metadata } from "next";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
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
        >
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
