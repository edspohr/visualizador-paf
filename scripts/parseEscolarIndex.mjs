// Parses docs/Planillas PAF Escolar.xlsx into a version-controlled inventory
// artifact: src/data/escolarPlanillaIndex.json.
//
// Uso:
//   node scripts/parseEscolarIndex.mjs
//
// El artifact declara la lista completa de planillas esperadas por escuela ×
// año × arquetipo × curso, con:
//   - identidad de la escuela (cohorte, sostenedor, comuna, tipo, nombre)
//   - año y arquetipo (Coordinación / UTP / Consultor / curso)
//   - curso en forma canónica y en forma cruda (para trazabilidad)
//   - spreadsheet ID normalizado
//   - URL original completa
//   - "expected", "no-aplica-explicito" o "ausencia-estructural"
//   - hint de gid si estaba presente en el URL (usar sólo como pista;
//     los tabs se resuelven por nombre, no por gid — ver comentario en E1)
//
// El artifact es la fuente única de verdad para el harvest E3 y el
// manifiesto de cobertura E5. No leer las planillas directamente sin pasar
// por acá.

import XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const XLSX_PATH = pathResolve(ROOT, 'docs/Planillas PAF Escolar.xlsx');
const OUT_PATH = pathResolve(ROOT, 'src/data/escolarPlanillaIndex.json');

// ─── Normalización de curso ────────────────────────────────────────────────
// El archivo usa distintos códigos para el mismo curso — PKA, PK-A, PreKA, PA.
// Definimos un conjunto canónico y una función que mapea cualquier raw variant
// a ese conjunto. Toda variante encontrada queda registrada en `variantesCurso`
// para que si aparece una nueva se detecte.

const CANONICAL_CURSOS = [
  'PKA', 'PKB', 'KA', 'KB',
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B',
  '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B', '8C',
];

const variantesCurso = new Map(); // raw → canonical

function normalizarCurso(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().toUpperCase();
  // Quitar acentos, guiones, "PRE" y "º"
  s = s.replace(/º/g, '');
  s = s.replace(/\s+/g, '');
  // Normalize: PK-A → PKA, PRE-KA → PKA, PREKA → PKA, PA → PKA
  s = s.replace(/^PRE-?K/, 'PK');
  s = s.replace(/-/g, '');
  // Handle the 2025-consolidated "PA" convention: PA→PKA, PB→PKB, KA=KA
  if (/^P[AB]$/.test(s)) s = 'PK' + s.slice(-1);
  // Some rows show "1° A", "1º A" — strip degree symbols
  s = s.replace(/[°ºª]/g, '');
  const found = CANONICAL_CURSOS.find(c => c === s);
  if (found) return found;
  return null; // unrecognized → caller decides how to handle
}

function recordVariant(raw, canonical) {
  if (raw === null || raw === undefined) return;
  const rawStr = String(raw).trim();
  if (!rawStr) return;
  if (!variantesCurso.has(rawStr)) variantesCurso.set(rawStr, canonical);
}

// ─── Normalización de URL a spreadsheet ID ─────────────────────────────────
// El archivo tiene dos formatos:
//   - https://drive.google.com/open?id=<ID>&usp=drive_copy
//   - https://docs.google.com/spreadsheets/d/<ID>/edit?usp=sharing
// Extraemos el ID canónico y descartamos el gid (sólo lo registramos como hint).

function extraerSpreadsheetId(url) {
  if (typeof url !== 'string') return null;
  let m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function extraerGidHint(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/[?&#]gid=(\d+)/);
  return m ? m[1] : null;
}

// ─── Clasificación de arquetipo ────────────────────────────────────────────
// Por posición de columna en el bloque de un año:
//   col 0 (relativa): Coordinación → arquetipo 'coordinacion' o 'utp'
//                     (el label diferencia; en 2025 muchos son 'Registro UTP',
//                     en 2026 varios son 'Registro Coordinación')
//   col 1 (relativa): Consultor → arquetipo 'consultor'
//   col 2+ (relativa): PKA/PKB/KA/KB/1A/… → arquetipo 'curso'

function clasificarArquetipo(archetipoColHeader, displayText) {
  const h = String(archetipoColHeader || '').toLowerCase();
  const t = String(displayText || '').toLowerCase();
  if (h === 'coordinación' || h === 'coordinacion') {
    if (/utp/.test(t)) return { archetipo: 'registro-utp', subtipo: 'utp' };
    return { archetipo: 'registro-coordinacion', subtipo: 'coordinacion' };
  }
  if (h === 'consultor') return { archetipo: 'datos-consultor', subtipo: null };
  // Otherwise it's a curso column
  return { archetipo: 'curso', subtipo: null };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const wb = XLSX.readFile(XLSX_PATH, { cellStyles: true, sheetStubs: true });
const sheetName = wb.SheetNames[0];
console.log(`[parse-escolar-index] Leyendo hoja "${sheetName}" (nótese: la hoja está mal nombrada como "Planillas PAF PARVULARIO" en el archivo; el contenido es Escolar)`);
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// Fila 0: metadata columns 0-4 (COHORTE, SOSTENEDOR, COMUNA, Tipo, Escuela) +
// bloques de año en cols 5 y 28.
// Fila 1: nombres de columna dentro de cada bloque (Coordinación, Consultor,
// PKA, PKB, KA…).
const row0 = rows[0];
const row1 = rows[1];

// Detectar los bloques de año
const bloqueCols = { 2025: null, 2026: null };
for (let c = 0; c < row0.length; c++) {
  const t = String(row0[c] || '');
  const y = t.match(/(202[56])/);
  if (y) {
    const anio = Number(y[1]);
    if (!bloqueCols[anio]) bloqueCols[anio] = { start: c, end: null };
  }
}
if (bloqueCols[2025]) bloqueCols[2025].end = bloqueCols[2026].start - 1;
if (bloqueCols[2026]) bloqueCols[2026].end = row0.length - 1;
// Trim end back until we find the last column with something in row1 within the block
for (const anio of [2025, 2026]) {
  const b = bloqueCols[anio];
  if (!b) continue;
  while (b.end > b.start && !row1[b.end]) b.end--;
}
console.log('[parse-escolar-index] Bloques:', bloqueCols);

// ─── Recorrer filas de escuela (rows 2–19) ─────────────────────────────────
const entries = [];
const linksConsolidados = [];
const inconsistenciasNoAplica = []; // cohorte 2026-2028 con blank donde debería ir No aplica

for (let r = 2; r < rows.length; r++) {
  const row = rows[r] || [];
  const escuela = row[4];
  if (!escuela || !String(escuela).trim()) {
    // Not a school row — check if it's one of the consolidated links (rows 22, 23)
    for (let c = 0; c < row.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.l?.Target) {
        const t = cell.l.Target;
        const id = extraerSpreadsheetId(t);
        if (id) {
          linksConsolidados.push({
            row: r,
            col: c,
            displayText: row[c] ? String(row[c]) : null,
            label: row[0] ? String(row[0]) : null,
            url: t,
            spreadsheetId: id,
          });
        }
      }
    }
    continue;
  }
  const cohorte = String(row[0] || '').trim();
  const sostenedor = String(row[1] || '').trim();
  const comuna = String(row[2] || '').trim();
  const tipo = String(row[3] || '').trim();
  const nombreEscuela = String(escuela).trim();

  for (const anio of [2025, 2026]) {
    const bloque = bloqueCols[anio];
    if (!bloque) continue;

    for (let c = bloque.start; c <= bloque.end; c++) {
      const colHeader = row1[c];
      if (!colHeader) continue;

      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellAddr];
      const displayText = row[c] !== undefined ? row[c] : null;

      const { archetipo, subtipo } = clasificarArquetipo(colHeader, displayText);
      const cursoRaw = archetipo === 'curso' ? String(colHeader).trim() : null;
      const cursoCanonical = cursoRaw ? normalizarCurso(cursoRaw) : null;
      if (cursoRaw) recordVariant(cursoRaw, cursoCanonical);

      // Also record the display text's curso variant (Row 19 shows PK-A_Platon etc)
      if (displayText && typeof displayText === 'string') {
        const dtCurso = displayText.match(/^(PK-?[AB]|K[AB]|[1-8][°º]?\s*[ABC]|PRE-?K[AB])\b/i);
        if (dtCurso) recordVariant(dtCurso[1], normalizarCurso(dtCurso[1]));
      }

      let estado; // 'expected' | 'no-aplica-explicito' | 'ausencia-estructural'
      let url = null;
      let spreadsheetId = null;
      let gidHint = null;

      if (cell?.l?.Target) {
        url = String(cell.l.Target);
        spreadsheetId = extraerSpreadsheetId(url);
        gidHint = extraerGidHint(url);
        estado = 'expected';
      } else if (displayText && /no\s*aplica/i.test(String(displayText))) {
        estado = 'no-aplica-explicito';
      } else if (displayText === null || String(displayText).trim() === '') {
        estado = 'ausencia-estructural';
        // Detect inconsistency: cohorte 2026-2028 in 2025 block should be No aplica
        if (anio === 2025 && cohorte === '2026-2028') {
          inconsistenciasNoAplica.push({ escuela: nombreEscuela, cohorte, anio, col: c, colHeader: String(colHeader) });
        }
      } else {
        // Some other text — record it for review
        estado = 'ausencia-estructural';
      }

      entries.push({
        anio,
        cohorte,
        sostenedor,
        comuna,
        tipoEstablecimiento: tipo,
        escuela: nombreEscuela,
        arquetipo: archetipo,
        subtipo,
        cursoCanonical,
        cursoRaw,
        colHeader: String(colHeader),
        displayText: displayText !== null ? String(displayText) : null,
        estado,
        spreadsheetId,
        url,
        gidHint,
      });
    }
  }
}

// ─── Contadores y sanity checks ────────────────────────────────────────────

const stats = {
  totalEntries: entries.length,
  byEstado: {},
  byAnio: {},
  byArquetipo: {},
  linksExpected: entries.filter(e => e.estado === 'expected').length,
  linksConsolidados: linksConsolidados.length,
};
for (const e of entries) {
  stats.byEstado[e.estado] = (stats.byEstado[e.estado] || 0) + 1;
  const k = `${e.anio}`;
  stats.byAnio[k] = (stats.byAnio[k] || 0) + 1;
  const kA = `${e.anio}·${e.arquetipo}`;
  stats.byArquetipo[kA] = (stats.byArquetipo[kA] || 0) + 1;
}

console.log('\n[parse-escolar-index] Stats:');
console.log(JSON.stringify(stats, null, 2));

console.log(`\n[parse-escolar-index] Inconsistencias No-aplica-vs-blank (cohorte 2026-2028 con blank en bloque 2025):`);
console.log(`  Total: ${inconsistenciasNoAplica.length}`);
console.log(`  Primeras 5:`, inconsistenciasNoAplica.slice(0, 5));

console.log(`\n[parse-escolar-index] Variantes de curso encontradas: ${variantesCurso.size}`);
for (const [raw, canonical] of variantesCurso) {
  const mark = canonical ? '✓' : '⚠ no reconocido';
  console.log(`  "${raw}" → ${canonical || 'null'} ${mark}`);
}

console.log(`\n[parse-escolar-index] Links consolidados (rows fuera del roster):`);
for (const l of linksConsolidados) {
  console.log(`  row ${l.row}: "${l.label || l.displayText}" → ${l.spreadsheetId}`);
}

// ─── Sanity assertions ─────────────────────────────────────────────────────

const errs = [];
if (stats.byAnio['2025'] !== 414) errs.push(`Bloque 2025 esperaba 18×23=414 entradas, got ${stats.byAnio['2025']}`);
if (stats.byAnio['2026'] !== 396) errs.push(`Bloque 2026 esperaba 18×22=396 entradas, got ${stats.byAnio['2026']}`);
if (stats.linksExpected !== 466) errs.push(`Esperaba 466 links de planilla, got ${stats.linksExpected}`);
if (stats.linksConsolidados !== 2) errs.push(`Esperaba 2 links consolidados, got ${stats.linksConsolidados}`);
for (const [raw, canonical] of variantesCurso) {
  if (!canonical) errs.push(`Curso raw "${raw}" no reconocido por normalizarCurso`);
}
if (errs.length) {
  console.error('\n❌ Sanity checks fallaron:');
  for (const e of errs) console.error('  -', e);
  process.exit(1);
}

// ─── Escribir artifact ─────────────────────────────────────────────────────

const artifact = {
  generatedAt: new Date().toISOString(),
  source: 'docs/Planillas PAF Escolar.xlsx',
  sheetNameEnArchivo: sheetName,
  notaSobreSheetName:
    'La hoja está mal nombrada como "Planillas PAF PARVULARIO" en el archivo. El contenido es Escolar. ' +
    'Reportar a Sebastián.',
  universo: {
    escuelas: 18,
    cohortes: { '2026-2028': 13, '2025-2027': 5 },
    sostenedores: { 'SLEP Santa Rosa': 9, 'SLEP Los Parques': 5, 'SLEP Santa Corina': 4 },
  },
  bloques: bloqueCols,
  cursosCanonicos: CANONICAL_CURSOS,
  variantesCurso: Object.fromEntries(variantesCurso),
  stats,
  inconsistenciasNoAplicaVsBlank: {
    descripcion:
      'Cohorte 2026-2028 no estaba en el programa en 2025 → esas celdas deberían decir "No aplica" ' +
      'pero están blank. Focus debe uniformarlas. No corregir la fuente desde acá.',
    total: inconsistenciasNoAplica.length,
    ejemplos: inconsistenciasNoAplica.slice(0, 10),
    todas: inconsistenciasNoAplica,
  },
  linksConsolidados,
  entries,
};

writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2));
console.log(`\n[parse-escolar-index] ✅ Wrote ${OUT_PATH}`);
console.log(`   Total entries: ${entries.length}`);
console.log(`   Expected planillas: ${stats.linksExpected}`);
console.log(`   No aplica (explícito): ${stats.byEstado['no-aplica-explicito'] || 0}`);
console.log(`   Ausencia estructural: ${stats.byEstado['ausencia-estructural'] || 0}`);
