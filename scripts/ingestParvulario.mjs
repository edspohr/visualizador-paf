// Etapa 3 — Ingesta Parvulario desde las 3 Planillas Centrales.
//
// Uso:
//   node scripts/ingestParvulario.mjs              → escribe a Firestore + reporte
//   node scripts/ingestParvulario.mjs --dry-run    → sólo produce reporte (sin escribir)
//   node scripts/ingestParvulario.mjs --purge      → borra resultados_real Parvulario antes
//
// Colecciones tocadas:
//   config/dataSource                (crea si no existe; NO flip — queda synthetic)
//   establecimientos_real/{jarSlug}  (roster + matrícula desde Bases SCJI, sin PII)
//   resultados_real/{docId}          (valor por indicador × jardín × período)
//
// Fuente:
//   Central 2025-2026·2025 (1KnApSD…) → INDICAD0RES CONSULTOR + IND PRODUCTOS + CONSOLIDADO SALAS
//   Central 2025-2026·2026 (1oJQ8bU…) → CONSOLIDADO JARDÍN + CONSOLIDADO SALAS
//   Central 2026-2027·2026 (1Qr5Qvn…) → CONS. NIVEL JARDÍN + CONS NIVEL SALAS
//                                         (NO CONSOLIDADO CENTRAL JARDÍN — está vacía)
//
// Regla del prompt: SOLO sección indicadores estrategia + productos.
//   NO se lee "progreso por ámbito / objetivo / porcentaje de progreso" (secciones
//   Objetivos/T1..T4/PERIODOS DE IMPLEMENTACIÓN de las pestañas per-jardín tipo AKUN/MODE/PJ).
//
// Sin PII: nunca se persisten RUTs, nombres de estudiantes ni de funcionarios.

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

// ─── Init ─────────────────────────────────────────────────────────────────

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Catálogo ─────────────────────────────────────────────────────────────

const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const IND_PARV = catalog.indicadores.parvulario;
const IND_BY_ID = Object.fromEntries(IND_PARV.map(i => [i.id, i]));

// ─── Helpers ──────────────────────────────────────────────────────────────

async function readTab(id, tab, range = 'A1:AZ500') {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `'${tab}'!${range}`,
  });
  return r.data.values || [];
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Drop parenthetical suffixes ("Cedin (Centro Educacional…)") and trailing punctuation before slugging.
function cleanName(s) {
  return String(s || '').replace(/\s*\(.*?\)\s*/g, '').replace(/[.,;]+$/, '').trim();
}

function jarId(name) {
  return `jar-${slug(cleanName(name))}`;
}

// Parse a cell value using the indicator's unidad.
// Returns { valor: number|null, raw: string, notas?: string }
function parseCell(raw, unidad) {
  if (raw === null || raw === undefined) return { valor: null, raw: '' };
  const s = String(raw).trim();
  if (!s) return { valor: null, raw: '' };
  if (/^(sin datos|no aplica|n\/a|—|-)$/i.test(s)) return { valor: null, raw: s };
  if (/^#(div\/0|value|ref|name|n\/a|num|null)!?$/i.test(s)) return { valor: null, raw: s, notas: 'error de fórmula' };

  if (unidad === 'binario') {
    if (/^(si|sí|true|1|verdadero)$/i.test(s)) return { valor: 1, raw: s };
    if (/^(no|false|0|falso)$/i.test(s)) return { valor: 0, raw: s };
    return { valor: null, raw: s, notas: 'binario no reconocido' };
  }

  // Numeric with comma decimal separator, optional %
  const pctMatch = s.match(/^-?\d+([.,]\d+)?\s*%$/);
  const numMatch = s.match(/^-?\d+([.,]\d+)?$/);
  if (pctMatch) {
    const n = Number(s.replace('%', '').replace(',', '.'));
    if (Number.isFinite(n)) return { valor: n / 100, raw: s };
    return { valor: null, raw: s };
  }
  if (numMatch) {
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n)) {
      if (unidad === '%') return { valor: n > 1.5 ? n / 100 : n, raw: s };
      return { valor: n, raw: s };
    }
  }
  return { valor: null, raw: s };
}

function computeLogro(ind, valor) {
  if (valor === null || valor === undefined) return null;
  if (!ind.metaNum || ind.tipoMeta === 'sin_meta') return null;
  const r = valor / ind.metaNum;
  return Math.max(0, Math.min(1.2, r));
}

// ─── Mapeo por tab de las Planillas Centrales ─────────────────────────────
//
// Cada entrada: nombre-de-columna (match exacto o prefijo tolerante) → indicador.
// `estado: 'validado'` cuando la columna es un match directo 1-a-1 con el catálogo.
// `estado: 'provisional'` cuando hay ambigüedad o el mapeo requiere confirmación.

const MAP = {
  'CONSOLIDADO JARDÍN': {
    // Central 2025-2026 · 2026 · tab CONSOLIDADO JARDÍN
    nombreCol: 'SCJI',
    indicadores: [
      { header: 'N° reuniones con directoras',                                              id: 'I.1',  estado: 'validado' },
      { header: 'N° de reuniones con educadoras',                                           id: 'I.2',  estado: 'validado' },
      { header: 'N° de reuniones territoriales con directoras desarrolladas',                id: 'I.4',  estado: 'validado' },
      { header: '% de directoras que participan en reuniones territoriales',                 id: 'I.5',  estado: 'validado' },
      { header: 'N° reuniones CAUE',                                                        id: 'I.12', estado: 'validado' },
      { header: 'Jardín infantil cuenta con un PLAN de acción integrado al PEI y consistente con PME', id: 'I.35', estado: 'validado' },
      { header: '% de acciones del plan de acción implementadas',                            id: 'I.36', estado: 'validado' },
      { header: '% de metas logradas del plan de acción',                                    id: 'I.37', estado: 'validado' },
      { header: 'SCJI gestiona definición operativa del Rol Educativo de las familias (definida, socializada y evaluada)', id: 'I.39', estado: 'validado' },
      { header: 'Jardín infantil cuenta con una estrategia comunicacional clara y efectiva (multicanal y bidireccional).', id: 'I.44', estado: 'validado' },
    ],
  },
  'CONS. NIVEL JARDÍN': {
    // Central 2026-2027 · 2026 · tab CONS. NIVEL JARDÍN (misma estructura que CONSOLIDADO JARDÍN)
    nombreCol: 'SCJI',
    indicadores: [
      { header: 'N° reuniones con directoras',                                              id: 'I.1',  estado: 'validado' },
      { header: 'N° de reuniones con educadoras',                                           id: 'I.2',  estado: 'validado' },
      { header: 'N° de reuniones territoriales con directoras desarrolladas',                id: 'I.4',  estado: 'validado' },
      { header: '% de directoras que participan en reuniones territoriales',                 id: 'I.5',  estado: 'validado' },
      { header: 'N° reuniones CAUE',                                                        id: 'I.12', estado: 'validado' },
      { header: 'Jardín infantil cuenta con un PLAN de acción integrado al PEI y consistente con PME', id: 'I.35', estado: 'validado' },
      { header: '% de acciones del plan de acción implementadas',                            id: 'I.36', estado: 'validado' },
      { header: '% de metas logradas del plan de acción',                                    id: 'I.37', estado: 'validado' },
      { header: 'SCJI gestiona definición operativa del Rol Educativo de las familias (definida, socializada y evaluada)', id: 'I.39', estado: 'validado' },
      { header: 'Jardín infantil cuenta con una estrategia comunicacional clara y efectiva (multicanal y bidireccional).', id: 'I.44', estado: 'validado' },
    ],
  },
  'INDICAD0RES CONSULTOR': {
    // Central 2025-2026 · 2025 · tab INDICAD0RES CONSULTOR
    nombreCol: 'Identificar sala cuna y/o jardín infantil',
    indicadores: [
      { header: 'N° de reuniones desarrolladas con directora o directora subrogante del jardín infantil.', id: 'I.1', estado: 'validado' },
      { header: 'N° de reuniones desarrolladas con educadoras del jardín infantil.',                       id: 'I.2', estado: 'validado' },
      { header: '% de educadoras que participan en reuniones.',                                             id: 'I.3', estado: 'validado' },
      { header: 'N° de modulos formativos desarrollados en CAUE',                                           id: 'I.12', estado: 'validado' },
      { header: '% de agentes educativas que participan en modulos formativos de CAUE',                     id: 'I.13', estado: 'validado' },
      { header: 'N° de encuentros formativos Entre Familias desarrollados en el JI',                        id: 'I.32', estado: 'validado' },
      { header: 'Promedio de asistencia de apoderados a los encuentros formativos de JI',                   id: 'I.33', estado: 'validado' },
      { header: 'Promedio de asistencia de agentes educativas a los encuentros formativos de JI',           id: 'I.34', estado: 'validado' },
      { header: 'Plan de acción diseñado e incorporado en PME y PEI',                                       id: 'I.35', estado: 'validado' },
      { header: '% de acciones implementadas del plan de acción',                                           id: 'I.36', estado: 'validado' },
      { header: '% de metas logradas del plan de acción',                                                   id: 'I.37', estado: 'validado' },
      { header: 'JI desarrolla definición operativa del Rol Pedagógico',                                    id: 'I.39', estado: 'validado' },
      { header: 'Jardín infantil cuenta con una estrategia comunicacional clara y efectiva (multicanal y bidireccional).', id: 'I.44', estado: 'validado' },
    ],
  },
  'IND PRODUCTOS': {
    // Central 2025-2026 · 2025 · tab IND PRODUCTOS
    nombreCol: 'Identificar sala cuna y/o jardín infantil',
    indicadores: [
      { header: '% de agentes educativas con malla formativa completa.', id: 'I.38', estado: 'validado' },
      { header: '% de salas que desarrollan actividades de Relatos Familiares', id: 'I.40', estado: 'validado' },
      { header: '% de salas que desarrollan experiencias pedagógicas con familias', id: 'I.41', estado: 'validado' },
      { header: '% de salas que realizan procesos de documentación pedagógica con familias', id: 'I.42', estado: 'validado' },
      { header: '% de salas que realizan voluntariados con las familias', id: 'I.43', estado: 'validado' },
    ],
  },
};

// SALAS tabs → aggregate per jardín (mean of numeric cols)
const SALAS = {
  'CONSOLIDADO SALAS': {
    nombreCol: 'SCJI',
    indicadores: [
      { header: 'Promedio anual Reunión apoderados',        id: 'I.47', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura de 1 entrevista de apoderados',  id: 'I.45', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura de 2 entrevistas de apoderados', id: 'I.46', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura Voluntariado',                    id: 'I.50', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura Rol Educativo SEM 2',            id: 'I.51', estado: 'provisional', agg: 'mean' },
    ],
  },
  'CONS NIVEL SALAS': {
    nombreCol: 'SCJI',
    indicadores: [
      { header: 'Promedio anual Reunión apoderados',        id: 'I.47', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura de 1 entrevista de apoderados',  id: 'I.45', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura de 2 entrevistas de apoderados', id: 'I.46', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura Voluntariado',                    id: 'I.50', estado: 'provisional', agg: 'mean' },
      { header: 'Cobertura Rol Educativo SEM 2',            id: 'I.51', estado: 'provisional', agg: 'mean' },
    ],
  },
};

// Match header text tolerantly: case-insensitive, whitespace-collapsed
function normHeader(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findCol(header, targetHeader) {
  const target = normHeader(targetHeader);
  return header.findIndex(h => normHeader(h) === target);
}

// ─── Sources ──────────────────────────────────────────────────────────────

const CENTRALES = [
  {
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    label: 'Central 2025-2026 · 2025',
    cohorte: '2025-2026',
    anio: 2025,
    jardinTabs: ['INDICAD0RES CONSULTOR', 'IND PRODUCTOS'],
    salasTabs: [], // 2025 workbook no expone CONSOLIDADO SALAS; sus tabs son RA/EA/VOL/RP/RF
  },
  {
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    label: 'Central 2025-2026 · 2026',
    cohorte: '2025-2026',
    anio: 2026,
    jardinTabs: ['CONSOLIDADO JARDÍN'],
    salasTabs: ['CONSOLIDADO SALAS'],
  },
  {
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    label: 'Central 2026-2027 · 2026',
    cohorte: '2026-2027',
    anio: 2026,
    jardinTabs: ['CONS. NIVEL JARDÍN'],   // NOT CONSOLIDADO CENTRAL JARDÍN (empty per fill audit)
    salasTabs: ['CONS NIVEL SALAS'],
  },
];

const BASES_SCJI = [
  {
    id: '1mTQJdFv9iTIcGbqKQHVq6VDhbP0mInoZ2OZqrcwzysE',
    label: 'Base SCJI Cohorte 2025-2026',
    cohorte: '2025-2026',
    tab: 'Base Datos',
  },
  {
    id: '1yUWIdwLGxoS_CeonNpDYIV2M03IQ4bS-IT9yBomAxJY',
    label: 'Base SCJI Cohorte 2026-2027',
    cohorte: '2026-2027',
    tab: 'PAF Ed. Parvularia 2026',
  },
];

// ─── Roster de establecimientos desde Bases SCJI ──────────────────────────

async function readRoster() {
  const roster = new Map();
  for (const base of BASES_SCJI) {
    const rows = await readTab(base.id, base.tab, 'A1:BZ200');
    if (rows.length < 3) continue;
    // Detect header row: scan first 3 rows for a canonical column (SCJI, Nombre, Jardín).
    let headerRow = 0;
    const canonHeader = /(^scji$|^nombre$|^jard[ií]n$|identificar sala cuna|identificar jard)/i;
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const low = (rows[i] || []).map(v => String(v || ''));
      if (low.some(h => canonHeader.test(h))) { headerRow = i; break; }
    }
    const header = rows[headerRow];
    const idxSCJI = header.findIndex(h => canonHeader.test(String(h || '')));
    if (idxSCJI < 0) { console.warn(`  ⚠ Base ${base.label}: no encuentro columna SCJI/Nombre`); continue; }
    const idxSost = header.findIndex(h => /sostenedor/i.test(String(h || '')));
    const idxCom = header.findIndex(h => /^comuna$/i.test(String(h || '').trim()));
    const idxCons = header.findIndex(h => /consultor/i.test(String(h || '')));
    const idxMatTotal = header.findIndex(h => /^(mat.*total.*jard|total matrículas|total mat)/i.test(String(h || '').trim()));
    const idxEquipo = header.findIndex(h => /total equipo/i.test(String(h || '')));
    // fallback sostenedor by cohorte if not present in the base
    const cohorteSostFallback = base.cohorte === '2025-2026' ? 'SLEP Santa Rosa' : null;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const nombre = String(r[idxSCJI] || '').trim();
      if (!nombre) continue;
      // Skip roll-up rows or explanation rows
      if (/^(total|resumen|totales)/i.test(nombre)) continue;
      const est = {
        id: jarId(nombre),
        programa: 'parvulario',
        nombre,
        cohorte: base.cohorte,
        sostenedor: (idxSost >= 0 ? String(r[idxSost] || '').trim() : '') || cohorteSostFallback,
        comuna: idxCom >= 0 ? String(r[idxCom] || '').trim() || null : null,
        consultorNombre: idxCons >= 0 ? String(r[idxCons] || '').trim() || null : null,
        nNinos: idxMatTotal >= 0 ? Number(String(r[idxMatTotal] || '').replace(',', '.')) || null : null,
        nAgentes: idxEquipo >= 0 ? Number(String(r[idxEquipo] || '').replace(',', '.')) || null : null,
        tipo: 'Jardín',
        fuente: { workbookId: base.id, tab: base.tab },
      };
      roster.set(est.id, est);
    }
  }
  return roster;
}

// ─── Ingest a jardín-level tab ────────────────────────────────────────────

function ingestJardinTab({ workbookId, workbookLabel, tab, rows, cohorte, anio, roster }) {
  if (!rows.length) return [];
  const header = rows[0];
  const cfg = MAP[tab] || SALAS[tab];
  if (!cfg) return [];
  const nombreIdx = findCol(header, cfg.nombreCol);
  if (nombreIdx < 0) {
    console.warn(`  ⚠ ${tab}: no encuentro columna "${cfg.nombreCol}"`);
    return [];
  }
  const results = [];
  for (const ind of cfg.indicadores) {
    const col = findCol(header, ind.header);
    if (col < 0) { console.warn(`  ⚠ ${tab}: no encuentro columna "${ind.header}"`); continue; }
    const indicador = IND_BY_ID[ind.id];
    if (!indicador) { console.warn(`  ⚠ Indicador ${ind.id} no está en el catálogo`); continue; }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const nombre = String(r[nombreIdx] || '').trim();
      if (!nombre) continue;
      // Skip roll-ups
      if (/^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
      const estId = jarId(nombre);
      const rosterEst = roster.get(estId);
      const parsed = parseCell(r[col], indicador.unidad);
      // Register est in roster if missing (some jardín names in Central may not be in Base SCJI)
      if (!rosterEst) {
        // ok — we still emit the value but roster may be incomplete; report separately
      }
      if (parsed.valor === null) continue;  // skip empty / errors (per prompt: no inventar)
      const doc = {
        programa: 'parvulario',
        establecimientoId: estId,
        establecimientoNombre: nombre,
        indicadorId: ind.id,
        ambito: indicador.ambito,
        cohorte,
        anio,
        periodo: String(anio),
        valor: parsed.valor,
        raw: parsed.raw,
        meta: indicador.meta,
        metaNum: indicador.metaNum,
        unidad: indicador.unidad,
        logro: computeLogro(indicador, parsed.valor),
        estado: ind.estado,
        fuente: { workbookId, workbookLabel, tab, col: ind.header, row: i + 1 },
      };
      if (parsed.notas) doc.notas = parsed.notas;
      results.push(doc);
    }
  }
  return results;
}

function ingestSalasTab({ workbookId, workbookLabel, tab, rows, cohorte, anio, roster }) {
  if (!rows.length) return [];
  const header = rows[0];
  const cfg = SALAS[tab];
  if (!cfg) return [];
  const nombreIdx = findCol(header, cfg.nombreCol);
  if (nombreIdx < 0) return [];
  // Group rows by jardín name; compute mean per column
  const results = [];
  for (const ind of cfg.indicadores) {
    const col = findCol(header, ind.header);
    if (col < 0) continue;
    const indicador = IND_BY_ID[ind.id];
    if (!indicador) continue;
    const buckets = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const nombre = String(r[nombreIdx] || '').trim();
      if (!nombre) continue;
      const parsed = parseCell(r[col], indicador.unidad);
      if (parsed.valor === null) continue;
      const arr = buckets.get(nombre) || [];
      arr.push(parsed.valor);
      buckets.set(nombre, arr);
    }
    for (const [nombre, arr] of buckets.entries()) {
      const valor = arr.reduce((s, v) => s + v, 0) / arr.length;
      const estId = jarId(nombre);
      results.push({
        programa: 'parvulario',
        establecimientoId: estId,
        establecimientoNombre: nombre,
        indicadorId: ind.id,
        ambito: indicador.ambito,
        cohorte,
        anio,
        periodo: String(anio),
        valor,
        raw: `mean over ${arr.length} salas`,
        meta: indicador.meta,
        metaNum: indicador.metaNum,
        unidad: indicador.unidad,
        logro: computeLogro(indicador, valor),
        estado: ind.estado,
        fuente: { workbookId, workbookLabel, tab, col: ind.header, agg: 'mean over salas', nSalas: arr.length },
      });
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log(`Ingesta Parvulario — Etapa 3 · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}\n`);

// 1) Roster
console.log('1) Leyendo Bases SCJI → roster de jardines…');
const roster = await readRoster();
console.log(`   ${roster.size} jardines registrados en roster`);

// 2) Ingest cada Central
console.log('\n2) Leyendo Planillas Centrales…');
const allResults = [];
const rosterFromCentral = new Set();
for (const c of CENTRALES) {
  console.log(`   • ${c.label}`);
  for (const tab of c.jardinTabs) {
    try {
      const rows = await readTab(c.id, tab);
      const res = ingestJardinTab({ workbookId: c.id, workbookLabel: c.label, tab, rows, cohorte: c.cohorte, anio: c.anio, roster });
      console.log(`      ${tab.padEnd(28)}  ${res.length} valores`);
      allResults.push(...res);
      for (const r of res) rosterFromCentral.add(r.establecimientoId);
    } catch (e) {
      console.warn(`      ${tab}: ERROR ${e.errors?.[0]?.message || e.message}`);
    }
  }
  for (const tab of c.salasTabs) {
    try {
      const rows = await readTab(c.id, tab);
      const res = ingestSalasTab({ workbookId: c.id, workbookLabel: c.label, tab, rows, cohorte: c.cohorte, anio: c.anio, roster });
      console.log(`      ${tab.padEnd(28)}  ${res.length} valores (aggregados por sala→jardín)`);
      allResults.push(...res);
      for (const r of res) rosterFromCentral.add(r.establecimientoId);
    } catch (e) {
      console.warn(`      ${tab}: ${e.errors?.[0]?.message || e.message}`);
    }
  }
}

// 3) Cross-check roster vs. Centrales
const rosterMissing = [...rosterFromCentral].filter(id => !roster.has(id));
if (rosterMissing.length) {
  console.log(`\n   ⚠ ${rosterMissing.length} jardines en Centrales sin match exacto en Base SCJI (probable diferencia de tipografía): ${rosterMissing.slice(0, 5).join(', ')}${rosterMissing.length > 5 ? '…' : ''}`);
}

// 4) Purge si aplica
if (PURGE && !DRY_RUN) {
  console.log('\n3) Purgando resultados_real programa=parvulario…');
  const snap = await db.collection('resultados_real').where('programa', '==', 'parvulario').get();
  const batch = db.batch();
  let n = 0;
  for (const d of snap.docs) { batch.delete(d.ref); n++; }
  if (n) await batch.commit();
  console.log(`   ${n} docs eliminados`);
}

// 5) Ensure config/dataSource
if (!DRY_RUN) {
  console.log('\n4) Asegurando config/dataSource…');
  const cfgRef = db.doc('config/dataSource');
  const cfgSnap = await cfgRef.get();
  if (!cfgSnap.exists) {
    await cfgRef.set({ escolar: 'synthetic', parvulario: 'synthetic', updatedAt: FieldValue.serverTimestamp(), note: 'Etapa 3: flag creado; permanece synthetic' });
    console.log('   Creado con {escolar: synthetic, parvulario: synthetic}');
  } else {
    console.log(`   Ya existe: ${JSON.stringify(cfgSnap.data())}`);
  }
}

// 6) Write establecimientos_real
if (!DRY_RUN) {
  console.log('\n5) Escribiendo establecimientos_real…');
  let n = 0;
  const batches = [];
  let batch = db.batch(); let count = 0;
  for (const est of roster.values()) {
    batch.set(db.collection('establecimientos_real').doc(est.id), { ...est, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  }
  if (count) batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`   ${n} establecimientos upserted`);
}

// 7) Write resultados_real
if (!DRY_RUN) {
  console.log('\n6) Escribiendo resultados_real…');
  let n = 0;
  const batches = [];
  let batch = db.batch(); let count = 0;
  for (const r of allResults) {
    const docId = `parv_${r.establecimientoId}_${r.indicadorId}_${r.periodo}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    batch.set(db.collection('resultados_real').doc(docId), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
  }
  if (count) batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`   ${n} resultados upserted`);
}

// 8) Verification report
console.log('\n7) Reporte de verificación');
const byEstado = allResults.reduce((acc, r) => (acc[r.estado] = (acc[r.estado] || 0) + 1, acc), {});
const byCohorte = allResults.reduce((acc, r) => (acc[r.cohorte] = (acc[r.cohorte] || 0) + 1, acc), {});
const byAnio = allResults.reduce((acc, r) => (acc[r.anio] = (acc[r.anio] || 0) + 1, acc), {});
const uniqueEsts = new Set(allResults.map(r => r.establecimientoId));
const uniqueInds = new Set(allResults.map(r => r.indicadorId));

console.log(`   Total resultados: ${allResults.length}`);
console.log(`   Por estado: ${JSON.stringify(byEstado)}`);
console.log(`   Por cohorte: ${JSON.stringify(byCohorte)}`);
console.log(`   Por año: ${JSON.stringify(byAnio)}`);
console.log(`   Jardines cubiertos: ${uniqueEsts.size}`);
console.log(`   Indicadores cubiertos: ${uniqueInds.size} (${[...uniqueInds].sort().join(', ')})`);
console.log(`   Roster (establecimientos_real): ${roster.size}`);

// Sample 5 for inspection
const sample = allResults.slice(0, 5);
console.log('\n   Muestra:');
for (const s of sample) {
  console.log(`     ${s.establecimientoId} · ${s.indicadorId} · ${s.periodo}: valor=${s.valor} logro=${s.logro?.toFixed(2) ?? 'n/a'} estado=${s.estado} tab=${s.fuente.tab}`);
}

// Write report file
const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  totals: {
    resultados: allResults.length,
    porEstado: byEstado,
    porCohorte: byCohorte,
    porAnio: byAnio,
    jardinesCubiertos: uniqueEsts.size,
    indicadoresCubiertos: uniqueInds.size,
    rosterTotal: roster.size,
  },
  indicadoresCubiertos: [...uniqueInds].sort(),
  rosterMissingInSCJI: rosterMissing,
  muestra: sample,
};
await writeFile(pathResolve(ROOT, 'docs/etapa3-ingesta-parvulario.json'), JSON.stringify(report, null, 2));
console.log('\n   Reporte JSON: docs/etapa3-ingesta-parvulario.json');
console.log(`\n${DRY_RUN ? 'DRY-RUN completo — no se escribió a Firestore.' : 'Ingesta completa.'}`);
