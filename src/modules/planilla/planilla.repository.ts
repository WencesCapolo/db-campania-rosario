import { db } from "@/db";
import { MisioneroRepository } from "@/modules/misionero/misionero.repository";
import type { NewMisioneroRow } from "@/modules/misionero/misionero.schema";
import { PeregrinaRepository } from "@/modules/peregrina/peregrina.repository";
import type { NewPeregrinaRow } from "@/modules/peregrina/peregrina.schema";
import {
  AsignacionRepository,
  type AperturaDeAsignacion,
} from "@/modules/asignacion/asignacion.repository";

/** Todo lo que una planilla revisada escribe, con los ids ya puestos. */
export interface CargaDePlanilla {
  misioneros: (NewMisioneroRow & { id: string })[];
  peregrinas: (NewPeregrinaRow & { id: string })[];
  aperturas: AperturaDeAsignacion[];
}

/**
 * PlanillaRepository
 *
 * No tiene tabla. Es la transacción de una importación, que abarca tres — ADR
 * 0017: o entran todos los Misioneros, las imágenes nuevas y las entregas de la
 * planilla, o no entra ninguno.
 *
 * Cada tabla la sigue escribiendo su propio repositorio, con la transacción que
 * se le pasa. En particular el puntero `misioneroActualId` lo escribe
 * `AsignacionRepository.abrirEn`, el mismo código que usa una entrega a mano.
 *
 * Sin reglas ni permisos: eso ya lo decidió `PlanillaService` antes de llegar acá.
 */
export class PlanillaRepository {
  static async cargar(carga: CargaDePlanilla): Promise<void> {
    await db.transaction(async (tx) => {
      // En este orden por las claves foráneas: la Asignación apunta a los dos.
      await MisioneroRepository.insertarVariosEn(tx, carga.misioneros);
      await PeregrinaRepository.insertarVariasEn(tx, carga.peregrinas);
      for (const apertura of carga.aperturas) {
        await AsignacionRepository.abrirEn(tx, apertura);
      }
    });
  }
}
