"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Boton from "./Boton";
import Dialogo from "./Dialogo";

/**
 * Un formulario de edición en un `Dialogo` — la ficha queda abajo, y al guardar
 * se cierra y la ficha se vuelve a leer del servidor.
 *
 * El formulario se monta de nuevo cada vez que se abre (`key`), así arranca con
 * lo que el registro *es* ahora y no con lo que quedó a medio tipear la vez
 * anterior. Tocar el fondo no lo cierra: perder un formulario largo por un toque
 * de más en un teléfono es peor que tener que apretar «No, volver».
 */
export default function DialogoDeEdicion({
  titulo,
  etiqueta = "Editar sus datos",
  children,
}: {
  titulo: string;
  etiqueta?: string;
  /** El formulario. `alGuardar` cierra y refresca; `alCancelar` sólo cierra. */
  children: (acciones: {
    alGuardar: () => void;
    alCancelar: () => void;
  }) => React.ReactNode;
}) {
  const router = useRouter();
  const [vez, setVez] = useState(0);

  return (
    <Dialogo
      titulo={titulo}
      cerrarConElFondo={false}
      disparador={(control) => (
        <Boton
          tono="secundario"
          onClick={() => {
            setVez((v) => v + 1);
            control.abrir();
          }}
        >
          {etiqueta}
        </Boton>
      )}
    >
      {(control) => (
        <div key={vez} className="mt-4">
          {children({
            alGuardar: () => {
              control.cerrar();
              router.refresh();
            },
            alCancelar: control.cancelar,
          })}
        </div>
      )}
    </Dialogo>
  );
}
