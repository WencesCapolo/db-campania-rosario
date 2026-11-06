import { beforeEach, describe, expect, it } from "vitest";
import { InvitacionService } from "./invitacion.service";
import { UserService } from "@/modules/user/user.service";
import {
  crearActor,
  crearIdentidad,
} from "@/test/factories";
import type { CurrentUser } from "@/modules/user/user.types";
import { NoAutorizadoError } from "@/lib/errors";
import type { Identidad } from "./invitacion.types";

/**
 * Aprovisionamiento por invitación — historias 7 a 14.
 *
 * Nadie se registra solo. Un Usuario existe porque alguien de rango superior lo
 * invitó, y la invitación es el registro que lo prueba. Desde ADR 0016 ningún
 * rol lleva territorio: los dos que cargan registros son un Buzón por función,
 * y los invita un admin o un Asesor Nacional.
 */

let admin: CurrentUser;
let asesor: CurrentUser;
let dirigente: CurrentUser;

beforeEach(async () => {
  admin = await crearActor({ rol: "admin" });
  asesor = await crearActor({ rol: "asesor_nacional" });
  dirigente = await crearActor({ rol: "dirigente_joven" });
});

describe("quién puede invitar a quién — historias 7 a 11", () => {
  it("un Asesor Nacional invita a un Responsable Diocesano y a un Dirigente Joven", async () => {
    const r = await InvitacionService.invitar(asesor, {
      email: "responsables@ejemplo.test",
      rol: "responsable_diocesano",
    });
    const d = await InvitacionService.invitar(asesor, {
      email: "dirigentes@ejemplo.test",
      rol: "dirigente_joven",
    });

    expect([r.estado, d.estado]).toEqual(["pendiente", "pendiente"]);
    expect([r.rol, d.rol]).toEqual(["responsable_diocesano", "dirigente_joven"]);
    expect(r.invitadaPorId).toBe(asesor.id);
  });

  it("un admin puede invitar a otro admin — decidido con el usuario el 2026-07-25", async () => {
    const invitacion = await InvitacionService.invitar(admin, {
      email: "otro.admin@ejemplo.test",
      rol: "admin",
    });

    expect(invitacion.rol).toBe("admin");
  });

  it("un Asesor Nacional NO puede invitar a otro Asesor Nacional", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: "colega@ejemplo.test",
        rol: "asesor_nacional",
      })
    ).rejects.toThrow(NoAutorizadoError);
  });
});

describe("aceptar una invitación", () => {
  it("crea el Usuario con el rol invitado", async () => {
    await InvitacionService.invitar(asesor, {
      email: "recien.llegado@ejemplo.test",
      rol: "dirigente_joven",
    });

    const identidad = await crearIdentidad({
      email: "recien.llegado@ejemplo.test",
    });
    const actor = await entrar(identidad);

    expect(actor?.role).toBe("dirigente_joven");
  });

  it("el id del Usuario es el de la identidad, así que la sesión lo encuentra", async () => {
    await InvitacionService.invitar(asesor, {
      email: "coincide@ejemplo.test",
      rol: "responsable_diocesano",
    });

    const identidad = await crearIdentidad({ email: "coincide@ejemplo.test" });
    await entrar(identidad);

    // Lo que el flujo anterior no lograba: creaba la fila con un randomUUID que
    // ninguna sesión iba a igualar nunca.
    const resuelto = await UserService.resolverActorSiExiste(identidad);
    expect(resuelto?.id).toBe(identidad.id);
  });

  it("ignora mayúsculas y espacios en el email", async () => {
    await InvitacionService.invitar(asesor, {
      email: "  Mayuscula@Ejemplo.TEST ",
      rol: "responsable_diocesano",
    });

    const identidad = await crearIdentidad({ email: "mayuscula@ejemplo.test" });

    expect(await entrar(identidad)).not.toBeNull();
  });

  it("aceptar dos veces produce un solo Usuario", async () => {
    await InvitacionService.invitar(asesor, {
      email: "dos.veces@ejemplo.test",
      rol: "responsable_diocesano",
    });

    const identidad = await crearIdentidad({ email: "dos.veces@ejemplo.test" });
    await entrar(identidad);
    await entrar(identidad);

    const usuarios = await UserService.listarUsuarios(asesor);
    expect(usuarios.filter((u) => u.id === identidad.id)).toHaveLength(1);
  });

  it("una identidad sin invitación no obtiene nada", async () => {
    const identidad = await crearIdentidad({ email: "nadie@ejemplo.test" });

    expect(await entrar(identidad)).toBeNull();
  });

  it("una invitación revocada no se puede aceptar — historia 14", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "un.error@ejemplo.test",
      rol: "responsable_diocesano",
    });

    await InvitacionService.revocar(asesor, invitacion.id);

    const identidad = await crearIdentidad({ email: "un.error@ejemplo.test" });
    expect(await entrar(identidad)).toBeNull();
  });

  it("el Usuario invitado queda atribuido a quien lo invitó", async () => {
    await InvitacionService.invitar(asesor, {
      email: "delegado@ejemplo.test",
      rol: "dirigente_joven",
    });

    const identidad = await crearIdentidad({ email: "delegado@ejemplo.test" });
    await entrar(identidad);

    const usuarios = await UserService.listarUsuarios(asesor);
    const invitado = usuarios.find((u) => u.id === identidad.id);
    expect(invitado?.createdById).toBe(asesor.id);
  });
});

describe("invitaciones pendientes — historias 13 y 14", () => {
  it("un Asesor Nacional ve las pendientes", async () => {
    await InvitacionService.invitar(asesor, {
      email: "uno@ejemplo.test",
      rol: "responsable_diocesano",
    });
    await InvitacionService.invitar(asesor, {
      email: "dos@ejemplo.test",
      rol: "dirigente_joven",
    });

    const pendientes = await InvitacionService.listarPendientes(asesor);

    expect(pendientes.map((i) => i.email).sort()).toEqual([
      "dos@ejemplo.test",
      "uno@ejemplo.test",
    ]);
  });

  it("una invitación aceptada deja de estar pendiente", async () => {
    await InvitacionService.invitar(asesor, {
      email: "ya.entro@ejemplo.test",
      rol: "responsable_diocesano",
    });
    const identidad = await crearIdentidad({ email: "ya.entro@ejemplo.test" });
    await entrar(identidad);

    expect(await InvitacionService.listarPendientes(asesor)).toEqual([]);
  });

  it("quien carga no revoca", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "ajena@ejemplo.test",
      rol: "dirigente_joven",
    });

    await expect(
      InvitacionService.revocar(dirigente, invitacion.id)
    ).rejects.toThrow(NoAutorizadoError);
  });

  it("no se revoca dos veces", async () => {
    const invitacion = await InvitacionService.invitar(asesor, {
      email: "revocada@ejemplo.test",
      rol: "responsable_diocesano",
    });

    await InvitacionService.revocar(asesor, invitacion.id);

    await expect(
      InvitacionService.revocar(asesor, invitacion.id)
    ).rejects.toThrow(/ya fue aceptada o revocada/);
  });

  it("no se invita dos veces al mismo email mientras haya una pendiente", async () => {
    await InvitacionService.invitar(asesor, {
      email: "repetida@ejemplo.test",
      rol: "responsable_diocesano",
    });

    await expect(
      InvitacionService.invitar(asesor, {
        email: "repetida@ejemplo.test",
        rol: "responsable_diocesano",
      })
    ).rejects.toThrow(/invitación pendiente/);
  });

  it("no se invita a quien ya tiene usuario", async () => {
    await expect(
      InvitacionService.invitar(asesor, {
        email: dirigente.email,
        rol: "dirigente_joven",
      })
    ).rejects.toThrow(/ya tiene un usuario/);
  });
});

/** What `getCurrentUser` does on a first sign-in: accept, then resolve the Actor. */
async function entrar(identidad: Identidad) {
  await InvitacionService.aceptarSiHayPendiente(identidad);
  return UserService.resolverActorSiExiste(identidad);
}
