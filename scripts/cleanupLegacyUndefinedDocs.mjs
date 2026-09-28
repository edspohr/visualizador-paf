#!/usr/bin/env node
// One-shot: mark legacy resultados_real docs without indicadorId as
// 'sin_dato_reportado' (retro 1 validation, 2026-09-28).
//
// An early Escolar ingest (July 2026) wrote 18 docs with ids like
// esc_esc-<escuela>_undefined_undefined: no indicadorId, programa, anio or
// periodo. The UI never reads them (queries filter by anio/programa) and
// --prune cannot see them (it queries by programa), so they would stay with a
// value forever. Same semantics as pruneStale: no delete, valor → null, the
// previous value kept in valorAnterior.
//
//   node scripts/cleanupLegacyUndefinedDocs.mjs --dry-run
//   node scripts/cleanupLegacyUndefinedDocs.mjs
// Idempotent. Report: reports/cleanupLegacyUndefinedDocs-YYYY-MM-DD.json

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { credenciales, salida } from './lib/runtime.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

const snap = await db.collection('resultados_real').get();
const legacy = snap.docs.filter(d => !d.data().indicadorId && !(d.data().valor === null && d.data().estado === 'sin_dato_reportado'));
console.log(`${legacy.length} docs sin indicadorId con valor${DRY_RUN ? ' (dry-run)' : ''}`);
for (const d of legacy) console.log(`  ${d.id} · valor=${d.data().valor} · indId legado=${d.data().indId ?? '—'}`);

if (!DRY_RUN && legacy.length) {
  const batch = db.batch();
  for (const d of legacy) {
    batch.set(d.ref, {
      programa: d.id.startsWith('esc_') ? 'escolar' : d.id.startsWith('parv_') ? 'parvulario' : null,
      valor: null,
      estado: 'sin_dato_reportado',
      valorAnterior: d.data().valor ?? null,
      rawAnterior: d.data().raw ?? null,
      prunedReason: 'doc legado sin indicador (ingesta de julio 2026)',
      prunedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  console.log(`✅ ${legacy.length} docs marcados como sin dato`);
}

const hoy = new Date().toISOString().slice(0, 10);
await writeFile(salida(ROOT, `reports/cleanupLegacyUndefinedDocs-${hoy}${DRY_RUN ? '-dryrun' : ''}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: DRY_RUN, docs: legacy.map(d => ({ id: d.id, valorAnterior: d.data().valor ?? null })) }, null, 2));
