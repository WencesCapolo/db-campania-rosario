import { beforeEach, describe, expect, it } from "vitest";
import { UserService } from "./user.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  crearActor,
  crearIdentidad,
  crearPeregrinaDirecta,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

let territorio: TerritorioDePrueba;
let asesor: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  asesor = await crearActor({ rol: "asesor_nacional" });
});

describe("resolver el Actor de una identidad autenticada — historia 12", () => {
  it("una identidad sin registro de aplicación NO queda autorizada", async () => {
    const identidad = await crearIdentidad({ email: "desconocida@ejemplo.test" });

    expect(await UserService.resolverActorSiExiste(identidad)).toBeNull();
  });

  it("y en particular NO queda como Referente Local", async () => {
    const identidad = await crearIdentidad();

    // El defecto que el issue #2 cierra: autenticarse alcanzaba para estar
    // autorizado, con rol referente_local «por si acaso».
    const actor = await UserService.resolverActorSiExiste(identidad);

    expect(actor).toBeNull();
    expect(actor?.role).not.toBe("referente_local");
  });

  it("lo rechaza con un mensaje en castellano que nombra a quién pedirle acceso", async () => {
    const identidad = await crearIdentidad();

    await expect(UserService.resolverActor(identidad)).rejects.toThrow(
      NoAutorizadoError
    );
    await expect(UserService.resolverActor(identidad)).rejects.toThrow(
      /todavía no está autorizada/
    );
  });

  it("distingue los tres motivos, porque mandan a tres personas distintas", async () => {
    const desconocida = await crearIdentidad();
    const sinTerritorio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: null,
    });
    const deBaja = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await UserService.darDeBaja(asesor, deBaja.id);

    expect(await UserService.motivoDeRefusa(desconocida.id)).toBe("sin-usuario");
    expect(await UserService.motivoDeRefusa(sinTerritorio.id)).toBe(
      "sin-territorio"
    );
    expect(await UserService.motivoDeRefusa(deBaja.id)).toBe("dado-de-baja");
    expect(await UserService.motivoDeRefusa(asesor.id)).toBeNull();
  });

  it("un rol nacional resuelve sin territorio, porque cubre el país", async () => {
    const actor = await UserService.resolverActor({
      id: asesor.id,
      email: asesor.email,
    });

    expect(actor.role).toBe("asesor_nacional");
    expect(actor.diocesisLocalidadId).toBeNull();
  });

  it("un rol territorial sin territorio NO resuelve", async () => {
    const roto = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: null,
    });

    expect(
      await UserService.resolverActorSiExiste({ id: roto.id, email: roto.email })
    ).toBeNull();
  });
});

describe("dar de baja un Usuario — historia 15", () => {
  it("le quita el acceso", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await UserService.darDeBaja(asesor, referente.id);

    expect(
      await UserService.resolverActorSiExiste({
        id: referente.id,
        email: referente.email,
      })
    ).toBeNull();
  });

  it("y deja intactas sus atribuciones anteriores", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const registrada = await PeregrinaService.create(referente, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await UserService.darDeBaja(asesor, referente.id);

    // El registro sigue apuntando a una fila real: por eso es baja y no borrado.
    const releida = await PeregrinaService.getById(asesor, registrada.id);
    expect(releida.createdById).toBe(referente.id);
  });

  it("no se puede dar de baja dos veces", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await UserService.darDeBaja(asesor, referente.id);

    await expect(
      UserService.darDeBaja(asesor, referente.id)
    ).rejects.toThrow(/ya estaba dado de baja/);
  });

  it("nadie se da de baja a sí mismo", async () => {
    await expect(UserService.darDeBaja(asesor, asesor.id)).rejects.toThrow(
      /a vos mismo/
    );
  });

  it("una reactivación devuelve el acceso", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await UserService.darDeBaja(asesor, referente.id);
    await UserService.reactivar(asesor, referente.id);

    expect(
      await UserService.resolverActorSiExiste({
        id: referente.id,
        email: referente.email,
      })
    ).not.toBeNull();
  });
});

describe("el rango y el territorio acotan la administración de Usuarios", () => {
  it("un Responsable Diocesano NO ve los Usuarios de otra Diócesis", async () => {
    const propio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const vecino = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });
    const diocesano = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const lista = await UserService.listarUsuarios(diocesano);
    const ids = lista.map((u) => u.id);

    expect(ids).toContain(propio.id);
    expect(ids).not.toContain(vecino.id);
    expect(ids).not.toContain(asesor.id);
  });

  it("un Referente Local no administra Usuarios en absoluto", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(UserService.listarUsuarios(referente)).rejects.toThrow(
      NoAutorizadoError
    );
  });

  it("un Responsable Diocesano NO puede tocar un Usuario de otra Diócesis", async () => {
    const vecino = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });
    const diocesano = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      UserService.darDeBaja(diocesano, vecino.id)
    ).rejects.toThrow(/No existe ese usuario/);
  });

  it("un Responsable Diocesano NO puede ascender a nadie por encima suyo", async () => {
    const propio = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const diocesano = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      UserService.actualizar(diocesano, propio.id, { rol: "asesor_nacional" })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Asesor Nacional reasigna rol y territorio — historia 16", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const actualizado = await UserService.actualizar(asesor, referente.id, {
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(actualizado.role).toBe("responsable_diocesano");
    expect(actualizado.diocesisLocalidad?.nombre).toBe("Zapala");
  });

  it("no deja un rol territorial sin territorio", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      UserService.actualizar(asesor, referente.id, {
        diocesisLocalidadId: null,
      })
    ).rejects.toThrow(/Elegí la Diócesis\/Localidad/);
  });

  it("un Asesor Nacional NO puede ascender a nadie a su propio rango", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    // Estrictamente inferior significa estrictamente: si un Asesor Nacional
    // pudiera nombrar Asesores Nacionales, el rango dejaría de acotar nada.
    await expect(
      UserService.actualizar(asesor, referente.id, { rol: "asesor_nacional" })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("no le pone territorio a un rol nacional", async () => {
    const admin = await crearActor({ rol: "admin" });
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      UserService.actualizar(admin, referente.id, {
        rol: "asesor_nacional",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(/cubren todo el país/);
  });

  it("ascender a un rol nacional le quita el territorio", async () => {
    const admin = await crearActor({ rol: "admin" });
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const ascendido = await UserService.actualizar(admin, referente.id, {
      rol: "asesor_nacional",
      diocesisLocalidadId: null,
    });

    expect(ascendido.diocesisLocalidad).toBeNull();
  });
});

describe("los emails salen de neon_auth, no de un guión", () => {
  it("la lista de Usuarios trae el email real de cada uno", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
      email: "referente.villamaria@ejemplo.test",
    });

    const lista = await UserService.listarUsuarios(asesor);
    const encontrado = lista.find((u) => u.id === referente.id);

    expect(encontrado?.email).toBe("referente.villamaria@ejemplo.test");
  });

  it("marca al Usuario cuya identidad ya no existe en el proveedor — ADR 0002", async () => {
    const huerfano = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
      sinIdentidad: true,
    });

    const lista = await UserService.listarUsuarios(asesor);
    const encontrado = lista.find((u) => u.id === huerfano.id);

    expect(encontrado?.sinIdentidad).toBe(true);
  });

  it("avisa de una identidad con sesión y sin Usuario — historia 17", async () => {
    const identidad = await crearIdentidad({ email: "a.medias@ejemplo.test" });

    const sinUsuario = await UserService.listarIdentidadesSinUsuario(asesor);

    expect(sinUsuario.map((i) => i.email)).toContain("a.medias@ejemplo.test");
    // Y no lista a los que sí tienen Usuario.
    expect(sinUsuario.map((i) => i.id)).not.toContain(asesor.id);
    expect(sinUsuario.map((i) => i.id)).toContain(identidad.id);
  });

  it("sólo un rol nacional ve esa advertencia", async () => {
    const diocesano = await crearActor({
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      UserService.listarIdentidadesSinUsuario(diocesano)
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("un Usuario dado de baja sale de las listas", () => {
  it("no aparece salvo que se lo pida explícitamente", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await UserService.darDeBaja(asesor, referente.id);

    const activos = await UserService.listarUsuarios(asesor);
    const conBajas = await UserService.listarUsuarios(asesor, {
      incluirBajas: true,
    });

    expect(activos.map((u) => u.id)).not.toContain(referente.id);
    expect(conBajas.find((u) => u.id === referente.id)?.deBaja).toBe(true);
  });

  it("y sigue habiendo una fila detrás de sus registros", async () => {
    const referente = await crearActor({
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const registrada = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: referente.id,
    });
    await UserService.darDeBaja(asesor, referente.id);

    const releida = await PeregrinaService.getById(asesor, registrada.id);
    expect(releida.createdById).toBe(referente.id);
  });
});
