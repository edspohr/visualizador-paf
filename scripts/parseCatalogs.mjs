// One-time parser: reads the two Excel workbooks in src/data/catalogs/
// and emits a committed catalog.json driving the whole synthetic front-end.
// Run with: node scripts/parseCatalogs.mjs
//
// Emits src/data/catalog.json with schema:
//   {
//     ambitos: { escolar: [...], parvulario: [...] },
//     indicadores: {
//       escolar2025: [...],   // 2025 framework (~50)
//       escolar2026: [...],   // 2026 framework (52)
//       parvulario:  [...],   // single framework (54)
//     }
//   }

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const ESCOLAR_XLSX    = pathResolve(ROOT, 'src/data/catalogs/Sistema indicadores PAF Escolar 2026.xlsx');
const PARVULARIO_XLSX = pathResolve(ROOT, 'src/data/catalogs/Sistema indicadores PAF Parvulario.xlsx');
const OUT_JSON        = pathResolve(ROOT, 'src/data/catalog.json');

// ─── Helpers ──────────────────────────────────────────────────────────────

function readSheet(path, sheetName) {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet not found: ${sheetName} in ${path}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

// Classify meta value: booleano (SI/sí/no), porcentaje (fraction ≤1 or % string), numero (int/float)
function classifyMeta(rawMeta) {
  if (rawMeta === null || rawMeta === undefined || rawMeta === '') {
    return { tipoMeta: 'sin_meta', metaNum: null, metaTexto: '—' };
  }
  if (typeof rawMeta === 'string') {
    const s = rawMeta.trim().toLowerCase();
    if (s === 'si' || s === 'sí' || s === 'sí/no' || s === 'si/no' || s === 'sí (sí/no)') {
      return { tipoMeta: 'booleano', metaNum: 1, metaTexto: 'Sí' };
    }
    if (s === '—' || s === '-' || s === 'no aplica' || s === 'n/a') {
      return { tipoMeta: 'sin_meta', metaNum: null, metaTexto: '—' };
    }
    // Percentage string like "80%"
    const pctMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
    if (pctMatch) {
      const n = Number(pctMatch[1].replace(',', '.'));
      return { tipoMeta: 'porcentaje', metaNum: n / 100, metaTexto: `${n}%` };
    }
    // Numeric string
    const nMatch = s.match(/^\d+(?:[.,]\d+)?$/);
    if (nMatch) {
      const n = Number(s.replace(',', '.'));
      if (n > 0 && n <= 1) return { tipoMeta: 'porcentaje', metaNum: n, metaTexto: `${Math.round(n * 100)}%` };
      return { tipoMeta: 'numero', metaNum: n, metaTexto: `${n}` };
    }
    // Fallback: raw string preserved as sin_meta
    return { tipoMeta: 'sin_meta', metaNum: null, metaTexto: rawMeta };
  }
  if (typeof rawMeta === 'number') {
    if (rawMeta > 0 && rawMeta <= 1) {
      return { tipoMeta: 'porcentaje', metaNum: rawMeta, metaTexto: `${Math.round(rawMeta * 100)}%` };
    }
    return { tipoMeta: 'numero', metaNum: rawMeta, metaTexto: `${rawMeta}` };
  }
  return { tipoMeta: 'sin_meta', metaNum: null, metaTexto: String(rawMeta) };
}

// Map full estrategia string → canonical ámbito id for Escolar 2026/año-2.
// The 2026 framework uses "A1: …", "A2: …", "P1: …", "P3: …" prefixes. Map Products to their A-ámbito counterpart.
function ambitoEscolar2026(estrategia) {
  if (!estrategia) return null;
  const s = String(estrategia).trim();
  if (s.startsWith('A1') || s.startsWith('P1')) return 'A1';
  if (s.startsWith('A2') || s.startsWith('P2:')) {
    // P2 exists twice: "P2: Formación equipos" → A2, "P2: Participación de apoderados" → A3.
    return s.includes('Participación de apoderados') ? 'A3' : 'A2';
  }
  if (s.startsWith('A3') || s.startsWith('P4')) return 'A3';
  if (s.startsWith('P3:')) {
    return s.includes('Fomento lector') ? 'A4' : 'A3';
  }
  if (s.startsWith('A4') || s.startsWith('P5')) return 'A4';
  return null;
}

// Map Escolar 2025 strategy → the 4 canonical Escolar ámbitos so cross-year comparisons work at ámbito level.
function ambitoEscolar2025(estrategia) {
  if (!estrategia) return null;
  const s = String(estrategia).toLowerCase();
  if (s.includes('gestión institucional')) return 'A1';
  if (s.includes('formaciones de profesores') || s.includes('formación de profesores')) return 'A2';
  if (s.includes('entre familias') || s.includes('redcreando') || s.includes('talleres de formación para estudiantes')) return 'A3';
  if (s.includes('mi familia cuenta')) return 'A4';
  return 'A3'; // fallback
}

function tipoActividadOrProducto(comentario, estrategia) {
  const c = String(comentario ?? '').trim().toLowerCase();
  if (c.startsWith('producto')) return 'producto';
  if (c.startsWith('actividad')) return 'actividad';
  // If Comentario is missing, fall back to strategy prefix (2026 uses A vs P)
  const s = String(estrategia ?? '').trim();
  if (s.match(/^P\d/)) return 'producto';
  if (s.match(/^A\d/)) return 'actividad';
  return 'actividad';
}

// Normalize frecuencia strings to a compact canonical set.
function normFrecuencia(raw) {
  if (!raw) return 'anual';
  const s = String(raw).toLowerCase().trim();
  if (s.includes('mensual')) return 'mensual';
  if (s.includes('trimestral')) return 'trimestral';
  if (s.includes('semestral')) return 'semestral';
  if (s.includes('anual')) return 'anual';
  return 'anual';
}

function normFuente(raw) {
  if (!raw) return 'Sin especificar';
  const s = String(raw).trim();
  // Canonicalize common variants
  if (/consultor/i.test(s)) return 'Consultor';
  if (/registro/i.test(s) && /establecimiento/i.test(s)) return 'Registro establecimiento';
  if (/jard[íi]n/i.test(s)) return 'Jardín';
  if (/utp/i.test(s)) return 'UTP';
  if (/encuesta/i.test(s)) return 'Encuesta apoderados';
  return s;
}

// ─── Parse Escolar 2025 ────────────────────────────────────────────────────

function parseEscolar2025() {
  const rows = readSheet(ESCOLAR_XLSX, 'Indicadores año 1, 2025');
  const H = rows[0];
  const idx = {
    estrategia: H.indexOf('Estrategia'),
    actividad: H.indexOf('Actividades/producto'),
    tipoInd: H.indexOf('Tipo de indicador'),
    id: H.indexOf('Indicador'),
    nombre: H.indexOf('Indicador de proceso 1'),
    meta: H.indexOf('Meta'),
    comentario: H.indexOf('Comentario'),
    freq: H.indexOf('Temporalidad de reporte'),
    inicio: H.indexOf('Inicio'),
    fuente: H.indexOf('Fuente'),
    formula: H.indexOf('Fórmula de cálculo'),
  };
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id = row[idx.id];
    if (!id || typeof id !== 'string' || !/^I\d+/i.test(id.trim())) continue;
    const estrategia = row[idx.estrategia];
    // For 2025, a handful of rows (I39–I41) have the nombre cell empty but a valid formula.
    // Synthesize a compact name from the formula + activity so those indicators still ship.
    let nombre = row[idx.nombre];
    if (!nombre) {
      const formula = row[idx.formula];
      const actividad = row[idx.actividad];
      if (formula || actividad) {
        nombre = actividad ? `${actividad}` : String(formula).slice(0, 80);
      } else {
        continue;
      }
    }
    const meta = classifyMeta(row[idx.meta]);
    out.push({
      id: id.trim(),
      programa: 'escolar',
      version: '2025',
      estrategiaId: estrategia ? estrategia.split(':')[0].trim().slice(0, 8) : null,
      estrategiaNombre: estrategia ?? null,
      ambito: ambitoEscolar2025(estrategia),
      actividadNombre: row[idx.actividad] ? String(row[idx.actividad]).trim() : null,
      nombre: String(nombre).trim(),
      meta: meta.metaTexto,
      metaNum: meta.metaNum,
      tipoMeta: meta.tipoMeta,
      unidad: unidadFromTipoMeta(meta.tipoMeta),
      tipo: tipoActividadOrProducto(row[idx.comentario], estrategia),
      fuente: normFuente(row[idx.fuente]),
      frecuencia: normFrecuencia(row[idx.freq]),
      inicio: row[idx.inicio] ?? null,
      clasificacion: tipoActividadOrProducto(row[idx.comentario], estrategia) === 'producto' ? 'producto' : 'estrategia',
    });
  }
  return out;
}

// ─── Parse Escolar 2026 (año 1) ────────────────────────────────────────────

function parseEscolar2026() {
  const rows = readSheet(ESCOLAR_XLSX, 'Indicadores año 1, 2026');
  const H = rows[0];
  const idx = {
    estrategia: H.indexOf('Estrategia'),
    actividad: H.indexOf('Actividades/producto'),
    id: H.indexOf('Indicador 2026'),
    nombre: H.indexOf('Indicador de proceso 1'),
    meta: H.indexOf('Meta'),
    comentario: H.indexOf('Comentario'),
    freq: H.indexOf('Temporalidad de reporte'),
    inicio: H.indexOf('Inicio'),
    fuente: H.indexOf('Fuente'),
  };
  const out = [];
  const seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawId = row[idx.id];
    if (!rawId || typeof rawId !== 'string') continue;
    const id = rawId.trim();
    if (!/^I\d+$/i.test(id)) continue;   // strict: exactly I<digits>
    if (seen.has(id)) continue;
    seen.add(id);
    const estrategia = row[idx.estrategia];
    const nombre = row[idx.nombre];
    if (!nombre) continue;
    const meta = classifyMeta(row[idx.meta]);
    const tipo = tipoActividadOrProducto(row[idx.comentario], estrategia);
    out.push({
      id,
      programa: 'escolar',
      version: '2026',
      estrategiaId: estrategia ? estrategia.split(':')[0].trim() : null,
      estrategiaNombre: estrategia ?? null,
      ambito: ambitoEscolar2026(estrategia),
      actividadNombre: row[idx.actividad] ? String(row[idx.actividad]).trim() : null,
      nombre: String(nombre).trim(),
      meta: meta.metaTexto,
      metaNum: meta.metaNum,
      tipoMeta: meta.tipoMeta,
      unidad: unidadFromTipoMeta(meta.tipoMeta),
      tipo,
      fuente: normFuente(row[idx.fuente]),
      frecuencia: normFrecuencia(row[idx.freq]),
      inicio: row[idx.inicio] ?? null,
      clasificacion: tipo === 'producto' ? 'producto' : 'estrategia',
    });
  }
  return out;
}

// ─── Parse Parvulario ─────────────────────────────────────────────────────

function parseParvulario() {
  const out = [];
  // Sheet 1: Estrategias y Actividades (I.1–I.34)
  const rowsE = readSheet(PARVULARIO_XLSX, 'Ind_ Estrategias y Actividades');
  const HE = rowsE[0];
  const iE = {
    estrId: HE.indexOf('ID_estrategia'),
    estrNombre: HE.indexOf('Nom_Estrategia'),
    actId: HE.indexOf('ID_actividad'),
    actNombre: HE.indexOf('Nom_Actividad'),
    id: HE.indexOf('ID_Indicador'),
    nombre: HE.indexOf('Nom_indicador'),
    meta: HE.indexOf('Meta'),
    freq: HE.indexOf('Frecuencia de reporte'),
    inicio: HE.indexOf('Inicio'),
    fuente: HE.indexOf('Fuente'),
  };
  for (let r = 1; r < rowsE.length; r++) {
    const row = rowsE[r];
    const id = row[iE.id];
    if (!id || typeof id !== 'string' || !/^I\./i.test(id.trim())) continue;
    const meta = classifyMeta(row[iE.meta]);
    out.push({
      id: id.trim(),
      programa: 'parvulario',
      version: '2026',
      estrategiaId: row[iE.estrId] ? String(row[iE.estrId]).trim() : null,
      estrategiaNombre: row[iE.estrNombre] ? String(row[iE.estrNombre]).trim() : null,
      ambito: mapParvularioEstrategiaToAmbito(row[iE.estrId]),
      actividadNombre: row[iE.actNombre] ? String(row[iE.actNombre]).trim() : null,
      nombre: String(row[iE.nombre] ?? '').trim(),
      meta: meta.metaTexto,
      metaNum: meta.metaNum,
      tipoMeta: meta.tipoMeta,
      unidad: unidadFromTipoMeta(meta.tipoMeta),
      tipo: 'actividad',
      fuente: normFuente(row[iE.fuente]),
      frecuencia: normFrecuencia(row[iE.freq]),
      inicio: row[iE.inicio] ?? null,
      clasificacion: 'estrategia',
    });
  }

  // Sheet 2: Productos (I.35–I.54)
  const rowsP = readSheet(PARVULARIO_XLSX, 'Ind_ Productos');
  const HP = rowsP[0];
  const iP = {
    prodId: HP.indexOf('ID_Producto'),
    prodNombre: HP.indexOf('Nom_Productos'),
    id: HP.indexOf('ID_Indicador'),
    nombre: HP.indexOf('Nom_Indicador'),
    meta: HP.indexOf('Meta'),
    freq: HP.indexOf('Frecuencia de reporte'),
    inicio: HP.indexOf('Inicio'),
    fuente: HP.indexOf('Fuente'),
  };
  for (let r = 1; r < rowsP.length; r++) {
    const row = rowsP[r];
    const id = row[iP.id];
    if (!id || typeof id !== 'string' || !/^I\./i.test(id.trim())) continue;
    const meta = classifyMeta(row[iP.meta]);
    out.push({
      id: id.trim(),
      programa: 'parvulario',
      version: '2026',
      estrategiaId: row[iP.prodId] ? String(row[iP.prodId]).trim() : null,
      estrategiaNombre: row[iP.prodNombre] ? String(row[iP.prodNombre]).trim() : null,
      ambito: mapParvularioProductoToAmbito(row[iP.prodId]),
      actividadNombre: row[iP.prodNombre] ? String(row[iP.prodNombre]).trim() : null,
      nombre: String(row[iP.nombre] ?? '').trim(),
      meta: meta.metaTexto,
      metaNum: meta.metaNum,
      tipoMeta: meta.tipoMeta,
      unidad: unidadFromTipoMeta(meta.tipoMeta),
      tipo: 'producto',
      fuente: normFuente(row[iP.fuente]),
      frecuencia: normFrecuencia(row[iP.freq]),
      inicio: row[iP.inicio] ?? null,
      clasificacion: 'producto',
    });
  }
  return out;
}

function mapParvularioEstrategiaToAmbito(estrId) {
  if (!estrId) return null;
  const s = String(estrId).trim().toUpperCase();
  if (s === 'E1') return 'A1';
  if (s === 'E2') return 'A2';
  if (s === 'E3' || s === 'E4' || s === 'E5' || s === 'E6') return 'A3';
  return 'A3';
}

function mapParvularioProductoToAmbito(prodId) {
  if (!prodId) return null;
  const s = String(prodId).trim().toUpperCase();
  if (s === 'P1') return 'A1';
  if (s === 'P2') return 'A2';
  if (s === 'P3' || s === 'P4') return 'A3';
  return 'A3';
}

function unidadFromTipoMeta(tipoMeta) {
  switch (tipoMeta) {
    case 'booleano':   return 'binario';
    case 'porcentaje': return '%';
    case 'numero':     return 'conteo';
    case 'sin_meta':   return 'sin_meta';
    default:           return 'sin_meta';
  }
}

// ─── Ámbitos canónicos ─────────────────────────────────────────────────────

const AMBITOS_ESCOLAR = [
  { id: 'A1', codigo: 'A.1', nombre: 'Liderazgo para la gestión de la alianza familia-escuela', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación de apoderados en el desarrollo y aprendizaje', color: 'lime' },
  { id: 'A4', codigo: 'A.4', nombre: 'Fomento lector y desarrollo del lenguaje en niños, niñas y adolescentes', color: 'navy' },
];

const AMBITOS_PARVULARIO = [
  { id: 'A1', codigo: 'A.1', nombre: 'Gestión institucional de la alianza familia-jardín', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación y formación de apoderados', color: 'lime' },
];

// ─── Main ─────────────────────────────────────────────────────────────────

const escolar2025 = parseEscolar2025();
const escolar2026 = parseEscolar2026();
const parvulario  = parseParvulario();

const CHECKSUMS = {
  escolar2025_expected: 50,
  escolar2026_expected: 52,
  parvulario_expected:  54,
  escolar2025_actual:   escolar2025.length,
  escolar2026_actual:   escolar2026.length,
  parvulario_actual:    parvulario.length,
};

console.log('\nChecksums:');
console.table(CHECKSUMS);

const fails = [];
if (escolar2025.length !== 50) fails.push(`escolar2025 count mismatch: got ${escolar2025.length}, expected 50`);
if (escolar2026.length !== 52) fails.push(`escolar2026 count mismatch: got ${escolar2026.length}, expected 52`);
if (parvulario.length  !== 54) fails.push(`parvulario  count mismatch: got ${parvulario.length}, expected 54`);
if (fails.length) {
  console.error('\n❌ Checksum failures:');
  fails.forEach(f => console.error('  -', f));
  process.exit(1);
}

const catalog = {
  generatedAt: new Date().toISOString(),
  source: {
    escolar:    'src/data/catalogs/Sistema indicadores PAF Escolar 2026.xlsx',
    parvulario: 'src/data/catalogs/Sistema indicadores PAF Parvulario.xlsx',
  },
  ambitos: {
    escolar: AMBITOS_ESCOLAR,
    parvulario: AMBITOS_PARVULARIO,
  },
  indicadores: {
    escolar2025,
    escolar2026,
    parvulario,
  },
  totals: {
    escolar2025: escolar2025.length,
    escolar2026: escolar2026.length,
    parvulario:  parvulario.length,
    headline_2026_plus_parvulario: escolar2026.length + parvulario.length,
  },
};

writeFileSync(OUT_JSON, JSON.stringify(catalog, null, 2));
console.log(`\n✅ Wrote ${OUT_JSON}`);
console.log(`   Total: ${escolar2026.length} escolar 2026 + ${parvulario.length} parvulario = ${escolar2026.length + parvulario.length} headline indicators`);
console.log(`   Plus:  ${escolar2025.length} escolar 2025 (prior-year history)`);
