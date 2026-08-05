// Backfill: para cada (escuela × indicador conectado × 2026) sin doc en Firestore,
// escribe un doc con valor=null estado='sin_dato_reportado'. Requerimiento de
// Sebastián 2026-08-05: "necesito toda la data aunque el dato sea celda vacía".
//
// Un indicador está "conectado globalmente" si tiene al menos 1 doc en Firestore
// para alguna escuela — es decir, sabemos leer la coordenada; sólo esa escuela
// tiene la celda vacía. Los 18 indicadores SIN_FUENTE_MAPEADA (I.21-I.24, I.30,
// I.32, I.39, I.48-I.51) NO se incluyen — su ausencia no es "celda vacía", es
// "coordenada no declarada" — la UI ya los muestra como "Sin fuente".
//
// Usage:
//   node scripts/backfillEscolarNullDocs.mjs [--dry-run]
//
// Idempotente. Nunca borra. Emite reporte en reports/.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const cat = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const inds2026 = cat.indicadores.escolar2026;
const indById = new Map(inds2026.map(i => [i.id, i]));

const [resSnap, estSnap] = await Promise.all([
  db.collection('resultados_real').where('programa', '==', 'escolar').get(),
  db.collection('establecimientos_real').where('programa', '==', 'escolar').get(),
]);

const escuelas = estSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// Which indicators are wired (have at least one doc anywhere)?
const wired = new Set();
const has = new Set();
for (const d of resSnap.docs) {
  const data = d.data();
  wired.add(data.indicadorId);
  has.add(`${data.establecimientoId}|${data.indicadorId}|${data.anio}`);
}

// Compute missing tuples: (escuela × wired-indicator × 2026) sin doc
const toWrite = [];
for (const e of escuelas) {
  for (const ind of inds2026) {
    if (!wired.has(ind.id)) continue;
    const key = `${e.id}|${ind.id}|2026`;
    if (has.has(key)) continue;
    const docId = `esc_${e.id}_${ind.id.replace(/\./g, '_')}_2026`;
    toWrite.push({
      docId,
      establecimientoId: e.id,
      establecimientoNombre: e.nombre,
      indicadorId: ind.id,
      indicadorNombre: ind.nombre,
      slep: e.slep,
    });
  }
}

console.log(`\nBackfill Escolar Null Docs — ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`Total slots faltantes (indicador conectado, sin doc para esa escuela):`, toWrite.length);
if (toWrite.length === 0) {
  console.log('Nada que hacer.');
  process.exit(0);
}

for (const t of toWrite) console.log(`  ${t.establecimientoNombre} · ${t.indicadorId}`);

if (DRY_RUN) {
  console.log('\nDRY-RUN — no se escribió a Firestore.');
} else {
  // Batch write (Firestore batch limit is 500)
  const batch = db.batch();
  for (const t of toWrite) {
    const ind = indById.get(t.indicadorId);
    const ref = db.collection('resultados_real').doc(t.docId);
    batch.set(ref, {
      programa: 'escolar',
      establecimientoId: t.establecimientoId,
      indicadorId: t.indicadorId,
      anio: 2026,
      periodo: '2026',
      valor: null,
      raw: null,
      estado: 'sin_dato_reportado',
      ambito: ind.ambito,
      meta: ind.meta,
      metaNum: ind.metaNum,
      unidad: ind.unidad,
      logro: null,
      slep: t.slep,
      fuente: { workbookId: null, workbookLabel: 'backfill-null-2026-08-05', tab: null, row: null },
      generatedAt: new Date().toISOString(),
      backfilled: true,
    });
  }
  await batch.commit();
  console.log(`\n✅ ${toWrite.length} docs escritos con valor=null estado='sin_dato_reportado'.`);
}

const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/backfillEscolarNullDocs-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  totalWritten: toWrite.length,
  slots: toWrite,
}, null, 2));
console.log(`Reporte → ${reportPath}`);
