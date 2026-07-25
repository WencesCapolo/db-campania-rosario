# Domain roles live in our own users table, not in neon_auth

Neon Auth (Managed Better Auth) stores identity in a `neon_auth` schema that Neon owns and migrates. Its user `role` column belongs to the Better Auth admin plugin and carries `admin`/`user`, which cannot express the Campaña's four-rank hierarchy or its territorial scope. We therefore keep our own application-level `users` table, keyed by the Neon Auth user id, holding the Rol and the territory that bounds it.

The baseline codebase already does this — `users.id` mirrors the id in the Neon Auth synced table, and stores Rol plus audit fields. This ADR records why, so it is not "simplified" later into relying on the provider's own role column.

## Consequences

Resolving an Actor costs two lookups — session from Neon Auth, then the application row — which should be resolved once per request rather than per call site. Provisioning becomes two steps that must not diverge: create the identity, then create the application record.

An authenticated identity with no application record must be treated as unauthorized. It must **not** be defaulted into a Rol. The baseline currently does default such users to `referente_local` on first login, which makes authentication sufficient for authorization; correcting that is specified in the authorization PRD (issue #2).

We deliberately do not declare a foreign key from our `users.id` into the `neon_auth` schema. That table is managed by Neon and may be migrated beneath us; integrity is enforced in the service layer instead. Deleting a user in the Neon console therefore leaves an orphaned application record, which the user-management screen must surface.
