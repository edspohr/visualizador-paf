// Runtime helpers so the ingest scripts run the same way locally and inside
// the nightly Cloud Function (L-04):
//
// - Credentials: locally, scripts/service-account.json; in Cloud Functions
//   there is no key file and the function runs as the project's service
//   account, so Application Default Credentials are used. No key is copied.
//   With FIRESTORE_EMULATOR_HOST set, the key is ignored and the script
//   talks to the local emulator.
// - Output: reports go to <repo>/reports and <repo>/docs locally. Cloud
//   Functions only allows writing under /tmp, so PAF_OUTPUT_DIR redirects them.

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { cert, applicationDefault } from 'firebase-admin/app';

/**
 * @param root repository root (the folder that contains scripts/)
 * @returns {{ firebaseCredential, googleAuthOptions, clientEmail }}
 */
export function credenciales(root) {
  // Local emulators (npm run emuladores): never load the production key. Run
  // with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=demo-paf.
  // Firestore goes to the emulator; the planillas are still read (read-only)
  // with the key when there is one, so a full load can be rehearsed locally.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const key = pathResolve(root, 'scripts/service-account.json');
    const sa = existsSync(key) ? JSON.parse(readFileSync(key, 'utf8')) : null;
    return { firebaseCredential: applicationDefault(), googleAuthOptions: sa ? { credentials: sa } : {}, clientEmail: '(emulador)' };
  }
  const keyPath = pathResolve(root, 'scripts/service-account.json');
  if (existsSync(keyPath)) {
    const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
    return { firebaseCredential: cert(sa), googleAuthOptions: { credentials: sa }, clientEmail: sa.client_email };
  }
  return { firebaseCredential: applicationDefault(), googleAuthOptions: {}, clientEmail: '(credenciales del entorno)' };
}

/** Absolute path for an output file given relative to the repo root (e.g. 'reports/x.json'). */
export function salida(root, rel) {
  const base = process.env.PAF_OUTPUT_DIR || root;
  const p = pathResolve(base, rel);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}
