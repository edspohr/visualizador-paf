// Etapa 5 — Ingesta Escolar desde los 18 workbooks.
//
// Uso:
//   node scripts/ingestEscolar.mjs                    → escribe a Firestore + reporte
//   node scripts/ingestEscolar.mjs --dry-run          → sólo lectura + reporte
//   node scripts/ingestEscolar.mjs --purge            → borra resultados_real Escolar antes
//   node scripts/ingestEscolar.mjs --schools=Gil,España  → limitar a estas escuelas
//
// Reglas del prompt (Etapa 5):
//   1. Mapeo por PATRÓN de header, NO por posición fija.
//   2. Si el header esperado no calza → NO calcular. Loguear noisily y omitir el indicador
//      para esa escuela (no se emite doc). Un número mal es peor que "sin dato".
//   3. Los 5 genuinamente-ausentes (I10, I13, I14, I39, I49) → no se intenta.
//   4. Encuesta apoderados: tab estructurada pero vacía → "sin dato" (sin error).
//   5. PII (RUT, nombre estudiante/funcionario) se agrega en memoria y se descarta.
//   6. Doc IDs deterministas + set merge:true → idempotente.
//   7. 22 mapeos propuestos (Etapa 2) marcados como `estado: 'provisional'`. Otros
//      (Registro establecimiento, Consultor, Evaluación final actividad) → 'validado'.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PURGE = args.includes('--purge');
const SCHOOL_FILTER = (args.find(a => a.startsWith('--schools=')) || '').split('=')[1]?.split(',').filter(Boolean) || null;

// ─── Init ─────────────────────────────────────────────────────────────────

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const IND_ESC = catalog.indicadores.escolar2026;
const IND_BY_ID = Object.fromEntries(IND_ESC.map(i => [i.id, i]));

// ─── Helpers ──────────────────────────────────────────────────────────────

const AÑO = 2026;
const READS = { count: 0 };
const HEADER_MISMATCHES = [];

async function sheetsGet(fn) {
  // retry once on quota errors with a small pause
  try { return await fn(); } catch (e) {
    const msg = e.errors?.[0]?.message || e.message || '';
    if (/quota/i.test(msg)) {
      await new Promise(r => setTimeout(r, 5000));
      return await fn();
    }
    throw e;
  }
}

async function listFolder(id) {
  const files = [];
  let pageToken;
  do {
    const r = await sheetsGet(() => drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: 500, pageToken,
      supportsAllDrives: true, includeItemsFromAllDrives: true,
    }));
    files.push(...(r.data.files || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function readTab(id, tab, range = 'A1:AZ200') {
  READS.count++;
  const r = await sheetsGet(() => sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `'${tab}'!${range}`,
  }));
  return r.data.values || [];
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function schoolId(name) { return `esc-${slug(name.replace(/^Escuela\s+/i, ''))}`; }

function parseBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (['true', 'verdadero', 'si', 'sí', '1'].includes(s)) return 1;
  if (['false', 'falso', 'no', '0'].includes(s)) return 0;
  return null;
}
function parseNum(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().replace('%', '').replace(',', '.');
  if (/^#\w+!?$/.test(s)) return null;   // #DIV/0! etc.
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function logMismatch(schoolName, indId, expected, tab) {
  HEADER_MISMATCHES.push({ schoolName, indId, expected, tab });
  console.warn(`  ✗ ${schoolName} · ${indId} · esperaba "${expected}" en ${tab} — sin dato`);
}

function findRowByPattern(rows, pattern, colIdx = 0) {
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i]?.[colIdx];
    if (cell && pattern.test(normalize(cell))) return i;
  }
  return -1;
}

function findColByPatterns(header, patterns) {
  for (let i = 0; i < header.length; i++) {
    const h = normalize(header[i]);
    if (!h) continue;
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

// ─── Mappings (tolerant patterns) ─────────────────────────────────────────

// Actividades tab structure (from Etapa 2 direct read):
//  - Group headers in col 1 ("Actividades con Docentes y Directivos", etc.)
//  - Sub-header rows have module/encuentro names in cols 1..N
//  - Data rows have indicator label in col 0, values in cols 1..N
//
// For each mapping:
//   - `label`: regex to match col 0 of the data row
//   - `subCols`: array of {pattern, aggregate} — patterns match sub-header cells; agg selects value
//   - `aggregate`: 'count_true' / 'first_number' / 'first_bool'
//   - `estado`: 'validado' | 'provisional' | 'sin_dato'
//
// If the label row isn't found → sin dato + log.

const ACTIVIDADES = [
  // I1 — Se conforma Equipo de Gestión (Registro establecimiento, validado)
  { id: 'I1',  label: /^se conforma equipo de gestion$/, aggregate: 'first_bool', estado: 'validado', headerHint: 'Se conforma Equipo de Gestión' },
  // I11 — # módulos formativos (Sin esp → provisional; row + 5 cols Módulo I..V)
  { id: 'I11', label: /^modulos formativos$/,           aggregate: 'count_true_from_col1',           estado: 'provisional', headerHint: 'Módulos formativos' },
  // I15 — # formaciones territoriales para docentes (row + 2 cols "1", "2")
  { id: 'I15', label: /^instancias de formacion territorial para docentes$/, aggregate: 'count_true_from_col1', estado: 'provisional', headerHint: 'Instancias de formación territorial para docentes' },
  // I25 — # formaciones apoderados monitores (row + 5 cols)
  { id: 'I25', label: /^instancia de formacion para apoderados monitores$/,  aggregate: 'count_true_from_col1', estado: 'validado',    headerHint: 'Instancia de formación para apoderados monitores' },
  // I36 — nota promedio módulos formativos (single number)
  { id: 'I36', label: /nota promedio de la evaluacion de consejo de profesores/, aggregate: 'first_number_from_col1', estado: 'validado', headerHint: 'Nota promedio de la evaluación de consejo de profesores' },
  // I37 — nota promedio formaciones territoriales (Sin esp → provisional)
  { id: 'I37', label: /nota promedio de la evaluacion de la instancia de formacion docente/, aggregate: 'first_number_from_col1', estado: 'provisional', headerHint: 'Nota promedio de la evaluación de la instancia de formación docente' },
  // I48 — nota promedio formaciones de monitores
  { id: 'I48', label: /nota promedio de la evaluacion de formacion a apoderados monitores/, aggregate: 'first_number_from_col1', estado: 'validado', headerHint: 'Nota promedio de la evaluación de formación a apoderados monitores' },
  // I9 — plan de acción diseñado
  { id: 'I9',  label: /^existe plan de accion familia escuela disenado$/,    aggregate: 'first_bool_from_col1', estado: 'provisional', headerHint: 'Existe plan de acción familia escuela diseñado' },
  // I33 — director cumple meta liderazgo (Consultor, validado)
  { id: 'I33', label: /^director cumple meta de liderazgo planificada$/,     aggregate: 'first_bool_from_col1', estado: 'validado', headerHint: 'Director cumple meta de liderazgo planificada' },
  // I35 — PME y PEI (Provisional Etapa 2)
  { id: 'I35', label: /^plan de accion disenado e incorporado en pme y pei$/, aggregate: 'first_bool_from_col1', estado: 'provisional', headerHint: 'Plan de acción diseñado e incorporado en PME y PEI' },
  // I38 — sistema planificación entrevistas
  { id: 'I38', label: /^existe en el establecimiento un sistema de planificacion, pauta y monitoreo de entrevistas para apoderados que cumple con estandares paf$/, aggregate: 'first_bool_from_col1', estado: 'provisional', headerHint: 'Existe en el establecimiento un sistema de planificación…' },
  // I34 — % cumplimiento plan de acción
  { id: 'I34', label: /^porcentaje de cumplimiento del plan de accion familia escuela$/, aggregate: 'first_number_from_col1', estado: 'provisional', headerHint: 'Porcentaje de cumplimiento del plan de acción familia escuela' },
];

// For "Director asiste" / "Coordinador asiste" the value depends on sub-header columns.
// This needs the previous sub-header row context.
const ACTIVIDADES_MULTI = [
  // I8  — Director asiste (Reunión director/a col)         provisional
  { id: 'I8',  label: /^director asiste$/, subCol: /reunion director\/?a/,             aggregate: 'first_bool', estado: 'provisional', headerHint: 'Director asiste × Reunión director/a' },
  // I6  — Director asiste (Encuentro territorial I & II)   Consultor, validado
  { id: 'I6',  label: /^director asiste$/, subCols: [/encuentro territorial i$/, /encuentro territorial ii$/], aggregate: 'count_true', estado: 'validado', headerHint: 'Director asiste × Encuentro territorial I+II' },
  // I17 — Director asiste (Encuentro territorial I & II)   Sin esp → provisional (mismo dato que I6; catálogo lo lista separado)
  { id: 'I17', label: /^director asiste$/, subCols: [/encuentro territorial i$/, /encuentro territorial ii$/], aggregate: 'count_true', estado: 'provisional', headerHint: 'Director asiste × Encuentro territorial I+II' },
  // I7  — Coordinador asiste (Encuentro territorial I & II)  Sin esp → provisional
  { id: 'I7',  label: /^coordinador asiste$/, subCols: [/encuentro territorial i$/, /encuentro territorial ii$/], aggregate: 'count_true', estado: 'provisional', headerHint: 'Coordinador asiste × Encuentro territorial I+II' },
  // I18 — Coordinador asiste (Encuentro territorial I & II)  Sin esp → provisional (mismo que I7)
  { id: 'I18', label: /^coordinador asiste$/, subCols: [/encuentro territorial i$/, /encuentro territorial ii$/], aggregate: 'count_true', estado: 'provisional', headerHint: 'Coordinador asiste × Encuentro territorial I+II' },
];

// ─── Actividades tab reader ───────────────────────────────────────────────

function subHeaderRowFor(rows, dataRowIdx) {
  // find the closest sub-header row above dataRowIdx that has multiple non-empty cells
  // in cols 1..N and col 0 empty.
  for (let i = dataRowIdx - 1; i >= 0; i--) {
    const r = rows[i] || [];
    const col0 = String(r[0] || '').trim();
    const other = r.slice(1).filter(v => v && String(v).trim());
    if (!col0 && other.length >= 2) return i;
  }
  return -1;
}

function ingestActividades(rows, schoolName, wbId, wbLabel) {
  const results = [];
  for (const spec of ACTIVIDADES) {
    const rowIdx = findRowByPattern(rows, spec.label);
    if (rowIdx < 0) { logMismatch(schoolName, spec.id, spec.headerHint, 'Actividades'); continue; }
    const row = rows[rowIdx] || [];
    let valor = null, raw = '';
    const cols = row.slice(1);
    if (spec.aggregate === 'count_true_from_col1') {
      const bools = cols.map(parseBool).filter(v => v !== null);
      valor = bools.filter(v => v === 1).length;
      raw = cols.join('|');
    } else if (spec.aggregate === 'first_bool_from_col1' || spec.aggregate === 'first_bool') {
      const b = cols.map(parseBool).find(v => v !== null);
      valor = b ?? null;
      raw = String(cols.find(v => v != null) ?? '');
    } else if (spec.aggregate === 'first_number_from_col1') {
      const n = cols.map(parseNum).find(v => v !== null);
      valor = n ?? null;
      raw = String(cols.find(v => v != null) ?? '');
    }
    if (valor === null) { logMismatch(schoolName, spec.id, spec.headerHint + ' (celda vacía)', 'Actividades'); continue; }
    results.push({ indId: spec.id, valor, raw, estado: spec.estado, tab: 'Actividades', row: rowIdx + 1, wbId, wbLabel });
  }

  // Multi-col specs: need sub-header row
  for (const spec of ACTIVIDADES_MULTI) {
    const rowIdx = findRowByPattern(rows, spec.label);
    if (rowIdx < 0) { logMismatch(schoolName, spec.id, spec.headerHint, 'Actividades'); continue; }
    const shIdx = subHeaderRowFor(rows, rowIdx);
    if (shIdx < 0) { logMismatch(schoolName, spec.id, `${spec.headerHint} (sin sub-header)`, 'Actividades'); continue; }
    const subHeader = (rows[shIdx] || []).slice(1);
    const dataRow = (rows[rowIdx] || []).slice(1);
    const targetPatterns = spec.subCols || [spec.subCol];
    const cols = targetPatterns.map(p => subHeader.findIndex(h => p.test(normalize(h))));
    if (cols.some(i => i < 0)) { logMismatch(schoolName, spec.id, `${spec.headerHint} (columnas ${targetPatterns.map(p=>p.source).join(', ')})`, 'Actividades'); continue; }
    const values = cols.map(i => dataRow[i]);
    let valor = null;
    if (spec.aggregate === 'count_true') {
      valor = values.map(parseBool).filter(v => v === 1).length;
    } else if (spec.aggregate === 'first_bool') {
      const b = values.map(parseBool).find(v => v !== null);
      valor = b ?? null;
    }
    if (valor === null) { logMismatch(schoolName, spec.id, `${spec.headerHint} (celdas vacías)`, 'Actividades'); continue; }
    results.push({ indId: spec.id, valor, raw: values.join('|'), estado: spec.estado, tab: 'Actividades', row: rowIdx + 1, wbId, wbLabel });
  }
  return results;
}

// ─── Reuniones equipo de Gestión tab ──────────────────────────────────────

function ingestReuniones(rows, schoolName, wbId, wbLabel) {
  // Expected structure:
  //   row 0: ['', 'Equipo de Coordinación']
  //   row 1: ['N', 'Nombre', 'Cargo', 'Asistencia sesiones']
  //   row 2: ['', '', '', '1', '2', ..., '13']
  //   row 3+: ['1', 'name', 'Cargo', TRUE/FALSE × 13]
  // NEVER persist Nombre. Only use Cargo + booleans.
  const results = [];
  const hdrIdx = findRowByPattern(rows, /^n$/, 0);
  if (hdrIdx < 0) { logMismatch(schoolName, 'I2', 'header con "N | Nombre | Cargo | Asistencia sesiones"', 'Reuniones equipo de Gestión'); return results; }
  const header = rows[hdrIdx] || [];
  const cargoCol = header.findIndex(h => /^cargo$/i.test(String(h || '').trim()));
  if (cargoCol < 0) { logMismatch(schoolName, 'I2', 'columna "Cargo"', 'Reuniones equipo de Gestión'); return results; }
  // sub-header row: session numbers 1..N in cols after cargoCol
  const subHdrIdx = hdrIdx + 1;
  const subHeader = rows[subHdrIdx] || [];
  const sessionCols = [];
  for (let j = cargoCol + 1; j < subHeader.length; j++) {
    const v = String(subHeader[j] || '').trim();
    if (/^\d+$/.test(v)) sessionCols.push(j);
  }
  if (!sessionCols.length) { logMismatch(schoolName, 'I2', 'sesiones numeradas 1..13', 'Reuniones equipo de Gestión'); return results; }

  // Iterate data rows; aggregate per cargo. Discard Nombre in memory.
  const perCargo = new Map(); // cargo → { totalTrueBySession, count }
  const sessionAnyTrue = new Array(sessionCols.length).fill(false);
  for (let i = subHdrIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const cargoRaw = String(r[cargoCol] || '').trim();
    if (!cargoRaw) continue;   // empty person row
    const cargoKey = normalize(cargoRaw);
    const entry = perCargo.get(cargoKey) || { attendance: [], nombre: cargoRaw };
    const attendance = sessionCols.map(j => parseBool(r[j]) || 0);
    entry.attendance.push(attendance);
    perCargo.set(cargoKey, entry);
    for (let s = 0; s < sessionCols.length; s++) if (attendance[s] === 1) sessionAnyTrue[s] = true;
  }

  // I2: número de reuniones = count of sessions with ≥1 person present
  {
    const valor = sessionAnyTrue.filter(Boolean).length;
    results.push({ indId: 'I2', valor, raw: `${valor}/${sessionCols.length} sesiones con asistencia`, estado: 'validado', tab: 'Reuniones equipo de Gestión', row: subHdrIdx + 1, wbId, wbLabel });
  }
  // I3: % asistencia directores → filas cargo=directora, promedio de asistencia sobre sesiones celebradas
  const attendMean = (attendanceArr) => {
    if (!attendanceArr.length) return null;
    const flat = attendanceArr.flat();
    return flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : null;
  };
  const directores = [...perCargo.entries()].filter(([k]) => /director/i.test(k));
  if (directores.length) {
    const arr = directores.flatMap(([, e]) => e.attendance);
    const v = attendMean(arr);
    if (v !== null) results.push({ indId: 'I3', valor: v, raw: `${directores.length} personas cargo Director/a`, estado: 'provisional', tab: 'Reuniones equipo de Gestión', row: subHdrIdx + 1, wbId, wbLabel });
    else logMismatch(schoolName, 'I3', 'asistencia directores (sin datos)', 'Reuniones equipo de Gestión');
  } else logMismatch(schoolName, 'I3', 'personas con Cargo=Director/a', 'Reuniones equipo de Gestión');

  const coordinadores = [...perCargo.entries()].filter(([k]) => /coordinador/i.test(k));
  if (coordinadores.length) {
    const arr = coordinadores.flatMap(([, e]) => e.attendance);
    const v = attendMean(arr);
    if (v !== null) results.push({ indId: 'I4', valor: v, raw: `${coordinadores.length} personas cargo Coordinador`, estado: 'provisional', tab: 'Reuniones equipo de Gestión', row: subHdrIdx + 1, wbId, wbLabel });
    else logMismatch(schoolName, 'I4', 'asistencia coordinadores (sin datos)', 'Reuniones equipo de Gestión');
  } else logMismatch(schoolName, 'I4', 'personas con Cargo=Coordinador', 'Reuniones equipo de Gestión');

  // I5 — número de reuniones de coordinación. Semántica ambigua (mismo tab). Marcamos provisional
  // usando el mismo total de sesiones con asistencia. Sebastián debe confirmar la semántica.
  {
    const valor = sessionAnyTrue.filter(Boolean).length;
    results.push({ indId: 'I5', valor, raw: 'igual que I2 — confirmar semántica', estado: 'provisional', tab: 'Reuniones equipo de Gestión', row: subHdrIdx + 1, wbId, wbLabel });
  }
  return results;
}

// ─── Datos docentes tab ───────────────────────────────────────────────────

function ingestDatosDocentes(rows, schoolName, wbId, wbLabel) {
  const results = [];
  // Structure known from Etapa 2:
  //   row 0: group labels ('Información equipo', 'Actividad de sensibilización', 'Instancias de formación', 'Consejos de Profesores')
  //   row 1: sub-labels    ('' … '', '1', '2', 'CD1', 'CD2', 'CD3', 'CD4')
  //   row 2: header con 'RBD', 'Rut funcionario', 'Nombre funcionario', 'Cargo', 'Curso', 'Letra', 'Activo', ...
  //          → data starts row 3+
  //
  // Estrategia: buscar la fila con 'Cargo' (header). Los sub-labels (CD1..CD4, 1, 2) están 1 fila arriba.
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    if ((rows[i] || []).some(h => /^cargo$/i.test(String(h || '').trim()))) { hdrIdx = i; break; }
  }
  if (hdrIdx < 0) { logMismatch(schoolName, 'I12', 'header con "Cargo"', 'Datos docentes'); return results; }
  const header = rows[hdrIdx] || [];
  const subLabels = rows[hdrIdx - 1] || [];   // CD1..CD4 y "1", "2" viven aquí
  const groupLabels = hdrIdx >= 2 ? (rows[hdrIdx - 2] || []) : [];
  const cargoCol = header.findIndex(h => /^cargo$/i.test(String(h || '').trim()));
  const activoCol = header.findIndex(h => /^activo$/i.test(String(h || '').trim()));

  // CD1..CD4: usar subLabels
  const cdCols = subLabels.map((h, i) => /^cd\d+$/i.test(String(h || '').trim()) ? i : -1).filter(i => i >= 0);
  // Instancias de formación: subLabel '1' o '2' bajo group 'Instancias de formación'.
  // Alternativa robusta: buscar en groupLabels dónde arranca 'Instancias de formación' y extraer los 2 cols siguientes cuyo subLabel sea numérico.
  const insCols = [];
  const groupIns = groupLabels.findIndex(h => /instancias de formaci[oó]n/i.test(String(h || '')));
  if (groupIns >= 0) {
    for (let j = groupIns; j < subLabels.length; j++) {
      const v = String(subLabels[j] || '').trim();
      if (/^\d+$/.test(v)) insCols.push(j);
      if (insCols.length >= 2) break;
    }
  }
  // Discard PII cols: don't touch Rut/Nombre.

  // I12 — % docentes que asisten a módulos formativos (mean over docentes, CD1..CD4)
  if (cdCols.length) {
    const rowsData = rows.slice(hdrIdx + 1).filter(r => r && String(r[cargoCol] || '').trim());
    const docenteRows = rowsData.filter(r => /docente|prof/i.test(String(r[cargoCol] || '')) && (activoCol < 0 || /si|sí|1|activo/i.test(String(r[activoCol] || ''))));
    if (docenteRows.length) {
      // avg over docentes of (sum of TRUE across CD1..CD4 / #cdCols)
      const per = docenteRows.map(r => {
        const bools = cdCols.map(c => parseBool(r[c])).filter(v => v !== null);
        if (!bools.length) return null;
        return bools.filter(v => v === 1).length / bools.length;
      }).filter(v => v !== null);
      if (per.length) {
        const valor = per.reduce((a, b) => a + b, 0) / per.length;
        results.push({ indId: 'I12', valor, raw: `mean over ${per.length} docentes activos`, estado: 'validado', tab: 'Datos docentes', row: hdrIdx + 1, wbId, wbLabel });
      } else logMismatch(schoolName, 'I12', 'columnas CD1..CD4 con datos', 'Datos docentes');
    } else logMismatch(schoolName, 'I12', 'filas con Cargo=Docente/Prof.', 'Datos docentes');
  } else logMismatch(schoolName, 'I12', 'columnas CD1..CD4', 'Datos docentes');

  // I16 — % profesores jefe asisten formaciones territoriales (Sin esp → provisional)
  if (insCols.length) {
    const rowsData = rows.slice(hdrIdx + 1).filter(r => r && String(r[cargoCol] || '').trim());
    const profJefeRows = rowsData.filter(r => /prof.*jefe|profesor.*jefe/i.test(String(r[cargoCol] || '')));
    // Si no hay explícitamente "Prof. Jefe" en Cargo, la Central no lo distingue → provisional sobre docentes
    const target = profJefeRows.length ? profJefeRows : rowsData.filter(r => /docente|prof/i.test(String(r[cargoCol] || '')));
    if (target.length) {
      const per = target.map(r => {
        const bools = insCols.map(c => parseBool(r[c])).filter(v => v !== null);
        if (!bools.length) return null;
        return bools.filter(v => v === 1).length / bools.length;
      }).filter(v => v !== null);
      if (per.length) {
        const valor = per.reduce((a, b) => a + b, 0) / per.length;
        results.push({
          indId: 'I16', valor, estado: 'provisional', tab: 'Datos docentes', row: hdrIdx + 1, wbId, wbLabel,
          raw: `mean over ${per.length} ${profJefeRows.length ? 'prof. jefe' : 'docentes (fallback)'}`,
        });
      } else logMismatch(schoolName, 'I16', 'columnas Instancias de formación 1/2 con datos', 'Datos docentes');
    } else logMismatch(schoolName, 'I16', 'filas Prof. Jefe / Docente', 'Datos docentes');
  } else logMismatch(schoolName, 'I16', 'columnas Instancias de formación 1, 2', 'Datos docentes');
  return results;
}

// ─── Registro Coordinación per-course tabs (aggregate over 20 sub-workbooks) ─
// El header de PKA..8B varía en columnas por escuela. Uso patrones.
//
// Columnas objetivo:
//   - Activo (para excluir 'NO')
//   - Entrevistas de apoderados > anual  → I19, I20
//   - Encuentro 1..4 (asistencia)         → contextual, no ingesta directa
//   - Monitores formado                    → I26
//   - Monitores activos                    → I27, I47
//   - Talleres TF1..TF4 (asistencia)      → I40, I41
//   - Número de Bibliotecas Viajeras enviadas → I28
//
// Se descartan RUT + Nombre en memoria; sólo se persisten conteos y promedios.

const COURSE_ORDER = ['PKA','PKB','KA','KB','1A','1B','2A','2B','3A','3B','4A','4B','5A','5B','6A','6B','7A','7B','8A','8B'];

async function ingestCoursesRC(schoolName, rcId, wbLabel) {
  const results = [];
  // Read the 20 per-course tabs via batchGet where possible
  const ranges = COURSE_ORDER.map(t => `'${t}'!A1:AZ200`);
  READS.count++;
  let batch;
  try {
    batch = await sheetsGet(() => sheets.spreadsheets.values.batchGet({ spreadsheetId: rcId, ranges }));
  } catch (e) {
    logMismatch(schoolName, 'I19', `batchGet cursos: ${e.errors?.[0]?.message || e.message}`, 'RC per-course');
    return results;
  }

  // Aggregates per school
  let totalStudents = 0;
  let with1Entrev = 0, with2Entrev = 0;
  let monitorFormado = 0;
  const salasWithMonitorActivo = new Set();
  const salasWithMonitorActivoCount = new Map();  // sala → # monitores activos
  const monitoresActivosPerSala = new Map();
  let bvSalas = [];   // for I28 mean
  let tallerPerStudent = [];  // for I40, I41
  const missing = new Set();  // tabs that failed

  for (let idx = 0; idx < COURSE_ORDER.length; idx++) {
    const sala = COURSE_ORDER[idx];
    const rangeResult = batch.data.valueRanges?.[idx];
    const rows = rangeResult?.values;
    if (!rows || !rows.length) { missing.add(sala); continue; }

    // Header rows can be at row 0 or 1. Row 1 typically has "RBD", "Rut estudiante", "Nombre alumno"...
    // Data starts after that.
    let hdrIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 3); i++) {
      if ((rows[i] || []).some(h => /^activo$/i.test(String(h || '').trim()))) { hdrIdx = i; break; }
    }
    const header = rows[hdrIdx] || [];
    const activoCol = header.findIndex(h => /^activo$/i.test(String(h || '').trim()));
    const entrAnualCol = header.findIndex(h => /^anual$/i.test(String(h || '').trim()));
    const monitorFormadoCol = -1;   // this label lives in the group-header row 0 (spans many cols); count TRUE in the exact col
    const bvCol = header.findIndex(h => /(asistencia\s+total|asistencia total)/i.test(String(h || '').trim()));
    // Group header row 0 has spans; we'll match values by group label + sub-header col name
    const gh = rows[0] || [];
    // BV col: look for "Número de Bibliotecas Viajeras" in row 0 → then that col in header row hosts data
    // Simpler: find in row 0 the col that contains "Biblioteca"
    let bvCandidate = -1;
    for (let j = 0; j < gh.length; j++) {
      if (/bibliotec/i.test(String(gh[j] || ''))) { bvCandidate = j; break; }
    }
    // Monitores activos col: in row 0 has "Monitores activos"
    let monActivosCol = -1;
    for (let j = 0; j < gh.length; j++) {
      if (/monitores activos/i.test(String(gh[j] || ''))) { monActivosCol = j; break; }
    }
    // Monitores formado col in row 0
    let monFormadoCol = -1;
    for (let j = 0; j < gh.length; j++) {
      if (/monitores formado/i.test(String(gh[j] || ''))) { monFormadoCol = j; break; }
    }
    // TF cols: row hdrIdx has "Taller ..." labels or TF1..TF4; count TRUE per student
    const tfCols = [];
    for (let j = 0; j < header.length; j++) {
      const h = normalize(header[j]);
      if (/^tf[1-4]\b/.test(h) || /taller\s*(presencial|entre familias|entre-familias|entrefamilias)/i.test(h)) {
        tfCols.push(j);
      }
    }

    if (activoCol < 0) { missing.add(sala); continue; }

    // Iterate students; discard PII (never store Rut/Nombre).
    let salaMonActivosCount = 0;
    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const activo = String(r[activoCol] || '').trim();
      if (!/^(si|sí|1|activo|s)$/i.test(activo)) continue;   // excluir retirados
      totalStudents++;
      // I19/I20 — entrevistas anual col: numeric count of entrevistas per estudiante
      if (entrAnualCol >= 0) {
        const n = parseNum(r[entrAnualCol]);
        if (n !== null) {
          if (n >= 1) with1Entrev++;
          if (n >= 2) with2Entrev++;
        }
      }
      // I26 — monitores formado
      if (monFormadoCol >= 0) {
        const v = parseBool(r[monFormadoCol]);
        if (v === 1) monitorFormado++;
      }
      // I27 / I47 — monitor activo per sala
      if (monActivosCol >= 0) {
        const v = parseBool(r[monActivosCol]);
        if (v === 1) { salaMonActivosCount++; salasWithMonitorActivo.add(sala); }
      }
      // I40/I41 — TF asistencia
      if (tfCols.length) {
        const tfBools = tfCols.map(c => parseBool(r[c])).filter(v => v !== null);
        tallerPerStudent.push({ atLeastOne: tfBools.some(v => v === 1) ? 1 : 0, allFour: tfBools.length >= 4 && tfBools.every(v => v === 1) ? 1 : 0 });
      }
    }
    if (salaMonActivosCount) monitoresActivosPerSala.set(sala, salaMonActivosCount);
    // I28 — número BV enviadas por sala: sum across students of that col
    if (bvCandidate >= 0) {
      let salaBV = 0;
      for (let i = hdrIdx + 1; i < rows.length; i++) {
        const n = parseNum(rows[i]?.[bvCandidate]);
        if (n !== null) salaBV += n;
      }
      bvSalas.push(salaBV);
    }
  }

  if (missing.size) logMismatch(schoolName, 'I19', `${missing.size} salas sin header 'Activo' (${[...missing].slice(0,4).join(',')}...)`, 'RC per-course');

  // Emit I19, I20
  if (totalStudents > 0) {
    results.push({ indId: 'I19', valor: with1Entrev / totalStudents, raw: `${with1Entrev}/${totalStudents} estudiantes activos`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (entrevistas anual)', row: 0, wbId: rcId, wbLabel });
    results.push({ indId: 'I20', valor: with2Entrev / totalStudents, raw: `${with2Entrev}/${totalStudents}`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (entrevistas anual)', row: 0, wbId: rcId, wbLabel });
  } else logMismatch(schoolName, 'I19', 'ningún estudiante activo detectado', 'RC per-course');

  // I26 — # apoderados monitores formados (validado)
  if (monitorFormado > 0) {
    results.push({ indId: 'I26', valor: monitorFormado, raw: `${monitorFormado} estudiantes con monitor formado`, estado: 'validado', tab: 'Registro Coordinación · PKA..8B (Monitores formado)', row: 0, wbId: rcId, wbLabel });
  }
  // I27 — % salas cubiertas por apoderados monitores (provisional).
  // El catálogo declara este indicador como % con meta=100% (todas las salas
  // cubiertas), así que emitimos la fracción salasCubiertas / totalSalas.
  if (salasWithMonitorActivo.size > 0 && COURSE_ORDER.length > 0) {
    const fraccion = salasWithMonitorActivo.size / COURSE_ORDER.length;
    results.push({ indId: 'I27', valor: fraccion, raw: `${salasWithMonitorActivo.size}/${COURSE_ORDER.length} salas`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (Monitores activos)', row: 0, wbId: rcId, wbLabel });
  }
  // I47 — # apoderados monitores que implementaron taller (validado)
  const totalMonActivos = [...monitoresActivosPerSala.values()].reduce((a, b) => a + b, 0);
  if (totalMonActivos > 0) {
    results.push({ indId: 'I47', valor: totalMonActivos, raw: `${totalMonActivos} monitores activos totales`, estado: 'validado', tab: 'Registro Coordinación · PKA..8B (Monitores activos)', row: 0, wbId: rcId, wbLabel });
  }
  // I28 — cantidad semanas envío BV por sala (mean)
  if (bvSalas.length) {
    const valor = bvSalas.reduce((a, b) => a + b, 0) / bvSalas.length;
    results.push({ indId: 'I28', valor, raw: `mean over ${bvSalas.length} salas`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (Bibliotecas Viajeras)', row: 0, wbId: rcId, wbLabel });
  }
  // I40, I41 — % apoderados con ≥1 y con 4/4 talleres
  if (tallerPerStudent.length) {
    const atLeast = tallerPerStudent.filter(t => t.atLeastOne).length;
    const all4 = tallerPerStudent.filter(t => t.allFour).length;
    results.push({ indId: 'I40', valor: atLeast / tallerPerStudent.length, raw: `${atLeast}/${tallerPerStudent.length}`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (Talleres TF1..4)', row: 0, wbId: rcId, wbLabel });
    results.push({ indId: 'I41', valor: all4 / tallerPerStudent.length, raw: `${all4}/${tallerPerStudent.length}`, estado: 'provisional', tab: 'Registro Coordinación · PKA..8B (Talleres TF1..4)', row: 0, wbId: rcId, wbLabel });
  }
  return results;
}

// ─── Encuesta apoderados — siempre sin dato (tab estructurada pero vacía) ─
// Se documenta como "sin dato" y se agrega al log de mismatches.

const ENCUESTA_INDS = ['I22', 'I29', 'I30', 'I31', 'I42', 'I43', 'I44', 'I45', 'I46'];
function noteEncuestaEmpty(schoolName) {
  for (const id of ENCUESTA_INDS) {
    // Not logged as mismatch since it's expected mid-year; noted separately
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

const SCHOOL_FOLDERS = [
  { cohorte: '2026-2028', folderId: '1lqf3guMNkX5Dy_A8MaDpXIfTi0fZnKQ4', label: 'Planillas de monitoreo año 1, 2026' },
  { cohorte: '2025-2027', folderId: '14M3Bo96abZQ5rcOgJwPqDoNpIR7kizIw', label: 'Planillas de monitoreo año 2, 2026' },
];

// Descubrir 18 escuelas por carpetas
console.log(`Ingesta Escolar — Etapa 5 · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}\n`);
console.log('1) Descubriendo escuelas…');

const schools = [];
for (const bucket of SCHOOL_FOLDERS) {
  const kids = await listFolder(bucket.folderId);
  for (const f of kids) {
    if (f.mimeType !== 'application/vnd.google-apps.folder') continue;
    if (SCHOOL_FILTER && !SCHOOL_FILTER.some(s => f.name.toLowerCase().includes(s.toLowerCase()))) continue;
    schools.push({ name: f.name, cohorte: bucket.cohorte, folderId: f.id });
  }
}
console.log(`   ${schools.length} escuelas encontradas`);

// Para cada escuela, encontrar sus workbooks Datos Consultor y Registro Coordinación
console.log('\n2) Descubriendo workbooks Datos Consultor + Registro Coordinación…');
for (const s of schools) {
  const kids = await listFolder(s.folderId);
  s.dcId = kids.find(k => /_0\. datos consultor$/i.test(k.name))?.id;
  s.rcId = kids.find(k => /_0\. registro coordinaci[oó]n$/i.test(k.name))?.id;
  s.slug = schoolId(s.name);
}
console.log(`   ${schools.filter(s => s.dcId && s.rcId).length}/${schools.length} escuelas con ambos workbooks`);

// Ingesta
console.log('\n3) Leyendo tabs por escuela…');
const allResults = [];
for (const s of schools) {
  if (!s.dcId) { console.warn(`  ✗ ${s.name}: sin Datos Consultor`); continue; }
  console.log(`\n   • ${s.name} (${s.cohorte})`);
  // Datos Consultor · Actividades
  try {
    const rows = await readTab(s.dcId, 'Actividades', 'A1:Z50');
    const res = ingestActividades(rows, s.name, s.dcId, 'Datos Consultor · Actividades');
    for (const r of res) r.establecimientoId = s.slug, r.establecimientoNombre = s.name, r.cohorte = s.cohorte;
    console.log(`      Actividades:                 ${res.length} valores`);
    allResults.push(...res);
  } catch (e) { console.warn(`      Actividades ERROR: ${e.errors?.[0]?.message || e.message}`); }
  // Datos Consultor · Reuniones equipo de Gestión
  try {
    const rows = await readTab(s.dcId, 'Reuniones equipo de Gestión', 'A1:Z50');
    const res = ingestReuniones(rows, s.name, s.dcId, 'Datos Consultor · Reuniones equipo de Gestión');
    for (const r of res) r.establecimientoId = s.slug, r.establecimientoNombre = s.name, r.cohorte = s.cohorte;
    console.log(`      Reuniones equipo Gestión:    ${res.length} valores`);
    allResults.push(...res);
  } catch (e) { console.warn(`      Reuniones ERROR: ${e.errors?.[0]?.message || e.message}`); }
  // Datos Consultor · Datos docentes
  try {
    const rows = await readTab(s.dcId, 'Datos docentes', 'A1:Z100');
    const res = ingestDatosDocentes(rows, s.name, s.dcId, 'Datos Consultor · Datos docentes');
    for (const r of res) r.establecimientoId = s.slug, r.establecimientoNombre = s.name, r.cohorte = s.cohorte;
    console.log(`      Datos docentes:              ${res.length} valores`);
    allResults.push(...res);
  } catch (e) { console.warn(`      Datos docentes ERROR: ${e.errors?.[0]?.message || e.message}`); }
  // Registro Coordinación · per-course tabs
  if (s.rcId) {
    try {
      const res = await ingestCoursesRC(s.name, s.rcId, 'Registro Coordinación · PKA..8B');
      for (const r of res) r.establecimientoId = s.slug, r.establecimientoNombre = s.name, r.cohorte = s.cohorte;
      console.log(`      RC per-course (agg):         ${res.length} valores`);
      allResults.push(...res);
    } catch (e) { console.warn(`      RC per-course ERROR: ${e.errors?.[0]?.message || e.message}`); }
  }
  noteEncuestaEmpty(s.name);
}

// Normaliza el id de indicador a forma canónica con punto ('I1' → 'I.1').
// El catálogo (catalog.json) hoy usa esta forma para escolar y parvulario;
// las líneas `results.push({ indId: 'I19', ... })` de este script usan la forma
// sin punto por herencia. Normalizamos antes del lookup para que ambas coincidan.
function normIndId(id) {
  const m = String(id).match(/^I\.?(\d+)$/);
  return m ? `I.${m[1]}` : id;
}

// Enriquecer con metadatos del catálogo
for (const r of allResults) {
  const normalized = normIndId(r.indId);
  const ind = IND_BY_ID[normalized];
  if (!ind) continue;
  r.programa = 'escolar';
  r.indicadorId = normalized;
  delete r.indId;
  r.ambito = ind.ambito;
  r.anio = AÑO;
  r.periodo = String(AÑO);
  r.meta = ind.meta;
  r.metaNum = ind.metaNum;
  r.unidad = ind.unidad;
  r.logro = ind.metaNum ? Math.max(0, Math.min(1.2, r.valor / ind.metaNum)) : null;
  r.fuente = { workbookId: r.wbId, workbookLabel: r.wbLabel, tab: r.tab, row: r.row };
  delete r.wbId; delete r.wbLabel; delete r.tab; delete r.row;
}

// ─── Purge + write ────────────────────────────────────────────────────────
if (PURGE && !DRY_RUN) {
  console.log('\n4) Purgando resultados_real programa=escolar…');
  const snap = await db.collection('resultados_real').where('programa', '==', 'escolar').get();
  const batch = db.batch();
  let n = 0;
  for (const d of snap.docs) { batch.delete(d.ref); n++; }
  if (n) await batch.commit();
  console.log(`   ${n} docs eliminados`);
}

if (!DRY_RUN) {
  console.log('\n5) Upsert establecimientos_real (Escolar roster mínimo)…');
  let n = 0;
  let batch = db.batch(); let count = 0;
  for (const s of schools) {
    batch.set(db.collection('establecimientos_real').doc(s.slug), {
      programa: 'escolar',
      id: s.slug,
      nombre: s.name,
      cohorte: s.cohorte,
      tipo: 'Escuela',
      fuente: { folderId: s.folderId, dcId: s.dcId, rcId: s.rcId },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    count++; n++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  console.log(`   ${n} establecimientos_real upserted`);

  console.log('\n6) Escribiendo resultados_real…');
  // Solo escribimos los que fueron enriquecidos con éxito (matchearon el catálogo).
  // Cualquier objeto sin `indicadorId` o sin `fuente` es evidencia de un lookup fallido
  // — antes se colaban a Firestore y contaminaban la colección.
  const writable = allResults.filter(r => r.indicadorId && r.fuente);
  const descartados = allResults.length - writable.length;
  if (descartados > 0) {
    console.log(`   ${descartados} filas descartadas (indicador desconocido o sin fuente)`);
  }
  n = 0;
  batch = db.batch(); count = 0;
  for (const r of writable) {
    const docId = `esc_${r.establecimientoId}_${r.indicadorId}_${r.periodo}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    batch.set(db.collection('resultados_real').doc(docId), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  console.log(`   ${n} resultados upserted`);
}

// ─── Verification report ──────────────────────────────────────────────────
console.log('\n7) Reporte de verificación');
// Base el reporte en los que sí fueron enriquecidos con éxito (indicadorId + fuente).
// Los que quedaron sin `indicadorId` (lookup fallido) son ruido para las métricas.
const enriquecidos = allResults.filter(r => r.indicadorId && r.fuente);
const byEstado = enriquecidos.reduce((acc, r) => (acc[r.estado] = (acc[r.estado] || 0) + 1, acc), {});
const uniqueEsts = new Set(enriquecidos.map(r => r.establecimientoId));
const uniqueInds = new Set(enriquecidos.map(r => r.indicadorId));
console.log(`   Total (enriquecidos): ${enriquecidos.length}${enriquecidos.length !== allResults.length ? ` (de ${allResults.length} recolectados)` : ''}`);
console.log(`   Por estado: ${JSON.stringify(byEstado)}`);
console.log(`   Escuelas cubiertas: ${uniqueEsts.size}`);
console.log(`   Indicadores cubiertos: ${uniqueInds.size} — ${[...uniqueInds].sort().join(', ')}`);
console.log(`   Reads a Sheets: ${READS.count}`);
console.log(`   Header mismatches: ${HEADER_MISMATCHES.length}`);

const sample = enriquecidos.slice(0, 5);
console.log('\n   Muestra:');
for (const s of sample) {
  const tab = s.fuente?.tab ?? '(sin fuente)';
  console.log(`     ${s.establecimientoId} · ${s.indicadorId} · ${s.periodo}: valor=${typeof s.valor === 'number' ? s.valor.toFixed(3) : s.valor} logro=${s.logro?.toFixed(2) ?? 'n/a'} estado=${s.estado} tab=${tab}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  totals: {
    resultados: enriquecidos.length,
    resultadosRecolectados: allResults.length,
    porEstado: byEstado,
    escuelasCubiertas: uniqueEsts.size,
    indicadoresCubiertos: uniqueInds.size,
    reads: READS.count,
    headerMismatches: HEADER_MISMATCHES.length,
  },
  indicadoresCubiertos: [...uniqueInds].sort(),
  headerMismatches: HEADER_MISMATCHES,
  muestra: sample,
};
await writeFile(pathResolve(ROOT, 'docs/etapa5-ingesta-escolar.json'), JSON.stringify(report, null, 2));
console.log('\n   Reporte JSON: docs/etapa5-ingesta-escolar.json');
console.log(`\n${DRY_RUN ? 'DRY-RUN completo — no se escribió a Firestore.' : 'Ingesta completa.'}`);
