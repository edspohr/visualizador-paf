// Repairs establecimientos_real docs with missing or malformed territorial fields.
// Two classes of repairs:
//   1. esc-profesor-ramon-del-rio: slep, comuna, sostenedor all null — confirmed by user.
//   2. Parvulario jardines with ALLCAPS comunas or "PAC" shorthand — confirmed by user.
//
// Usage:
//   node scripts/repairTerritorial.mjs [--dry-run]
//
// Idempotent. Never creates docs, never deletes. Only merge-writes corrected fields.

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

// ─── Canonical repairs ────────────────────────────────────────────────────────
// Source of truth: escolarPlanillaIndex.json (Ramón del Río) + user confirmation (parvulario).
// Only fields listed here are changed; all other fields are left untouched.

const REPAIRS = [
  // Escolar — Ramón del Río: slep/comuna/sostenedor were null
  {
    id: 'esc-profesor-ramon-del-rio',
    fields: { slep: 'SLEP-SC', comuna: 'Estación Central', sostenedor: 'SLEP Santa Corina' },
    reason: 'slep/comuna/sostenedor were null — confirmed SLEP-SC, Estación Central (W1b)',
  },
  // Parvulario — ALLCAPS comunas → proper mixed case
  { id: 'jar-angel-fantuzzi',      fields: { comuna: 'Cerrillos' },             reason: 'ALLCAPS → mixed case' },
  { id: 'jar-cedin',               fields: { comuna: 'La Pintana' },            reason: 'ALLCAPS → mixed case' },
  { id: 'jar-ciudad-de-barcelona', fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-el-tranque',          fields: { comuna: 'Maipú' },                 reason: 'ALLCAPS → mixed case' },
  { id: 'jar-eluney',              fields: { comuna: 'San Bernardo' },           reason: 'ALLCAPS → mixed case' },
  { id: 'jar-enrique-backausse',   fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-estacion-alegria',    fields: { comuna: 'Estación Central' },       reason: 'ALLCAPS → mixed case' },
  { id: 'jar-la-marina',           fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-ochagavia',           fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-paula-jaraquemada',   fields: { comuna: 'El Bosque' },             reason: 'ALLCAPS → mixed case' },
  { id: 'jar-pequeno-aymara',      fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-poetas-de-chile',     fields: { comuna: 'Pedro Aguirre Cerda' },   reason: '"PAC" shorthand → full name' },
  { id: 'jar-salomon-sack',        fields: { comuna: 'Cerrillos' },             reason: 'ALLCAPS → mixed case' },
  { id: 'jar-sueno-de-colores',    fields: { comuna: 'San Bernardo' },           reason: 'ALLCAPS → mixed case' },
  { id: 'jar-tierra-de-angeles',   fields: { comuna: 'San Bernardo' },           reason: 'ALLCAPS → mixed case' },
];

// ─── Load current state and compute diff ─────────────────────────────────────
const snap = await db.collection('establecimientos_real').get();
const docsById = new Map(snap.docs.map(d => [d.id, { ref: d.ref, data: d.data() }]));

const toWrite = [];
const errors = [];

for (const repair of REPAIRS) {
  const doc = docsById.get(repair.id);
  if (!doc) {
    errors.push(`DOC NOT FOUND: ${repair.id} — will not create`);
    console.error(`  ERROR: doc ${repair.id} not found in Firestore`);
    continue;
  }
  // Only include fields that actually differ
  const diff = {};
  for (const [field, value] of Object.entries(repair.fields)) {
    if (doc.data[field] !== value) diff[field] = { from: doc.data[field] ?? null, to: value };
  }
  if (Object.keys(diff).length === 0) {
    console.log(`  SKIP (already correct): ${repair.id}`);
    continue;
  }
  toWrite.push({ ref: doc.ref, id: repair.id, diff, fields: repair.fields, reason: repair.reason });
  console.log(`  REPAIR: ${repair.id} — ${repair.reason}`);
  for (const [field, { from, to }] of Object.entries(diff)) {
    console.log(`    ${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  }
}

console.log(`\n${toWrite.length} docs to repair, ${errors.length} errors.`);

if (errors.length > 0) {
  console.error('\nErrors (docs not found — repair aborted for these):');
  errors.forEach(e => console.error(' ', e));
}

if (!DRY_RUN && toWrite.length > 0) {
  const batch = db.batch();
  for (const item of toWrite) {
    // Only write the differing fields (merge)
    const update = Object.fromEntries(Object.entries(item.diff).map(([f, { to }]) => [f, to]));
    batch.update(item.ref, update);
  }
  await batch.commit();
  console.log(`\nDone: ${toWrite.length} docs repaired.`);
}

// ─── Write report ─────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/repairTerritorial-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  repaired: toWrite.map(({ id, diff, reason }) => ({ id, diff, reason })),
  errors,
}, null, 2), 'utf8');
console.log(`Report → ${reportPath}`);
if (DRY_RUN) console.log('Re-run without --dry-run to apply.');
