import type { Metadata } from "next";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import "@neondatabase/auth/ui/css";
import "./globals.css";
import { openSans } from "./fuentes";

export const metadata: Metadata = {
  title: "Base de Datos Campaña del Rosario",
  description: "Sistema de gestión de Peregrinas y Misioneros — Campaña del Rosario Argentina",
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
    <html lang="es" className={openSans.variable}>
      <body>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NeonAuthUIProvider authClient={authClient as any} redirectTo="/dashboard">
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}