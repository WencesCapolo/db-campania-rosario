# A Usuario exists only because somebody with authority invited them

The baseline created an application-level `users` row for any identity Neon Auth would issue a session for, defaulting it to `referente_local` with the comment "safe default; admin can promote later". It was not a safe default: it made authentication sufficient for authorization, which is the opposite of what the four-rank hierarchy is for. ADR 0002 named the defect; this records how it is closed.

An authenticated identity with no application row is **unauthorized**. It is never defaulted into a rol. There is exactly one way a Usuario comes into existence: a Usuario of higher rank issues an invitation, and the invited person's first sign-in accepts it.

An invitation is a record in its own right — `invitacion` — with an email, a rol, a territory, a state (`pendiente` / `aceptada` / `revocada`), and the Usuario who issued it. Two rules bound who may issue one, and both must pass:

- **Rank.** The invited rol must be strictly below the inviter's. One exception, settled with the user on 2026-07-25: `admin` is a real person rather than a technical account, and an admin may invite another admin. A Referente Local — the bottom — invites nobody.
- **Territory.** The invited Usuario is placed inside the inviter's own scope, so the hierarchy is territorial as well as ranked. A Responsable Diocesano cannot seed a Referente into the next Diócesis, even though that Diócesis appears in their territory picker.

The rol and the territory are paired, not independent: a nacional rol carries no territory, and a territorial rol must have one. Both halves are refused at write time.

Acceptance is matched on email, because the Neon Auth id does not exist when the invitation is written. The old flow used `crypto.randomUUID()` for the row's id, which no session could ever match, so the "invitation" produced an orphan and the first real sign-in silently self-provisioned instead.

## Consequences

Accepting an invitation is the one operation with no Actor, by definition — the person accepting does not have one yet. It takes a Neon Auth identity instead and is bounded by the invitation rather than by a rol. The privilege lives in the invitation record, issued earlier by somebody who did have an Actor. It runs inside `getCurrentUser()`, after the ordinary Usuario lookup fails and before the refusal.

Accepting twice yields one Usuario, and neither half of that guarantee depends on the service reasoning correctly: the row is created by an upsert keyed on the identity's own id, and the invitation transition only fires on a row still `pendiente`. A partial unique index enforces at most one pending invitation per email in the database rather than by a read-then-write.

Refusals are specific, because they send people to three different places: a stranger needs an invitation, a Usuario given de baja needs an Asesor Nacional, and a territorial rol with no territory needs one assigned. `/sin-autorizacion` renders the reason, in Spanish, as a code rather than a message so the copy can be reworded without breaking the contract.

Migrating existing Usuarios onto invitations is deliberately out of scope — current rows keep their access. What does change for them: a `responsable_diocesano` or `referente_local` with no territory now fails closed. Migration `0002` reports how many such rows exist and how many look like products of the old self-provisioning default, rather than guessing a territory or deleting rows that `created_by_id` still points at.

There is no expiry. Nothing in the Campaña's process has a deadline, and inventing one would lock people out quietly. A mistake is handled by revoking, which is explicit and visible.

## Considered options

Provisioning through a Neon Auth webhook was rejected: it would put the rol decision at the moment the identity is created, which is not when anybody knows what territory the person belongs to, and it would make the hierarchy depend on delivery of an HTTP call.

Pre-creating the `users` row at invitation time — the baseline's intent — was rejected because the row's id cannot be known yet. Either it is a placeholder no session matches, which is the bug being fixed, or the email becomes a second identity key on a table that already has one.
