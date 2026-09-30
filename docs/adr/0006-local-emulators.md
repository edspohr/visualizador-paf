# 0006 — Rules, functions and profile checks are verified on local emulators

Status: Accepted · 2026-09-30

## Context

The platform has no staging project. Rules and functions could only be tried in
production, and checking a UI change "in the six profiles" required six real
accounts (login is Google-only).

## Decision

- `npm run emuladores` starts the Auth, Firestore and Functions emulators under
  the project id `demo-paf` (a `demo-` project can never reach production).
- `npm run emuladores:seed -- --exportar` takes a read-only copy of production
  into `.cache/` (gitignored); `npm run emuladores:seed` loads it and creates one
  test user per profile.
- `npm run dev:emuladores` runs the app against the emulators
  (`.env.emuladores`); the login page then offers the test users.
- `npm run test:reglas` signs in as each profile with the web SDK and checks the
  rules and every `adminPlataforma` action.
- Any script runs against the emulator with
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=demo-paf`
  (`scripts/lib/runtime.mjs` then ignores the production key for Firestore and
  still reads the planillas read-only), so a full pipeline run can be rehearsed.

## Consequences

- Requires a Java runtime locally (`brew install openjdk`).
- The emulator-only sign-in is compiled out of the production bundle
  (`VITE_USE_EMULATORS` is unset there).
- The checks are run by hand; there is no CI yet (TD-14).
