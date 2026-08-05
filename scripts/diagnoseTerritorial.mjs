// Read-only diagnostic: inspects establecimientos_real for territorial data quality.
// Detects missing slep/comuna, unexpected counts, and accent/whitespace variants.
//
// Usage:
//   node scripts/diagnoseTerritorial.mjs
//
// Never writes.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const sa = JSON.parse(
  await import('node:fs').then(m => m.promises.readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Normalize for variant detection (accent-strip + lowercase + trim)
// Used only for collision detection, NOT for canonical display.
function normalize(v) {
  if (v == null) return '';
  return String(v).trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const snap = await db.collection('establecimientos_real').get();
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log(`\nTotal docs: ${docs.length}`);

for (const programa of ['escolar', 'parvulario']) {
  const subset = docs.filter(d => d.programa === programa);
  console.log(`\n── ${programa.toUpperCase()} (${subset.length} docs) ─────────────────────────────────`);

  // Per-field dumps
  const slepCounts = new Map();
  const comunaCounts = new Map();
  const missingSlep = [];
  const missingComuna = [];

  for (const d of subset) {
    // Show raw values via JSON.stringify to expose whitespace/quotes
    const slepRaw = d.slep ?? null;
    const comunaRaw = d.comuna ?? null;
    console.log(`  ${d.id}`);
    console.log(`    slep=${JSON.stringify(slepRaw)}  comuna=${JSON.stringify(comunaRaw)}  cohorte=${d.cohorte ?? '—'}  tipo=${d.tipo ?? '—'}`);

    if (!slepRaw) missingSlep.push(d.id);
    else slepCounts.set(slepRaw, (slepCounts.get(slepRaw) ?? 0) + 1);

    if (!comunaRaw) missingComuna.push(d.id);
    else comunaCounts.set(comunaRaw, (comunaCounts.get(comunaRaw) ?? 0) + 1);
  }

  console.log(`\n  SLEPs (${slepCounts.size}):`, [...slepCounts.entries()].map(([k, v]) => `${k}(${v})`).join(', '));
  console.log(`  Comunas (${comunaCounts.size}):`, [...comunaCounts.keys()].sort().join(', '));

  if (missingSlep.length) console.warn(`  ⚠ Missing slep: ${missingSlep.join(', ')}`);
  if (missingComuna.length) console.warn(`  ⚠ Missing comuna: ${missingComuna.join(', ')}`);

  // Accent/whitespace variant detection
  const normToRaw = new Map();
  const variants = [];
  for (const raw of comunaCounts.keys()) {
    const n = normalize(raw);
    if (normToRaw.has(n)) variants.push({ normalized: n, variants: [normToRaw.get(n), raw] });
    else normToRaw.set(n, raw);
  }
  if (variants.length) {
    console.warn(`  ⚠ Comuna variants detected:`);
    variants.forEach(v => console.warn(`    "${v.variants[0]}" vs "${v.variants[1]}"`));
  } else {
    console.log(`  ✓ No comunas variants detected.`);
  }
}

// Check for docs not in either programa
const neither = docs.filter(d => d.programa !== 'escolar' && d.programa !== 'parvulario');
if (neither.length) {
  console.warn(`\n⚠ Docs with unexpected programa (${neither.length}):`);
  neither.forEach(d => console.warn(`  ${d.id}: programa=${JSON.stringify(d.programa)}`));
}

// Write report
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/diagnoseTerritorial-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: docs.length,
  byPrograma: ['escolar', 'parvulario'].map(programa => {
    const subset = docs.filter(d => d.programa === programa);
    const slepCounts = {};
    const comunaCounts = {};
    for (const d of subset) {
      if (d.slep) slepCounts[d.slep] = (slepCounts[d.slep] ?? 0) + 1;
      if (d.comuna) comunaCounts[d.comuna] = (comunaCounts[d.comuna] ?? 0) + 1;
    }
    return { programa, count: subset.length, slepCounts, comunaCounts,
      missingSlep: subset.filter(d => !d.slep).map(d => d.id),
      missingComuna: subset.filter(d => !d.comuna).map(d => d.id),
      docs: subset.map(({ id, slep, comuna, cohorte, tipo, nombre }) => ({ id, nombre, slep, comuna, cohorte, tipo })),
    };
  }),
}, null, 2), 'utf8');
console.log(`\nReport → ${reportPath}`);
