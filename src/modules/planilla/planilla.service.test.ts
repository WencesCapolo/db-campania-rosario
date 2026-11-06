import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PlanillaService } from "./planilla.service";
import { COLUMNAS, type ColumnaDeImportacion } from "./planilla.types";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { ValidacionError } from "@/lib/errors";

/**
 * ADR 0017 — planillas.
 *
 * Importar es todo o nada: la revisión no escribe, y una planilla con un solo
 * error no carga ninguna fila. Las mismas reglas que el alta a mano, fila por
 * fila. Exportar trae las filas que el listado cuenta.
 */

let territorio: TerritorioDePrueba;
let responsable: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  responsable = await crearActor({ rol: "responsable_diocesano" });
});

type Fila = Partial<Record<ColumnaDeImportacion, string | number | Date>>;

/** Una planilla como la llenaría alguien: los títulos, y una fila por persona. */
async function planilla(filas: Fila[], columnas = Object.keys(COLUMNAS)) {
  const libro = new ExcelJS.Workbook();
  const ws = libro.addWorksheet("Misioneros");
  const claves = columnas as ColumnaDeImportacion[];
  ws.addRow(claves.map((c) => COLUMNAS[c]));
  for (const f of filas) ws.addRow(claves.map((c) => f[c] ?? null));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

async function leer(archivo: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(
    archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength) as ArrayBuffer
  );
  return libro;
}

const persona = (apellido: string, extra: Fila = {}): Fila => ({
  nombre: "Ana",
  apellido,
  diocesis: "Villa María (Córdoba)",
  ...extra,
});

async function cuantosMisioneros() {
  return (await MisioneroService.listPagina(responsable, {})).total;
}

describe("revisar", () => {
  it("dice qué se cargaría, y no escribe nada", async () => {
    const libre = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      numero: 7,
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([
        persona("Sola"),
        persona("Con Una Vieja", { codigo: "cba fam 7" }),
        persona("Con Una Nueva", { modalidad: "JOV — Jóvenes" }),
      ])
    );

    expect(revision.errores).toEqual([]);
    expect(revision.filas.flatMap((f) => f.errores)).toEqual([]);
    expect(revision.lista).toBe(true);
    expect(revision.totales).toEqual({ misioneros: 3, imagenesNuevas: 1, entregas: 2 });
    expect(revision.filas.map((f) => f.imagen)).toEqual([
      null,
      `${libre.codigo} (ya cargada)`,
      "CBA JOV 0001 (nueva)",
    ]);
    expect(revision.filas[0]?.numero).toBe(2);

    expect(await cuantosMisioneros()).toBe(0);
    expect((await PeregrinaService.listPagina(responsable, {})).total).toBe(1);
  });

  it("acepta el nombre de la Diócesis sola si no se repite, sin acentos", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([persona("Gómez", { diocesis: "villa maria" })])
    );

    expect(revision.lista).toBe(true);
  });

  it("una Diócesis que no existe es un error de la fila, que dice cuál", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([persona("Bien"), persona("Mal", { diocesis: "Atlántida" })])
    );

    expect(revision.lista).toBe(false);
    expect(revision.filas[0]?.errores).toEqual([]);
    expect(revision.filas[1]?.errores.join(" ")).toMatch(/«Atlántida»/);
  });

  it("usa los mensajes del alta: falta el apellido, el email no es un email", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([
        { nombre: "Ana", diocesis: "Villa María (Córdoba)", email: "ana@" },
      ])
    );

    const errores = revision.filas[0]?.errores ?? [];
    expect(errores).toContain("El apellido es obligatorio.");
    expect(errores).toContain("Escribí un email válido.");
  });

  it("sin una columna obligatoria, lo dice antes de mirar filas", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([{ nombre: "Ana" }], ["nombre", "telefono"])
    );

    expect(revision.lista).toBe(false);
    expect(revision.errores[0]).toMatch(/«Apellido», «Diócesis\/Localidad»/);
  });

  it("un archivo que no es un Excel es una negativa que se entiende", async () => {
    await expect(
      PlanillaService.revisar(responsable, Buffer.from("nombre,apellido\nAna,Gómez"))
    ).rejects.toThrow(ValidacionError);
  });

  it("una imagen que ya tiene alguien es un error, y nombra a quién", async () => {
    const tenida = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const quien = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: responsable.id,
      nombre: "Rosa",
      apellido: "Ibáñez",
    });
    await AsignacionService.asignar(responsable, {
      peregrinaId: tenida.id,
      tenedor: { tipo: "persona", id: quien.id },
    });

    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([persona("Gómez", { codigo: tenida.codigo ?? "" })])
    );

    expect(revision.filas[0]?.errores.join(" ")).toMatch(/ya la tiene Rosa Ibáñez/);
  });

  it("un Código que no existe, un Código en dos filas y uno ya escrito son errores", async () => {
    const existente = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      numero: 3,
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([
        persona("Uno", { codigo: "CBA FAM 0099" }),
        persona("Dos", { codigo: existente.codigo ?? "" }),
        persona("Tres", { codigo: existente.codigo ?? "" }),
        persona("Cuatro", { modalidad: "FAM", numero: 3 }),
      ])
    );

    const [uno, dos, tres, cuatro] = revision.filas;
    expect(uno?.errores.join(" ")).toMatch(/No hay ninguna imagen con el Código CBA FAM 0099/);
    // La cuarta escribe a mano el mismo Código que la segunda y la tercera
    // nombran: tres filas que dicen lo mismo, y ninguna sabe cuál es la real.
    expect(dos?.errores.join(" ")).toMatch(/más de una fila \(3, 4, 5\)/);
    expect(tres?.errores.join(" ")).toMatch(/más de una fila \(3, 4, 5\)/);
    expect(cuatro?.errores.join(" ")).toMatch(/más de una fila \(3, 4, 5\)/);
    expect(cuatro?.errores.join(" ")).toMatch(/Ya hay una imagen con el Código CBA FAM 0003/);
  });

  it("no se puede escribir un Código y los datos de una nueva en la misma fila", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([persona("Gómez", { codigo: "CBA FAM 0001", modalidad: "FAM" })])
    );

    expect(revision.filas[0]?.errores.join(" ")).toMatch(/no los dos/);
  });

  it("numera las nuevas salteando los números que la planilla escribe a mano", async () => {
    await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "JOV",
      numero: 1,
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([
        persona("A", { modalidad: "JOV" }),
        persona("B", { modalidad: "JOV", numero: 3 }),
        persona("C", { modalidad: "JOV" }),
        persona("D", { modalidad: "JOV", numeracionAnterior: "Peregrina 7" }),
        persona("E", { modalidad: "JOV", diocesis: "Zapala" }),
      ])
    );

    expect(revision.filas.map((f) => f.imagen)).toEqual([
      "CBA JOV 0002 (nueva)",
      "CBA JOV 0003 (nueva)",
      "CBA JOV 0004 (nueva)",
      "Peregrina 7 (nueva, sin Código)",
      "NEU JOV 0001 (nueva)",
    ]);
  });

  it("lee una fecha de celda y una escrita como texto", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([
        persona("A", { fechaConsagracion: new Date(Date.UTC(1998, 7, 15)) }),
        persona("B", { fechaConsagracion: "15/08/1998" }),
        persona("C", { fechaConsagracion: "el día de la Virgen" }),
        persona("D", { fechaConsagracion: "31/02/1998" }),
      ])
    );

    const [a, b, c, d] = revision.filas;
    expect(a?.errores).toEqual([]);
    expect(b?.errores).toEqual([]);
    expect(c?.errores.join(" ")).toMatch(/no se entiende «el día de la Virgen»/);
    expect(d?.errores.join(" ")).toMatch(/fecha válida/);
  });

  it("avisa, sin frenar, de alguien con el mismo nombre en la misma Diócesis", async () => {
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: responsable.id,
      nombre: "Ana",
      apellido: "Gómez",
    });

    const revision = await PlanillaService.revisar(
      responsable,
      await planilla([persona("gomez"), persona("Gómez")])
    );

    expect(revision.lista).toBe(true);
    expect(revision.filas[0]?.avisos.join(" ")).toMatch(/Ya hay un Misionero con este nombre/);
    expect(revision.filas[0]?.avisos.join(" ")).toMatch(/más de una fila \(2, 3\)/);
  });
});

describe("importar", () => {
  it("crea los Misioneros, las imágenes nuevas y las entregas", async () => {
    const libre = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const totales = await PlanillaService.importar(
      responsable,
      await planilla([
        persona("Sola", { telefono: 3415551234, email: "Ana@Ejemplo.com" }),
        persona("Con Una Vieja", { codigo: libre.codigo ?? "" }),
        persona("Con Una Nueva", {
          modalidad: "MAT",
          tipo: "Auxiliar",
          fechaImagen: "02/02/2020",
        }),
      ])
    );

    expect(totales).toEqual({ misioneros: 3, imagenesNuevas: 1, entregas: 2 });

    const misioneros = await MisioneroService.listFiltrados(responsable, {});
    const porApellido = new Map(
      misioneros.flatMap((t) =>
        t.tipo === "persona" ? [[t.persona.apellido, t.persona] as const] : []
      )
    );
    expect(porApellido.get("Sola")?.telefono).toBe("3415551234");
    expect(porApellido.get("Sola")?.email).toBe("ana@ejemplo.com");

    const vieja = await PeregrinaService.getById(responsable, libre.id);
    expect(vieja.tenenciaActual?.id).toBe(porApellido.get("Con Una Vieja")?.id);
    const historial = await AsignacionService.historialDePeregrina(responsable, libre.id);
    expect(historial[0]?.registradaPor.usuarioId).toBe(responsable.id);
    expect(historial[0]?.notaApertura).toBe("Cargada desde una planilla.");

    const nueva = (
      await PeregrinaService.listPagina(responsable, { modalidad: "MAT" })
    ).filas[0];
    expect(nueva?.codigo).toBe("CBA MAT 0001");
    expect(nueva?.tipo).toBe("auxiliar");
    expect(nueva?.fechaConsagracion).toBe("2020-02-02");
    expect(nueva?.diocesisLocalidad.id).toBe(territorio.villaMaria.id);
    expect(nueva?.tenenciaActual?.id).toBe(porApellido.get("Con Una Nueva")?.id);
  });

  it("con una sola fila mal no carga ninguna", async () => {
    await expect(
      PlanillaService.importar(
        responsable,
        await planilla([
          persona("Bien", { modalidad: "JOV" }),
          persona("Mal", { diocesis: "Atlántida" }),
        ])
      )
    ).rejects.toThrow(ValidacionError);

    expect(await cuantosMisioneros()).toBe(0);
    expect((await PeregrinaService.listPagina(responsable, {})).total).toBe(0);
  });

  it("subir dos veces la misma planilla de una imagen ya cargada no la entrega dos veces", async () => {
    const libre = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const archivo = await planilla([persona("Gómez", { codigo: libre.codigo ?? "" })]);

    await PlanillaService.importar(responsable, archivo);
    await expect(PlanillaService.importar(responsable, archivo)).rejects.toThrow(
      ValidacionError
    );

    expect(await cuantosMisioneros()).toBe(1);
    expect(
      await AsignacionService.historialDePeregrina(responsable, libre.id)
    ).toHaveLength(1);
  });
});

describe("plantilla", () => {
  it("trae los títulos que se leen de vuelta, y la lista de territorios", async () => {
    const libro = await leer(await PlanillaService.plantilla(responsable));

    const hoja = libro.getWorksheet("Misioneros");
    const titulos = (hoja?.getRow(1).values as unknown[]).slice(1);
    expect(titulos).toContain("Apellido *");
    expect(titulos).toContain(COLUMNAS.codigo);

    const listas = libro.getWorksheet("Listas");
    expect(listas?.state).toBe("hidden");
    const territorios = listas?.getColumn(1).values.filter(Boolean);
    expect(territorios).toContain("Villa María (Córdoba)");
    expect(listas?.getColumn(2).values.filter(Boolean)).toHaveLength(16);
  });

  it("una plantilla vacía vuelta a subir no tiene filas", async () => {
    const revision = await PlanillaService.revisar(
      responsable,
      await PlanillaService.plantilla(responsable)
    );

    expect(revision.lista).toBe(false);
    expect(revision.errores[0]).toMatch(/ninguna fila/);
  });
});

describe("exportar", () => {
  it("las Peregrinas con los filtros del listado", async () => {
    await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
      fechaConsagracion: "1998-08-15",
    });
    await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const libro = await leer(
      await PlanillaService.peregrinas(responsable, { modalidad: "JOV" })
    );
    const hoja = libro.getWorksheet("Peregrinas");

    expect(hoja?.rowCount).toBe(2);
    const fila = hoja?.getRow(2);
    expect(fila?.getCell(1).value).toBe("CBA JOV 0001");
    expect(fila?.getCell(8).value).toBe("Nadie");
    expect(fila?.getCell(12).value).toEqual(new Date(Date.UTC(1998, 7, 15)));
  });

  it("los Misioneros, con la imagen que tiene cada uno", async () => {
    const imagen = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const quien = await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: responsable.id,
      nombre: "Rosa",
      apellido: "Ibáñez",
    });
    await crearMisioneroDirecto({
      diocesisLocalidadId: territorio.zapala.id,
      createdById: responsable.id,
      nombre: "Juan",
      apellido: "Libre",
    });
    await AsignacionService.asignar(responsable, {
      peregrinaId: imagen.id,
      tenedor: { tipo: "persona", id: quien.id },
    });

    const libro = await leer(
      await PlanillaService.misioneros(responsable, { imagen: "con" })
    );
    const hoja = libro.getWorksheet("Misioneros");

    expect(hoja?.rowCount).toBe(2);
    expect(hoja?.getRow(2).getCell(1).value).toBe("Ibáñez");
    expect(hoja?.getRow(2).getCell(12).value).toBe("CBA JOV 0001");
  });
});
