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

  it("y en particular NO recibe un rol por omisión", async () => {
    const identidad = await crearIdentidad();

    // El defecto que el issue #2 cierra: autenticarse alcanzaba para estar
    // autorizado, con un rol «por si acaso».
    expect(await UserService.resolverActorSiExiste(identidad)).toBeNull();
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

  it("distingue los motivos, porque mandan a personas distintas", async () => {
    const desconocida = await crearIdentidad();
    const deBaja = await crearActor({ rol: "responsable_diocesano" });
    await UserService.darDeBaja(asesor, deBaja.id);

    expect(await UserService.motivoDeRefusa(desconocida.id)).toBe("sin-usuario");
    expect(await UserService.motivoDeRefusa(deBaja.id)).toBe("dado-de-baja");
    expect(await UserService.motivoDeRefusa(asesor.id)).toBeNull();
  });

  it("resuelve el rol de su fila", async () => {
    const actor = await UserService.resolverActor({
      id: asesor.id,
      email: asesor.email,
    });

    expect(actor.role).toBe("asesor_nacional");
  });
});

describe("dar de baja un Usuario — historia 15", () => {
  it("le quita el acceso", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    await UserService.darDeBaja(asesor, responsable.id);

    expect(
      await UserService.resolverActorSiExiste({
        id: responsable.id,
        email: responsable.email,
      })
    ).toBeNull();
  });

  it("y deja intactas sus atribuciones anteriores", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });
    const registrada = await PeregrinaService.create(responsable, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await UserService.darDeBaja(asesor, responsable.id);

    // El registro sigue apuntando a una fila real: por eso es baja y no borrado.
    const releida = await PeregrinaService.getById(asesor, registrada.id);
    expect(releida.createdById).toBe(responsable.id);
  });

  it("no se puede dar de baja dos veces", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    await UserService.darDeBaja(asesor, responsable.id);

    await expect(
      UserService.darDeBaja(asesor, responsable.id)
    ).rejects.toThrow(/ya estaba dado de baja/);
  });

  it("nadie se da de baja a sí mismo", async () => {
    await expect(UserService.darDeBaja(asesor, asesor.id)).rejects.toThrow(
      /a vos mismo/
    );
  });

  it("una reactivación devuelve el acceso", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    await UserService.darDeBaja(asesor, responsable.id);
    await UserService.reactivar(asesor, responsable.id);

    expect(
      await UserService.resolverActorSiExiste({
        id: responsable.id,
        email: responsable.email,
      })
    ).not.toBeNull();
  });
});

describe("el rango acota la administración de Usuarios", () => {
  it("un Dirigente Joven no administra Usuarios en absoluto", async () => {
    const dirigente = await crearActor({ rol: "dirigente_joven" });

    await expect(UserService.listarUsuarios(dirigente)).rejects.toThrow(
      NoAutorizadoError
    );
  });
  it("un Responsable Diocesano NO puede ascender a nadie por encima suyo", async () => {
    const propio = await crearActor({ rol: "responsable_diocesano" });
    const diocesano = await crearActor({ rol: "responsable_diocesano" });

    await expect(
      UserService.actualizar(diocesano, propio.id, { rol: "asesor_nacional" })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Asesor Nacional cambia el rol de quien carga — historia 16", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    const actualizado = await UserService.actualizar(asesor, responsable.id, {
      rol: "dirigente_joven",
    });

    expect(actualizado.role).toBe("dirigente_joven");
  });
  it("un Asesor Nacional NO puede ascender a nadie a su propio rango", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });

    // Estrictamente inferior significa estrictamente: si un Asesor Nacional
    // pudiera nombrar Asesores Nacionales, el rango dejaría de acotar nada.
    await expect(
      UserService.actualizar(asesor, responsable.id, { rol: "asesor_nacional" })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("los emails salen de neon_auth, no de un guión", () => {
  it("la lista de Usuarios trae el email real de cada uno", async () => {
    const responsable = await crearActor({
      rol: "responsable_diocesano",
      email: "responsable.villamaria@ejemplo.test",
    });

    const lista = await UserService.listarUsuarios(asesor);
    const encontrado = lista.find((u) => u.id === responsable.id);

    expect(encontrado?.email).toBe("responsable.villamaria@ejemplo.test");
  });

  it("marca al Usuario cuya identidad ya no existe en el proveedor — ADR 0002", async () => {
    const huerfano = await crearActor({
      rol: "responsable_diocesano",
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
    const diocesano = await crearActor({ rol: "responsable_diocesano" });

    await expect(
      UserService.listarIdentidadesSinUsuario(diocesano)
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("un Usuario dado de baja sale de las listas", () => {
  it("no aparece salvo que se lo pida explícitamente", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });
    await UserService.darDeBaja(asesor, responsable.id);

    const activos = await UserService.listarUsuarios(asesor);
    const conBajas = await UserService.listarUsuarios(asesor, {
      incluirBajas: true,
    });

    expect(activos.map((u) => u.id)).not.toContain(responsable.id);
    expect(conBajas.find((u) => u.id === responsable.id)?.deBaja).toBe(true);
  });

  it("y sigue habiendo una fila detrás de sus registros", async () => {
    const responsable = await crearActor({ rol: "responsable_diocesano" });
    const registrada = await crearPeregrinaDirecta({
      diocesisLocalidadId: territorio.villaMaria.id,
      createdById: responsable.id,
    });
    await UserService.darDeBaja(asesor, responsable.id);

    const releida = await PeregrinaService.getById(asesor, registrada.id);
    expect(releida.createdById).toBe(responsable.id);
  });
});

describe("un admin administra a otros admins — 2026-07-25", () => {
  it("asciende a un Usuario existente a admin", async () => {
    const admin = await crearActor({ rol: "admin" });

    const actualizado = await UserService.actualizar(admin, asesor.id, {
      rol: "admin",
    });

    expect(actualizado.role).toBe("admin");
  });

  it("cambia el rol de otro admin", async () => {
    const admin = await crearActor({ rol: "admin" });
    const otro = await crearActor({ rol: "admin" });

    const actualizado = await UserService.actualizar(admin, otro.id, {
      rol: "asesor_nacional",
    });

    expect(actualizado.role).toBe("asesor_nacional");
  });

  it("nadie se cambia el rol a sí mismo: el último admin no se puede bajar solo", async () => {
    const admin = await crearActor({ rol: "admin" });

    await expect(
      UserService.actualizar(admin, admin.id, { rol: "asesor_nacional" })
    ).rejects.toThrow(/tu propio rol/);
  });
});
