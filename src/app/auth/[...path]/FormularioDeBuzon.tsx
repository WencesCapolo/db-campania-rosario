"use client";

import { useState } from "react";
import { z } from "zod";
import Campo from "@/components/Campo";
import Boton from "@/components/Boton";
import Mensaje from "@/components/Mensaje";
import { useValidacionAlSalir } from "@/lib/validacion-al-salir";

/**
 * Entrar: un campo y un botón.
 *
 * Es el único formulario de credenciales escrito a mano en todo el repo, y la
 * razón es una sola: el `MagicLinkForm` del paquete no se puede precargar. Trae
 * `defaultValues: { email: "" }` adentro y de la dirección lee nada más que a dónde
 * volver, así que un Enlace de invitación que llega con el Buzón escrito llegaría a
 * un campo vacío — que es exactamente el tipeo que el enlace existe para ahorrar
 * (historia 27). Todo lo demás de esas pantallas lo sigue dibujando el paquete.
 *
 * No hay contraseña porque no hay contraseñas: `email_and_password` está apagado
 * arriba, en Neon Auth, y no sólo escondido acá. Apagarlo sólo en la pantalla
 * dejaba la ruta de alta contestando igual, y con ella el agujero que este trabajo
 * vino a cerrar — quien supiera un Buzón invitado se creaba una cuenta con esa
 * dirección y una contraseña propia, y se quedaba con el Rol y el territorio que
 * alguien había reservado para otra persona (ADR 0011).
 *
 * Lo que se manda no es una sesión: es un pedido de enlace al Buzón. Recibirlo *es*
 * la prueba de pertenencia que ADR 0003 daba por supuesta cuando emparejó una
 * Invitación por email y nada más. De ahí que este formulario no distinga a quien
 * fue invitado de quien no: los dos reciben el mismo «Listo», porque contestar
 * distinto convertiría la pantalla en un directorio de qué direcciones tienen algo
 * esperándolas (historia 44). Quien no tenga Invitación entra a una identidad sin
 * Usuario, que por ADR 0002 no lee ni una Peregrina.
 *
 * El estado tiene las tres caras que pide el proyecto para cualquier superficie
 * asincrónica: mandando, mandado, y el error con el botón todavía ahí para volver a
 * intentar.
 */

/* El mismo Zod del campo y del blur — una sola regla y un solo castellano. */
const buzonSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribí el correo del Buzón.")
    .pipe(z.email("Ese correo no parece un correo. Fijate que esté completo.")),
});

type Estado =
  | { fase: "quieto" }
  | { fase: "mandando" }
  | { fase: "mandado"; buzon: string }
  | { fase: "falló"; mensaje: string };

const ERROR_GENERICO =
  "No pudimos mandar el enlace. Probá de nuevo en un momento.";

export default function FormularioDeBuzon({
  buzonInicial,
  /**
   * A dónde vuelve la persona después de abrir el enlace del correo. Se recibe
   * en lugar de leerse acá para que la pantalla siga siendo la que decide a dónde
   * lleva cada ruta, que es donde ya vive esa decisión.
   */
  destino,
  /** Inyectable para la prueba: en la app es el cliente de Neon Auth. */
  pedirEnlace,
}: {
  buzonInicial: string;
  destino: string;
  pedirEnlace: (email: string, callbackURL: string) => Promise<void>;
}) {
  const [buzon, setBuzon] = useState(buzonInicial);
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const validacion = useValidacionAlSalir(buzonSchema);

  async function mandar(evento: React.FormEvent) {
    evento.preventDefault();

    const analizado = buzonSchema.safeParse({ email: buzon });
    if (!analizado.success) {
      validacion.alSalir("email", buzon);
      return;
    }

    setEstado({ fase: "mandando" });

    try {
      await pedirEnlace(analizado.data.email, destino);
      setEstado({ fase: "mandado", buzon: analizado.data.email });
    } catch {
      // El texto del proveedor no se muestra: llega en inglés y por su nombre, y
      // ninguno de sus nombres le dice nada a quien está mirando la pantalla.
      setEstado({ fase: "falló", mensaje: ERROR_GENERICO });
    }
  }

  if (estado.fase === "mandado") {
    return (
      <div className="space-y-5">
        <Mensaje tono="exito">
          <p>
            Listo: mandamos el enlace a <strong>{estado.buzon}</strong>.
          </p>
          <p>
            Abrilo desde este teléfono o esta computadora y entrás. Dura una
            hora y sirve una sola vez.
          </p>
        </Mensaje>

        <Boton
          tono="secundario"
          anchoCompleto
          onClick={() => setEstado({ fase: "quieto" })}
        >
          Mandarlo de nuevo
        </Boton>
      </div>
    );
  }

  const mandando = estado.fase === "mandando";

  return (
    <form onSubmit={mandar} noValidate className="space-y-5">
      <Campo
        etiqueta="Correo del Buzón"
        /* `email` y no `text`: el teclado del teléfono es otro, con la arroba a
           la vista, y es el teléfono lo que hay en la parroquia. */
        type="email"
        name="email"
        /* Sin corrección ni mayúscula automática: las dos cambian una dirección
           que después no empareja con ninguna Invitación. */
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="email"
        /* Enfocado solo cuando la dirección no trajo el Buzón. Con el Buzón ya
           escrito no hay nada que tipear, y abrir el teclado encima del botón es
           esconder lo único que hay que apretar. */
        autoFocus={buzonInicial === ""}
        placeholder="nombre@ejemplo.com"
        value={buzon}
        disabled={mandando}
        error={validacion.error("email")}
        onChange={(e) => {
          setBuzon(e.target.value);
          validacion.alEscribir("email");
          // Un error de red que quedó en pantalla es sobre una dirección que ya
          // no es la que está escrita.
          setEstado((previo) =>
            previo.fase === "falló" ? { fase: "quieto" } : previo,
          );
        }}
        onBlur={(e) => validacion.alSalir("email", e.target.value)}
      />

      {estado.fase === "falló" && (
        <Mensaje tono="alerta">
          <p>{estado.mensaje}</p>
        </Mensaje>
      )}

      <Boton type="submit" anchoCompleto disabled={mandando}>
        {mandando ? "Mandando…" : "Mandarme el enlace"}
      </Boton>

      <p className="text-base leading-relaxed text-tinta-suave">
        Te llega un enlace al correo del Buzón. No hay contraseña que recordar.
      </p>
    </form>
  );
}
