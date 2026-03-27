import type { Metadata } from "next";
import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import "@neondatabase/auth/ui/css";
import "./globals.css";

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
    <html lang="es">
      <body>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NeonAuthUIProvider authClient={authClient as any} redirectTo="/dashboard">
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}