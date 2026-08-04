"use client";

import * as React from "react";
import Image from "next/image";
import { AuthView, GoogleIcon } from "@neondatabase/auth/react/ui";
import { LOCALIZACION_AUTH } from "@/lib/auth/localizacion";
import { authClient } from "@/lib/auth/client";
import { destinoAbsoluto, leerBuzon } from "@/lib/auth/buzon";
import Boton from "@/components/Boton";
import FormularioDeBuzon from "./FormularioDeBuzon";

/**
 * Entrar.
 *
 * Ya no dice «entrar, crear cuenta, recuperar la contraseña»: no hay contraseñas y
 * no hay alta. Entrar es un enlace al Buzón, y el Buzón es la dirección de un
 * territorio antes que la de una persona (ADR 0011). Las tres pantallas que
 * existían sólo porque existía la contraseña — crearla, olvidarla, elegir otra —
 * están apagadas arriba, en Neon Auth, y por eso también salieron de acá.
 *
 * Lo que queda son dos caminos al mismo lugar. El enlace al correo, que es el que
 * vale siempre y es el que hace la prueba de pertenencia. Y Google, porque el Buzón
 * de una Localidad suele ser un Gmail parroquial y ahí un toque es mejor que una
 * vuelta por el correo (historia 36).
 *
 * ─── Qué dibuja el paquete y qué dibujamos nosotros ──────────────────────────
 *
 * El formulario de entrar es nuestro, y es la única excepción: el del paquete no se
 * puede precargar con el Buzón que trae el Enlace de invitación. La razón larga
 * está en `FormularioDeBuzon`. Todo lo demás que sobrevive — el `callback` que
 * cierra la vuelta del correo, el `sign-out` — lo sigue dibujando `AuthView`, y lo
 * nuestro es cómo se ve: `cardHeader` propio y una clase por pieza, así que la
 * tarjeta termina siendo la misma tarjeta de Inicio.
 *
 * ─── Por qué el encabezado es nuestro ────────────────────────────────────────
 *
 * `cardHeader` reemplaza el título y la bajada del paquete, que son un texto por
 * vista. Así que el título lo elegimos nosotros, por ruta, y arriba va el retrato
 * del Padre Pozzobón con el mismo tratamiento de Inicio: el marco de 3 px, el
 * filete dorado y el azul institucional. Alguien que llega acá desde el sitio de la
 * Campaña tiene que reconocer dónde está antes de leer.
 *
 * El resto del tema entra por los tokens de shadcn que el paquete lee —
 * `--primary`, `--border`, `--input` — declarados una sola vez en globals.css. Las
 * clases de acá son lo que los tokens no alcanzan a decir: el alto mínimo de 48 px
 * de cada control, el cuerpo de 18 px y los bordes de 2 px.
 */

type Portada = { titulo: string; bajada?: string };

/*
 * El título por ruta, y la lista es corta a propósito: son las vistas que se pueden
 * alcanzar. Crear cuenta, olvidé la contraseña, contraseña nueva, segundo paso,
 * código por correo y aceptar invitación se fueron con su portada — cada una está
 * ahora deshabilitada upstream o es inalcanzable, y una portada para una pantalla
 * que nadie ve es una traducción que hay que mantener igual.
 *
 * Las claves son los segmentos que usa Neon Auth (`authViewPaths`), y la de entrar
 * es también el default: una ruta que no conocemos cae en la pantalla que el
 * paquete también elige por defecto.
 */
const PORTADAS: Record<string, Portada> = {
  "sign-in": {
    titulo: "Entrar",
    bajada: "Te mandamos un enlace al correo del Buzón",
  },
  "magic-link": {
    titulo: "Entrar",
    bajada: "Te mandamos un enlace al correo del Buzón",
  },
  "sign-out": { titulo: "Saliendo…" },
  callback: { titulo: "Un momento…" },
};

/* Las dos rutas que llevan a nuestro formulario. Con `credentials` en falso el
   paquete manda la vista de entrar a la del enlace, así que las dos direcciones
   circulan y las dos tienen que mostrar lo mismo. */
const VISTAS_DE_ENTRAR = new Set(["sign-in", "magic-link"]);

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
    checkbox: "border-2 border-borde-fuerte",
  },
};

/* A dónde vuelve quien abre el enlace del correo o vuelve de Google. Es el mismo
   `redirectTo` que declara el proveedor, escrito acá porque el cliente de auth lo
   pide por llamada y no lo hereda. Se manda absoluto —— ver `destinoAbsoluto`:
   quien resuelve una ruta relativa es el servidor de auth, que está en otro
   dominio. */
const DESTINO = "/dashboard";

/*
 * La ruta es `/auth/[...path]` y no otra, y eso no es una preferencia: el
 * `basePath` de `NeonAuthUIProvider` es `/auth` por defecto, y de ahí salen todos
 * los enlaces que dibuja el paquete más el `callbackURL` del correo. Montada en
 * cualquier otro segmento, la pantalla de entrar anda y cada enlace que sale de
 * ella da 404.
 */
export default function PantallaDeCredenciales({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path: segmentos } = React.use(params);
  const parametros = React.use(searchParams);
  const path = segmentos?.[0] || "sign-in";
  const portada = PORTADAS[path] ?? PORTADAS["sign-in"];

  /* El Buzón que trae el Enlace de invitación, si lo trae. Se lee con la misma
     pieza que lo escribió — `leerBuzon` — para que el nombre del parámetro no
     quede escrito dos veces. */
  const buzon = leerBuzon(aSearchParams(parametros));

  const encabezado = (
    <>
      {/* El retrato del Padre Pozzobón con la Peregrina, el mismo de Inicio y el
          mismo del sitio. Va `alt=""` y `aria-hidden`: es la identidad de la
          pantalla y no un dato, y a quien navega con lector de pantalla no le
          agrega nada antes del formulario. */}
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

      {/* El filete dorado del sitio, corto y centrado: cierra el encabezado. Es
          decoración y no lleva nada encima — #ac954f da 2.9:1, que no alcanza ni
          para una regla que diga algo. */}
      <hr className="mx-auto mt-7 w-16 border-t-4 border-oro" />
    </>
  );

  return (
    /* El mismo centrado óptico de Inicio: los `p*` desparejos dejan la tarjeta
       arriba del centro exacto, y `pt-6` es el piso cuando la pantalla es más baja
       que la tarjeta. Acá no hay barra arriba, pero el teclado del teléfono ocupa
       la mitad de abajo, que produce el mismo desequilibrio. */
    <div className="flex min-h-screen items-center justify-center bg-lienzo px-5 pt-6 pb-16">
      <main className="w-full max-w-md">
        {VISTAS_DE_ENTRAR.has(path) ? (
          /* La tarjeta a mano, con las mismas clases que el paquete recibe por
             `classNames`: adentro va nuestro formulario, así que no hay `AuthView`
             que la dibuje. */
          <div className={CLASES.base}>
            <div className={CLASES.header}>{encabezado}</div>

            <div className="space-y-6 px-5 py-7 sm:px-6">
              <FormularioDeBuzon
                buzonInicial={buzon}
                destino={DESTINO}
                pedirEnlace={pedirEnlace}
              />

              <Separador />

              <Boton tono="secundario" anchoCompleto onClick={entrarConGoogle}>
                <GoogleIcon className="h-5 w-5" aria-hidden />
                Entrar con Google
              </Boton>
            </div>
          </div>
        ) : (
          <AuthView
            pathname={path}
            localization={LOCALIZACION_AUTH}
            classNames={CLASES}
            cardHeader={encabezado}
          />
        )}
      </main>
    </div>
  );
}

/** Lo que Next entrega, en la forma que `leerBuzon` sabe leer. Un parámetro
    repetido — `?buzon=a&buzon=b` — llega como arreglo y se descarta entero: la
    ambigüedad no se resuelve eligiendo una de las dos. */
function aSearchParams(
  parametros: Record<string, string | string[] | undefined>,
): URLSearchParams {
  return new URLSearchParams(
    Object.entries(parametros).flatMap(([clave, valor]) =>
      typeof valor === "string" ? [[clave, valor] as [string, string]] : [],
    ),
  );
}

/**
 * El pedido del enlace, tal como lo hace el formulario del paquete: un POST a
 * `sign-in/magic-link` con a dónde volver. `throw: true` para que un 400 llegue
 * como una excepción y no como un objeto que hay que acordarse de mirar.
 *
 * El cast existe porque el cliente de Neon Auth no declara el plugin del enlace
 * mágico en sus tipos — se habilita del lado del servidor, y del lado del cliente
 * Better Auth arma la ruta por proxy. Es la misma llamada que hace el paquete.
 */
async function pedirEnlace(email: string, callbackURL: string): Promise<void> {
  const cliente = authClient as unknown as {
    signIn: {
      magicLink: (opciones: {
        email: string;
        callbackURL: string;
        fetchOptions?: { throw?: boolean };
      }) => Promise<unknown>;
    };
  };

  await cliente.signIn.magicLink({
    email,
    callbackURL: destinoAbsoluto(window.location.origin, callbackURL),
    fetchOptions: { throw: true },
  });
}

function entrarConGoogle() {
  void authClient.signIn.social({
    provider: "google",
    callbackURL: destinoAbsoluto(window.location.origin, DESTINO),
  });
}

/** «O si no», con la línea a los costados. La línea es decoración y no se anuncia. */
function Separador() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-borde-suave" />
      <span className="text-base text-tinta-suave">O si no</span>
      <span className="h-px flex-1 bg-borde-suave" />
    </div>
  );
}
