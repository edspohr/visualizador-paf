// Migración canónica de `indicadorId` en `resultados_real`.
//
// Lleva los documentos Firestore a la numeración canónica declarada en
// `scripts/lib/canonicalIds.mjs` (Parvulario 53 · Escolar 2026 51).
//
// Uso:
//   node scripts/migrateCanonicalIndicadorIds.mjs --dry-run
//   node scripts/migrateCanonicalIndicadorIds.mjs --program=parvulario --dry-run
//   node scripts/migrateCanonicalIndicadorIds.mjs --phase=full --delete-orphans
//
// Flags:
//   --dry-run                   No escribe nada. Imprime manifest before/after.
//   --program=<x>               'parvulario' | 'escolar' | 'both' (default both).
//   --phase=<x>                 'write-temp' | 'finalize' | 'full' (default full).
//                               `full` corre write-temp, verifica, y luego
//                               finalize (escribe canónico + borra viejos y
//                               temporales).
//   --delete-orphans            Requerido para borrar los docs de indicadores
//                               eliminados en canónico. Sin este flag, el
//                               script cuenta y reporta pero no borra.
//
// Diseño colisión-safe (dos fases):
//   1. write-temp — por cada doc con ID pre-canónico, escribe una copia en
//      un namespace temporal (`resultados_real_migracion_2026_07_29`) con el
//      indicadorId canónico. Los docs a eliminar (I.22/I.23 parvulario, I.46
//      escolar) NO se copian.
//   2. verify    — cuenta temp vs originales-menos-eliminados. Si no cuadra,
//      aborta sin tocar producción.
//   3. finalize  — por cada doc temporal, escribe en el ID canónico final en
//      `resultados_real`. Verifica. Luego borra los originales (los que
//      cambian de ID) y los temporales.
//
// Idempotencia: si al iniciar no hay docs con IDs no-canónicos y sí los hay
// canónicos, sale 0 sin escribir.
//
// PRECONDICIÓN: antes de correr sin --dry-run, tomar un export completo de
// `resultados_real` con `gcloud firestore export` (ver Q5 del plan).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  PARVULARIO_CANONICAL,
  ESCOLAR2026_CANONICAL,
  preCanonicalToCanonical,
} from './lib/canonicalIds.mjs';

// ─── Args ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);

const DRY_RUN = args.includes('--dry-run');
const DELETE_ORPHANS = args.includes('--delete-orphans');
const PROGRAM = (args.find(a => a.startsWith('--program=')) || '--program=both').split('=')[1];
const PHASE   = (args.find(a => a.startsWith('--phase=')) || '--phase=full').split('=')[1];

if (!['parvulario', 'escolar', 'both'].includes(PROGRAM)) {
  console.error(`[migrate] --program debe ser parvulario|escolar|both, got ${PROGRAM}`);
  process.exit(2);
}
if (!['write-temp', 'finalize', 'full'].includes(PHASE)) {
  console.error(`[migrate] --phase debe ser write-temp|finalize|full, got ${PHASE}`);
  process.exit(2);
}

console.log(`[migrate] program=${PROGRAM} phase=${PHASE} dry-run=${DRY_RUN} delete-orphans=${DELETE_ORPHANS}`);

// ─── Firestore init ────────────────────────────────────────────────────────

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const COLL_LIVE = 'resultados_real';
const COLL_TEMP = 'resultados_real_migracion_2026_07_29';

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeDocId(s) {
  return String(s).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function programaFromDoc(data, docId) {
  // Preferir el campo explícito; si no está, inferir por prefijo del docId.
  if (data.programa === 'parvulario' || data.programa === 'escolar') return data.programa;
  if (typeof docId === 'string') {
    if (docId.startsWith('parv_')) return 'parvulario';
    if (docId.startsWith('esc_'))  return 'escolar';
  }
  return null;
}

function canonicalForDoc(data, docId) {
  const prog = programaFromDoc(data, docId);
  if (!prog) return { canonId: null, action: 'skip', reason: 'programa desconocido' };
  const pre = data.indicadorId;
  if (typeof pre !== 'string') return { canonId: null, action: 'skip', reason: 'indicadorId ausente' };
  const canonical = prog === 'parvulario' ? PARVULARIO_CANONICAL : ESCOLAR2026_CANONICAL;
  const canonId = preCanonicalToCanonical(pre, canonical);
  if (canonId === null) return { canonId: null, action: 'delete-orphan', pre };
  if (canonId === pre)  return { canonId, action: 'identity' };
  return { canonId, action: 'rename', pre };
}

function nuevoDocIdCanonico(oldDocId, data, canonId, prog) {
  const suffix = data.nivel ? `_${sanitizeDocId(data.nivel)}` : '';
  const prefix = prog === 'parvulario' ? 'parv' : 'esc';
  const anioPart = data.anio ?? data.periodo ?? '';
  const baseFinal = `${prefix}_${data.establecimientoId}_${canonId}_${anioPart}${suffix}`;
  return sanitizeDocId(baseFinal);
}

function nuevoDocIdTemp(oldDocId) {
  // Namespace temporal — no colisiona con ningún prefijo del scheme normal.
  return sanitizeDocId(`tmp_${oldDocId}`);
}

// ─── Read all live docs (filtrando por programa si aplica) ────────────────

async function readLiveDocs() {
  console.log(`\n[migrate] Leyendo colección ${COLL_LIVE}…`);
  const snap = await db.collection(COLL_LIVE).get();
  const rows = [];
  for (const d of snap.docs) {
    const data = d.data();
    const prog = programaFromDoc(data, d.id);
    if (PROGRAM !== 'both' && prog !== PROGRAM) continue;
    rows.push({ docId: d.id, data, prog });
  }
  console.log(`[migrate] Leídos ${rows.length} docs (post filtro programa=${PROGRAM}).`);
  return rows;
}

// ─── Idempotencia: si no queda nada por migrar, salir ──────────────────────

function analizar(rows) {
  const counts = {
    total: rows.length,
    identity: 0,
    rename: 0,
    deleteOrphan: 0,
    skip: 0,
    byProgram: { parvulario: 0, escolar: 0, otros: 0 },
  };
  const acciones = [];
  for (const r of rows) {
    const decision = canonicalForDoc(r.data, r.docId);
    acciones.push({ row: r, decision });
    if (r.prog === 'parvulario') counts.byProgram.parvulario++;
    else if (r.prog === 'escolar') counts.byProgram.escolar++;
    else counts.byProgram.otros++;
    if (decision.action === 'identity')      counts.identity++;
    else if (decision.action === 'rename')   counts.rename++;
    else if (decision.action === 'delete-orphan') counts.deleteOrphan++;
    else                                     counts.skip++;
  }
  return { counts, acciones };
}

// ─── Fase 1: write-temp ────────────────────────────────────────────────────

async function faseWriteTemp(acciones) {
  console.log(`\n[migrate] Fase write-temp → ${COLL_TEMP}`);
  let escritos = 0, saltados = 0, borrarOriginales = 0;
  const batch = [];
  for (const { row, decision } of acciones) {
    if (decision.action === 'identity') { saltados++; continue; }
    if (decision.action === 'skip')     { saltados++; continue; }
    if (decision.action === 'delete-orphan') {
      // Los orphans no se copian al temp; se cuentan para el borrado en
      // finalize (si --delete-orphans).
      borrarOriginales++;
      continue;
    }
    const newData = { ...row.data, indicadorId: decision.canonId, _migradoDesde: row.docId };
    const tempDocId = nuevoDocIdTemp(row.docId);
    batch.push({ tempDocId, newData });
    escritos++;
  }
  console.log(`  Rename: ${escritos} escrituras al temp; ${saltados} identity/skip; ${borrarOriginales} orphans a borrar en finalize.`);
  if (!DRY_RUN) {
    let i = 0;
    for (const { tempDocId, newData } of batch) {
      await db.collection(COLL_TEMP).doc(tempDocId).set(newData);
      i++;
      if (i % 100 === 0) console.log(`    …${i}/${batch.length}`);
    }
    console.log(`  ✅ ${i} docs escritos al temp.`);
  }
  return { escritos, saltados, borrarOriginales, batch };
}

// ─── Fase 2: verify ─────────────────────────────────────────────────────────

async function faseVerify(escritosEsperados) {
  console.log(`\n[migrate] Fase verify`);
  if (DRY_RUN) {
    console.log('  (dry-run: no leemos el temp para no depender de un write real; asumimos OK)');
    return { ok: true, count: escritosEsperados };
  }
  const snap = await db.collection(COLL_TEMP).get();
  const ok = snap.docs.length === escritosEsperados;
  console.log(`  Temp docs: ${snap.docs.length} · esperados: ${escritosEsperados} · ${ok ? 'OK' : 'MISMATCH — abortando'}`);
  return { ok, count: snap.docs.length };
}

// ─── Fase 3: finalize ──────────────────────────────────────────────────────

async function faseFinalize(acciones) {
  console.log(`\n[migrate] Fase finalize`);
  let renombrados = 0, orphansBorrados = 0, tempBorrados = 0;
  const orphanBatch = [];
  const finalizeBatch = [];
  for (const { row, decision } of acciones) {
    if (decision.action === 'delete-orphan') {
      orphanBatch.push({ oldDocId: row.docId, pre: decision.pre });
      continue;
    }
    if (decision.action !== 'rename') continue;
    const newDocId = nuevoDocIdCanonico(row.docId, row.data, decision.canonId, row.prog);
    const tempDocId = nuevoDocIdTemp(row.docId);
    const finalData = { ...row.data, indicadorId: decision.canonId };
    // Evitar residuos del write-temp:
    delete finalData._migradoDesde;
    finalizeBatch.push({ oldDocId: row.docId, newDocId, tempDocId, finalData });
    renombrados++;
  }
  console.log(`  Renames a finalizar: ${finalizeBatch.length}`);
  console.log(`  Orphans a borrar:    ${orphanBatch.length} ${DELETE_ORPHANS ? '(con --delete-orphans)' : '(SIN --delete-orphans → solo reporte)'}`);
  if (DRY_RUN) return { renombrados, orphansBorrados, tempBorrados };

  let i = 0;
  for (const { oldDocId, newDocId, tempDocId, finalData } of finalizeBatch) {
    // 1. Escribir doc canónico final.
    await db.collection(COLL_LIVE).doc(newDocId).set(finalData);
    // 2. Verificar que se escribió antes de borrar cualquier cosa.
    const check = await db.collection(COLL_LIVE).doc(newDocId).get();
    if (!check.exists) throw new Error(`finalize: doc canónico ${newDocId} no se escribió`);
    // 3. Borrar el temporal.
    await db.collection(COLL_TEMP).doc(tempDocId).delete();
    tempBorrados++;
    // 4. Borrar el original solo si el nuevo ID es distinto (nunca borres si es identity — ya cubierto arriba).
    if (oldDocId !== newDocId) {
      await db.collection(COLL_LIVE).doc(oldDocId).delete();
    }
    i++;
    if (i % 100 === 0) console.log(`    …${i}/${finalizeBatch.length}`);
  }
  console.log(`  ✅ ${i} renames finalizados.`);

  if (DELETE_ORPHANS) {
    for (const { oldDocId } of orphanBatch) {
      await db.collection(COLL_LIVE).doc(oldDocId).delete();
      orphansBorrados++;
    }
    console.log(`  ✅ ${orphansBorrados} orphans borrados.`);
  }

  return { renombrados, orphansBorrados, tempBorrados };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const rows = await readLiveDocs();
const { counts, acciones } = analizar(rows);
console.log(`\n[migrate] Análisis:`);
console.log(counts);

// Idempotencia: si no hay renames ni orphans pendientes, salir 0.
if (counts.rename === 0 && counts.deleteOrphan === 0) {
  console.log(`\n[migrate] Nada por migrar. Firestore ya está en canónico. Salida limpia.`);
  process.exit(0);
}

const doWrite   = PHASE === 'write-temp' || PHASE === 'full';
const doFinal   = PHASE === 'finalize'   || PHASE === 'full';

let writeResult = null, verifyResult = null, finalResult = null;
if (doWrite) {
  writeResult  = await faseWriteTemp(acciones);
  verifyResult = await faseVerify(writeResult.escritos);
  if (!verifyResult.ok) {
    console.error(`\n❌ Verify falló — abortando sin tocar producción.`);
    process.exit(3);
  }
}
if (doFinal) {
  finalResult = await faseFinalize(acciones);
}

// ─── Reporte JSON ──────────────────────────────────────────────────────────

const reportsDir = pathResolve(ROOT, 'reports');
await mkdir(reportsDir, { recursive: true });
const reportPath = pathResolve(reportsDir, `migrateCanonicalIndicadorIds-${new Date().toISOString().slice(0, 10)}.json`);
const report = {
  ranAt: new Date().toISOString(),
  program: PROGRAM,
  phase: PHASE,
  dryRun: DRY_RUN,
  deleteOrphans: DELETE_ORPHANS,
  counts,
  writeResult: writeResult ? {
    escritos: writeResult.escritos,
    saltados: writeResult.saltados,
    borrarOriginales: writeResult.borrarOriginales,
  } : null,
  verifyResult,
  finalResult,
};
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\n[migrate] Reporte JSON: ${reportPath}`);
console.log(`[migrate] Listo.`);
