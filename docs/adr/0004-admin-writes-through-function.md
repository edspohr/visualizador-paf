# 0004 — Privileged writes go through a Cloud Function; users cannot write their own profile

Status: Accepted · 2026-09-30

## Context

`firestore.rules` allowed any signed-in user to create and update their own
`usuarios/{uid}` document without restricting fields. `perfilDefault`,
`establecimientoId` and `slepId` in that document are what every other rule reads
to decide access, so any user could make themselves superadmin from the browser
console.

Two related problems: creating a user from the panel used the client Auth API,
which replaced the administrator's session with the new user's and dropped the
`slepId` of a sostenedor; and `establecimientos_real` was read-only for clients,
so the admin screen (ADR-0002) had no way to write.

## Decision

- **Rules.** A user may create their own doc only as `pendiente` with no
  assignment, and may update it only if `perfilDefault`, `establecimientoId`,
  `slepId`, `establecimientoIds` and `email` are untouched. The superadmin
  whitelist applies only when the provider verified the email. Superadmins keep
  full write access to `usuarios` (the "ver como" switch depends on it).
- **Callable `adminPlataforma`** (`functions/src/admin.mjs`, Admin SDK), only for
  superadmins: create / update / delete user (Auth account included), create /
  rename / delete sostenedor, create / edit / join / delete establishment. It
  derives the SLEP of a jardin/escuela user on the server and propagates a change
  of sostenedor to values and users.
- `establecimientos_real` and `sostenedores_real` stay closed to client writes.

## Consequences

- The privilege escalation is closed; covered by `npm run test:reglas`.
- Creating a user no longer signs the administrator out, and deleting one
  removes the Auth account instead of leaving it orphaned.
- One more deployed function. Admin actions now need the function to be up.
- The whitelist exists in two places, `src/lib/firebase.js` and
  `firestore.rules` (TD-09).
- The action logic (`adminAcciones.mjs`) imports the registry helpers from the
  pipeline bundle, so `functions/pipeline/` must be built before serving or
  deploying functions (the predeploy hook and `npm run emuladores` do it).

## Alternatives considered

- **Custom claims** for the profile. Cleaner, but changes every rule and the
  login flow; not justified for closing this hole now.
- **Let superadmins write establishments straight from the client.** The
  cascade to values and users would run in the browser, in several non-atomic
  steps, against rules that would have to allow writes to `resultados_real`.
