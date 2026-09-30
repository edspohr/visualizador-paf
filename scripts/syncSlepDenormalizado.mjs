#!/usr/bin/env node
// Keeps the denormalized SLEP in step with establecimientos_real (ADR-0001):
//   - resultados_real.slep and progresoTrimestral_real.slep  = est.slep
//   - usuarios.slepId of jardin/escuela profiles              = est.slep
//
// The sostenedor rules and queries filter by that field, so a value without
// it (or with a stale one after an establishment changes sostenedor) is
// invisible to the sostenedor and counts as 0 in its percentage. The ingests
// write `slep` themselves; this step is the safety net and runs every night
// after them. Supersedes the one-shot backfillSlepOnResultados.mjs /
// backfillSlepIdOnUsuarios.mjs.
//
// Usage: node scripts/syncSlepDenormalizado.mjs [--dry-run]
// Idempotent. Never deletes. Report in reports/.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { credenciales, salida } from './lib/runtime.mjs';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

const estSnap = await db.collection('establecimientos_real').get();
const slepDe = new Map(estSnap.docs.map(d => [d.id, d.data().slep ?? null]));

const cambios = [];
const huerfanos = { resultados_real: new Set(), progresoTrimestral_real: new Set() };
const sinSlep = new Set();

for (const col of ['resultados_real', 'progresoTrimestral_real']) {
  const snap = await db.collection(col).select('establecimientoId', 'slep').get();
  for (const d of snap.docs) {
    const { establecimientoId, slep } = d.data();
    if (!establecimientoId) continue;
    if (!slepDe.has(establecimientoId)) { huerfanos[col].add(establecimientoId); continue; }
    const esperado = slepDe.get(establecimientoId);
    if (!esperado) { sinSlep.add(establecimientoId); continue; }
    if (slep !== esperado) cambios.push({ ref: d.ref, col, campo: 'slep', de: slep ?? null, a: esperado });
  }
}

const usrSnap = await db.collection('usuarios').get();
for (const d of usrSnap.docs) {
  const u = d.data();
  if (!['jardin', 'escuela'].includes(u.perfilDefault) || !u.establecimientoId) continue;
  const esperado = slepDe.get(u.establecimientoId);
  if (esperado && u.slepId !== esperado) cambios.push({ ref: d.ref, col: 'usuarios', campo: 'slepId', de: u.slepId ?? null, a: esperado });
}

const porColeccion = cambios.reduce((acc, c) => (acc[c.col] = (acc[c.col] || 0) + 1, acc), {});
console.log(`Sync SLEP denormalizado — ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`  Por corregir: ${cambios.length} ${JSON.stringify(porColeccion)}`);
if (sinSlep.size) console.log(`  Establecimientos sin sostenedor asignado (sus valores quedan sin slep): ${[...sinSlep].join(', ')}`);
for (const [col, ids] of Object.entries(huerfanos)) {
  if (ids.size) console.log(`  ${col}: valores de establecimientos que no existen: ${[...ids].join(', ')}`);
}

if (!DRY_RUN) {
  let batch = db.batch(); let count = 0;
  for (const c of cambios) {
    batch.set(c.ref, { [c.campo]: c.a }, { merge: true });
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  if (cambios.length) console.log(`✅ ${cambios.length} docs corregidos.`);
}

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  corregidos: cambios.length,
  porColeccion,
  establecimientosSinSlep: [...sinSlep],
  huerfanos: Object.fromEntries(Object.entries(huerfanos).map(([k, v]) => [k, [...v]])),
};
const reportPath = salida(ROOT, `reports/syncSlepDenormalizado-${new Date().toISOString().slice(0, 10)}${DRY_RUN ? '-dryrun' : ''}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`Reporte → ${reportPath}`);
process.exit(0);
