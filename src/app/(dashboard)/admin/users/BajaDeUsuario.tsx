"use client";

import ConfirmarAccion from "@/components/ConfirmarAccion";
import {
  darDeBajaUsuarioAction,
  reactivarUsuarioAction,
} from "@/modules/user/user.router";

/**
 * Quitar un acceso, o devolverlo — historia 15.
 *
 * `UserService.darDeBaja` was written and tested in issue #2 and had no control
 * anywhere, so the screen could list who had access and not end it. That is the
 * gap worth closing first of the three: an invitation sent to the wrong address
 * could already be revoked, but a Usuario who had actually signed in could only
 * be stopped by an UPDATE against the production database.
 *
 * Access ends; attributions stay. The row is never destroyed, so `createdById`
 * keeps resolving on every record they ever registered, and the consequence says
 * that rather than implying a deletion that will not happen.
 *
 * The subject is the email, and the copy calls it *an access* — `el acceso de …`.
 * Referentes Locales share one login per territory, so "dar de baja a
 * referentes@villamaria" would be a sentence about a place written as if it were
 * about a person. Here the account is genuinely what is being changed, which is
 * the one case where naming it is honest.
 *
 * Refusing to give yourself de baja is `UserService`'s rule, checked there and
 * not copied here — the button is simply not offered for your own row, which is a
 * different thing from re-implementing the guard.
 */
export default function BajaDeUsuario({
  id,
  email,
  deBaja,
}: {
  id: string;
  email: string;
  deBaja: boolean;
}) {
  const acceso = email || "este usuario sin identidad";

  if (deBaja) {
    return (
      <ConfirmarAccion
        tono="secundario"
        etiqueta="Devolver el acceso"
        titulo="¿Devolverle el acceso?"
        sujeto={`El acceso de ${acceso}`}
        consecuencia="Vuelve a poder entrar, con el mismo rol y el mismo territorio que tenía."
        etiquetaDeConfirmacion="Sí, devolver el acceso"
        accion={() => reactivarUsuarioAction(id)}
      />
    );
  }

  return (
    <ConfirmarAccion
      etiqueta="Quitar el acceso"
      titulo="¿Quitarle el acceso?"
      sujeto={`El acceso de ${acceso}`}
      consecuencia="Deja de poder entrar desde el próximo intento. No se borra nada: todo lo que cargó sigue figurando, y el acceso se puede devolver."
      etiquetaDeConfirmacion="Sí, quitar el acceso"
      accion={() => darDeBajaUsuarioAction(id)}
    />
  );
}
