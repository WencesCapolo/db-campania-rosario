import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

/**
 * Next 16 renamed the `middleware` convention to `proxy` — same hook, a name
 * que dice que se trata del borde de la red. El runtime es Node y no es
 * configurable; nada de acá necesita el edge.
 *
 * ─── Por qué sólo mira las navegaciones ──────────────────────────────────────
 *
 * Porque en un POST el guardia del paquete se equivoca, y se equivoca siempre.
 * Para saber si hay sesión reenvía **el mismo pedido** a `get-session` del
 * servidor de auth, con su método original: en un GET eso es `GET get-session`,
 * que contesta 200; en un POST es `POST get-session`, que **no existe y contesta
 * 404**. La respuesta no viene bien, así que el guardia concluye que no hay
 * sesión y redirige a la pantalla de entrar —— con un 307, que conserva el
 * método, de ahí que en los registros se vea un `POST /auth/sign-in` que nadie
 * pidió.
 *
 * Una server action de Next es un POST a la ruta de la propia pantalla. O sea
 * que **toda** server action bajo el matcher moría antes de llegar al servidor,
 * con la sesión puesta y perfectamente válida. Se vio primero en el selector de
 * territorio, que es la única lectura que la aplicación hace desde el cliente y
 * por lo tanto la única que falla sola, sin que nadie apriete nada: «No pudimos
 * cargar los territorios». Pero alcanzaba a cada escritura del sistema.
 *
 * No se pierde nada por dejarlo pasar. El comentario de abajo ya decía lo que
 * hace de verdad la autorización: `getCurrentUser()`, del lado del servidor, en
 * cada pantalla y en cada router —— y de ahí sale el Actor que todo servicio
 * recibe como primer parámetro (ADR 0001). El guardia del borde es un atajo para
 * que una navegación sin sesión no llegue a renderizar; nunca fue la regla.
 *
 * El día que el paquete mande `GET get-session` sin importar el método del
 * pedido, esto se borra y vuelve a ser una línea.
 */
const guardia = auth.middleware({ loginUrl: "/auth/sign-in" });

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  return guardia(request);
}

export const config = {
  matcher: [
    /*
     * Match all protected routes. Next.js will call this proxy for these
     * paths, but the actual auth redirect is handled server-side by
     * getCurrentUser().
     *
     * Excludes: /, /auth/**, /api/auth/**, /_next/**, and static files.
     */
    "/dashboard/:path*",
    "/tablero/:path*",
    "/peregrina/:path*",
    "/misionero/:path*",
    "/matrimonio/:path*",
    "/asignacion/:path*",
    "/admin/:path*",
  ],
};
