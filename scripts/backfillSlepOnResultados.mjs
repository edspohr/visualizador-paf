// Backfill: adds `slep` field to resultados_real and progresoTrimestral_real docs
// that are missing it. Looks up slep from establecimientos_real[establecimientoId].
//
// Required for Firestore rule W1(d): sostenedor reads are scoped to slep.
//
// Usage:
//   node scripts/backfillSlepOnResultados.mjs [--dry-run]
//
// --dry-run  prints what would change, writes nothing.
// Idempotent: re-running after a full run is a no-op (skips docs that already have slep).

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(
  await import('node:fs').then(m => m.promises.readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

if (DRY_RUN) console.log('DRY RUN — no writes will be made.\n');

// ─── Load roster ─────────────────────────────────────────────────────────────
console.log('Loading establecimientos_real…');
const estSnap = await db.collection('establecimientos_real').get();
const slepByEstId = new Map();
for (const d of estSnap.docs) {
  const slep = d.data().slep;
  if (slep) slepByEstId.set(d.id, slep);
}
console.log(`  ${estSnap.size} docs, ${slepByEstId.size} with slep field.\n`);

async function backfillCollection(collName) {
  console.log(`Processing ${collName}…`);
  const snap = await db.collection(collName).get();
  const toUpdate = [];
  const missing = [];

  for (const d of snap.docs) {
    const data = d.data();
    if (data.slep) continue; // already backfilled

    const estId = data.establecimientoId;
    const slep = slepByEstId.get(estId);
    if (!slep) {
      missing.push({ id: d.id, establecimientoId: estId });
      continue;
    }
    toUpdate.push({ ref: d.ref, id: d.id, establecimientoId: estId, slep });
  }

  console.log(`  ${snap.size} total, ${toUpdate.length} to backfill, ${missing.length} missing est reference.`);

  if (missing.length > 0) {
    console.warn('  Missing est references (first 10):');
    missing.slice(0, 10).forEach(m => console.warn(`    ${m.id} → estId=${m.establecimientoId}`));
  }

  if (toUpdate.length > 0) {
    console.log(`  Sample (first 5):${toUpdate.slice(0, 5).map(u => `\n    ${u.id} → slep=${u.slep}`).join('')}`);
  }

  if (!DRY_RUN && toUpdate.length > 0) {
    // Batch writes (max 500 ops per batch)
    let written = 0;
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = db.batch();
      for (const item of toUpdate.slice(i, i + 500)) {
        batch.update(item.ref, { slep: item.slep });
      }
      await batch.commit();
      written += Math.min(500, toUpdate.length - i);
      process.stdout.write(`  Written: ${written}/${toUpdate.length}\r`);
    }
    console.log(`\n  Done: ${written} docs updated.`);
  }

  return { total: snap.size, backfilled: toUpdate.length, missing: missing.length, details: toUpdate, missingDetails: missing };
}

const resultadosResult = await backfillCollection('resultados_real');
const progresoResult = await backfillCollection('progresoTrimestral_real');

// ─── Write report ─────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/backfillSlepOnResultados-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  resultados_real: {
    total: resultadosResult.total,
    backfilled: resultadosResult.backfilled,
    missing: resultadosResult.missing,
    missingDetails: resultadosResult.missingDetails,
    sampleUpdates: resultadosResult.details.slice(0, 5).map(({ id, establecimientoId, slep }) => ({ id, establecimientoId, slep })),
  },
  progresoTrimestral_real: {
    total: progresoResult.total,
    backfilled: progresoResult.backfilled,
    missing: progresoResult.missing,
    missingDetails: progresoResult.missingDetails,
    sampleUpdates: progresoResult.details.slice(0, 5).map(({ id, establecimientoId, slep }) => ({ id, establecimientoId, slep })),
  },
}, null, 2), 'utf8');
console.log(`\nReport → ${reportPath}`);
if (DRY_RUN) console.log('\nRe-run without --dry-run to apply changes.');
