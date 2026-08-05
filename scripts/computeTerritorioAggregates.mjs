// Computes territorial aggregates for the peer-average feature (W1(peer)).
//
// Writes /aggregatesTerritorio_real/{docId}. Two tiers:
//   - aggregateKind='slep-tipo' : one doc per (programa × slep × tipo × anio × indicadorId)
//   - aggregateKind='programa'  : one doc per (programa × tipo × anio × indicadorId)
//
// Privacy floor (Ley 21.719):
//   - K_MIN=4 reporters on the primary tier. Below → publishable=false.
//   - YoY composition-delta: for each (programa, slep, tipo, indicadorId), if the
//     reporter sets G_2025 and G_2026 differ by exactly one establecimiento, BOTH
//     years' primary aggregates are marked publishable=false (a viewer could
//     diff them and isolate the differing centre).
//   - Programa tier is always publishable (universe ≥ 18, composition changes are
//     slow and publicly known).
//
// Firestore rules for /aggregatesTerritorio_real expose only publishable=true docs
// to limited profiles. Admin roles (consultor/cap/superadmin) can read all.
//
// Derivation collection — the ONLY collection this pipeline may delete from.
// Ordering: write-new-then-delete-orphans, never the other way around, so at
// every moment during the run the collection is a superset of correct data.
//
// Usage:
//   node scripts/computeTerritorioAggregates.mjs [--dry-run]
//
// Idempotent. Emits reports/computeTerritorioAggregates-YYYY-MM-DD.json.

import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const K_MIN = 4;
const YEARS = [2025, 2026];

// Doc ID components can contain colons/dots/spaces — sanitize to Firestore-safe.
function sanitizeDocId(s) {
  return String(s).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function normalizarIndicadorId(id) {
  if (typeof id !== 'string') return id;
  const m = id.match(/^I\.?(\d+)$/);
  return m ? `I.${m[1]}` : id;
}

// Mirror of src/data/establecimientos.js → calcularLogro. Kept in sync manually;
// if that helper changes, update this too.
function calcularLogro(valor, indicador) {
  const tipoMeta = indicador.tipoMeta;
  if (tipoMeta === 'sin_meta' || indicador.metaNum === null || indicador.metaNum === undefined) return null;
  if (valor === null || valor === undefined) return null;
  if (tipoMeta === 'booleano') return valor;
  if (indicador.metaNum === 0) return 0;
  return Math.min(1.2, valor / indicador.metaNum);
}

// ─── Init Firebase Admin ─────────────────────────────────────────────────────
const sa = JSON.parse(readFileSync(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

if (DRY_RUN) console.log('DRY RUN — no writes will be made.\n');

// ─── Load catalog + establecimientos ─────────────────────────────────────────
const catalog = JSON.parse(readFileSync(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const indicadoresByProg = {
  parvulario: catalog.indicadores.parvulario,
  escolar: catalog.indicadores.escolar2026,
};

console.log('Loading establecimientos_real…');
const estSnap = await db.collection('establecimientos_real').get();
const ests = estSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`  ${ests.length} docs`);

// Index establecimiento by id for O(1) lookups
const estById = new Map(ests.map(e => [e.id, e]));

// ─── Load resultados_real (aggregate-per-est only, exclude per-sala) ──────────
console.log('Loading resultados_real…');
const resSnap = await db.collection('resultados_real').get();
let allRes = resSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(d => !d.nivel)
  .map(d => ({ ...d, indicadorId: normalizarIndicadorId(d.indicadorId) }));
console.log(`  ${resSnap.size} total, ${allRes.length} aggregate-per-est\n`);

// ─── Group values by (programa, tipo, slep, anio, indicadorId) ───────────────
// values: { key -> { indicador, ests: { [estId]: valor } } }
// A value is included only if it's a real number (null / undefined excluded).
function key(programa, slep, tipo, anio, indId) {
  return `${programa}|${slep ?? ''}|${tipo}|${anio}|${indId}`;
}

const primaryBuckets = new Map();    // key(programa, slep, tipo, anio, indId) -> Map<estId, valor>
const programaBuckets = new Map();   // key(programa, '', tipo, anio, indId)   -> Map<estId, valor>

for (const r of allRes) {
  const est = estById.get(r.establecimientoId);
  if (!est) continue;
  if (!YEARS.includes(r.anio)) continue;
  if (r.valor === null || r.valor === undefined) continue;

  const programa = est.programa;
  const tipo = est.tipo;
  const slep = est.slep;
  if (!programa || !tipo || !slep) continue;

  const inds = indicadoresByProg[programa];
  if (!inds) continue;
  const ind = inds.find(i => i.id === r.indicadorId);
  if (!ind) continue;
  // Skip indicators without meta — no peer average is meaningful there.
  if (ind.tipoMeta === 'sin_meta' || ind.metaNum === null || ind.metaNum === undefined) continue;

  const pk = key(programa, slep, tipo, r.anio, r.indicadorId);
  if (!primaryBuckets.has(pk)) primaryBuckets.set(pk, new Map());
  primaryBuckets.get(pk).set(est.id, r.valor);

  const gk = key(programa, null, tipo, r.anio, r.indicadorId);
  if (!programaBuckets.has(gk)) programaBuckets.set(gk, new Map());
  programaBuckets.get(gk).set(est.id, r.valor);
}

// ─── YoY composition gate ────────────────────────────────────────────────────
// For each (programa, slep, tipo, indId), compare reporter sets across YEARS.
// If |G_2025 △ G_2026| === 1, mark BOTH years' primary aggregates unpublishable.
function symmetricDiffSize(setA, setB) {
  let n = 0;
  for (const x of setA) if (!setB.has(x)) n++;
  for (const x of setB) if (!setA.has(x)) n++;
  return n;
}

// Build (programa|slep|tipo|indId) -> { [anio]: Set<estId> }
const yoyGroups = new Map();
for (const [k, ests] of primaryBuckets) {
  const [programa, slep, tipo, anio, indId] = k.split('|');
  const gk = `${programa}|${slep}|${tipo}|${indId}`;
  if (!yoyGroups.has(gk)) yoyGroups.set(gk, {});
  yoyGroups.get(gk)[anio] = new Set(ests.keys());
}

// (programa|slep|tipo|anio|indId) -> boolean : true means "leak this year"
const yoyLeakByPrimaryKey = new Set();
for (const [gk, byYear] of yoyGroups) {
  const years = Object.keys(byYear);
  if (years.length !== 2) continue; // need both years
  const [ya, yb] = years;
  const delta = symmetricDiffSize(byYear[ya], byYear[yb]);
  if (delta === 1) {
    // Mark both years as leaky.
    const [programa, slep, tipo, indId] = gk.split('|');
    yoyLeakByPrimaryKey.add(key(programa, slep, tipo, Number(ya), indId));
    yoyLeakByPrimaryKey.add(key(programa, slep, tipo, Number(yb), indId));
  }
}

// ─── Build aggregate docs ────────────────────────────────────────────────────
const now = new Date().toISOString();
const aggregates = []; // { id, data }

function buildAgg({ kind, programa, slep, tipo, anio, indId, values }) {
  const inds = indicadoresByProg[programa];
  const ind = inds.find(i => i.id === indId);
  const nReporters = values.size;
  let sumaValor = 0;
  let sumaLogroCapped = 0;
  for (const v of values.values()) {
    sumaValor += v;
    const l = calcularLogro(v, ind);
    sumaLogroCapped += l === null ? 0 : Math.min(1, l);
  }

  let publishable = true;
  let publishableReason = 'ok';
  if (kind === 'slep-tipo') {
    if (nReporters < K_MIN) {
      publishable = false;
      publishableReason = 'below_k_min';
    } else if (yoyLeakByPrimaryKey.has(key(programa, slep, tipo, anio, indId))) {
      publishable = false;
      publishableReason = 'yoy_composition_leak';
    }
  }
  // 'programa' tier: always publishable (universe ≥ 18 by construction).

  const idParts = kind === 'slep-tipo'
    ? ['agg', programa, slep, tipo, anio, indId]
    : ['agg', programa, tipo, anio, indId];
  const docId = idParts.map(sanitizeDocId).join('_');

  const data = {
    aggregateKind: kind,
    programa,
    tipo,
    anio,
    indicadorId: indId,
    n: nReporters,
    nReporters,
    sumaValor,
    sumaLogroCapped,
    publishable,
    publishableReason,
    unidad: ind.unidad ?? null,
    metaNum: ind.metaNum ?? null,
    computedAt: now,
  };
  if (kind === 'slep-tipo') data.slep = slep;

  return { id: docId, data };
}

for (const [k, values] of primaryBuckets) {
  const [programa, slep, tipo, anioStr, indId] = k.split('|');
  aggregates.push(buildAgg({
    kind: 'slep-tipo', programa, slep, tipo, anio: Number(anioStr), indId, values,
  }));
}

for (const [k, values] of programaBuckets) {
  const [programa, , tipo, anioStr, indId] = k.split('|');
  aggregates.push(buildAgg({
    kind: 'programa', programa, slep: null, tipo, anio: Number(anioStr), indId, values,
  }));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const summary = {
  total: aggregates.length,
  primary: aggregates.filter(a => a.data.aggregateKind === 'slep-tipo').length,
  fallback: aggregates.filter(a => a.data.aggregateKind === 'programa').length,
  publishable: aggregates.filter(a => a.data.publishable).length,
  unpublishable_below_k_min: aggregates.filter(a => a.data.publishableReason === 'below_k_min').length,
  unpublishable_yoy_leak: aggregates.filter(a => a.data.publishableReason === 'yoy_composition_leak').length,
  by_programa: {},
  by_slep_tipo_anio: {},
};

for (const p of ['parvulario', 'escolar']) {
  const bucket = aggregates.filter(a => a.data.programa === p);
  summary.by_programa[p] = {
    total: bucket.length,
    publishable: bucket.filter(a => a.data.publishable).length,
    below_k_min: bucket.filter(a => a.data.publishableReason === 'below_k_min').length,
    yoy_leak: bucket.filter(a => a.data.publishableReason === 'yoy_composition_leak').length,
  };
}

for (const a of aggregates) {
  if (a.data.aggregateKind !== 'slep-tipo') continue;
  const k = `${a.data.programa}|${a.data.slep}|${a.data.tipo}|${a.data.anio}`;
  if (!summary.by_slep_tipo_anio[k]) {
    summary.by_slep_tipo_anio[k] = { total: 0, publishable: 0, below_k_min: 0, yoy_leak: 0 };
  }
  summary.by_slep_tipo_anio[k].total++;
  if (a.data.publishable) summary.by_slep_tipo_anio[k].publishable++;
  if (a.data.publishableReason === 'below_k_min') summary.by_slep_tipo_anio[k].below_k_min++;
  if (a.data.publishableReason === 'yoy_composition_leak') summary.by_slep_tipo_anio[k].yoy_leak++;
}

console.log('Aggregate summary:');
console.log(`  Total docs to write : ${summary.total}`);
console.log(`  Primary (slep-tipo) : ${summary.primary}`);
console.log(`  Fallback (programa) : ${summary.fallback}`);
console.log(`  Publishable         : ${summary.publishable} / ${summary.total}`);
console.log(`  Below K_MIN=${K_MIN}       : ${summary.unpublishable_below_k_min}`);
console.log(`  YoY composition leak: ${summary.unpublishable_yoy_leak}`);
console.log('');
console.log('  By programa:');
for (const [p, s] of Object.entries(summary.by_programa)) {
  console.log(`    ${p.padEnd(11)}: ${s.total} docs, ${s.publishable} publishable (${s.below_k_min} below K_MIN, ${s.yoy_leak} YoY-leak)`);
}
console.log('');
console.log('  Primary by (programa, slep, tipo, anio):');
for (const [k, s] of Object.entries(summary.by_slep_tipo_anio).sort()) {
  console.log(`    ${k.padEnd(45)} → ${s.total} inds, ${s.publishable} publishable, ${s.below_k_min} below_K, ${s.yoy_leak} YoY`);
}

// Sample docs for review
console.log('\nSample primary aggregate:');
const samplePrimary = aggregates.find(a => a.data.aggregateKind === 'slep-tipo' && a.data.publishable);
if (samplePrimary) console.log(JSON.stringify({ id: samplePrimary.id, ...samplePrimary.data }, null, 2));

console.log('\nSample fallback aggregate:');
const sampleFb = aggregates.find(a => a.data.aggregateKind === 'programa');
if (sampleFb) console.log(JSON.stringify({ id: sampleFb.id, ...sampleFb.data }, null, 2));

// ─── Write to Firestore + orphan cleanup ─────────────────────────────────────
async function writeAndPruneOrphans() {
  console.log('\nWriting aggregates to Firestore…');
  const writtenIds = new Set();
  for (let i = 0; i < aggregates.length; i += 500) {
    const batch = db.batch();
    for (const a of aggregates.slice(i, i + 500)) {
      const ref = db.collection('aggregatesTerritorio_real').doc(a.id);
      batch.set(ref, a.data);
      writtenIds.add(a.id);
    }
    await batch.commit();
    console.log(`  wrote ${Math.min(i + 500, aggregates.length)}/${aggregates.length}`);
  }

  console.log('Pruning orphan aggregates…');
  const existing = await db.collection('aggregatesTerritorio_real').get();
  const orphans = existing.docs.filter(d => !writtenIds.has(d.id));
  console.log(`  ${existing.size} existing, ${orphans.length} orphans to delete`);

  for (let i = 0; i < orphans.length; i += 500) {
    const batch = db.batch();
    for (const o of orphans.slice(i, i + 500)) batch.delete(o.ref);
    await batch.commit();
    console.log(`  deleted ${Math.min(i + 500, orphans.length)}/${orphans.length}`);
  }

  return { written: writtenIds.size, orphansDeleted: orphans.length };
}

let runResult = { written: 0, orphansDeleted: 0 };
if (!DRY_RUN) {
  runResult = await writeAndPruneOrphans();
}

// ─── Report ──────────────────────────────────────────────────────────────────
const stamp = new Date().toISOString().slice(0, 10);
const reportsDir = pathResolve(ROOT, 'reports');
await mkdir(reportsDir, { recursive: true });
const reportPath = pathResolve(reportsDir, `computeTerritorioAggregates-${stamp}.json`);
await writeFile(reportPath, JSON.stringify({
  dryRun: DRY_RUN,
  computedAt: now,
  kMin: K_MIN,
  summary,
  written: runResult.written,
  orphansDeleted: runResult.orphansDeleted,
  yoyLeakKeys: [...yoyLeakByPrimaryKey].sort(),
}, null, 2));
console.log(`\nReport → ${reportPath}`);
console.log(DRY_RUN ? '\nDONE (dry run — nothing written).' : '\nDONE.');
