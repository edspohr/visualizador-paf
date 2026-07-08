// Read-only fill audit: measure what EXISTS in source vs what we SHOW in resultados_real.
// Emits docs/auditoria-llenado.{csv,json} + docs/auditoria-llenado.md.
//
// No writes to data collections. No app changes. No flag changes.
// PII is never persisted/logged (we don't read cell-level source data here — we consume
// the existing cobertura matrix from Task 2, which already summarized presence per cell).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── 1. Auth ────────────────────────────────────────────────────────────────

const saPath = path.join(__dirname, 'service-account.json');
const sa = JSON.parse(readFileSync(saPath, 'utf8'));
console.log(`SA client_email: ${sa.client_email}`);
console.log(`project_id:      ${sa.project_id}`);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ─── 2. Load cobertura matrix (existe side) ─────────────────────────────────

const matrizPath = path.join(ROOT, 'docs', 'task2-cobertura-matriz.json');
const matrizFile = JSON.parse(readFileSync(matrizPath, 'utf8'));
const matriz = Array.isArray(matrizFile) ? matrizFile : matrizFile.rows;
console.log(`\nCobertura matrix loaded: ${matriz.length} rows (from ${Array.isArray(matrizFile) ? 'array' : 'rows[]'})`);
if (matrizFile.byEstado) console.log('byEstado (source):', matrizFile.byEstado);

// ─── 2b. Load catalog for Sem-based scope check ─────────────────────────────
// Parvulario indicadores tienen `inicio` (Sem 1..4). Cada cohorte ha ejecutado hasta
// un semestre distinto; indicadores fuera de ese scope no aplican todavía y no
// deben contarse como gap.
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));
const COHORT_MAX_SEM = {
  '2025-2026': 3,  // Sem 1+2+3 ejecutados
  '2026-2027': 1,  // solo Sem 1 ejecutado
};
function semNum(inicio) {
  const m = String(inicio || '').match(/Sem\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}
const parvIndSem = new Map(
  (catalog.indicadores.parvulario || []).map(i => [i.id, semNum(i.inicio)])
);
console.log(`Parvulario Sem-scope map: ${parvIndSem.size} indicadores`);

// Sample to confirm shape
console.log('Sample row:', JSON.stringify(matriz[0], null, 2));

// ─── 3. Load resultados_real (mostrado side) ────────────────────────────────

// ─── 3a. Load establecimientos_real to build a name→id map ──────────────────
// The cobertura matrix uses synthetic ids (ESC-001, PAR-001) but Firestore holds
// real slugs (esc-abate-molina, jar-akun-pichiwentxu). We join by normalized name.

console.log('\nReading establecimientos_real…');
const estSnap = await db.collection('establecimientos_real').get();
console.log(`  ${estSnap.size} docs`);

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/^escuela\s+/, '')                       // drop leading "Escuela "
    .replace(/\(.*?\)/g, '')                          // drop parentheticals
    .replace(/[^a-z0-9]+/g, ' ')                      // collapse punctuation
    .trim();
}

// Map: `${programa}|${normName}` → real firestore id
const nameToFsId = new Map();
// Reverse map for reporting: real id → { programa, nombre }
const fsIdMeta = new Map();
for (const d of estSnap.docs) {
  const x = d.data();
  const programa = x.programa;
  const nombre = x.nombre;
  if (!programa || !nombre) continue;
  nameToFsId.set(`${programa}|${normName(nombre)}`, d.id);
  fsIdMeta.set(d.id, { programa, nombre });
}

// Indicator id normalization: matrix uses "I.1" for both tracks; Firestore uses
// "I1" (Escolar) and "I.1" (Parvulario). Normalize to a canonical form for join.
function normIndId(programa, id) {
  const s = String(id || '').trim();
  const m = s.match(/^I\.?(\d+)$/);
  if (!m) return s;
  const n = m[1];
  // Canonical: dotted form for parvulario, undotted for escolar (matches Firestore).
  return programa === 'escolar' ? `I${n}` : `I.${n}`;
}

// ─── 3b. Load resultados_real (mostrado side) ───────────────────────────────

console.log('\nReading resultados_real…');
const snap = await db.collection('resultados_real').get();
console.log(`  ${snap.size} docs read`);

// Build lookup keyed by REAL Firestore ids: `${programa}|${fsEstId}|${fsIndId}|${anio}` → doc
const shown = new Map();
let readErrors = 0;
for (const d of snap.docs) {
  const x = d.data();
  const programa = x.programa;
  const est = x.establecimientoId;
  const ind = x.indicadorId;
  const anio = x.anio;
  if (!programa || !est || !ind || !anio) { readErrors++; continue; }
  const key = `${programa}|${est}|${ind}|${anio}`;
  shown.set(key, { estado: x.estado, valor: x.valor });
}
console.log(`  shown-set size: ${shown.size}${readErrors ? `  (skipped ${readErrors} malformed docs)` : ''}`);

// ─── 4. Classify each cell ──────────────────────────────────────────────────
// Mapping from cobertura `estado` to audit `estado`:
//   presente         → existe (source has value)
//   parcial          → existe (source has a derived value — the pivot)
//   ausente-mapeo    → existe (column exists, only awaiting mapping confirmation)
//   ausente-datos    → no-existe (no column in source)
//   ausente-acceso   → no-accesible (source could not be read)
//
// Then cross with resultados_real:
//   existe && shown  → existe+mostrado
//   existe && !shown → existe+no-mostrado  ← the recoverable gap
//   no-existe        → no-existe            (regardless of shown; a stray shown doc without source
//                                            would show up as an anomaly counted separately)
//   no-accesible     → no-accesible

const OUT_STATES = ['existe+mostrado', 'existe+no-mostrado', 'no-existe', 'no-accesible', 'no-aplica-aun'];

// Sem scope check: para Parvulario, si el indicador inicia en un semestre posterior al
// que la cohorte ha ejecutado, la celda no aplica todavía.
function esFueraDeScope(row, fsIndId) {
  if (row.programa !== 'parvulario') return false;
  const maxSem = COHORT_MAX_SEM[row.cohorte];
  const indSem = parvIndSem.get(fsIndId);
  if (maxSem === undefined || indSem === null || indSem === undefined) return false;
  return indSem > maxSem;
}

function existeFromCobertura(row) {
  if (row.estado === 'presente') return 'existe';
  if (row.estado === 'parcial') return 'existe';
  if (row.estado === 'ausente-mapeo') return 'existe';
  if (row.estado === 'ausente-datos') return 'no-existe';
  if (row.estado === 'ausente-acceso') return 'no-accesible';
  return 'no-existe'; // conservative default for unknown states
}

// Location confidence: confirmed when cobertura row has sourceTab AND sourceColumns AND estado ∈ {presente, parcial}.
// Inferred when it's ausente-mapeo (column proposal exists but Sebastián hasn't confirmed) or when sourceColumns is empty.
function confianzaUbicacion(row) {
  // presente: Etapa 2 registró workbook+tab de la fuente. sourceColumns puede quedar en '' para
  // filas ingresadas por consolidado, sin cambiar el hecho de que la ubicación es conocida.
  if (row.estado === 'presente' && row.sourceTab) return 'confirmada';
  if (row.estado === 'parcial') return 'confirmada'; // pivote 2025 aceptado como fuente
  if (row.estado === 'ausente-mapeo') return 'inferida'; // columna propuesta, esperando confirmación
  if (row.estado === 'ausente-acceso') return 'confirmada';
  if (row.estado === 'ausente-datos') return 'confirmada';
  return 'inferida';
}

// Track diagnostic: matrix rows for which we couldn't resolve a Firestore establecimientoId
let unmatchedEsts = new Set();
const classified = matriz.map(row => {
  const nk = `${row.programa}|${normName(row.establecimientoNombre)}`;
  const fsEstId = nameToFsId.get(nk) || null;
  const fsIndId = normIndId(row.programa, row.indicadorId);
  const anio = Number(row.anio);
  const key = fsEstId ? `${row.programa}|${fsEstId}|${fsIndId}|${anio}` : null;
  if (!fsEstId) unmatchedEsts.add(`${row.programa}|${row.establecimientoNombre}`);

  const existe = existeFromCobertura(row);
  let auditState;
  // Marco cohorte × semestre: si el indicador no aplica al scope de esta cohorte,
  // clasificar como no-aplica-aun (independiente de si la fuente tiene columna).
  if (esFueraDeScope(row, fsIndId)) {
    auditState = 'no-aplica-aun';
  } else if (existe === 'no-accesible') auditState = 'no-accesible';
  else if (existe === 'no-existe') auditState = 'no-existe';
  else {
    // existe
    auditState = key && shown.has(key) ? 'existe+mostrado' : 'existe+no-mostrado';
  }
  return {
    programa: row.programa,
    version: row.version,
    indicadorId: row.indicadorId,
    indicadorIdFs: fsIndId,
    ambito: row.ambito,
    fuente: row.fuente,
    establecimientoId: row.establecimientoId,
    establecimientoIdFs: fsEstId || '',
    establecimientoNombre: row.establecimientoNombre,
    sostenedor: row.sostenedor,
    cohorte: row.cohorte,
    anio: row.anio,
    estado: auditState,
    coberturaEstado: row.estado,
    sourceWorkbookId: row.sourceWorkbookId || '',
    sourceTab: row.sourceTab || '',
    sourceColumns: row.sourceColumns || '',
    confianzaUbicacion: confianzaUbicacion(row),
    notas: row.notas || '',
    mapeoPropuesto: row.mapeoPropuesto || '',
  };
});

console.log(`\nEstablishment name→id resolution: ${matriz.length - unmatchedEsts.size * 106} matrix rows matched to a Firestore id`);
if (unmatchedEsts.size) {
  console.log(`  ⚠ Unmatched est-names (${unmatchedEsts.size}):`);
  for (const u of unmatchedEsts) console.log(`     • ${u}`);
}

// Anomaly: docs in resultados_real not covered by any cobertura row (post-normalization)
const coberturaKeys = new Set(
  classified
    .filter(r => r.establecimientoIdFs)
    .map(r => `${r.programa}|${r.establecimientoIdFs}|${r.indicadorIdFs}|${Number(r.anio)}`)
);
const orphanShown = [...shown.keys()].filter(k => !coberturaKeys.has(k));
console.log(`\nOrphan shown (in resultados_real but not in cobertura matrix): ${orphanShown.length}`);
if (orphanShown.length) console.log('  sample:', orphanShown.slice(0, 5));

// Contradiction: matrix says the cell doesn't exist / isn't accessible, but Firestore has a value.
const contradictions = classified.filter(r => {
  if (!r.establecimientoIdFs) return false;
  const key = `${r.programa}|${r.establecimientoIdFs}|${r.indicadorIdFs}|${Number(r.anio)}`;
  return shown.has(key) && (r.estado === 'no-existe' || r.estado === 'no-accesible');
});
console.log(`\nContradictions (matrix says no-existe/no-accesible but Firestore shows a value): ${contradictions.length}`);
if (contradictions.length) {
  const sample = contradictions.slice(0, 5).map(c => `${c.programa}·${c.indicadorId}·${c.establecimientoNombre}·${c.anio} (matrix=${c.coberturaEstado})`);
  console.log('  sample:', sample);
}

// ─── 5. Totals ──────────────────────────────────────────────────────────────

function totals(rows) {
  const t = { total: rows.length };
  for (const s of OUT_STATES) t[s] = 0;
  for (const r of rows) t[r.estado]++;
  return t;
}

const totalGlobal = totals(classified);
const totalEscolar = totals(classified.filter(r => r.programa === 'escolar'));
const totalParv = totals(classified.filter(r => r.programa === 'parvulario'));

console.log('\n─── Totales ─────────────────────────────');
console.log('Global:    ', totalGlobal);
console.log('Escolar:   ', totalEscolar);
console.log('Parvulario:', totalParv);

// ─── 6. existe+no-mostrado breakdown ────────────────────────────────────────

const gaps = classified.filter(r => r.estado === 'existe+no-mostrado');

// Aggregate by (programa, indicadorId, anio) with count of centros afectados + fuente representativa
const byInd = new Map();
for (const g of gaps) {
  const k = `${g.programa}|${g.indicadorId}|${g.anio}`;
  if (!byInd.has(k)) byInd.set(k, {
    programa: g.programa,
    indicadorId: g.indicadorId,
    ambito: g.ambito,
    fuente: g.fuente,
    anio: g.anio,
    sourceTab: g.sourceTab,
    sourceColumns: g.sourceColumns,
    sourceWorkbookId: g.sourceWorkbookId,
    confianza: g.confianzaUbicacion,
    coberturaEstado: g.coberturaEstado,
    centros: 0,
  });
  byInd.get(k).centros++;
}
const gapsPorIndicador = [...byInd.values()].sort((a, b) => b.centros - a.centros);

// ─── 7. Write CSV, JSON, MD ─────────────────────────────────────────────────

function toCsvRow(row) {
  return Object.values(row).map(v => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',');
}

const csvHeader = 'programa,version,indicadorId,indicadorIdFs,ambito,fuente,establecimientoId,establecimientoIdFs,establecimientoNombre,sostenedor,cohorte,anio,estado,coberturaEstado,sourceWorkbookId,sourceTab,sourceColumns,confianzaUbicacion,notas,mapeoPropuesto';
const csvLines = [csvHeader, ...classified.map(toCsvRow)];
writeFileSync(path.join(ROOT, 'docs', 'auditoria-llenado.csv'), csvLines.join('\n'));
console.log(`\nWrote docs/auditoria-llenado.csv (${csvLines.length - 1} rows)`);

writeFileSync(path.join(ROOT, 'docs', 'auditoria-llenado.json'), JSON.stringify(classified, null, 2));
console.log(`Wrote docs/auditoria-llenado.json`);

// Build the Markdown report

const fmt = (n) => n.toLocaleString('es-CL');
const pct = (n, tot) => tot ? `${(100 * n / tot).toFixed(1)} %` : '—';

const md = `# Auditoría de llenado — ¿qué existe en la fuente vs qué mostramos?

**Fecha:** ${new Date().toISOString().slice(0, 10)}
**Modo:** medición read-only. Cero escrituras a colecciones de datos, cero cambios en el
app, cero cambios de flags. La única entrada de Firestore es la lectura de \`resultados_real\`.
**Identidad:** \`${sa.client_email}\` — verificada contra \`client_email\` del JSON.
**Alcance:** cada celda \`(programa × indicadorId × establecimientoId × año)\` del catálogo
2026 (con 2025 donde el establecimiento tiene ese año). Total: ${fmt(totalGlobal.total)} celdas.

## Definiciones (no re-interpretadas)

- **existe+mostrado** — el valor existe en la fuente Y está presente en \`resultados_real\`.
- **existe+no-mostrado** — el valor existe en la fuente pero NO está en \`resultados_real\`. ← la brecha real.
- **no-existe** — no hay valor en la fuente (celda vacía/ausente).
- **no-accesible** — la fuente no pudo leerse.
- **no-aplica-aun** — el indicador inicia en un semestre posterior al ejecutado por su
  cohorte (2025-2026 hasta Sem 3, 2026-2027 solo Sem 1). Aplica sólo a Parvulario.

La columna “existe” se hereda del estado de la matriz de cobertura Etapa 2:
\`presente\` → existe · \`parcial\` → existe · \`ausente-mapeo\` → existe (columna hallada,
esperando confirmación de mapeo) · \`ausente-datos\` → no-existe · \`ausente-acceso\` → no-accesible.

## Los tres números

| Estado | Global | % | Escolar | Parvulario |
|---|---:|---:|---:|---:|
| existe+mostrado | ${fmt(totalGlobal['existe+mostrado'])} | ${pct(totalGlobal['existe+mostrado'], totalGlobal.total)} | ${fmt(totalEscolar['existe+mostrado'])} | ${fmt(totalParv['existe+mostrado'])} |
| **existe+no-mostrado** | **${fmt(totalGlobal['existe+no-mostrado'])}** | **${pct(totalGlobal['existe+no-mostrado'], totalGlobal.total)}** | **${fmt(totalEscolar['existe+no-mostrado'])}** | **${fmt(totalParv['existe+no-mostrado'])}** |
| no-existe | ${fmt(totalGlobal['no-existe'])} | ${pct(totalGlobal['no-existe'], totalGlobal.total)} | ${fmt(totalEscolar['no-existe'])} | ${fmt(totalParv['no-existe'])} |
| no-accesible | ${fmt(totalGlobal['no-accesible'])} | ${pct(totalGlobal['no-accesible'], totalGlobal.total)} | ${fmt(totalEscolar['no-accesible'])} | ${fmt(totalParv['no-accesible'])} |
| no-aplica-aun | ${fmt(totalGlobal['no-aplica-aun'])} | ${pct(totalGlobal['no-aplica-aun'], totalGlobal.total)} | ${fmt(totalEscolar['no-aplica-aun'])} | ${fmt(totalParv['no-aplica-aun'])} |
| **Total** | **${fmt(totalGlobal.total)}** | 100.0 % | **${fmt(totalEscolar.total)}** | **${fmt(totalParv.total)}** |

${orphanShown.length ? `> ⚠ Documentos huérfanos en \`resultados_real\` (${orphanShown.length}): no calzan con ninguna fila de la matriz. Ejemplos: ${orphanShown.slice(0, 5).map(k => `\`${k}\``).join(', ')}.\n` : ''}${contradictions.length ? `> ⚠ Contradicciones (${contradictions.length}): la matriz de cobertura marca la celda como \`no-existe\` o \`no-accesible\` pero \`resultados_real\` tiene un valor. Esto ocurre cuando la ingesta extrajo un valor de una columna que la auditoría Etapa 2 no reconoció, o cuando el pivote 2025 se ingresó pese a estar marcado \`ausente-datos\`. Revisar caso por caso:\n${contradictions.slice(0, 10).map(c => `>   - ${c.programa} · ${c.indicadorId} · ${c.establecimientoNombre} · ${c.anio}  (matriz=${c.coberturaEstado})`).join('\n')}${contradictions.length > 10 ? `\n>   … y ${contradictions.length - 10} más (ver CSV)` : ''}\n` : ''}

## existe+no-mostrado — la brecha recuperable

Total: **${fmt(totalGlobal['existe+no-mostrado'])} celdas** en ${gapsPorIndicador.length} combinaciones \`(programa × indicador × año)\`.

Agrupado por indicador × año, ordenado por cantidad de centros afectados:

| # | Programa | Indicador | Año | Centros | Fuente catálogo | Ubicación (workbook · tab · columnas) | Confianza | Estado cobertura |
|---:|---|---|---:|---:|---|---|---|---|
${gapsPorIndicador.map((g, i) => {
  const src = [g.sourceWorkbookId, g.sourceTab, g.sourceColumns].filter(Boolean).join(' · ') || '—';
  return `| ${i + 1} | ${g.programa} | ${g.indicadorId} | ${g.anio} | ${g.centros} | ${g.fuente || '—'} | ${src} | ${g.confianza} | ${g.coberturaEstado} |`;
}).join('\n')}

## Notas de método

- La medición usa \`docs/task2-cobertura-matriz.json\` como columna “existe” (auditoría de fuentes
  hecha en Etapa 2, no re-medida aquí para evitar dobles lecturas de Sheets y no volver a tocar
  PII). Cada fila de esa matriz representa una celda del cubo \`(indicador × establecimiento × año)\`.
- La medición usa \`resultados_real\` como columna “mostrado”. Se leen todos los documentos y se
  construye un set con la llave \`(programa, establecimientoId, indicadorId, anio)\`. Un cell se
  marca **existe+mostrado** ↔ la llave está en ese set y la matriz de cobertura reporta el valor
  como existente.
- **Confianza de ubicación**:
  - \`confirmada\`: la matriz de cobertura tiene \`sourceTab\` + \`sourceColumns\` poblados y estado
    \`presente\` o \`parcial\`; también \`ausente-datos\`/\`ausente-acceso\` cuya ubicación es conocida
    aunque el valor no exista/no sea leíble.
  - \`inferida\`: estado \`ausente-mapeo\` (Etapa 2 propuso una columna pero Sebastián debe
    confirmarla). Un \`existe+no-mostrado\` con confianza \`inferida\` requiere revisión antes de
    ser ingresado — la propuesta podría ser incorrecta.
- Se detectan documentos huérfanos en \`resultados_real\` que no calcen con ninguna fila de la
  matriz (typos de id, ediciones fuera de banda). Se listan pero no se cuentan como
  \`existe+mostrado\`.

## Archivos anexos

- \`docs/auditoria-llenado.csv\` — una fila por \`(programa, indicadorId, establecimientoId, anio)\`.
- \`docs/auditoria-llenado.json\` — misma información en JSON.

## Resumen ejecutivo

- **existe+mostrado**: ${fmt(totalGlobal['existe+mostrado'])} celdas (${pct(totalGlobal['existe+mostrado'], totalGlobal.total)}).
- **existe+no-mostrado**: ${fmt(totalGlobal['existe+no-mostrado'])} celdas (${pct(totalGlobal['existe+no-mostrado'], totalGlobal.total)}). Esta es la brecha recuperable.
- **no-existe**: ${fmt(totalGlobal['no-existe'])} celdas (${pct(totalGlobal['no-existe'], totalGlobal.total)}).
- **no-accesible**: ${fmt(totalGlobal['no-accesible'])} celdas (${pct(totalGlobal['no-accesible'], totalGlobal.total)}).

Top de \`existe+no-mostrado\` (primeros 5 por centros):

${gapsPorIndicador.slice(0, 5).map((g, i) => `${i + 1}. **${g.programa} · ${g.indicadorId} · ${g.anio}** — ${g.centros} centros · fuente: ${g.fuente || '—'} · ubicación: ${g.sourceTab || '—'} (${g.confianza})`).join('\n')}
`;

writeFileSync(path.join(ROOT, 'docs', 'auditoria-llenado.md'), md);
console.log('Wrote docs/auditoria-llenado.md');

console.log('\nDone.');
process.exit(0);
