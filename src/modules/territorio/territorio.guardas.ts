import { NoEncontradoError, ValidacionError } from "@/lib/errors";
import {
  TerritorioRepository,
  type DiocesisLocalidadConProvincia,
} from "./territorio.repository";

/**
 * The Diócesis/Localidad a Peregrina, a Misionero or a Matrimonio is being
 * filed under, refused when it does not exist or has been given de baja.
 *
 * One guard for every write that files a record somewhere — create and edit
 * alike. The edits used to check only that the Diócesis existed, so a record
 * could be moved into one that had been retired.
 */
export async function exigirDiocesisVigente(
  id: string
): Promise<DiocesisLocalidadConProvincia> {
  const territorio = await TerritorioRepository.findDiocesisLocalidadById(id);
  if (!territorio) {
    throw new NoEncontradoError("No existe esa Diócesis/Localidad.");
  }
  if (territorio.diocesis.bajaAt !== null) {
    throw new ValidacionError(
      `«${territorio.diocesis.nombre}» está dada de baja.`
    );
  }
  return territorio;
}
