#!/usr/bin/env node
// Local test data for the Firebase emulators (npm run emuladores).
//
//   node scripts/dev/seedEmulador.mjs --exportar   read-only copy of production
//                                                  into .cache/emulador-seed.json
//   node scripts/dev/seedEmulador.mjs              load that copy into the
//                                                  emulators + one test user per profile
//
// The two halves run as separate processes on purpose: the import sets the
// emulator hosts and a demo project id, so it cannot write to production.
// .cache/ is gitignored. Test users only exist in the Auth emulator.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ARCHIVO = pathResolve(ROOT, '.cache/emulador-seed.json');
const COLECCIONES = ['establecimientos_real', 'resultados_real', 'progresoTrimestral_real', 'aggregatesTerritorio_real', 'sostenedores_real', 'config'];

// Emulator-only credentials, overridable from the environment.
const CLAVE = process.env.PAF_EMULADOR_CLAVE || 'emulador-paf';
const USUARIOS = [
  { email: 'superadmin@prueba.test', perfilDefault: 'superadmin' },
  { email: 'consultor@prueba.test', perfilDefault: 'consultor' },
  { email: 'cap@prueba.test', perfilDefault: 'cap' },
  { email: 'sostenedor@prueba.test', perfilDefault: 'sostenedor', slep: true },
  { email: 'escuela@prueba.test', perfilDefault: 'escuela', programa: 'escolar' },
  { email: 'jardin@prueba.test', perfilDefault: 'jardin', programa: 'parvulario' },
  { email: 'pendiente@prueba.test', perfilDefault: 'pendiente' },
];

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

if (process.argv.includes('--exportar')) {
  const { credenciales } = await import('../lib/runtime.mjs');
  initializeApp({ credential: credenciales(ROOT).firebaseCredential });
  const db = getFirestore();
  const out = {};
  for (const col of COLECCIONES) {
    const snap = await db.collection(col).get();
    out[col] = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    console.log(`  ${col}: ${snap.size}`);
  }
  await mkdir(dirname(ARCHIVO), { recursive: true });
  // Timestamps become { _ts: millis } so the import can restore them.
  await writeFile(ARCHIVO, JSON.stringify(out, (k, v) => (v && typeof v === 'object' && typeof v._seconds === 'number' ? { _ts: v._seconds * 1000 } : v)));
  console.log(`Copia → ${ARCHIVO}`);
  process.exit(0);
}

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
initializeApp({ projectId: 'demo-paf' });
const db = getFirestore();
const { getAuth } = await import('firebase-admin/auth');

const datos = JSON.parse(await readFile(ARCHIVO, 'utf8'), (k, v) => (v && typeof v === 'object' && typeof v._ts === 'number' ? Timestamp.fromMillis(v._ts) : v));
for (const [col, docs] of Object.entries(datos)) {
  let batch = db.batch(); let n = 0;
  for (const [id, data] of Object.entries(docs)) {
    batch.set(db.collection(col).doc(id), data);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400) await batch.commit();
  console.log(`  ${col}: ${n}`);
}

const ests = Object.entries(datos.establecimientos_real).map(([id, e]) => ({ id, ...e }));
// Same result as scripts/seedSostenedores.mjs, for a copy taken before the catalog existed.
for (const e of ests) {
  if (e.slep && !datos.sostenedores_real?.[e.slep]) await db.doc(`sostenedores_real/${e.slep}`).set({ nombre: e.sostenedor || e.slep, alias: [], origen: 'seed' }, { merge: true });
}
for (const u of USUARIOS) {
  const est = u.programa ? ests.find(e => e.programa === u.programa && e.slep) : null;
  let user;
  try { user = await getAuth().createUser({ email: u.email, password: CLAVE, emailVerified: true }); }
  catch { user = await getAuth().getUserByEmail(u.email); }
  await db.doc(`usuarios/${user.uid}`).set({
    email: u.email, nombre: `Prueba ${u.perfilDefault}`, perfilDefault: u.perfilDefault,
    establecimientoId: est?.id ?? null,
    slepId: est?.slep ?? (u.slep ? ests.find(e => e.programa === 'escolar' && e.slep)?.slep : null) ?? null,
    createdAt: Timestamp.now(), proveedor: 'password',
  });
  console.log(`  usuario ${u.email} (${u.perfilDefault})`);
}
process.exit(0);
