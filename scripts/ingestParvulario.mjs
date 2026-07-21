// Ingesta Parvulario desde las pestañas VISUALIZADOR JARDÍN / VISUALIZADOR SALAS
// de las 3 Planillas Centrales. Fuente de verdad definida por Focus (ver notas
// del 17-jul-2026 con Luis).
//
// Uso:
//   node scripts/ingestParvulario.mjs              → escribe a Firestore + reporte
//   node scripts/ingestParvulario.mjs --dry-run    → sólo produce reporte (sin escribir)
//   node scripts/ingestParvulario.mjs --purge      → borra resultados_real Parvulario antes
//
// Colecciones tocadas:
//   config/dataSource                (crea si no existe; NO flip)
//   establecimientos_real/{jarSlug}  (roster + matrícula desde Bases SCJI, sin PII)
//   resultados_real/{docId}          (valor por indicador × jardín × período)
//
// Fuentes (VISUALIZADOR JARDÍN + VISUALIZADOR SALAS):
//   Central 2025-2026 · Año 1 (2025) → 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A
//   Central 2025-2026 · Año 2 (2026) → 1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo
//   Central 2026-2027 · Año 1 (2026) → 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk
//
// ⚠ Numeración planilla vs catálogo:
//   La numeración de las planillas VISUALIZADOR reordenó los indicadores.
//   PLANILLA_A_CATALOG (más abajo) traduce ID_planilla → ID_catalogo.
//   Los indicadores planilla sin match (p.ej. planilla I.1 = "N° visitas") se
//   ignoran con warning. Los del catálogo sin equivalente en planilla (p.ej.
//   cat I.22 comités comunales, I.23 fiesta familia, I.43 voluntariados) no se
//   ingestan — pendientes de confirmar con Luis.
//
// Docs generados en resultados_real:
//   • Agregado por jardín (jardín + promedio sobre salas): `parv_${estId}_${indId}_${anio}`
//     — sin campo `nivel`. Es lo que consume la UI actual.
//   • Por nivel específico: `parv_${estId}_${indId}_${anio}_${nivelSlug}`
//     — incluye `nivel`, `nivelEspecifico`, `nivelGeneral`. Solo para VISUALIZADOR SALAS.
//     La UI leerá estos cuando el filtro Nivel del comparador esté activo.
//
// Sin PII: nunca se persisten RUTs, nombres de estudiantes ni de funcionarios.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { extractPlanillaId, planillaToCatalog } from './lib/parvularioIds.mjs';

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

// Numeración planilla → catálogo y extractor de IDs tolerante viven en
// scripts/lib/parvularioIds.mjs (compartido con mapeoParvulario.mjs).
// Consecuencia de la traducción: catálogo I.22 (comités comunales) e I.23
// (fiesta familia) no reciben datos. Se reportan al final.

// ─── Helpers ──────────────────────────────────────────────────────────────

async function readTab(id, tab, range = 'A1:BZ500') {
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

function cleanName(s) {
  return String(s || '').replace(/\s*\(.*?\)\s*/g, '').replace(/[.,;]+$/, '').trim();
}

function jarId(name) {
  return `jar-${slug(cleanName(name))}`;
}

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

// Normaliza el "Nivel Específico" a uno de los 6 buckets del selector Nivel
// (sala_cuna_menor, sala_cuna_mayor, nivel_medio_menor, nivel_medio_mayor,
// transicion_1, transicion_2). Los nombres custom ("Sala Cuna Heterogénea I",
// "Nivel Medio Mayor y Transición Convencional A", etc.) se resuelven por
// heurística: primero se detecta "sala cuna" vs "nivel medio" vs "transición",
// después "menor"/"mayor"/"1"/"2"/"heterogénea".
const NIVELES_BUCKETS = [
  'sala_cuna_menor', 'sala_cuna_mayor',
  'nivel_medio_menor', 'nivel_medio_mayor',
  'transicion_1', 'transicion_2',
];

function normalizarNivel(nivelEspecifico, nivelGeneral) {
  const s = String(nivelEspecifico || '').toLowerCase();
  const g = String(nivelGeneral || '').toLowerCase();
  const isSalaCuna = /sala\s*cuna|sc/i.test(s) || /sala\s*cuna|sc/i.test(g);
  const isMedio = /nivel\s*medio|medio/i.test(s) || /nivel\s*medio|medio/i.test(g);
  const isTransicion = /transici[oó]n|transición/i.test(s);
  const isMenor = /menor|primer|1/.test(s);
  const isMayor = /mayor|segundo|2|heterog/.test(s);

  if (isSalaCuna) {
    if (isMenor) return 'sala_cuna_menor';
    if (isMayor) return 'sala_cuna_mayor';
    return 'sala_cuna_mayor'; // default (heterogénea suele cubrir el rango)
  }
  if (isTransicion) {
    if (/1|primer/.test(s)) return 'transicion_1';
    if (/2|segund/.test(s)) return 'transicion_2';
    return 'transicion_1';
  }
  if (isMedio) {
    if (isMenor) return 'nivel_medio_menor';
    if (isMayor) return 'nivel_medio_mayor';
    return 'nivel_medio_menor';
  }
  return null; // no clasificable
}

// Nivel corto para el docId (compatible con Firestore ID).
function nivelSlug(nivelBucket) {
  return String(nivelBucket || 'nc').replace(/_/g, '-');
}

// ─── Configuración de tabs ────────────────────────────────────────────────

const TABS = {
  jardin: 'VISUALIZADOR JARDÍN',
  salas: 'VISUALIZADOR SALAS',
  // Fallback alternativo — algunas planillas usan variantes
  jardinAlt: ['VISUALIZADOR JARDIN', 'Visualizador Jardín'],
  salasAlt: ['VISUALIZADOR SALA', 'VISUALIZADOR SALA S', 'Visualizador Salas'],
};

// La columna con el nombre del jardín se llama "SCJI" en ambas tabs.
const NOMBRE_JARDIN_COL = 'scji';
const NIVEL_GENERAL_COL = 'nivel general';
const NIVEL_ESPECIFICO_COL = 'nivel específico';
const COHORTE_COL = 'cohorte';
const ANIO_CAL_COL = 'año calendario';
const SOSTENEDOR_COL = 'sostenedor';
const COMUNA_COL = 'comuna';

function normHeader(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function findColByName(header, target) {
  const t = normHeader(target);
  return header.findIndex(h => normHeader(h) === t);
}

// Encuentra la tab exacta buscando primero el nombre canónico y luego
// alternativas tolerantes de mayúsculas / guiones raros.
function findTab(tabNames, wanted, alts = []) {
  for (const t of tabNames) if (t === wanted) return t;
  for (const alt of alts) for (const t of tabNames) if (t === alt) return t;
  for (const t of tabNames) if (normHeader(t) === normHeader(wanted)) return t;
  return null;
}

// ─── Fuentes ──────────────────────────────────────────────────────────────

const CENTRALES = [
  {
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    label: 'Central 2025-2026 · 2025',
    cohorte: '2025-2026',
    anio: 2025,
  },
  {
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    label: 'Central 2025-2026 · 2026',
    cohorte: '2025-2026',
    anio: 2026,
  },
  {
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    label: 'Central 2026-2027 · 2026',
    cohorte: '2026-2027',
    anio: 2026,
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

// ─── Roster ───────────────────────────────────────────────────────────────

async function readRoster() {
  const roster = new Map();
  for (const base of BASES_SCJI) {
    const rows = await readTab(base.id, base.tab, 'A1:BZ200');
    if (rows.length < 3) continue;
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
    const cohorteSostFallback = base.cohorte === '2025-2026' ? 'SLEP Santa Rosa' : null;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const nombre = String(r[idxSCJI] || '').trim();
      if (!nombre) continue;
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

// ─── Ingesta VISUALIZADOR JARDÍN ──────────────────────────────────────────

function ingestJardinTab({ workbookId, workbookLabel, tab, rows, cohorte, anio }) {
  if (rows.length < 2) return { docs: [], warnings: [`${tab}: sin filas`] };
  const header = rows[0];
  const warnings = [];
  const nombreIdx = findColByName(header, NOMBRE_JARDIN_COL);
  if (nombreIdx < 0) {
    return { docs: [], warnings: [`${tab}: falta columna "SCJI"`] };
  }
  // Mapa columna → indicador catálogo (traduciendo el ID de planilla)
  const colToCatalog = [];
  for (let c = 0; c < header.length; c++) {
    const planillaId = extractPlanillaId(header[c]);
    if (!planillaId) continue;
    const catId = planillaToCatalog(planillaId);
    if (!catId) {
      warnings.push(`${tab}: planilla ${planillaId} sin equivalente en catálogo (col ${c})`);
      continue;
    }
    const ind = IND_BY_ID[catId];
    if (!ind) {
      warnings.push(`${tab}: catálogo ${catId} no existe en IND_BY_ID (col ${c})`);
      continue;
    }
    colToCatalog.push({ col: c, planillaId, catId, ind });
  }

  const docs = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const nombre = String(r[nombreIdx] || '').trim();
    if (!nombre) continue;
    if (/^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
    const estId = jarId(nombre);

    for (const { col, planillaId, catId, ind } of colToCatalog) {
      const parsed = parseCell(r[col], ind.unidad);
      if (parsed.valor === null) continue;
      docs.push({
        programa: 'parvulario',
        establecimientoId: estId,
        establecimientoNombre: nombre,
        indicadorId: catId,
        ambito: ind.ambito,
        cohorte,
        anio,
        periodo: String(anio),
        // sin campo `nivel` → doc agregado por jardín, consumido por la UI actual
        valor: parsed.valor,
        raw: parsed.raw,
        meta: ind.meta,
        metaNum: ind.metaNum,
        unidad: ind.unidad,
        logro: computeLogro(ind, parsed.valor),
        estado: 'validado',
        fuente: { workbookId, workbookLabel, tab, col: header[col], row: i + 1, planillaId },
      });
      if (parsed.notas) docs[docs.length - 1].notas = parsed.notas;
    }
  }
  return { docs, warnings };
}

// ─── Ingesta VISUALIZADOR SALAS ───────────────────────────────────────────

function ingestSalasTab({ workbookId, workbookLabel, tab, rows, cohorte, anio }) {
  if (rows.length < 2) return { salasDocs: [], jardinDocs: [], warnings: [`${tab}: sin filas`] };
  const header = rows[0];
  const warnings = [];
  const nombreIdx = findColByName(header, NOMBRE_JARDIN_COL);
  const nivelGenIdx = findColByName(header, NIVEL_GENERAL_COL);
  const nivelEspIdx = findColByName(header, NIVEL_ESPECIFICO_COL);
  if (nombreIdx < 0 || nivelEspIdx < 0) {
    return { salasDocs: [], jardinDocs: [], warnings: [`${tab}: falta SCJI (${nombreIdx}) o Nivel Específico (${nivelEspIdx})`] };
  }
  const colToCatalog = [];
  for (let c = 0; c < header.length; c++) {
    const planillaId = extractPlanillaId(header[c]);
    if (!planillaId) continue;
    const catId = planillaToCatalog(planillaId);
    if (!catId) { warnings.push(`${tab}: planilla ${planillaId} sin equivalente en catálogo`); continue; }
    const ind = IND_BY_ID[catId];
    if (!ind) { warnings.push(`${tab}: catálogo ${catId} no existe`); continue; }
    colToCatalog.push({ col: c, planillaId, catId, ind });
  }

  const salasDocs = [];
  // Para agregar por jardín: por (estId, catId) acumulamos valores para promediar.
  const bucketsAgg = new Map();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const nombre = String(r[nombreIdx] || '').trim();
    if (!nombre) continue;
    if (/^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
    const estId = jarId(nombre);
    const nivelEsp = String(r[nivelEspIdx] || '').trim();
    const nivelGen = nivelGenIdx >= 0 ? String(r[nivelGenIdx] || '').trim() : null;
    const nivelBucket = normalizarNivel(nivelEsp, nivelGen);

    for (const { col, planillaId, catId, ind } of colToCatalog) {
      const parsed = parseCell(r[col], ind.unidad);
      if (parsed.valor === null) continue;

      // Doc por sala/nivel
      const nvSlug = nivelSlug(nivelBucket);
      salasDocs.push({
        programa: 'parvulario',
        establecimientoId: estId,
        establecimientoNombre: nombre,
        indicadorId: catId,
        ambito: ind.ambito,
        cohorte,
        anio,
        periodo: String(anio),
        nivel: nivelBucket,          // string bucket: sala_cuna_menor, etc.
        nivelEspecifico: nivelEsp,   // original de la planilla ("Sala cuna menor" / "Sala Cuna Heterogénea I" ...)
        nivelGeneral: nivelGen,      // "Sala Cuna" | "Nivel Medio" | ...
        valor: parsed.valor,
        raw: parsed.raw,
        meta: ind.meta,
        metaNum: ind.metaNum,
        unidad: ind.unidad,
        logro: computeLogro(ind, parsed.valor),
        estado: 'validado',
        docSlug: nvSlug,             // para docId
        fuente: { workbookId, workbookLabel, tab, col: header[col], row: i + 1, planillaId },
      });

      // Acumular para el agregado por jardín (promedio)
      const key = `${estId}|${catId}`;
      const b = bucketsAgg.get(key) || { valores: [], ind, estId, nombre, catId };
      b.valores.push(parsed.valor);
      bucketsAgg.set(key, b);
    }
  }

  // Emitir el doc agregado por jardín (sin campo `nivel`)
  const jardinDocs = [];
  for (const b of bucketsAgg.values()) {
    const valor = b.valores.reduce((s, v) => s + v, 0) / b.valores.length;
    jardinDocs.push({
      programa: 'parvulario',
      establecimientoId: b.estId,
      establecimientoNombre: b.nombre,
      indicadorId: b.catId,
      ambito: b.ind.ambito,
      cohorte,
      anio,
      periodo: String(anio),
      valor,
      raw: `mean over ${b.valores.length} salas`,
      meta: b.ind.meta,
      metaNum: b.ind.metaNum,
      unidad: b.ind.unidad,
      logro: computeLogro(b.ind, valor),
      estado: 'validado',
      fuente: { workbookId, workbookLabel, tab, agg: 'mean over salas', nSalas: b.valores.length },
    });
  }

  return { salasDocs, jardinDocs, warnings };
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log(`Ingesta Parvulario (VISUALIZADOR) — ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}\n`);

// 1) Roster
console.log('1) Leyendo Bases SCJI → roster de jardines…');
const roster = await readRoster();
console.log(`   ${roster.size} jardines en roster`);

// 2) Ingesta por planilla
console.log('\n2) Leyendo pestañas VISUALIZADOR…');
const allJardinDocs = [];
const allSalasDocs = [];
const allWarnings = [];
const perPlanillaSummary = [];
const rosterFromCentral = new Set();

for (const c of CENTRALES) {
  console.log(`\n   • ${c.label}`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: c.id });
  const tabNames = meta.data.sheets.map(s => s.properties.title);
  const tabJardin = findTab(tabNames, TABS.jardin, TABS.jardinAlt);
  const tabSalas = findTab(tabNames, TABS.salas, TABS.salasAlt);
  const summary = { label: c.label, cohorte: c.cohorte, anio: c.anio, jardin: null, salas: null };

  if (tabJardin) {
    const rows = await readTab(c.id, tabJardin);
    const { docs, warnings } = ingestJardinTab({ workbookId: c.id, workbookLabel: c.label, tab: tabJardin, rows, cohorte: c.cohorte, anio: c.anio });
    console.log(`      ${tabJardin.padEnd(22)}  ${docs.length} valores jardín`);
    allJardinDocs.push(...docs);
    allWarnings.push(...warnings);
    for (const d of docs) rosterFromCentral.add(d.establecimientoId);
    summary.jardin = docs.length;
  } else {
    console.warn(`      ⚠ ${TABS.jardin} no encontrada`);
    allWarnings.push(`${c.label}: falta tab "${TABS.jardin}"`);
  }

  if (tabSalas) {
    const rows = await readTab(c.id, tabSalas);
    const { salasDocs, jardinDocs, warnings } = ingestSalasTab({ workbookId: c.id, workbookLabel: c.label, tab: tabSalas, rows, cohorte: c.cohorte, anio: c.anio });
    console.log(`      ${tabSalas.padEnd(22)}  ${salasDocs.length} valores sala + ${jardinDocs.length} agregados por jardín`);
    allSalasDocs.push(...salasDocs);
    allJardinDocs.push(...jardinDocs);
    allWarnings.push(...warnings);
    for (const d of jardinDocs) rosterFromCentral.add(d.establecimientoId);
    summary.salas = salasDocs.length;
  } else {
    console.warn(`      ⚠ ${TABS.salas} no encontrada`);
    allWarnings.push(`${c.label}: falta tab "${TABS.salas}"`);
  }

  perPlanillaSummary.push(summary);
}

// 3) Cross-check roster
const rosterMissing = [...rosterFromCentral].filter(id => !roster.has(id));
if (rosterMissing.length) {
  console.log(`\n   ⚠ ${rosterMissing.length} jardines en Centrales sin match exacto en Base SCJI: ${rosterMissing.slice(0, 5).join(', ')}${rosterMissing.length > 5 ? '…' : ''}`);
}

// 4) Purge
if (PURGE && !DRY_RUN) {
  console.log('\n3) Purgando resultados_real programa=parvulario…');
  const snap = await db.collection('resultados_real').where('programa', '==', 'parvulario').get();
  let n = 0;
  let batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref); n++; count++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  console.log(`   ${n} docs eliminados`);
}

// 5) config/dataSource
if (!DRY_RUN) {
  const cfgRef = db.doc('config/dataSource');
  const cfgSnap = await cfgRef.get();
  if (!cfgSnap.exists) {
    await cfgRef.set({ escolar: 'synthetic', parvulario: 'synthetic', updatedAt: FieldValue.serverTimestamp(), note: 'Etapa 3 VISUALIZADOR: flag creado; permanece synthetic' });
  }
}

// 6) Escribir establecimientos_real
if (!DRY_RUN) {
  console.log('\n4) Escribiendo establecimientos_real…');
  let n = 0;
  let batch = db.batch(); let count = 0;
  for (const est of roster.values()) {
    batch.set(db.collection('establecimientos_real').doc(est.id), { ...est, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  console.log(`   ${n} establecimientos upserted`);
}

// 7) Escribir resultados_real (jardín + salas)
if (!DRY_RUN) {
  console.log('\n5) Escribiendo resultados_real…');
  // Deduplicar jardín docs por (estId, indId, periodo). Cuando el mismo indicador
  // aparece en VISUALIZADOR JARDÍN y también en SALAS agregado, el de JARDÍN gana
  // (dato reportado por la escuela vs promedio calculado de salas).
  const jardinByKey = new Map();
  for (const d of allJardinDocs) {
    const k = `${d.establecimientoId}|${d.indicadorId}|${d.periodo}`;
    if (!jardinByKey.has(k) || d.fuente.tab === 'VISUALIZADOR JARDÍN') {
      jardinByKey.set(k, d);
    }
  }
  const uniqueJardin = [...jardinByKey.values()];

  let n = 0;
  let batch = db.batch(); let count = 0;
  for (const r of uniqueJardin) {
    const docId = `parv_${r.establecimientoId}_${r.indicadorId}_${r.periodo}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    batch.set(db.collection('resultados_real').doc(docId), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  for (const r of allSalasDocs) {
    const suffix = r.docSlug || 'nc';
    const { docSlug, ...clean } = r;
    const docId = `parv_${r.establecimientoId}_${r.indicadorId}_${r.periodo}_${suffix}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    batch.set(db.collection('resultados_real').doc(docId), { ...clean, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    count++; n++;
    if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count) await batch.commit();
  console.log(`   ${uniqueJardin.length} agregados por jardín + ${allSalasDocs.length} por sala = ${n} docs totales`);
}

// 8) Reporte
console.log('\n6) Reporte');
const byPeriodo = allJardinDocs.reduce((acc, r) => (acc[r.periodo] = (acc[r.periodo] || 0) + 1, acc), {});
const uniqueInds = new Set(allJardinDocs.map(r => r.indicadorId));
const uniqueEsts = new Set(allJardinDocs.map(r => r.establecimientoId));
const uniqueNiveles = new Set(allSalasDocs.map(r => r.nivel).filter(Boolean));
// Indicadores (en coordenadas de catálogo) que efectivamente generan al menos
// un doc con `nivel` — es decir, los que deberían llevar `desagregaNivel:true`
// en catalog.json. Es la fuente de verdad empírica del flag.
const indicadoresConNivel = [...new Set(allSalasDocs.map(r => r.indicadorId))]
  .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));

console.log(`   Jardín docs: ${allJardinDocs.length}`);
console.log(`   Sala docs:   ${allSalasDocs.length}`);
console.log(`   Por período: ${JSON.stringify(byPeriodo)}`);
console.log(`   Jardines: ${uniqueEsts.size}`);
console.log(`   Indicadores catálogo cubiertos: ${uniqueInds.size} → ${[...uniqueInds].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).join(', ')}`);
console.log(`   Niveles detectados: ${uniqueNiveles.size} → ${[...uniqueNiveles].join(', ')}`);
console.log(`   Indicadores con desglose por nivel (${indicadoresConNivel.length}): ${indicadoresConNivel.join(', ')}`);

if (allWarnings.length) {
  console.log(`\n   ⚠ ${allWarnings.length} advertencias:`);
  const unique = [...new Set(allWarnings)].slice(0, 15);
  for (const w of unique) console.log(`     · ${w}`);
  if (allWarnings.length > unique.length) console.log(`     … y ${allWarnings.length - unique.length} más`);
}

// Indicadores del catálogo no cubiertos
const cubiertos = new Set([...uniqueInds]);
const noCubiertos = IND_PARV.filter(i => !cubiertos.has(i.id)).map(i => i.id);
console.log(`\n   Indicadores del catálogo SIN DATOS (${noCubiertos.length}): ${noCubiertos.join(', ') || '_ninguno_'}`);

// Verificación por planilla
console.log('\n   Por planilla:');
for (const s of perPlanillaSummary) {
  console.log(`     ${s.label}: jardín=${s.jardin ?? 'N/A'}, salas=${s.salas ?? 'N/A'}`);
}

// Write JSON report
const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  totals: {
    jardinDocs: allJardinDocs.length,
    salasDocs: allSalasDocs.length,
    porPeriodo: byPeriodo,
    jardines: uniqueEsts.size,
    indicadoresCubiertos: uniqueInds.size,
    nivelesDetectados: [...uniqueNiveles],
    rosterTotal: roster.size,
    warnings: allWarnings.length,
  },
  indicadoresCubiertos: [...uniqueInds].sort(),
  indicadoresNoCubiertos: noCubiertos,
  indicadoresConNivel,
  warnings: allWarnings,
  perPlanilla: perPlanillaSummary,
};

// El reporte se emite siempre — en modo dry-run va a un archivo con sufijo
// `-dryrun` para no pisar el reporte oficial de la última ingesta real.
const fecha = new Date().toISOString().slice(0, 10);
const reportName = DRY_RUN
  ? `ingestParvulario-${fecha}-dryrun.json`
  : `ingestParvulario-${fecha}.json`;
const reportPath = pathResolve(ROOT, 'reports', reportName);
const { mkdir } = await import('node:fs/promises');
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`\n   Reporte: ${reportPath}`);

process.exit(0);
