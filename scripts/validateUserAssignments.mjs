// Pre-deploy gate: validates that all usuarios docs have correct assignment fields.
// Exit 1 if any ERROR (not just warnings).
//
// Usage:
//   node scripts/validateUserAssignments.mjs
//
// Checks:
//   jardin/escuela: establecimientoId set, doc exists, programa matches, slepId set and matches doc.slep
//   sostenedor:     slepId set, at least one est has that slep, establecimientoId is null
//   consultor:      establecimientoIds array present (warn if empty)
//   resultados_real: warns if any doc is missing `slep` field (should be 0 post-backfill)

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

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); console.error(`  ERROR: ${msg}`); }
function warn(msg) { warnings.push(msg); console.warn(`  WARN:  ${msg}`); }

// ─── Load data ────────────────────────────────────────────────────────────────
console.log('Loading establecimientos_real…');
const estSnap = await db.collection('establecimientos_real').get();
const estById = new Map(estSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
const slepIds = new Set([...estById.values()].map(e => e.slep).filter(Boolean));
const estsBySlep = new Map();
for (const e of estById.values()) {
  if (!e.slep) continue;
  if (!estsBySlep.has(e.slep)) estsBySlep.set(e.slep, []);
  estsBySlep.get(e.slep).push(e);
}

console.log('Loading usuarios…');
const usrSnap = await db.collection('usuarios').get();
const usuarios = usrSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

console.log(`\n── Validating ${usuarios.length} users ──────────────────────────────`);

for (const u of usuarios) {
  const tag = u.email ?? u.uid;
  const p = u.perfilDefault;

  if (p === 'escuela' || p === 'jardin') {
    if (!u.establecimientoId) {
      err(`[${tag}] ${p}: missing establecimientoId`);
      continue;
    }
    const est = estById.get(u.establecimientoId);
    if (!est) {
      err(`[${tag}] ${p}: establecimientoId=${u.establecimientoId} not found in establecimientos_real`);
      continue;
    }
    const expectedPrograma = p === 'jardin' ? 'parvulario' : 'escolar';
    if (est.programa !== expectedPrograma) {
      err(`[${tag}] ${p}: est.programa=${est.programa} but expected ${expectedPrograma}`);
    }
    if (!u.slepId) {
      warn(`[${tag}] ${p}: missing slepId (run scripts/backfillSlepIdOnUsuarios.mjs)`);
    } else if (u.slepId !== est.slep) {
      err(`[${tag}] ${p}: slepId=${u.slepId} but est.slep=${est.slep}`);
    }

  } else if (p === 'sostenedor') {
    const slepId = u.slepId;
    if (!slepId) {
      if (u.establecimientoId) {
        err(`[${tag}] sostenedor: slepId missing, but establecimientoId=${u.establecimientoId} present (misstored — run repair)`);
      } else {
        err(`[${tag}] sostenedor: missing slepId`);
      }
      continue;
    }
    const ests = estsBySlep.get(slepId) ?? [];
    if (ests.length === 0) {
      err(`[${tag}] sostenedor: slepId=${slepId} matches no establecimientos`);
    }
    if (u.establecimientoId) {
      warn(`[${tag}] sostenedor: establecimientoId=${u.establecimientoId} should be null for sostenedor`);
    }

  } else if (p === 'consultor') {
    if (!Array.isArray(u.establecimientoIds)) {
      warn(`[${tag}] consultor: no establecimientoIds array`);
    } else if (u.establecimientoIds.length === 0) {
      warn(`[${tag}] consultor: establecimientoIds is empty`);
    }

  } else if (p === 'cap' || p === 'superadmin' || p === 'pendiente') {
    // no assignment requirements
  } else {
    warn(`[${tag}] unknown perfilDefault: ${p}`);
  }
}

// ─── Check resultados_real for missing slep ───────────────────────────────────
console.log('\nChecking resultados_real for missing `slep` field (sample of 500)…');
const resSnap = await db.collection('resultados_real').limit(500).get();
const missingSlep = resSnap.docs.filter(d => !d.data().slep).length;
if (missingSlep > 0) {
  warn(`${missingSlep}/${resSnap.size} sampled resultados_real docs missing 'slep' field — run backfillSlepOnResultados.mjs`);
} else {
  console.log(`  OK: all ${resSnap.size} sampled resultados_real docs have 'slep'.`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n── RESULT ───────────────────────────────────────────────────────');
if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ All checks passed.');
} else {
  if (errors.length > 0) console.error(`✗ ${errors.length} error(s).`);
  if (warnings.length > 0) console.warn(`⚠ ${warnings.length} warning(s).`);
}

// ─── Write report ─────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/validateUserAssignments-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  errors,
  warnings,
  userCount: usuarios.length,
  estCount: estById.size,
}, null, 2), 'utf8');
console.log(`Report → ${reportPath}`);

if (errors.length > 0) process.exit(1);
