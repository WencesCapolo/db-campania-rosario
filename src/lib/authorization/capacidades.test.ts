import { beforeEach, describe, expect, it } from "vitest";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import { AsignacionService } from "@/modules/asignacion/asignacion.service";
import { MisioneroService } from "@/modules/misionero/misionero.service";
import { TerritorioService } from "@/modules/territorio/territorio.service";
import { InvitacionService } from "@/modules/invitacion/invitacion.service";
import { UserService } from "@/modules/user/user.service";
import {
  crearActor,
  crearMisioneroDirecto,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

/**
 * ADR 0016 — un Buzón por función, y la Modalidad acota lo que se escribe.
 *
 * Los cuatro rols ven el país entero. Lo que los separa es lo que hacen: admin
 * y Asesor Nacional configuran; el Responsable Diocesano carga Peregrinas de
 * cualquier Modalidad; el Dirigente Joven, sólo de `JOV`.
 *
 * La mitad negativa es la que importa, como con el territorio antes: que el
 * Dirigente Joven pueda cargar una `JOV` pasa igual si puede cargar cualquiera.
 */

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;
let responsable: CurrentUser;
let dirigente: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
  responsable = await crearActor({ rol: "responsable_diocesano" });
  dirigente = await crearActor({ rol: "dirigente_joven" });
});

function imagen(modalidad: "JOV" | "FAM", diocesisLocalidadId?: string) {
  return crearPeregrinaDirecta({
    diocesisLocalidadId: diocesisLocalidadId ?? territorio.villaMaria.id,
    createdById: asesor.id,
    modalidad,
  });
}

function persona(diocesisLocalidadId?: string) {
  return crearMisioneroDirecto({
    diocesisLocalidadId: diocesisLocalidadId ?? territorio.villaMaria.id,
    createdById: asesor.id,
  });
}

describe("el Dirigente Joven ve todo", () => {
  it("lee una Peregrina de otra Modalidad, de cualquier Provincia", async () => {
    const fam = await imagen("FAM", territorio.zapala.id);

    const leida = await PeregrinaService.getById(dirigente, fam.id);

    expect(leida.modalidad).toBe("FAM");
  });

  it("el listado le trae todas las Modalidades", async () => {
    const jov = await imagen("JOV");
    const fam = await imagen("FAM", territorio.zapala.id);

    const pagina = await PeregrinaService.listPagina(dirigente, {});

    expect(pagina.filas.map((p) => p.id).sort()).toEqual([jov.id, fam.id].sort());
  });

  it("carga y edita Misioneros de cualquier Provincia", async () => {
    const creado = await MisioneroService.create(dirigente, {
      nombre: "Lucía",
      apellido: "Gómez",
      diocesisLocalidadId: territorio.chosMalal.id,
    });
    const editado = await MisioneroService.update(dirigente, creado.id, {
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(editado.diocesisLocalidad.id).toBe(territorio.villaMaria.id);
  });
});

describe("el Dirigente Joven escribe sólo Jóvenes", () => {
  it("registra una JOV", async () => {
    const creada = await PeregrinaService.create(dirigente, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(creada.modalidad).toBe("JOV");
  });

  it("NO registra una FAM", async () => {
    await expect(
      PeregrinaService.create(dirigente, {
        tipo: "peregrina",
        modalidad: "FAM",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(NoAutorizadoError);

    const pagina = await PeregrinaService.listPagina(asesor, {});
    expect(pagina.total).toBe(0);
  });

  it("NO edita una FAM, y queda intacta", async () => {
    const fam = await imagen("FAM");

    await expect(
      PeregrinaService.update(dirigente, fam.id, { estado: "en_reparacion" })
    ).rejects.toThrow(NoAutorizadoError);

    expect((await PeregrinaService.getById(asesor, fam.id)).estado).toBe("activa");
  });

  it("NO pasa una JOV a otra Modalidad", async () => {
    const jov = await imagen("JOV");

    await expect(
      PeregrinaService.update(dirigente, jov.id, { modalidad: "FAM" })
    ).rejects.toThrow(NoAutorizadoError);

    expect((await PeregrinaService.getById(asesor, jov.id)).modalidad).toBe("JOV");
  });

  it("NO trae una FAM a Jóvenes", async () => {
    const fam = await imagen("FAM");

    await expect(
      PeregrinaService.update(dirigente, fam.id, { modalidad: "JOV" })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("borra una JOV y NO borra una FAM", async () => {
    const jov = await imagen("JOV");
    const fam = await imagen("FAM");

    await PeregrinaService.borrar(dirigente, jov.id);
    await expect(PeregrinaService.borrar(dirigente, fam.id)).rejects.toThrow(
      NoAutorizadoError
    );

    expect((await PeregrinaService.getById(asesor, fam.id)).id).toBe(fam.id);
  });

  it("NO le genera el Código a una FAM", async () => {
    const fam = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: asesor.id,
      modalidad: "FAM",
      numeracionAnterior: "Peregrina 7",
    });

    await expect(PeregrinaService.generarCodigo(dirigente, fam.id)).rejects.toThrow(
      NoAutorizadoError
    );
  });

  it("entrega y devuelve una JOV", async () => {
    const jov = await imagen("JOV");
    const ana = await persona();
    const beto = await persona(territorio.zapala.id);

    await AsignacionService.asignar(dirigente, {
      peregrinaId: jov.id,
      tenedor: { tipo: "persona", id: ana.id },
    });
    await AsignacionService.entregar(dirigente, {
      peregrinaId: jov.id,
      tenedor: { tipo: "persona", id: beto.id },
    });
    const devuelta = await AsignacionService.devolver(dirigente, {
      peregrinaId: jov.id,
    });

    expect(devuelta.abierta).toBe(false);
  });

  it("NO asigna, entrega, devuelve ni corrige una FAM", async () => {
    const fam = await imagen("FAM");
    const ana = await persona();
    const beto = await persona();

    await expect(
      AsignacionService.asignar(dirigente, {
        peregrinaId: fam.id,
        tenedor: { tipo: "persona", id: ana.id },
      })
    ).rejects.toThrow(NoAutorizadoError);

    const abierta = await AsignacionService.asignar(responsable, {
      peregrinaId: fam.id,
      tenedor: { tipo: "persona", id: ana.id },
    });

    await expect(
      AsignacionService.entregar(dirigente, {
        peregrinaId: fam.id,
        tenedor: { tipo: "persona", id: beto.id },
      })
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      AsignacionService.devolver(dirigente, { peregrinaId: fam.id })
    ).rejects.toThrow(NoAutorizadoError);
    await expect(
      AsignacionService.corregir(dirigente, {
        asignacionId: abierta.id,
        notaApertura: "corregida",
      })
    ).rejects.toThrow(NoAutorizadoError);

    const tenencia = await AsignacionService.tenenciaActual(asesor, fam.id);
    expect(tenencia?.id).toBe(abierta.id);
  });

  it("para entregar se le ofrecen sólo las JOV", async () => {
    const jov = await imagen("JOV");
    await imagen("FAM");

    const opciones = await PeregrinaService.listParaEntregar(dirigente);
    const libres = await PeregrinaService.listDisponibles(dirigente);

    expect(opciones.map((p) => p.id)).toEqual([jov.id]);
    expect(libres.map((p) => p.id)).toEqual([jov.id]);
  });
});

describe("el Responsable Diocesano carga todas las Modalidades, en todo el país", () => {
  it("registra, edita y borra una FAM de otra Provincia", async () => {
    const creada = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "FAM",
      diocesisLocalidadId: territorio.zapala.id,
    });
    await PeregrinaService.update(responsable, creada.id, { modalidad: "JOV" });
    await PeregrinaService.borrar(responsable, creada.id);

    expect((await PeregrinaService.listPagina(asesor, {})).total).toBe(0);
  });

  it("para entregar se le ofrecen todas", async () => {
    await imagen("JOV");
    await imagen("FAM");

    expect(await PeregrinaService.listParaEntregar(responsable)).toHaveLength(2);
  });
});

describe("quien carga no configura", () => {
  for (const rol of ["responsable_diocesano", "dirigente_joven"] as const) {
    it(`${rol}: NO toca el territorio`, async () => {
      const actor = rol === "dirigente_joven" ? dirigente : responsable;

      await expect(
        TerritorioService.crearProvincia(actor, {
          nombre: "Mendoza",
          abreviatura: "MZA",
        })
      ).rejects.toThrow(NoAutorizadoError);
      await expect(
        TerritorioService.darDeBajaDiocesisLocalidad(actor, territorio.zapala.id)
      ).rejects.toThrow(NoAutorizadoError);
    });

    it(`${rol}: NO invita a nadie, ni a su propio rol`, async () => {
      const actor = rol === "dirigente_joven" ? dirigente : responsable;

      for (const invitado of ["responsable_diocesano", "dirigente_joven"] as const) {
        await expect(
          InvitacionService.invitar(actor, {
            email: `otro-${invitado}@ejemplo.test`,
            rol: invitado,
          })
        ).rejects.toThrow(NoAutorizadoError);
      }
    });

    it(`${rol}: NO lista ni administra Usuarios`, async () => {
      const actor = rol === "dirigente_joven" ? dirigente : responsable;
      const otro = rol === "dirigente_joven" ? responsable : dirigente;

      await expect(UserService.listarUsuarios(actor)).rejects.toThrow(
        NoAutorizadoError
      );
      await expect(UserService.darDeBaja(actor, otro.id)).rejects.toThrow(
        NoAutorizadoError
      );
    });
  }

  it("un Asesor Nacional invita a los dos, sin territorio", async () => {
    const a = await InvitacionService.invitar(asesor, {
      email: "dirigentes@ejemplo.test",
      rol: "dirigente_joven",
    });
    const b = await InvitacionService.invitar(asesor, {
      email: "responsables@ejemplo.test",
      rol: "responsable_diocesano",
    });

    expect([a.diocesisLocalidad, b.diocesisLocalidad]).toEqual([null, null]);
  });

  it("y uno de los dos con territorio se rechaza", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: "dirigentes@ejemplo.test",
        rol: "dirigente_joven",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow();
  });
});
