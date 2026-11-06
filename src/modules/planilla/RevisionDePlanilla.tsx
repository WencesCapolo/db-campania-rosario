import Mensaje from "@/components/Mensaje";
import type {
  FilaRevisadaDTO,
  RevisionDTO,
  TotalesDeCargaDTO,
} from "@/modules/planilla/planilla.types";

/**
 * Lo que la revisión de una planilla dice, fila por fila — ADR 0017.
 *
 * Primero lo que hay que corregir, después lo que conviene mirar, y al final,
 * plegado, lo que está bien: con quinientas filas, las buenas empujarían las
 * que hay que corregir fuera de la pantalla.
 */

export function Revision({ revision }: { revision: RevisionDTO }) {
  if (revision.errores.length > 0) {
    return (
      <Mensaje tono="alerta">
        {revision.errores.map((e) => (
          <p key={e}>{e}</p>
        ))}
      </Mensaje>
    );
  }

  const conErrores = revision.filas.filter((f) => f.errores.length > 0);
  const conAvisos = revision.filas.filter(
    (f) => f.errores.length === 0 && f.avisos.length > 0
  );
  const bien = revision.filas.filter(
    (f) => f.errores.length === 0 && f.avisos.length === 0
  );

  return (
    <div className="space-y-4">
      {revision.lista ? (
        <Mensaje tono="exito">
          <p className="font-semibold">
            {revision.filas.length === 1
              ? "La fila está bien."
              : `Las ${revision.filas.length} filas están bien.`}
          </p>
          <p>{resumen(revision.totales, "Se van a cargar")}</p>
          {conAvisos.length > 0 && (
            <p>Mirá los avisos de abajo antes de confirmar.</p>
          )}
        </Mensaje>
      ) : (
        <Mensaje tono="alerta">
          <p className="font-semibold">
            {conErrores.length === 1
              ? "Hay 1 fila con errores."
              : `Hay ${conErrores.length} filas con errores.`}
          </p>
          <p>
            No se carga nada hasta que estén todas bien. Corregí la planilla y
            volvé a subirla.
          </p>
        </Mensaje>
      )}

      {conErrores.length > 0 && (
        <ListaDeFilas titulo="Para corregir" filas={conErrores} />
      )}
      {conAvisos.length > 0 && (
        <ListaDeFilas titulo="Para mirar" filas={conAvisos} />
      )}
      {bien.length > 0 && (
        // Plegadas: con quinientas filas, las que están bien empujarían las
        // que hay que corregir fuera de la pantalla.
        <details className="rounded-control border-2 border-borde">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-semibold text-tinta">
            {bien.length === 1 ? "1 fila sin problemas" : `${bien.length} filas sin problemas`}
          </summary>
          <ul className="divide-y divide-borde border-t-2 border-borde">
            {bien.map((f) => (
              <FilaRevisada key={f.numero} fila={f} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ListaDeFilas({
  titulo,
  filas,
}: {
  titulo: string;
  filas: FilaRevisadaDTO[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-tinta">{titulo}</h3>
      <ul className="divide-y divide-borde rounded-control border-2 border-borde">
        {filas.map((f) => (
          <FilaRevisada key={f.numero} fila={f} />
        ))}
      </ul>
    </div>
  );
}

function FilaRevisada({ fila }: { fila: FilaRevisadaDTO }) {
  return (
    <li className="space-y-1 px-4 py-3 text-base">
      <p className="text-tinta">
        <span className="font-semibold">Fila {fila.numero}</span>
        {" · "}
        {fila.misionero}
      </p>
      {fila.imagen && (
        <p className="text-tinta-suave">
          Imagen: <span className="font-mono">{fila.imagen}</span>
        </p>
      )}
      {fila.errores.map((e) => (
        <p key={e} className="flex items-start gap-2 font-semibold text-peligro">
          <span aria-hidden>✕</span>
          {e}
        </p>
      ))}
      {fila.avisos.map((a) => (
        <p key={a} className="flex items-start gap-2 text-aviso-tinta">
          <span aria-hidden>▲</span>
          {a}
        </p>
      ))}
    </li>
  );
}

export function cantidad(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function resumen(t: TotalesDeCargaDTO, verbo: string): string {
  const partes = [cantidad(t.misioneros, "Misionero", "Misioneros")];
  if (t.imagenesNuevas > 0) {
    partes.push(cantidad(t.imagenesNuevas, "imagen nueva", "imágenes nuevas"));
  }
  if (t.entregas > 0) {
    partes.push(cantidad(t.entregas, "entrega", "entregas"));
  }
  const lista =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return `${verbo} ${lista}.`;
}
