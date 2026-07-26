import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "./peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ConflictoError } from "@/lib/errors";

/**
 * Baja lógica de una Peregrina — historia 16.
 *
 * Sale del inventario activo sin borrar su historia, porque una Asignación que no
 * puede resolver su Código es una fila de ids ilegibles. Y se rechaza mientras
 * alguien la tenga: una imagen que está físicamente en la casa de un Misionero no
 * salió del inventario, diga lo que diga el papeleo.
 */

let territorio: TerritorioDePrueba;
let referente: CurrentUser;
let asesor: CurrentUser;

let peregrina: { id: string; codigo: string };
let ana: { id: string };

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();

  asesor = await crearActor({ rol: "asesor_nacional" });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });

  peregrina = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
  });
  ana = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: referente.id,
    nombre: "Ana",
    apellido: "Álvarez",
  });
});

describe("no se puede dar de baja una Peregrina que alguien tiene", () => {
  it("se rechaza y dice quién la tiene", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });

    const intento = PeregrinaService.darDeBaja(referente, peregrina.id);

    await expect(intento).rejects.toThrow(ConflictoError);
    await expect(intento).rejects.toThrow(/Ana Álvarez/);

    const sigue = await PeregrinaService.getById(referente, peregrina.id);
    expect(sigue.deBaja).toBe(false);
  });

  it("se puede una vez devuelta", async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });

    const deBaja = await PeregrinaService.darDeBaja(referente, peregrina.id);
    expect(deBaja.deBaja).toBe(true);
  });
});

describe("una Peregrina dada de baja", () => {
  beforeEach(async () => {
    await AsignacionService.asignar(referente, {
      peregrinaId: peregrina.id,
      misioneroId: ana.id,
      nota: null,
    });
    await AsignacionService.devolver(referente, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });
    await PeregrinaService.darDeBaja(referente, peregrina.id);
  });

  it("sale del inventario activo", async () => {
    expect(await PeregrinaService.listAll(referente)).toEqual([]);
    expect(await PeregrinaService.listByEstado(referente, "activa")).toEqual([]);
    expect(await PeregrinaService.listByModalidad(referente, "JOV")).toEqual([]);
    expect(await PeregrinaService.listDisponibles(referente)).toEqual([]);
    expect(await PeregrinaService.dashboardStats(referente)).toEqual({
      byEstado: [],
      byRegion: [],
    });
  });

  it("sigue leyéndose por id, y su historial entero con ella", async () => {
    const dto = await PeregrinaService.getById(referente, peregrina.id);
    expect(dto.deBaja).toBe(true);
    expect(dto.codigo).toBe(peregrina.codigo);

    const historial = await AsignacionService.historialDePeregrina(
      referente,
      peregrina.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0].misionero.apellido).toBe("Álvarez");
  });

  it("no aparece entre las nunca asignadas: retirada no es ociosa", async () => {
    const otra = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });
    await PeregrinaService.darDeBaja(referente, otra.id);

    expect(await AsignacionService.listarNuncaAsignadas(referente)).toEqual([]);
  });

  it("no se puede asignar", async () => {
    await expect(
      AsignacionService.asignar(referente, {
        peregrinaId: peregrina.id,
        misioneroId: ana.id,
        nota: null,
      })
    ).rejects.toThrow(/está dada de baja/);
  });

  it("se la puede reactivar", async () => {
    const reactivada = await PeregrinaService.reactivar(referente, peregrina.id);
    expect(reactivada.deBaja).toBe(false);
    expect(await PeregrinaService.listAll(referente)).toHaveLength(1);
  });

  it("no libera su Código: el número no se reutiliza", async () => {
    // El Código está escrito en la imagen, que puede estar en un armario. Volver a
    // emitir su número acabaría en dos imágenes con el mismo.
    const nueva = await PeregrinaService.create(asesor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    expect(nueva.codigo).not.toBe(peregrina.codigo);
  });

  it("deja de contar como uso del territorio, así que la Diócesis se puede retirar", async () => {
    // Antes del issue #3 esto contaba cada fila, sin noción de baja: una Diócesis
    // cuyo inventario entero se hubiera retirado no habría podido retirarse nunca,
    // y el rechazo habría hablado de registros que nadie puede ver.
    await MisioneroService.darDeBaja(referente, ana.id);

    const uso = await TerritorioService.usoDeDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );
    expect(uso).toEqual({ peregrinas: 0, misioneros: 0 });

    const retirada = await TerritorioService.darDeBajaDiocesisLocalidad(
      asesor,
      territorio.villaMaria.id
    );
    expect(retirada.deBaja).toBe(true);
  });
});
