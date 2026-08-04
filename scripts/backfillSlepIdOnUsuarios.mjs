// Backfill: writes `slepId` on usuarios docs for jardin/escuela profiles
// that have an establecimientoId but no slepId. Derives slepId from
// establecimientos_real[establecimientoId].slep.
//
// Usage:
//   node scripts/backfillSlepIdOnUsuarios.mjs [--dry-run]
//
// Idempotent: skips docs that already have a correct slepId.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(
  await import('node:fs').then(m => m.promises.readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

if (DRY_RUN) console.log('DRY RUN — no writes.\n');

// ─── Load roster ─────────────────────────────────────────────────────────────
const estSnap = await db.collection('establecimientos_real').get();
const slepByEstId = new Map(estSnap.docs.map(d => [d.id, d.data().slep]).filter(([, s]) => s));
console.log(`Loaded ${estSnap.size} establecimientos, ${slepByEstId.size} with slep.\n`);

const usrSnap = await db.collection('usuarios').get();
const toUpdate = [];
const warnings = [];

for (const d of usrSnap.docs) {
  const u = d.data();
  const p = u.perfilDefault;

  if (p === 'jardin' || p === 'escuela') {
    const estId = u.establecimientoId;
    if (!estId) { warnings.push(`${u.email}: no establecimientoId, skipping`); continue; }
    const slep = slepByEstId.get(estId);
    if (!slep) { warnings.push(`${u.email}: est ${estId} not found in roster`); continue; }
    if (u.slepId === slep) continue; // already correct
    toUpdate.push({ ref: d.ref, uid: d.id, email: u.email, slepId: slep, was: u.slepId ?? null });
  }

  if (p === 'sostenedor' && !u.slepId && u.establecimientoId) {
    // Legacy misstored sostenedor: establecimientoId holds the slepId value.
    const candidateSlep = u.establecimientoId;
    const isRealEst = slepByEstId.has(candidateSlep);
    if (isRealEst) {
      warnings.push(`${u.email}: sostenedor — establecimientoId=${candidateSlep} looks like a real est, NOT auto-migrating — STOP-AND-ASK`);
      console.warn(`  ⚠ STOP-AND-ASK: ${u.email} sostenedor has a real establecimientoId. Manual review needed.`);
    } else {
      toUpdate.push({ ref: d.ref, uid: d.id, email: u.email, slepId: candidateSlep, clearEstId: true, was: null });
    }
  }
}

console.log(`Users to update: ${toUpdate.length}`);
toUpdate.forEach(u => console.log(`  ${u.email}: slepId=${u.slepId}${u.clearEstId ? ' + clear establecimientoId' : ''} (was: ${u.was})`));
if (warnings.length) { console.warn('\nWarnings:'); warnings.forEach(w => console.warn(`  ${w}`)); }

if (!DRY_RUN && toUpdate.length > 0) {
  const batch = db.batch();
  for (const item of toUpdate) {
    const update = { slepId: item.slepId };
    if (item.clearEstId) update.establecimientoId = null;
    batch.update(item.ref, update);
  }
  await batch.commit();
  console.log(`\nDone: ${toUpdate.length} usuarios updated.`);
}

const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/backfillSlepIdOnUsuarios-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(), dryRun: DRY_RUN,
  updated: toUpdate.map(({ uid, email, slepId, clearEstId, was }) => ({ uid, email, slepId, clearEstId, was })),
  warnings,
}, null, 2), 'utf8');
console.log(`Report → ${reportPath}`);
if (DRY_RUN) console.log('Re-run without --dry-run to apply.');
