import Insignia, { type TonoDeInsignia } from "@/components/Insignia";
import type { PeregrinaEstado } from "./peregrina.schema";
import { ESTADO_LABELS } from "./peregrina.types";

/**
 * El Estado de una Peregrina, como insignia.
 *
 * In the module rather than in a page, following `SelectorDeTerritorio`: the
 * mapping from Estado to a tone is a domain judgement, not a layout one, and it
 * was about to have a second copy. The detail page had `TONO_POR_ESTADO` and the
 * historial page — needing the same badge — settled for `neutro` on every Estado,
 * so an Extraviada image and an Activa one looked identical on the one screen
 * somebody opens when an image is missing.
 *
 * `activa` is green, `en_reparacion` amber, `extraviada` red, and `inactiva` grey
 * because it is the legacy value: readable, never offered for new entry, and
 * deliberately the quietest thing on the screen.
 *
 * Estado is about the image and never about who has it. There is no tone here for
 * "sin entregar", because that is not an Estado.
 */

const TONO_POR_ESTADO: Record<PeregrinaEstado, TonoDeInsignia> = {
  activa: "exito",
  en_reparacion: "aviso",
  extraviada: "alerta",
  inactiva: "neutro",
};

export default function EstadoDePeregrina({
  estado,
}: {
  estado: PeregrinaEstado;
}) {
  return (
    <Insignia tono={TONO_POR_ESTADO[estado]}>{ESTADO_LABELS[estado]}</Insignia>
  );
}
