#!/usr/bin/env node
// Monthly closure snapshot for the CAP profile (L-04, D-14).
//
// Copies resultados_real as it stands into
//   cierres_real/{YYYY-MM}                 → { periodo, anio, mes, docs, creadoAt }
//   cierres_real/{YYYY-MM}/resultados/{id} → copy of each resultados_real doc
//
// The nightly pipeline runs it at 02:00 on day 1 of each month with the
// previous month as periodo, right after the load, so the snapshot holds
// everything entered up to the last day of the month. CAP sees it from day 16
// (capClosedPeriod). Idempotent: re-running overwrites the same periodo.
//
//   node scripts/snapshotCierre.mjs --periodo=2026-09 [--dry-run]
//   node scripts/snapshotCierre.mjs --auto   (previous month, Chile time)

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { credenciales, salida } from './lib/runtime.mjs';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const arg = (n) => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1] || null;

// Previous calendar month in Chile time.
function mesAnteriorChile(now = new Date()) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' })
    .format(now).split('-').map(Number);
  const mes = m === 1 ? 12 : m - 1;
  const anio = m === 1 ? y - 1 : y;
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

const periodo = arg('periodo') || (args.includes('--auto') ? mesAnteriorChile() : null);
if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
  console.error('Uso: --periodo=YYYY-MM | --auto [--dry-run]');
  process.exit(1);
}
const [anio, mes] = periodo.split('-').map(Number);

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

const snap = await db.collection('resultados_real').get();
console.log(`Cierre ${periodo}: ${snap.size} docs de resultados_real${DRY_RUN ? ' (dry-run)' : ''}`);

if (!DRY_RUN) {
  const base = db.collection('cierres_real').doc(periodo);
  let batch = db.batch(); let count = 0;
  for (const d of snap.docs) {
    batch.set(base.collection('resultados').doc(d.id), d.data());
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  await base.set({ periodo, anio, mes, docs: snap.size, creadoAt: FieldValue.serverTimestamp() });
  console.log(`✅ cierres_real/${periodo} escrito (${snap.size} docs)`);
}

await writeFile(salida(ROOT, `reports/snapshotCierre-${periodo}${DRY_RUN ? '-dryrun' : ''}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: DRY_RUN, periodo, docs: snap.size }, null, 2));
