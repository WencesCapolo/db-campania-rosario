"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorDeTerritorio from "@/modules/territorio/SelectorDeTerritorio";
import { actualizarUsuarioAction } from "@/modules/user/user.router";
import Boton from "@/components/Boton";
import Dialogo from "@/components/Dialogo";
import Eleccion from "@/components/Eleccion";
import Mensaje from "@/components/Mensaje";
import { ROLE_LABELS, llevaTerritorio } from "@/lib/permissions";
import type { Role } from "@/modules/user/user.schema";

/**
 * Cambiar el rol o el territorio de un Usuario — historia 16.
 *
 * A real-world reassignment: somebody moves Diócesis, or a Referente Local becomes
 * the Responsable Diocesano. `UserService.actualizar` handled both and nothing
 * called it, so the only way to express a reassignment through the app was to
 * revoke the access and invite the person again — which changes the row, and with
 * it every attribution pointing at it.
 *
 * The rol list comes from the server, resolved from the Actor's own rank, so the
 * form cannot offer an escalation the service would refuse. That is a courtesy and
 * not the guard: `UserService.actualizar` asks the same question twice, once about
 * the rol the target has now and once about the rol they are being given, because
 * offering a Referente Local a promotion to Asesor Nacional and refusing it at the
 * boundary is the correct order.
 *
 * The territory picker appears only for the two territorial rols. Choosing a
 * country-wide rol sends `diocesisLocalidadId: null` explicitly rather than
 * leaving it out — omitting it means "leave it as it was", and a Usuario left with
 * a Diócesis they no longer answer to is the bug that reads as working.
 *
 * Escape and "No, volver" both discard. Nothing is submitted until the button is
 * pressed, so backing out of a half-made change costs nothing, and `alCerrar`
 * resets both fields to what the Usuario actually is — otherwise reopening the
 * dialog shows the abandoned edit as though it had been saved.
 */
export default function EditarUsuario({
  id,
  email,
  rolActual,
  diocesisLocalidadIdActual,
  rolesDisponibles,
}: {
  id: string;
  email: string;
  rolActual: Role;
  diocesisLocalidadIdActual: string | null;
  /** What this Actor may hand out. Always includes `rolActual`. */
  rolesDisponibles: Role[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const [rol, setRol] = useState<Role>(rolActual);
  const [diocesisLocalidadId, setDiocesisLocalidadId] = useState<string | null>(
    diocesisLocalidadIdActual
  );
  const [error, setError] = useState<string | null>(null);

  const necesitaTerritorio = llevaTerritorio(rol);

  return (
    <Dialogo
      titulo="Cambiar el rol o el territorio"
      alCerrar={(cancelado) => {
        setError(null);
        // Only on a cancel, and this is where `cancelado` earns its keep. On a
        // confirmation the state already holds what was saved; putting the props
        // back would show the *previous* rol, because these props do not reach
        // `useState` again after the first render — so the dialog would reopen
        // claiming the change had not happened.
        if (!cancelado) return;
        setRol(rolActual);
        setDiocesisLocalidadId(diocesisLocalidadIdActual);
      }}
      disparador={(control) => (
        <Boton tono="secundario" onClick={control.abrir}>
          Cambiar el rol o el territorio
        </Boton>
      )}
    >
      {(control) => (
        <>
          <p className="mt-3 text-base leading-relaxed">
            El acceso de <strong>{email || "este usuario sin identidad"}</strong>.
            El cambio vale desde su próximo ingreso.
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
              onChange={(e) => setRol(e.target.value as Role)}
            />

            {necesitaTerritorio ? (
              <SelectorDeTerritorio
                value={diocesisLocalidadId}
                onChange={setDiocesisLocalidadId}
              />
            ) : (
              <Mensaje tono="neutro">
                <p>
                  Este rol cubre todo el país, así que no lleva
                  Diócesis/Localidad.
                </p>
              </Mensaje>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Boton
              disabled={pendiente}
              onClick={() =>
                empezar(async () => {
                  setError(null);

                  if (necesitaTerritorio && !diocesisLocalidadId) {
                    // The service refuses this too, and would refuse it with a
                    // sentence about scope. Said here it is a sentence about the
                    // field somebody is looking at.
                    setError(
                      "Este rol necesita una Diócesis/Localidad. Elegí una."
                    );
                    return;
                  }

                  const resultado = await actualizarUsuarioAction(id, {
                    rol,
                    // Explicitly null for a country-wide rol. Omitting it means
                    // "leave the territory as it was", which would leave somebody
                    // bound to a Diócesis they no longer answer to.
                    diocesisLocalidadId: necesitaTerritorio
                      ? diocesisLocalidadId
                      : null,
                  });

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
