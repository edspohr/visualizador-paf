// Read-only diagnostic: resolves every usuarios doc to its Firestore assignment
// and checks whether the referenced establecimientos_real doc exists.
//
// Usage:
//   node scripts/diagnoseAuthResolution.mjs [--email=<address>]
//
// Output:
//   console: summary table
//   reports/diagnoseAuthResolution-YYYY-MM-DD.json
//
// Never writes to Firestore.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const filterEmail = argValue('email', null);

const sa = JSON.parse(
  await import('node:fs').then(m => m.promises.readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'))
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ─── Load all establecimientos_real ─────────────────────────────────────────
console.log('Loading establecimientos_real…');
const estSnap = await db.collection('establecimientos_real').get();
const estById = new Map();
for (const d of estSnap.docs) {
  estById.set(d.id, { id: d.id, ...d.data() });
}
console.log(`  ${estById.size} docs loaded.`);

// ─── Load all usuarios ───────────────────────────────────────────────────────
console.log('Loading usuarios…');
const usrSnap = await db.collection('usuarios').get();
const usuarios = usrSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
console.log(`  ${usuarios.length} docs loaded.`);

// ─── Analyse each user ───────────────────────────────────────────────────────
const results = [];

for (const u of usuarios) {
  if (filterEmail && u.email !== filterEmail) continue;

  const perfil = u.perfilDefault ?? 'MISSING';
  const base = {
    uid: u.uid,
    email: u.email ?? null,
    nombre: u.nombre ?? null,
    perfilDefault: perfil,
    establecimientoId: u.establecimientoId ?? null,
    slepId: u.slepId ?? null,
    establecimientoIds_length: Array.isArray(u.establecimientoIds) ? u.establecimientoIds.length : null,
    proveedor: u.proveedor ?? null,
  };

  if (perfil === 'escuela' || perfil === 'jardin') {
    const estId = u.establecimientoId;
    if (!estId) {
      results.push({ ...base, assignment: 'MISSING_ESTABLECIMIENTO_ID', estPrograma: null, estSlep: null });
      continue;
    }
    const est = estById.get(estId);
    if (!est) {
      results.push({ ...base, assignment: 'MISSING_DOC', estPrograma: null, estSlep: null });
      console.warn(`  MISSING DOC: usuario ${u.email} → establecimientoId=${estId} not found in Firestore`);
      continue;
    }
    // Check programa matches profile
    const expectedPrograma = perfil === 'jardin' ? 'parvulario' : 'escolar';
    const programaMatch = est.programa === expectedPrograma;
    const slepOnEst = est.slep ?? null;
    const slepMatch = u.slepId ? u.slepId === slepOnEst : null;
    results.push({
      ...base,
      assignment: 'MATCH',
      estNombre: est.nombre,
      estPrograma: est.programa,
      estSlep: slepOnEst,
      programaMatch,
      slepOnUsuario: u.slepId ?? null,
      slepMatch,
    });
    if (!programaMatch) {
      console.warn(`  PROGRAMA MISMATCH: usuario ${u.email} is ${perfil} but est.programa=${est.programa}`);
    }
    if (!u.slepId) {
      console.warn(`  MISSING slepId: usuario ${u.email} (${perfil}) has no slepId — needed for peer-average rule`);
    }
  } else if (perfil === 'sostenedor') {
    const slepId = u.slepId ?? u.establecimientoId; // legacy: might be stored as establecimientoId
    if (!slepId) {
      results.push({ ...base, assignment: 'MISSING_SLEP_ID', estCount: 0 });
      continue;
    }
    const estEnSlep = [...estById.values()].filter(e => e.slep === slepId);
    const hasMisstored = !u.slepId && !!u.establecimientoId;
    results.push({
      ...base,
      resolvedSlepId: slepId,
      assignment: estEnSlep.length > 0 ? 'MATCH' : 'EMPTY_SLEP',
      estCount: estEnSlep.length,
      estNames: estEnSlep.map(e => e.nombre),
      hasMisstored,
    });
    if (hasMisstored) {
      console.warn(`  MISSTORED slepId: usuario ${u.email} has slepId in establecimientoId field (not slepId)`);
    }
    if (estEnSlep.length === 0) {
      console.warn(`  EMPTY SLEP: usuario ${u.email} → slepId=${slepId} matches no establecimientos`);
    }
  } else {
    // consultor, cap, superadmin, pendiente
    results.push({ ...base, assignment: 'N/A' });
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n── SUMMARY ─────────────────────────────────────────────────────');
for (const r of results) {
  const tag = r.assignment === 'MATCH' ? '✓' : '✗';
  console.log(
    `${tag} [${(r.perfilDefault ?? '?').padEnd(11)}] ${(r.email ?? r.uid).padEnd(42)} ` +
    `establId=${String(r.establecimientoId ?? '—').padEnd(28)} slepId=${r.slepId ?? '—'} ` +
    `→ ${r.assignment}${r.estNombre ? ` (${r.estNombre})` : ''}${r.hasMisstored ? ' ⚠ MISSTORED' : ''}`
  );
}

// ─── Write report ─────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/diagnoseAuthResolution-${date}.json`);
await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2), 'utf8');
console.log(`\nReport written → ${reportPath}`);
