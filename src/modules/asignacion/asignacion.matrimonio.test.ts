import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { matrimonio } from "@/modules/misionero/matrimonio.schema";
import { nombreDeTenedor } from "@/lib/formato";
import { AsignacionService } from "./asignacion.service";
import { AsignacionRepository } from "./asignacion.repository";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ValidacionError } from "@/lib/errors";

/**
 * Las imágenes de un Matrimonio se ven en **todas** las lecturas.
 *
 * Esta suite es la mitigación que ADR 0010 se comprometió a escribir: el modo de
 * falla es el silencio. Una consulta que junta la pata del Misionero y se olvida de la
 * del Matrimonio devuelve **menos filas y ningún error** — la imagen de una
 * pareja simplemente desaparece de una lista, y nadie se entera hasta que
 * alguien la busca por teléfono.
 *
 * Por eso cada `it` de acá abajo es una lectura distinta y no una variación de
 * la misma: lo que se prueba no es una regla, es que ninguna de las consultas se
 * olvidó de una pata.
 */

let territorio: TerritorioDePrueba;
let responsable: CurrentUser;

let peregrina: { id: string; identificacion: string };
let otraPeregrina: { id: string; identificacion: string };
let ana: { id: string };
let juan: { id: string };
let soltera: { id: string };
let parejaId: string;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();

  responsable = await crearActor({ rol: "responsable_diocesano" });

  peregrina = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
  });
  otraPeregrina = await crearPeregrinaDirecta({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
  });

  ana = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
    nombre: "Ana",
    apellido: "Álvarez",
  });
  juan = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
    nombre: "Juan",
    apellido: "Benítez",
  });
  soltera = await crearMisioneroDirecto({
    diocesisLocalidadId: territorio.villaMaria.id,
    createdById: responsable.id,
    nombre: "Carla",
    apellido: "Castro",
  });

  // Directo contra la tabla y no por `MatrimonioService`: lo que esta suite
  // prueba son las lecturas de *estos* dos módulos, y armar el par con el
  // service ataría cada fallo de acá a un cambio de allá.
  const [par] = await db
    .insert(matrimonio)
    .values({
      misioneroAId: ana.id,
      misioneroBId: juan.id,
      createdById: responsable.id,
    })
    .returning();
  parejaId = par!.id;
});

function pareja() {
  return { tipo: "matrimonio", id: parejaId } as const;
}

async function darsela() {
  return AsignacionService.asignar(responsable, {
    peregrinaId: peregrina.id,
    tenedor: pareja(),
    nota: null,
  });
}

// ── La regla ──────────────────────────────────────────────────────────────────

describe("un Misionero casado nunca tiene una imagen solo", () => {
  it("asignarle a un cónyuge por su cuenta se rechaza, y nombra a la pareja", async () => {
    const intento = AsignacionService.asignar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: { tipo: "persona", id: ana.id },
      nota: null,
    });

    await expect(intento).rejects.toThrow(ValidacionError);
    // La negativa sirve para elegir bien la próxima vez, no sólo para negarse.
    await expect(intento).rejects.toThrow(/Ana Álvarez y Juan Benítez/);
  });

  it("pasársela a un cónyuge por su cuenta se rechaza igual", async () => {
    await AsignacionService.asignar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: { tipo: "persona", id: soltera.id },
      nota: null,
    });

    await expect(
      AsignacionService.entregar(responsable, {
        peregrinaId: peregrina.id,
        tenedor: { tipo: "persona", id: juan.id },
        notaCierre: null,
        nota: null,
      })
    ).rejects.toThrow(ValidacionError);
  });

  it("a quien no está casado se le sigue asignando sin ruido", async () => {
    const dto = await AsignacionService.asignar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: { tipo: "persona", id: soltera.id },
      nota: null,
    });

    expect(dto.tenedor.tipo).toBe("persona");
    expect(dto.tenedor.id).toBe(soltera.id);
  });
});

// ── Las lecturas, una por una ─────────────────────────────────────────────────

describe("las imágenes de un Matrimonio se ven en cada lectura", () => {
  it("la tenencia actual las nombra como una sola respuesta", async () => {
    await darsela();

    const tenencia = await AsignacionService.tenenciaActual(
      responsable,
      peregrina.id
    );
    expect(tenencia?.tenedor.tipo).toBe("matrimonio");
    expect(nombreDeTenedor(tenencia!.tenedor)).toBe("Ana Álvarez y Juan Benítez");
  });

  it("el historial de la Peregrina no se queda corto", async () => {
    await darsela();

    const historial = await AsignacionService.historialDePeregrina(
      responsable,
      peregrina.id
    );
    expect(historial).toHaveLength(1);
    expect(historial[0]!.tenedor.id).toBe(parejaId);
  });

  it("el historial de cada cónyuge incluye lo que tuvo la pareja", async () => {
    await darsela();

    for (const persona of [ana, juan]) {
      const historial = await AsignacionService.historialDeMisionero(
        responsable,
        persona.id
      );
      expect(historial.map((a) => a.peregrina.identificacion)).toEqual([
        peregrina.identificacion,
      ]);
    }
  });

  it("el listado dice quién la tiene, y el filtro por nombre toma a los dos", async () => {
    await darsela();

    const todas = await PeregrinaService.listFiltradas(responsable, {});
    const fila = todas.find((p) => p.id === peregrina.id);
    expect(fila?.tenenciaActual?.id).toBe(parejaId);

    // Buscar por cualquiera de los dos apellidos encuentra la imagen: antes
    // estaba a nombre de quien se hubiera tipeado primero.
    for (const termino of ["Álvarez", "Benítez", "Juan Benítez"]) {
      const encontradas = await PeregrinaService.listFiltradas(responsable, {
        misionero: termino,
      });
      expect(encontradas.map((p) => p.id)).toEqual([peregrina.id]);
    }
  });

  it("no es libre, ni para el filtro ni para el picker ni para la cuenta", async () => {
    await darsela();

    const libres = await PeregrinaService.listFiltradas(responsable, {
      tenencia: "libre",
    });
    expect(libres.map((p) => p.id)).toEqual([otraPeregrina.id]);

    const asignadas = await PeregrinaService.listFiltradas(responsable, {
      tenencia: "asignada",
    });
    expect(asignadas.map((p) => p.id)).toEqual([peregrina.id]);

    const disponibles = await PeregrinaService.listDisponibles(responsable);
    expect(disponibles.map((p) => p.id)).toEqual([otraPeregrina.id]);

    // La cifra tiene que dar lo mismo que las filas a las que linkea.
    const pagina = await PeregrinaService.listPagina(
      responsable,
      { tenencia: "libre" },
      1
    );
    expect(pagina.total).toBe(1);
  });

  it("el filtro de tenencia pone a la pareja del lado «con», una sola vez", async () => {
    await darsela();

    // Las dos mitades de `?imagen=con|sin`, que son las dos lecturas de un mismo
    // predicado. La pareja es **un** Tenedor: aparece una vez del lado «con», y
    // ninguno de los dos cónyuges aparece por su cuenta en ninguna de las dos —
    // no son filas del listado mientras el Matrimonio esté activo.
    const ocupados = await AsignacionService.listarTenedoresConPeregrina(
      responsable
    );
    expect(ocupados.map((t) => [t.tipo, t.id])).toEqual([
      ["matrimonio", parejaId],
    ]);
    expect(nombreDeTenedor(ocupados[0]!)).toBe("Ana Álvarez y Juan Benítez");

    const libres = await AsignacionService.listarTenedoresSinPeregrina(
      responsable
    );
    expect(libres.map((t) => [t.tipo, t.id])).toEqual([
      ["persona", soltera.id],
    ]);
  });

  it("una pareja sin imagen está del lado «sin», y tampoco dos veces", async () => {
    // La mitad negativa del caso de arriba, que es la que atrapa el bug al revés:
    // sin ella, una implementación que devolviera cero parejas en las dos listas
    // pasaría la primera prueba.
    const libres = await AsignacionService.listarTenedoresSinPeregrina(
      responsable
    );
    expect(libres.map((t) => [t.tipo, t.id]).sort()).toEqual(
      [
        ["matrimonio", parejaId],
        ["persona", soltera.id],
      ].sort()
    );

    const ocupados = await AsignacionService.listarTenedoresConPeregrina(
      responsable
    );
    expect(ocupados).toEqual([]);
  });

  it("la columna «¿Tiene imagen?» contesta en la fila de la pareja", async () => {
    await darsela();

    // La pregunta se hace con las filas del listado, que son Tenedores. Pasar el
    // id del Matrimonio a una API por Misionero no coincidía con nada y la celda
    // decía «Ninguna» con la imagen en la casa.
    const tenencias = await AsignacionService.tenenciasDeTenedores(responsable, [
      pareja(),
      { tipo: "persona", id: soltera.id },
    ]);

    const suya = tenencias.find((t) => t.tenedor.id === parejaId);
    expect(suya?.peregrinas.map((p) => p.identificacion)).toEqual([peregrina.identificacion]);

    expect(
      tenencias.find((t) => t.tenedor.id === soltera.id)?.peregrinas
    ).toEqual([]);
  });

  it("la imagen de la casa se cuenta una vez y no una por cónyuge", async () => {
    await darsela();

    // Preguntar por la pareja *y* por sus dos cónyuges a la vez: la imagen sale
    // en la fila de la pareja y en ninguna otra. Atribuírsela además a cada uno
    // haría que la cifra dijera tres donde la lista muestra uno, que es lo que
    // CONTEXT.md prohíbe al pedir que cada cifra linkee a sus registros.
    const tenencias = await AsignacionService.tenenciasDeTenedores(responsable, [
      pareja(),
      { tipo: "persona", id: ana.id },
      { tipo: "persona", id: juan.id },
    ]);

    const conImagen = tenencias.filter((t) => t.peregrinas.length > 0);
    expect(conImagen).toHaveLength(1);
    expect(conImagen[0]!.tenedor).toEqual(pareja());
  });

  it("la imagen estancada de una pareja aparece, con los dos nombres", async () => {
    await darsela();

    const estancadas = await AsignacionRepository.findPeregrinasEstancadas(0);

    expect(estancadas.map((e) => e.identificacion)).toEqual([peregrina.identificacion]);
    expect(nombreDeTenedor(estancadas[0]!.tenedor)).toBe(
      "Ana Álvarez y Juan Benítez"
    );
  });

  it("la baja de un cónyuge se rechaza mientras la pareja tenga la imagen", async () => {
    await darsela();

    // La guarda que usa `MisioneroService.darDeBaja`: keyed sólo en
    // `misionero_id` no veía nada acá, y esa es la historia 3 del PRD.
    for (const persona of [ana, juan]) {
      const abiertas =
        await AsignacionRepository.findAbiertasDeMisionero(persona.id);
      expect(abiertas.map((a) => a.peregrinaIdentificacion)).toEqual([peregrina.identificacion]);
    }

    const delPar = await AsignacionRepository.findAbiertasDeMatrimonio(parejaId);
    expect(delPar.map((a) => a.peregrinaIdentificacion)).toEqual([peregrina.identificacion]);
  });
});

// ── Devolver y pasar, con el puntero denormalizado en el medio ────────────────

describe("el puntero denormalizado sigue a la pareja", () => {
  it("devolver deja la imagen libre de verdad, con las dos columnas en null", async () => {
    await darsela();
    await AsignacionService.devolver(responsable, {
      peregrinaId: peregrina.id,
      notaCierre: null,
    });

    const dto = await PeregrinaService.getById(responsable, peregrina.id);
    expect(dto.tenenciaActual).toBeNull();

    const libres = await PeregrinaService.listDisponibles(responsable);
    expect(libres.map((p) => p.id).sort()).toEqual(
      [peregrina.id, otraPeregrina.id].sort()
    );
  });

  it("pasarla de una persona a una pareja cambia de pata sin dejar las dos puestas", async () => {
    await AsignacionService.asignar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: { tipo: "persona", id: soltera.id },
      nota: null,
    });

    const { cerrada, abierta } = await AsignacionService.entregar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: pareja(),
      notaCierre: null,
      nota: null,
    });

    expect(cerrada.tenedor.id).toBe(soltera.id);
    expect(abierta.tenedor.id).toBe(parejaId);

    // El check `num_nonnulls(...) <= 1` habría refuzado la escritura si las dos
    // columnas quedaran puestas; lo que se comprueba acá es que la que quedó es
    // la que corresponde.
    const dto = await PeregrinaService.getById(responsable, peregrina.id);
    expect(dto.tenenciaActual?.tipo).toBe("matrimonio");
    expect(dto.tenenciaActual?.id).toBe(parejaId);
  });

  it("corregir un período abierto de una persona a la pareja mueve el puntero", async () => {
    const asignada = await AsignacionService.asignar(responsable, {
      peregrinaId: peregrina.id,
      tenedor: { tipo: "persona", id: soltera.id },
      nota: null,
    });

    await AsignacionService.corregir(responsable, {
      asignacionId: asignada.id,
      tenedor: pareja(),
    });

    const dto = await PeregrinaService.getById(responsable, peregrina.id);
    expect(dto.tenenciaActual?.id).toBe(parejaId);
  });
});
