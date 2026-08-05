// Reporte para Sebastián: qué (escuela × indicador × año) tuplas están conectadas
// a la planilla fuente y cuáles no. Salida principal es markdown, con CSV como anexo.
//
// Usage:
//   node scripts/reporteConexionEscolar.mjs [--dry-run]
//
// Solo lectura. Nunca escribe a Firestore.

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
const inds2026 = cat.indicadores.escolar2026
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));
const indById = new Map(inds2026.map(i => [i.id, i]));

const [resSnap, estSnap] = await Promise.all([
  db.collection('resultados_real').where('programa', '==', 'escolar').get(),
  db.collection('establecimientos_real').where('programa', '==', 'escolar').get(),
]);

const escuelas = estSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.sostenedor || '').localeCompare(b.sostenedor || '') || a.nombre.localeCompare(b.nombre));

// Firestore state: Map<estId|indId|anio, { valor, estado }>
const firestoreState = new Map();
const indHasAnyDoc = new Set();
for (const d of resSnap.docs) {
  const data = d.data();
  const k = `${data.establecimientoId}|${data.indicadorId}|${data.anio}`;
  firestoreState.set(k, { valor: data.valor, estado: data.estado });
  indHasAnyDoc.add(data.indicadorId);
}

// Global: which indicators are wired anywhere (have at least one doc for any school × year)?
const wired   = inds2026.filter(i => indHasAnyDoc.has(i.id));
const unwired = inds2026.filter(i => !indHasAnyDoc.has(i.id));

// Per-school 2026 tuple state
function tupleState(estId, indId) {
  const st = firestoreState.get(`${estId}|${indId}|2026`);
  if (!st) {
    return indHasAnyDoc.has(indId) ? 'CONECTADO_SIN_DOC' : 'SIN_FUENTE';
  }
  if (st.valor === null || st.valor === undefined) return 'CONECTADO_SIN_DATO';
  return 'CONECTADO_CON_DATO';
}

const LABELS = {
  CONECTADO_CON_DATO: 'Con dato',
  CONECTADO_SIN_DATO: 'Sin dato',
  CONECTADO_SIN_DOC:  'Faltante',    // wired en general pero sin doc para ese school × indicador (raro)
  SIN_FUENTE:         'Sin fuente',
};

// ── Markdown ──────────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push('# Reporte de conexión Escolar — visualizador vs planillas fuente\n');
lines.push(`Fecha: ${date}. Programa: **Escolar** · Año: **2026**.\n`);
lines.push('Este reporte responde a la pregunta: **para cada escuela e indicador del catálogo canónico 2026, ¿está el visualizador leyendo el dato desde la planilla fuente?**');
lines.push('');
lines.push('El estado tiene cuatro valores:');
lines.push('');
lines.push('- **Con dato**: la planilla fuente reportó un valor y llegó al visualizador.');
lines.push('- **Sin dato**: la planilla fuente se leyó correctamente, pero la celda está vacía. La conexión funciona.');
lines.push('- **Faltante**: la conexión está declarada en general pero no se registró un documento para esta escuela. Requiere revisar el pipeline.');
lines.push('- **Sin fuente**: no está declarada la coordenada de dónde leer este indicador. **Requiere que Sebastián indique la planilla / pestaña / columna.**');
lines.push('');
lines.push('---\n');

// Section 1: universal picture
lines.push('## Resumen general (18 escuelas × 51 indicadores = 918 tuplas para 2026)\n');
const summary = { CONECTADO_CON_DATO: 0, CONECTADO_SIN_DATO: 0, CONECTADO_SIN_DOC: 0, SIN_FUENTE: 0 };
for (const e of escuelas) {
  for (const ind of inds2026) summary[tupleState(e.id, ind.id)]++;
}
lines.push('| Estado | Tuplas | % |');
lines.push('|---|---:|---:|');
const total = escuelas.length * inds2026.length;
for (const k of ['CONECTADO_CON_DATO', 'CONECTADO_SIN_DATO', 'CONECTADO_SIN_DOC', 'SIN_FUENTE']) {
  lines.push(`| ${LABELS[k]} | ${summary[k]} | ${(summary[k] * 100 / total).toFixed(1)}% |`);
}
lines.push(`| **Total** | **${total}** | 100% |`);
lines.push('');

// Section 2: which indicators have a source declared
lines.push(`## Indicadores conectados a fuente (${wired.length}/51)\n`);
lines.push('Estos indicadores tienen al menos un documento en Firestore para alguna escuela × año, lo que confirma que la coordenada de lectura está declarada:');
lines.push('');
lines.push('| ID | Ámbito | Nombre |');
lines.push('|---|---|---|');
for (const ind of wired) lines.push(`| ${ind.id} | ${ind.ambito} | ${ind.nombre} |`);
lines.push('');

// Section 3: indicators without source (the actionable list)
lines.push(`## Indicadores sin fuente (${unwired.length}/51) — pendiente de Sebastián\n`);
lines.push('Estos indicadores no tienen coordenada de lectura declarada en ninguna escuela. Necesitamos, para cada uno, la planilla / pestaña / columna donde se reporta — o marca "no vigente en 2026":');
lines.push('');
lines.push('| ID | Ámbito | Nombre | Planilla de origen |');
lines.push('|---|---|---|---|');
for (const ind of unwired) lines.push(`| ${ind.id} | ${ind.ambito} | ${ind.nombre} | *(por definir)* |`);
lines.push('');

// Section 4: per-school detail
lines.push('## Detalle por escuela — 2026\n');
lines.push('Conteo por escuela de las 51 tuplas indicador × 2026:');
lines.push('');
lines.push('| Sostenedor | Escuela | Con dato | Sin dato | Faltante | Sin fuente |');
lines.push('|---|---|---:|---:|---:|---:|');
for (const e of escuelas) {
  const counts = { CONECTADO_CON_DATO: 0, CONECTADO_SIN_DATO: 0, CONECTADO_SIN_DOC: 0, SIN_FUENTE: 0 };
  for (const ind of inds2026) counts[tupleState(e.id, ind.id)]++;
  lines.push(`| ${e.sostenedor || '—'} | ${e.nombre} | ${counts.CONECTADO_CON_DATO} | ${counts.CONECTADO_SIN_DATO} | ${counts.CONECTADO_SIN_DOC} | ${counts.SIN_FUENTE} |`);
}
lines.push('');

// Section 5: full matrix (compact)
lines.push('## Matriz escuela × indicador — 2026 (símbolos)\n');
lines.push('Leyenda: ✅ Con dato · ○ Sin dato · ⚠ Faltante · ✗ Sin fuente\n');
const header = ['| Escuela |', ...inds2026.map(i => ` ${i.id.replace('I.', '')} |`)].join('');
const sep    = ['|---|', ...inds2026.map(() => '---|')].join('');
lines.push(header);
lines.push(sep);
for (const e of escuelas) {
  const row = [`| ${e.nombre} |`];
  for (const ind of inds2026) {
    const st = tupleState(e.id, ind.id);
    const sym = st === 'CONECTADO_CON_DATO' ? '✅' : st === 'CONECTADO_SIN_DATO' ? '○' : st === 'CONECTADO_SIN_DOC' ? '⚠' : '✗';
    row.push(` ${sym} |`);
  }
  lines.push(row.join(''));
}
lines.push('');

const md = lines.join('\n');
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const mdPath = pathResolve(ROOT, `reports/reporteConexionEscolar-${date}.md`);
if (!DRY_RUN) await writeFile(mdPath, md, 'utf8');

// CSV anexo: escuela, indicadorId, ambito, estado
const csvLines = ['escuela,sostenedor,indicadorId,ambito,estado,valor'];
for (const e of escuelas) {
  for (const ind of inds2026) {
    const st = tupleState(e.id, ind.id);
    const stored = firestoreState.get(`${e.id}|${ind.id}|2026`);
    const val = stored?.valor ?? '';
    csvLines.push(`"${e.nombre}","${e.sostenedor || ''}",${ind.id},${ind.ambito},${st},${val}`);
  }
}
const csvPath = pathResolve(ROOT, `reports/reporteConexionEscolar-${date}.csv`);
if (!DRY_RUN) await writeFile(csvPath, csvLines.join('\n'), 'utf8');

console.log(`\n✓ Total tuplas: ${escuelas.length * inds2026.length} (${escuelas.length} escuelas × ${inds2026.length} indicadores 2026)`);
console.log(`✓ Estado global:`, summary);
console.log(`✓ ${wired.length} indicadores conectados, ${unwired.length} sin fuente`);
if (!DRY_RUN) {
  console.log(`\nReporte → ${mdPath}`);
  console.log(`CSV     → ${csvPath}`);
} else {
  console.log('\nDRY RUN — no se escribió nada.');
}
