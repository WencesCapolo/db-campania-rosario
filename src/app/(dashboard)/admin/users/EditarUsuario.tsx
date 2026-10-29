"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarUsuarioAction } from "@/modules/user/user.router";
import Boton from "@/components/Boton";
import Dialogo from "@/components/Dialogo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";

/**
 * Cambiar el rol de un Usuario — historia 16.
 *
 * A real-world reassignment: a Buzón that should answer to another rol.
 * `UserService.actualizar` handled it and nothing called it, so the only way to express a reassignment through the app was to
 * revoke the access and invite the person again — which changes the row, and with
 * it every attribution pointing at it.
 *
 * The rol list comes from the server, resolved from the Actor's own rank, so the
 * form cannot offer an escalation the service would refuse. That is a courtesy and
 * not the guard: `UserService.actualizar` asks the same question twice, once about
 * the rol the target has now and once about the rol they are being given.
 *
 * Escape and "No, volver" both discard. Nothing is submitted until the button is
 * pressed, so backing out of a half-made change costs nothing, and `alCerrar`
 * resets the field to what the Usuario actually is — otherwise reopening the
 * dialog shows the abandoned edit as though it had been saved.
 *
 * The trigger lives in a row of the Usuarios table, beside «Quitar acceso», and
 * both must fit on one line — so it reads «Cambiar», and its accessible name
 * carries the rest, beginning with the same word a voice command would say.
 */
export default function EditarUsuario({
  id,
  email,
  rolActual,
  rolesDisponibles,
}: {
  id: string;
  email: string;
  rolActual: Role;
  /** What this Actor may hand out. Always includes `rolActual`. */
  rolesDisponibles: Role[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [rol, setRol] = useState<Role>(rolActual);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialogo
      titulo="Cambiar el rol"
      alCerrar={(cancelado) => {
        setError(null);
        // Only on a cancel, and this is where `cancelado` earns its keep. On a
        // confirmation the state already holds what was saved; putting the props
        // back would show the *previous* rol, because these props do not reach
        // `useState` again after the first render — so the dialog would reopen
        // claiming the change had not happened.
        if (!cancelado) return;
        setRol(rolActual);
      }}
      disparador={(control) => (
        <Boton
          tono="secundario"
          compacto
          aria-label={`Cambiar el rol de ${email || "este usuario sin identidad"}`}
          onClick={control.abrir}
        >
          Cambiar
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            El acceso de{" "}
            <strong>{email || "este usuario sin identidad"}</strong>. El cambio
            vale desde su próximo ingreso.
          </p>

          {error && (
            <div className="mt-4">
              <Mensaje tono="alerta">
                <p>{error}</p>
              </Mensaje>
            </div>
          )}

          <div className="mt-4 space-y-5">
            <Eleccion
              etiqueta="Rol"
              value={rol}
              opciones={rolesDisponibles.map((r) => ({
                valor: r,
                etiqueta: ROLE_LABELS[r],
              }))}
              alElegir={(valor) => setRol(valor as Role)}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Boton
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);

                  const resultado = await actualizarUsuarioAction(id, { rol });

                  if (!resultado.ok) {
                    setError(resultado.error);
                    return;
                  }

                  control.cerrar();
                  router.refresh();
                })
              }
            >
              {pendiente ? "Guardando…" : "Guardar el cambio"}
            </Boton>

            <Boton
              tono="secundario"
              disabled={pendiente}
              onClick={control.cancelar}
            >
              No, volver
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
