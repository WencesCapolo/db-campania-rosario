import { beforeEach, describe, expect, it } from "vitest";
import { InvitacionService } from "./invitacion.service";
import { UserService } from "@/modules/user/user.service";
import { PeregrinaService } from "@/modules/peregrina/peregrina.service";
import {
  crearActor,
  crearIdentidad,
  crearTerritorioDePrueba,
  type TerritorioDePrueba,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";

/**
 * Aprovisionamiento por invitación — historias 7 a 14.
 *
 * Nadie se registra solo. Un Usuario existe porque alguien de rango superior lo
 * invitó a un territorio que ese alguien también alcanza, y la invitación es el
 * registro que lo prueba.
 */

let territorio: TerritorioDePrueba;
let admin: CurrentUser;
let asesor: CurrentUser;
let diocesano: CurrentUser;
let referente: CurrentUser;

beforeEach(async () => {
  territorio = await crearTerritorioDePrueba();
  admin = await crearActor({ rol: "admin" });
  asesor = await crearActor({ rol: "asesor_nacional" });
  diocesano = await crearActor({
    rol: "responsable_diocesano",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
  referente = await crearActor({
    rol: "referente_local",
    diocesisLocalidadId: territorio.villaMaria.id,
  });
});

describe("quién puede invitar a quién — historias 7 a 11", () => {
  it("un Asesor Nacional invita a un Responsable Diocesano y le asigna la Diócesis", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "nuevo.diocesano@ejemplo.test",
      rol: "responsable_diocesano",
      diocesisLocalidadId: territorio.zapala.id,
    });

    expect(invitacion.estado).toBe("pendiente");
    expect(invitacion.rol).toBe("responsable_diocesano");
    expect(invitacion.diocesisLocalidad?.nombre).toBe("Zapala");
    expect(invitacion.invitadaPorId).toBe(asesor.id);
  });

  it("un Responsable Diocesano invita a un Referente Local de su Diócesis", async () => {
    const invitacion = await InvitacionService.invitar(diocesano, {
      email: "nuevo.referente@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    expect(invitacion.rol).toBe("referente_local");
    expect(invitacion.diocesisLocalidad?.nombre).toBe("Villa María");
  });

  it("un Responsable Diocesano NO puede invitar fuera de su Diócesis — historia 9", async () => {
    await expect(
      InvitacionService.invitar(diocesano, {
        email: "de.al.lado@ejemplo.test",
        rol: "referente_local",
        // Misma Provincia, otra Diócesis. La jerarquía es territorial además de
        // jerárquica, y el selector de territorio llega más lejos que el permiso.
        diocesisLocalidadId: territorio.rioCuarto.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Responsable Diocesano NO puede invitar a su propio rango ni por encima — historia 10", async () => {
    await expect(
      InvitacionService.invitar(diocesano, {
        email: "otro.diocesano@ejemplo.test",
        rol: "responsable_diocesano",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(NoAutorizadoError);

    await expect(
      InvitacionService.invitar(diocesano, {
        email: "un.asesor@ejemplo.test",
        rol: "asesor_nacional",
        diocesisLocalidadId: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("un Referente Local no puede invitar a nadie — historia 11", async () => {
    await expect(
      InvitacionService.invitar(referente, {
        email: "cualquiera@ejemplo.test",
        rol: "referente_local",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(NoAutorizadoError);

    await expect(InvitacionService.listarPendientes(referente)).rejects.toThrow(
      NoAutorizadoError
    );
  });

  it("un admin puede invitar a otro admin — decidido con el usuario el 2026-07-25", async () => {
    const invitacion = await InvitacionService.invitar(admin, {
      email: "otro.admin@ejemplo.test",
      rol: "admin",
      diocesisLocalidadId: null,
    });

    expect(invitacion.rol).toBe("admin");
    expect(invitacion.diocesisLocalidad).toBeNull();
  });

  it("un Asesor Nacional NO puede invitar a otro Asesor Nacional", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: "colega@ejemplo.test",
        rol: "asesor_nacional",
        diocesisLocalidadId: null,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("el par rol/territorio es una regla, no una comodidad", () => {
  it("un rol territorial necesita territorio", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: "sin.territorio@ejemplo.test",
        rol: "referente_local",
        diocesisLocalidadId: null,
      })
    ).rejects.toThrow(/Elegí la Diócesis\/Localidad/);
  });

  it("un rol nacional no lleva territorio", async () => {
    await expect(
      InvitacionService.invitar(admin, {
        email: "asesor.con.diocesis@ejemplo.test",
        rol: "asesor_nacional",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(/cubren todo el país/);
  });

  it("no se invita a una Diócesis dada de baja ni a una inexistente", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: "a.ningun.lado@ejemplo.test",
        rol: "referente_local",
        diocesisLocalidadId: "no-existe",
      })
    ).rejects.toThrow(/No existe esa Diócesis\/Localidad/);
  });
});

describe("aceptar una invitación", () => {
  it("crea el Usuario con el rol y el territorio invitados", async () => {
    await InvitacionService.invitar(asesor, {
      email: "recien.llegado@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const identidad = await crearIdentidad({
      email: "recien.llegado@ejemplo.test",
    });
    const actor = await InvitacionService.aceptarSiHayPendiente(identidad);

    expect(actor?.role).toBe("referente_local");
    expect(actor?.diocesisLocalidadId).toBe(territorio.zapala.id);
  });

  it("el id del Usuario es el de la identidad, así que la sesión lo encuentra", async () => {
    await InvitacionService.invitar(asesor, {
      email: "coincide@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const identidad = await crearIdentidad({ email: "coincide@ejemplo.test" });
    await InvitacionService.aceptarSiHayPendiente(identidad);

    // Lo que el flujo anterior no lograba: creaba la fila con un randomUUID que
    // ninguna sesión iba a igualar nunca.
    const resuelto = await UserService.resolverActorSiExiste(identidad);
    expect(resuelto?.id).toBe(identidad.id);
  });

  it("ignora mayúsculas y espacios en el email", async () => {
    await InvitacionService.invitar(asesor, {
      email: "  Mayuscula@Ejemplo.TEST ",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const identidad = await crearIdentidad({ email: "mayuscula@ejemplo.test" });

    expect(await InvitacionService.aceptarSiHayPendiente(identidad)).not.toBeNull();
  });

  it("aceptar dos veces produce un solo Usuario", async () => {
    await InvitacionService.invitar(asesor, {
      email: "dos.veces@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const identidad = await crearIdentidad({ email: "dos.veces@ejemplo.test" });
    await InvitacionService.aceptarSiHayPendiente(identidad);
    await InvitacionService.aceptarSiHayPendiente(identidad);

    const usuarios = await UserService.listarUsuarios(asesor);
    expect(usuarios.filter((u) => u.id === identidad.id)).toHaveLength(1);
  });

  it("una identidad sin invitación no obtiene nada", async () => {
    const identidad = await crearIdentidad({ email: "nadie@ejemplo.test" });

    expect(await InvitacionService.aceptarSiHayPendiente(identidad)).toBeNull();
  });

  it("una invitación revocada no se puede aceptar — historia 14", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "un.error@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await InvitacionService.revocar(asesor, invitacion.id);

    const identidad = await crearIdentidad({ email: "un.error@ejemplo.test" });
    expect(await InvitacionService.aceptarSiHayPendiente(identidad)).toBeNull();
  });

  it("el Usuario invitado queda atribuido a quien lo invitó", async () => {
    await InvitacionService.invitar(diocesano, {
      email: "delegado@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    const identidad = await crearIdentidad({ email: "delegado@ejemplo.test" });
    await InvitacionService.aceptarSiHayPendiente(identidad);

    const usuarios = await UserService.listarUsuarios(asesor);
    const invitado = usuarios.find((u) => u.id === identidad.id);
    expect(invitado?.createdById).toBe(diocesano.id);
  });

  it("el Usuario invitado puede trabajar en su territorio y no en otro", async () => {
    await InvitacionService.invitar(asesor, {
      email: "a.trabajar@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.zapala.id,
    });
    const identidad = await crearIdentidad({ email: "a.trabajar@ejemplo.test" });
    const actor = await InvitacionService.aceptarSiHayPendiente(identidad);
    expect(actor).not.toBeNull();
    if (!actor) return;

    const creada = await PeregrinaService.create(actor, {
      tipo: "peregrina",
      modalidad: "JOV",
      diocesisLocalidadId: territorio.zapala.id,
    });
    expect(creada.codigo).toBe("NEU JOV 0001");

    await expect(
      PeregrinaService.create(actor, {
        tipo: "peregrina",
        modalidad: "JOV",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("invitaciones pendientes — historias 13 y 14", () => {
  it("un Asesor Nacional ve las pendientes del país", async () => {
    await InvitacionService.invitar(asesor, {
      email: "uno@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await InvitacionService.invitar(asesor, {
      email: "dos@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.zapala.id,
    });

    const pendientes = await InvitacionService.listarPendientes(asesor);

    expect(pendientes.map((i) => i.email).sort()).toEqual([
      "dos@ejemplo.test",
      "uno@ejemplo.test",
    ]);
  });

  it("un Responsable Diocesano ve sólo las de su Diócesis", async () => {
    await InvitacionService.invitar(asesor, {
      email: "de.villa.maria@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    await InvitacionService.invitar(asesor, {
      email: "de.rio.cuarto@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    const pendientes = await InvitacionService.listarPendientes(diocesano);

    expect(pendientes.map((i) => i.email)).toEqual([
      "de.villa.maria@ejemplo.test",
    ]);
  });

  it("una invitación aceptada deja de estar pendiente", async () => {
    await InvitacionService.invitar(asesor, {
      email: "ya.entro@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });
    const identidad = await crearIdentidad({ email: "ya.entro@ejemplo.test" });
    await InvitacionService.aceptarSiHayPendiente(identidad);

    expect(await InvitacionService.listarPendientes(asesor)).toEqual([]);
  });

  it("un Responsable Diocesano NO puede revocar una invitación de otra Diócesis", async () => {
    const ajena = await InvitacionService.invitar(asesor, {
      email: "ajena@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.rioCuarto.id,
    });

    await expect(
      InvitacionService.revocar(diocesano, ajena.id)
    ).rejects.toThrow(/No existe esa invitación/);
  });

  it("no se revoca dos veces", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "revocada@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await InvitacionService.revocar(asesor, invitacion.id);

    await expect(
      InvitacionService.revocar(asesor, invitacion.id)
    ).rejects.toThrow(/ya fue aceptada o revocada/);
  });

  it("no se invita dos veces al mismo email mientras haya una pendiente", async () => {
    await InvitacionService.invitar(asesor, {
      email: "repetida@ejemplo.test",
      rol: "referente_local",
      diocesisLocalidadId: territorio.villaMaria.id,
    });

    await expect(
      InvitacionService.invitar(asesor, {
        email: "repetida@ejemplo.test",
        rol: "referente_local",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(/invitación pendiente/);
  });

  it("no se invita a quien ya tiene usuario", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: referente.email,
        rol: "referente_local",
        diocesisLocalidadId: territorio.villaMaria.id,
      })
    ).rejects.toThrow(/ya tiene un usuario/);
  });
});
