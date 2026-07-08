// Etapa 6 — Extended ingest to close the "existe+no-mostrado ∩ confirmada" gap
// found by scripts/auditFill.mjs (docs/auditoria-llenado.csv).
//
// Uso:
//   node scripts/ingestExtended.mjs --dry-run    → count + sample, no writes
//   node scripts/ingestExtended.mjs              → escribe a Firestore (idempotente)
//
// Colecciones tocadas: resultados_real (set merge:true; doc IDs deterministas).
// NO toca config/dataSource. NO toca establecimientos_real. NO cambia el app.
//
// Cobertura de este script:
//   A. Parvulario · Planillas Centrales — indicadores no cubiertos por Etapa 3.
//   B. Escolar · Pivote Resultados 2025 (Base Vertical) — 40 indicadores × 5 escuelas cohorte 2025-2027.
//
// Fuera del alcance de este script (requieren pipeline dedicado y/o cambios upstream):
//   - Parvulario Jardín-source (workbooks Jardín, tabs por curso con PII) — 575 rows.
//   - Escolar 2026 Registro Coordinación / Encuesta — 190 rows: MAP existe en Etapa 5 pero la
//     fuente está vacía o tab estructurada esperando llenado. Re-correr no cierra el gap.
//
// PII: nunca se persisten RUTs, nombres de estudiantes ni de funcionarios.

import { readFile } from 'node:fs/promises';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TRACK = (args.find(a => a.startsWith('--track=')) || '').split('=')[1] || 'both';

// ─── Init ────────────────────────────────────────────────────────────────────

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Catálogo + roster real ──────────────────────────────────────────────────

const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const IND_PARV_BY_ID = Object.fromEntries(catalog.indicadores.parvulario.map(i => [i.id, i]));
const IND_ESC_2025_BY_ID = Object.fromEntries(catalog.indicadores.escolar2025.map(i => [i.id, i]));

// Load establecimientos_real to know the real Firestore id per name.
console.log(`Etapa 6 — Ingesta extendida · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}`);
console.log(`Track: ${TRACK}\n`);

const estSnap = await db.collection('establecimientos_real').get();

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^escuela\s+/, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const nameToFsId = new Map();
const fsIdToProg = new Map();
for (const d of estSnap.docs) {
  const x = d.data();
  if (!x.programa || !x.nombre) continue;
  nameToFsId.set(`${x.programa}|${normName(x.nombre)}`, d.id);
  fsIdToProg.set(d.id, x.programa);
}
console.log(`Roster real cargado: ${estSnap.size} centros educativos`);

// ─── Sheet helpers ───────────────────────────────────────────────────────────

async function readTab(id, tab, range = 'A1:BZ500') {
  try {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `'${tab}'!${range}` });
    return r.data.values || [];
  } catch (e) {
    console.warn(`  ✗ read ${id}·${tab}: ${e.errors?.[0]?.message || e.message}`);
    return [];
  }
}

function normHeader(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function findCol(header, target) {
  const t = normHeader(target);
  return header.findIndex(h => normHeader(h) === t);
}
function findColPrefix(header, prefix) {
  const p = normHeader(prefix);
  return header.findIndex(h => normHeader(h).startsWith(p));
}

// Parse a cell value using the indicator's unidad. Emits `null` for empty/error.
// `tipoMeta` opcional: si es 'booleano' aceptamos SI/NO aunque unidad no sea 'binario'
// (workaround para el pivote Escolar 2025 que reporta booleanos con unidades varias).
function parseCell(raw, unidad, tipoMeta) {
  if (raw === null || raw === undefined) return { valor: null, raw: '' };
  const s = String(raw).trim();
  if (!s) return { valor: null, raw: '' };
  if (/^(sin datos|no aplica|n\/a|—|-)$/i.test(s)) return { valor: null, raw: s };
  if (/^#(div\/0|value|ref|name|n\/a|num|null)!?$/i.test(s)) return { valor: null, raw: s, notas: 'error de formula' };

  const isBinary = unidad === 'binario' || tipoMeta === 'booleano';
  if (isBinary) {
    if (/^(si|sí|true|1|verdadero)$/i.test(s)) return { valor: 1, raw: s };
    if (/^(no|false|0|falso)$/i.test(s)) return { valor: 0, raw: s };
    // Fall through to numeric — algunos "binarios" catálogo son en realidad conteos.
  }

  const pct = s.match(/^-?\d+([.,]\d+)?\s*%$/);
  const num = s.match(/^-?\d+([.,]\d+)?$/);
  if (pct) {
    const n = Number(s.replace('%', '').replace(',', '.'));
    return Number.isFinite(n) ? { valor: n / 100, raw: s } : { valor: null, raw: s };
  }
  if (num) {
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n)) {
      if (unidad === '%') return { valor: n > 1.5 ? n / 100 : n, raw: s };
      return { valor: n, raw: s };
    }
  }
  if (isBinary) return { valor: null, raw: s, notas: 'binario no reconocido' };
  return { valor: null, raw: s };
}

function computeLogro(ind, valor) {
  if (valor === null || valor === undefined) return null;
  if (!ind.metaNum || ind.tipoMeta === 'sin_meta') return null;
  return Math.max(0, Math.min(1.2, valor / ind.metaNum));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE A · Parvulario Centrales — extended MAP (indicators not covered by Etapa 3)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Naming caveat: matchear el header exacto de las Centrales. Si el header no está
// exactamente como acá, se salta y se loguea. Los headers vienen del probe hecho
// en docs/etapa6-headers.md.

// Cada entrada: {tab, workbookId, cohorte, anio, nombreCol, mapCol[]}
// mapCol[]: { header, id, estado: 'validado'|'provisional' }

const PARV_TABS = [
  // ─── Central 2025-2026 · 2025 ──────────────────────────────────────────────
  {
    label: 'Central 2025-2026 · 2025 · INDICAD0RES CONSULTOR',
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    tab: 'INDICAD0RES CONSULTOR',
    cohorte: '2025-2026',
    anio: 2025,
    nombreCol: 'Identificar sala cuna y/o jardín infantil',
    mapCol: [
      { header: 'N° de encuentros formativos Entre Familias', id: 'I.32', estado: 'validado', notas: 'columna corta duplica I.32; usar la última encontrada' },
      // Nota: 'INDICAD0RES CONSULTOR' tiene columnas duplicadas con nombres cortos y largos.
      // Los indicadores realmente cubiertos por MAP existente (I.1, I.2, I.3, I.12, I.13, I.32, I.33, I.34, I.35, I.36, I.37, I.39, I.44)
      // ya están en Etapa 3. Los que la auditoría pide para 2025 (I.4, I.5, I.6, I.7, I.8, I.9, I.10, I.11, I.22, I.23, I.29, I.30, I.31, I.48)
      // están en INDICADORES COORDINADOR, no aquí.
    ],
  },
  {
    label: 'Central 2025-2026 · 2025 · INDICADORES COORDINADOR',
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    tab: 'INDICADORES COORDINADOR',
    cohorte: '2025-2026',
    anio: 2025,
    nombreCol: 'Identificar sala cuna y/o jardín infantil',
    mapCol: [
      { header: 'N° de reuniones territoriales con directoras desarrolladas', id: 'I.4', estado: 'validado' },
      { header: '% de directoras que participan en reuniones territoriales', id: 'I.5', estado: 'validado' },
      { header: 'N° de reuniones territoriales con coordinadoras desarrolladas', id: 'I.6', estado: 'validado' },
      { header: '% de coordinadoras que participan en reuniones territoriales', id: 'I.7', estado: 'validado' },
      { header: 'N° de instancias de sensibilización y presentación del Programa desarrolladas', id: 'I.8', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancia de sensibilización y presentación Programa', id: 'I.9', estado: 'validado' },
      { header: 'N° de formaciones anuales para agentes educativas desarrolladas', id: 'I.10', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancias de formación', id: 'I.11', estado: 'validado' },
      { header: 'N° de comités comunales en los que participa el jardín infantil', id: 'I.22', estado: 'validado' },
      { header: '% de familias que participan en la actividad', id: 'I.23', estado: 'validado' },
      { header: 'N° formaciones territoriales de monitores desarrolladas', id: 'I.29', estado: 'validado' },
      { header: '% de salas representadas por apoderados en la formación', id: 'I.30', estado: 'validado' },
      { header: '% de salas representadas por agentes educativas en la formación', id: 'I.31', estado: 'validado' },
    ],
  },
  {
    label: 'Central 2025-2026 · 2025 · CONSOLIDADO (salas)',
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    tab: 'CONSOLIDADO',
    cohorte: '2025-2026',
    anio: 2025,
    nombreCol: 'Sala cuna - jardín infantil',
    aggregate: 'mean',
    mapCol: [
      { header: 'Promedio anual Reunión apoderados', id: 'I.47', estado: 'provisional' },
      { header: 'Cobertura de 1 entrevista de apoderados', id: 'I.45', estado: 'provisional' },
      { header: 'Cobertura de 2 entrevistas de apoderados', id: 'I.46', estado: 'provisional' },
      { header: 'Cobertura Voluntariado', id: 'I.50', estado: 'provisional' },
      { header: 'Cobertura Rol Pedagógico SEM 2', id: 'I.51', estado: 'provisional', notas: 'nomenclatura 2025' },
      { header: 'N° libros enviados de Biblioteca Viajera', id: 'I.16', estado: 'provisional' },
      { header: 'Cobertura apoderados participantes en Relatos Familiares SEM 2', id: 'I.52', estado: 'provisional' },
      { header: 'Total encuentros padres hijos', id: 'I.27', estado: 'provisional' },
      { header: 'Total de Talleres Entre Familias Aplicados', id: 'I.53', estado: 'provisional' },
      { header: '% asistencia talleres', id: 'I.25', estado: 'provisional' },
      { header: '% asistencia encuentros padres e hijos', id: 'I.28', estado: 'provisional' },
      { header: '% de talleres aplicados por Duplas', id: 'I.26', estado: 'provisional' },
      { header: 'Total talleres aplicados', id: 'I.24', estado: 'provisional', notas: 'total talleres por sala' },
    ],
  },

  // ─── Central 2025-2026 · 2026 ──────────────────────────────────────────────
  {
    label: 'Central 2025-2026 · 2026 · CONSOLIDADO JARDÍN (extendido)',
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    tab: 'CONSOLIDADO JARDÍN',
    cohorte: '2025-2026',
    anio: 2026,
    nombreCol: 'SCJI',
    mapCol: [
      { header: 'N° reuniones con directoras', id: 'I.1', estado: 'validado' },
      { header: 'N° de reuniones con educadoras', id: 'I.2', estado: 'validado' },
      { header: 'N° de reuniones territoriales con directoras desarrolladas', id: 'I.4', estado: 'validado' },
      { header: '% de directoras que participan en reuniones territoriales', id: 'I.5', estado: 'validado' },
      { header: 'N° de reuniones territoriales con coordinadoras desarrolladas', id: 'I.6', estado: 'validado' },
      { header: '% de coordinadoras que participan en reuniones territoriales', id: 'I.7', estado: 'validado' },
      { header: 'N° de instancias de sensibilización y presentación del Programa desarrolladas', id: 'I.8', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancia de sensibilización y presentación Programa', id: 'I.9', estado: 'validado' },
      { header: 'N° de formaciones anuales para agentes educativas desarrolladas', id: 'I.10', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancias de formación', id: 'I.11', estado: 'validado' },
      { header: 'N° reuniones CAUE', id: 'I.12', estado: 'validado' },
      { header: 'N° formaciones territoriales de monitores desarrolladas', id: 'I.29', estado: 'validado' },
      { header: '% de salas representadas por apoderados en la formación', id: 'I.30', estado: 'validado' },
      { header: '% de salas representadas por agentes educativas en la formación', id: 'I.31', estado: 'validado' },
      { header: '% de acciones del plan de acción implementadas', id: 'I.36', estado: 'validado' },
      { header: '% de metas logradas del plan de acción', id: 'I.37', estado: 'validado' },
      { header: 'Jardín infantil cuenta con un PLAN de acción integrado al PEI y consistente con PME', id: 'I.35', estado: 'validado' },
    ],
  },
  {
    label: 'Central 2025-2026 · 2026 · CONSOLIDADO SALAS (extendido, agregado)',
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    tab: 'CONSOLIDADO SALAS',
    cohorte: '2025-2026',
    anio: 2026,
    nombreCol: 'SCJI',
    aggregate: 'mean',
    mapCol: [
      { header: 'Uso de la bitácora como medio oficial de comunicación', id: 'I.48', estado: 'provisional', notas: 'promedio SI/NO por sala' },
      { header: '% de familias que participan en experiencias pedagógicas ANUAL', id: 'I.41', estado: 'provisional' },
      { header: 'Promedio anual Reunión apoderados', id: 'I.47', estado: 'provisional' },
      { header: 'Cobertura de 1 entrevista de apoderados', id: 'I.45', estado: 'provisional' },
      { header: 'Cobertura de 2 entrevistas de apoderados', id: 'I.46', estado: 'provisional' },
      { header: 'Cobertura Voluntariado', id: 'I.50', estado: 'provisional' },
      { header: 'Cobertura Rol Educativo SEM 2', id: 'I.51', estado: 'provisional' },
      { header: 'N° libros enviados de Biblioteca Viajera', id: 'I.16', estado: 'provisional' },
      { header: 'N° de semanas envío BV', id: 'I.14', estado: 'provisional' },
      { header: '% de familias que reciben libros', id: 'I.15', estado: 'provisional' },
      { header: 'Sala que envían libros con ritos', id: 'I.17', estado: 'provisional' },
      { header: 'N de cartillas enviadas de BV', id: 'I.18', estado: 'provisional' },
      { header: 'Salas que envían el calendario de invierno', id: 'I.20', estado: 'provisional' },
      { header: 'Cobertura apoderados participantes en Baúl MFC (Relatos Familiares) ANUAL', id: 'I.52', estado: 'provisional' },
      { header: 'Salas que desarrollan RF', id: 'I.21', estado: 'provisional' },
    ],
  },

  // ─── Central 2026-2027 · 2026 ──────────────────────────────────────────────
  {
    label: 'Central 2026-2027 · 2026 · CONS. NIVEL JARDÍN (extendido)',
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    tab: 'CONS. NIVEL JARDÍN',
    cohorte: '2026-2027',
    anio: 2026,
    nombreCol: 'SCJI',
    mapCol: [
      { header: 'N° reuniones con directoras', id: 'I.1', estado: 'validado' },
      { header: 'N° de reuniones con educadoras', id: 'I.2', estado: 'validado' },
      { header: 'N° de reuniones territoriales con directoras desarrolladas', id: 'I.4', estado: 'validado' },
      { header: '% de directoras que participan en reuniones territoriales', id: 'I.5', estado: 'validado' },
      { header: 'N° de reuniones territoriales con coordinadoras desarrolladas', id: 'I.6', estado: 'validado' },
      { header: '% de coordinadoras que participan en reuniones territoriales', id: 'I.7', estado: 'validado' },
      { header: 'N° de instancias de sensibilización y presentación del Programa desarrolladas', id: 'I.8', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancia de sensibilización y presentación Programa', id: 'I.9', estado: 'validado' },
      { header: 'N° de formaciones anuales para agentes educativas desarrolladas', id: 'I.10', estado: 'validado' },
      { header: '% de agentes educativas que participan en instancias de formación', id: 'I.11', estado: 'validado' },
      { header: 'N° reuniones CAUE', id: 'I.12', estado: 'validado' },
      { header: 'N° formaciones territoriales de monitores desarrolladas', id: 'I.29', estado: 'validado' },
      { header: '% de salas representadas por apoderados en la formación', id: 'I.30', estado: 'validado' },
      { header: '% de salas representadas por agentes educativas en la formación', id: 'I.31', estado: 'validado' },
      { header: '% de acciones del plan de acción implementadas', id: 'I.36', estado: 'validado' },
      { header: '% de metas logradas del plan de acción', id: 'I.37', estado: 'validado' },
      { header: 'Jardín infantil cuenta con un PLAN de acción integrado al PEI y consistente con PME', id: 'I.35', estado: 'validado' },
    ],
  },
  {
    label: 'Central 2026-2027 · 2026 · CONS NIVEL SALAS (extendido, agregado)',
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    tab: 'CONS NIVEL SALAS',
    cohorte: '2026-2027',
    anio: 2026,
    nombreCol: 'SCJI',
    aggregate: 'mean',
    mapCol: [
      { header: 'Uso de la bitácora como medio oficial de comunicación', id: 'I.48', estado: 'provisional' },
      { header: '% de familias que participan en experiencias pedagógicas ANUAL', id: 'I.41', estado: 'provisional' },
      { header: 'Promedio anual Reunión apoderados', id: 'I.47', estado: 'provisional' },
      { header: 'Cobertura de 1 entrevista de apoderados', id: 'I.45', estado: 'provisional' },
      { header: 'Cobertura de 2 entrevistas de apoderados', id: 'I.46', estado: 'provisional' },
      { header: 'Cobertura Voluntariado', id: 'I.50', estado: 'provisional' },
      { header: 'Cobertura Rol Educativo SEM 2', id: 'I.51', estado: 'provisional' },
      { header: 'N° libros enviados de Biblioteca Viajera', id: 'I.16', estado: 'provisional' },
      { header: 'N° de semanas envío BV', id: 'I.14', estado: 'provisional' },
      { header: '% de familias que reciben libros', id: 'I.15', estado: 'provisional' },
      { header: 'Sala que envían libros con ritos', id: 'I.17', estado: 'provisional' },
      { header: 'N de cartillas enviadas de BV', id: 'I.18', estado: 'provisional' },
      { header: 'Salas que envían el calendario de invierno', id: 'I.20', estado: 'provisional' },
      { header: 'Cobertura apoderados participantes en Baúl MFC (Relatos Familiares) ANUAL', id: 'I.52', estado: 'provisional' },
      { header: 'Salas que desarrollan RF', id: 'I.21', estado: 'provisional' },
    ],
  },

  // ─── COORDINADOR tabs (contienen Comité comunal, formaciones, CAUE, etc.) ──
  {
    label: 'Central 2025-2026 · 2026 · COORDINADOR',
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    tab: 'COORDINADOR',
    cohorte: '2025-2026',
    anio: 2026,
    nombreCol: 'SCJI',
    mapCol: [
      { header: 'N° de comités comunales en los que participa el jardín infantil', id: 'I.22', estado: 'validado' },
      { header: '% de familias que participan en la actividad', id: 'I.23', estado: 'validado' },
      { header: '% de agentes educativas con malla formativa completa.', id: 'I.38', estado: 'provisional', notas: 'no siempre presente' },
      // Columnas con 100% fill: proxies para I.33 (asistencia apoderados) y I.34 (asistencia agentes)
      { header: '% asistencia Formación 2 Relatos Familiares', id: 'I.34', estado: 'provisional', notas: 'proxy: asistencia formación agentes' },
      { header: '% asistencia Formación 3 Experiencias Pedagógicas con participación de las familias (modalidades)', id: 'I.33', estado: 'provisional', notas: 'proxy: asistencia formación familias' },
      // I.3: no hay columna directa "% educadoras que participan en reuniones" en COORDINADOR 2026
    ],
  },
  {
    label: 'Central 2026-2027 · 2026 · COORDINADOR',
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    tab: 'COORDINADOR',
    cohorte: '2026-2027',
    anio: 2026,
    nombreCol: 'SCJI',
    mapCol: [
      { header: 'N° de comités comunales en los que participa el jardín infantil', id: 'I.22', estado: 'validado' },
      { header: '% de familias que participan en la actividad', id: 'I.23', estado: 'validado' },
      { header: '% de agentes educativas con malla formativa completa.', id: 'I.38', estado: 'provisional' },
      { header: '% asistencia Formación 2 Relatos Familiares', id: 'I.34', estado: 'provisional' },
      { header: '% asistencia Formación 3 Experiencias Pedagógicas con participación de las familias (modalidades)', id: 'I.33', estado: 'provisional' },
    ],
  },
];

// ─── ZERO_FALLBACK ─────────────────────────────────────────────────────────
// Indicadores que aplican al scope del semestre ejecutado por la cohorte pero
// cuya columna en la Central está estructurada y vacía. Por decisión del
// usuario: emitir valor 0 = "sin actividad reportada" en vez de dejar la
// celda como gap, para que la UI refleje que no hubo actividad.
//
// Reglas:
//   - Cohorte 2025-2026 ejecutó hasta Sem 3 → todos sus indicadores Sem 1-3 aplican.
//   - Cohorte 2026-2027 ejecutó solo Sem 1 → solo indicadores Sem 1 aplican.
//   - Solo se emite si NO hay ya un valor real desde alguna PARV_TABS.
//
// La lista de indicadores/cohorte viene del análisis de fill rate: columnas
// con 0% fill en la Central pero dentro del scope del semestre ejecutado.
const ZERO_FALLBACK = [
  {
    cohorte: '2025-2026', anio: 2026,
    // Central 2025-2026 · 2026 es la fuente de nombres de jardín.
    jardinesFromWb: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    jardinesFromTab: 'CONSOLIDADO JARDÍN',
    jardinesFromCol: 'SCJI',
    // Indicadores en scope (Sem <= 3) con columna vacía en la Central 2026:
    //   I.30 (Sem 1), I.31 (Sem 1), I.48 (Sem 1),
    //   I.36 (Sem 3), I.37 (Sem 3)
    ids: ['I.30', 'I.31', 'I.48', 'I.36', 'I.37'],
  },
  {
    cohorte: '2026-2027', anio: 2026,
    jardinesFromWb: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    jardinesFromTab: 'CONS. NIVEL JARDÍN',
    jardinesFromCol: 'SCJI',
    // Cohorte 2026-2027 solo ejecutó Sem 1 → solo Sem 1 aplica:
    //   I.30 (Sem 1), I.31 (Sem 1), I.48 (Sem 1)
    // NO se incluyen I.36/I.37 (Sem 3) porque no aplican aún a esta cohorte.
    ids: ['I.30', 'I.31', 'I.48'],
  },
];

// jarId slugger — matches ingestParvulario.mjs
function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function cleanName(s) { return String(s || '').replace(/\s*\(.*?\)\s*/g, '').replace(/[.,;]+$/, '').trim(); }
function jarId(name) { return `jar-${slug(cleanName(name))}`; }

// Ingest one Central tab into a list of docs.
async function ingestParvTab(spec, cache) {
  const key = `${spec.id}|${spec.tab}`;
  let rows = cache.get(key);
  if (!rows) {
    rows = await readTab(spec.id, spec.tab);
    cache.set(key, rows);
  }
  if (!rows.length) return { emitted: [], skipped: [], reason: 'empty' };

  const header = rows[0];
  const nombreIdx = findCol(header, spec.nombreCol);
  if (nombreIdx < 0) {
    return { emitted: [], skipped: [], reason: `no encuentro columna "${spec.nombreCol}"` };
  }

  const emitted = [];
  const skipped = [];
  for (const ind of spec.mapCol) {
    const indicador = IND_PARV_BY_ID[ind.id];
    if (!indicador) { skipped.push({ id: ind.id, reason: 'no en catálogo' }); continue; }
    let col = findCol(header, ind.header);
    if (col < 0) {
      // Fallback: prefix match on the first 40 chars.
      col = findColPrefix(header, ind.header.slice(0, 40));
      if (col < 0) { skipped.push({ id: ind.id, header: ind.header, reason: 'columna no encontrada' }); continue; }
    }

    if (spec.aggregate === 'mean') {
      // Bucket rows by jardín
      const buckets = new Map();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const nombre = String(r[nombreIdx] || '').trim();
        if (!nombre || /^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
        const parsed = parseCell(r[col], indicador.unidad, indicador.tipoMeta);
        if (parsed.valor === null) continue;
        const arr = buckets.get(nombre) || [];
        arr.push(parsed.valor);
        buckets.set(nombre, arr);
      }
      for (const [nombre, arr] of buckets.entries()) {
        const valor = arr.reduce((s, v) => s + v, 0) / arr.length;
        const estId = jarId(nombre);
        emitted.push({
          programa: 'parvulario',
          establecimientoId: estId,
          establecimientoNombre: nombre,
          indicadorId: ind.id,
          ambito: indicador.ambito,
          cohorte: spec.cohorte,
          anio: spec.anio,
          periodo: String(spec.anio),
          valor,
          raw: `mean over ${arr.length} salas`,
          meta: indicador.meta, metaNum: indicador.metaNum, unidad: indicador.unidad,
          logro: computeLogro(indicador, valor),
          estado: ind.estado,
          fuente: { workbookId: spec.id, workbookLabel: spec.label, tab: spec.tab, col: ind.header, agg: 'mean', nSalas: arr.length },
        });
      }
    } else {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue;
        const nombre = String(r[nombreIdx] || '').trim();
        if (!nombre || /^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
        const parsed = parseCell(r[col], indicador.unidad, indicador.tipoMeta);
        if (parsed.valor === null) continue;
        const estId = jarId(nombre);
        emitted.push({
          programa: 'parvulario',
          establecimientoId: estId,
          establecimientoNombre: nombre,
          indicadorId: ind.id,
          ambito: indicador.ambito,
          cohorte: spec.cohorte,
          anio: spec.anio,
          periodo: String(spec.anio),
          valor: parsed.valor,
          raw: parsed.raw,
          meta: indicador.meta, metaNum: indicador.metaNum, unidad: indicador.unidad,
          logro: computeLogro(indicador, parsed.valor),
          estado: ind.estado,
          fuente: { workbookId: spec.id, workbookLabel: spec.label, tab: spec.tab, col: ind.header, row: i + 1 },
        });
        if (parsed.notas) emitted[emitted.length - 1].notas = parsed.notas;
      }
    }
  }
  return { emitted, skipped, reason: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE B · Escolar 2025 pivote (Base Vertical)
// ═══════════════════════════════════════════════════════════════════════════════

const ESC_2025_PIVOT = '1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus';

async function ingestEscolar2025() {
  console.log('\n─── Ruta B · Escolar 2025 pivote ─────────────────────────');
  const nombreRows = await readTab(ESC_2025_PIVOT, 'Nombre escuelas', 'A1:B50');
  const rbdToName = new Map();
  if (nombreRows.length) {
    for (let i = 1; i < nombreRows.length; i++) {
      const r = nombreRows[i]; if (!r) continue;
      const rbd = String(r[0] || '').trim();
      const nombre = String(r[1] || '').trim();
      if (rbd && nombre) rbdToName.set(rbd, nombre);
    }
  }
  console.log(`  Nombre escuelas: ${rbdToName.size} RBD→nombre`);

  const rows = await readTab(ESC_2025_PIVOT, 'Base Vertical', 'A1:P5000');
  if (!rows.length) { console.warn('  Base Vertical vacío'); return []; }
  const header = rows[0];
  const idxRBD = findCol(header, 'RBD');
  const idxInd = findCol(header, 'Indicador');
  const idxValNum = findCol(header, 'Valor Numerico');
  const idxValor = findCol(header, 'Valor');
  const idxMetaNum = findCol(header, 'Meta Numerica');
  if (idxRBD < 0 || idxInd < 0) { console.warn('  Base Vertical sin cols requeridas'); return []; }

  console.log(`  Base Vertical: ${rows.length - 1} filas`);

  // Nombre → firestore id map (cohorte 2025-2027 solamente)
  // Los establecimientos ya existen en establecimientos_real como esc-<slug>.
  function fsIdFor(nombre) {
    return nameToFsId.get(`escolar|${normName(nombre)}`) || null;
  }

  // The pivot has one row per (RBD × curso × indicador). Aggregate to
  // (escuela × indicador) by taking the mean of numeric values. That mirrors
  // how a school-level indicator is intended to summarise its cursos.
  const buckets = new Map(); // key: `${fsId}|${indId}` → { indicador, nombre, values: [], nRows }
  const skipped = { noRBD: 0, noSchool: 0, noInd: 0, notInRoster: 0, noValue: 0 };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const rbd = String(r[idxRBD] || '').trim();
    if (!rbd) { skipped.noRBD++; continue; }
    const nombre = rbdToName.get(rbd);
    if (!nombre) { skipped.noSchool++; continue; }
    const fsId = fsIdFor(nombre);
    if (!fsId) { skipped.notInRoster++; continue; }

    const indRaw = String(r[idxInd] || '').trim();
    if (!indRaw) { skipped.noInd++; continue; }
    const indId = indRaw.match(/^I\.?(\d+)$/) ? `I${indRaw.replace(/^I\.?/, '')}` : indRaw;
    const indicador = IND_ESC_2025_BY_ID[indId] || catalog.indicadores.escolar2025.find(x => x.id === indId);
    if (!indicador) { skipped.noInd++; continue; }

    let parsed = null;
    if (idxValNum >= 0) parsed = parseCell(r[idxValNum], indicador.unidad, indicador.tipoMeta);
    if ((!parsed || parsed.valor === null) && idxValor >= 0) parsed = parseCell(r[idxValor], indicador.unidad, indicador.tipoMeta);
    if (!parsed || parsed.valor === null) { skipped.noValue++; continue; }

    const key = `${fsId}|${indId}`;
    let b = buckets.get(key);
    if (!b) { b = { fsId, nombre, indicador, indId, values: [], nRows: 0 }; buckets.set(key, b); }
    b.values.push(parsed.valor);
    b.nRows++;
  }

  const emitted = [];
  for (const b of buckets.values()) {
    // For binary indicators: mean gives % de "Sí" across cursos (fractional 0..1).
    // For percentages: mean of percentages.
    // For counts: mean over cursos.
    const valor = b.values.reduce((s, v) => s + v, 0) / b.values.length;
    emitted.push({
      programa: 'escolar',
      establecimientoId: b.fsId,
      establecimientoNombre: b.nombre,
      indicadorId: b.indId,
      ambito: b.indicador.ambito,
      cohorte: '2025-2027',
      anio: 2025,
      periodo: '2025',
      valor,
      raw: `mean over ${b.values.length} cursos`,
      meta: b.indicador.meta, metaNum: b.indicador.metaNum, unidad: b.indicador.unidad,
      logro: computeLogro(b.indicador, valor),
      estado: 'validado',
      fuente: { workbookId: ESC_2025_PIVOT, workbookLabel: 'Resultados indicadores 2025 (pivote)', tab: 'Base Vertical', agg: 'mean over cursos', nCursos: b.values.length },
    });
  }
  console.log(`  emitidas: ${emitted.length}  (agregado por escuela × indicador)`);
  console.log(`  saltadas:`, skipped);
  return emitted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

const allResults = [];
const stats = { parv: 0, esc: 0, skippedByTab: [], byEstado: { validado: 0, provisional: 0 } };

if (TRACK === 'both' || TRACK === 'parvulario') {
  console.log('\n─── Ruta A · Parvulario Centrales (extendido) ────────────');
  const tabCache = new Map();
  for (const spec of PARV_TABS) {
    const { emitted, skipped, reason } = await ingestParvTab(spec, tabCache);
    if (reason) console.warn(`  ${spec.label}: ${reason}`);
    console.log(`  ${spec.label.padEnd(60)} → ${emitted.length} valores${skipped.length ? ` (${skipped.length} skipped)` : ''}`);
    if (skipped.length) {
      for (const s of skipped) stats.skippedByTab.push({ tab: spec.label, ...s });
    }
    for (const r of emitted) {
      // resolve to real Firestore establecimientoId; if not in roster, skip and record
      const fsId = nameToFsId.get(`parvulario|${normName(r.establecimientoNombre)}`);
      if (!fsId) continue;
      r.establecimientoId = fsId;
      allResults.push(r);
      stats.parv++;
      stats.byEstado[r.estado] = (stats.byEstado[r.estado] || 0) + 1;
    }
  }

  // ─── ZERO_FALLBACK: emitir valor 0 para indicadores en scope sin data en Central ──
  console.log('\n─── Ruta A · ZERO_FALLBACK (indicadores en scope con columna vacía) ─');
  // Set de llaves ya emitidas para saber cuáles NO tocar.
  const yaEmitido = new Set(allResults
    .filter(r => r.programa === 'parvulario')
    .map(r => `${r.establecimientoId}|${r.indicadorId}|${r.anio}`));

  for (const zf of ZERO_FALLBACK) {
    // Leer lista de jardines de esta cohorte desde la tab canonical.
    const rows = await readTab(zf.jardinesFromWb, zf.jardinesFromTab);
    if (!rows.length) {
      console.warn(`  ⚠ ${zf.cohorte}·${zf.anio}: no puedo leer ${zf.jardinesFromTab}`);
      continue;
    }
    const header = rows[0];
    const nombreIdx = findCol(header, zf.jardinesFromCol);
    if (nombreIdx < 0) {
      console.warn(`  ⚠ ${zf.cohorte}·${zf.anio}: no encuentro columna "${zf.jardinesFromCol}"`);
      continue;
    }
    const jardines = new Set();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const nombre = String(r[nombreIdx] || '').trim();
      if (!nombre || /^(total|resumen|totales|planilla|cohorte|año|url)/i.test(nombre)) continue;
      jardines.add(nombre);
    }

    let emitidos = 0, saltados = 0;
    for (const nombre of jardines) {
      const fsId = nameToFsId.get(`parvulario|${normName(nombre)}`);
      if (!fsId) { saltados++; continue; }
      for (const indId of zf.ids) {
        const indicador = IND_PARV_BY_ID[indId];
        if (!indicador) continue;
        const key = `${fsId}|${indId}|${zf.anio}`;
        if (yaEmitido.has(key)) continue;   // valor real ya presente
        const doc = {
          programa: 'parvulario',
          establecimientoId: fsId,
          establecimientoNombre: nombre,
          indicadorId: indId,
          ambito: indicador.ambito,
          cohorte: zf.cohorte,
          anio: zf.anio,
          periodo: String(zf.anio),
          valor: 0,
          raw: 'sin actividad reportada',
          meta: indicador.meta, metaNum: indicador.metaNum, unidad: indicador.unidad,
          logro: 0,
          estado: 'validado',
          fuente: { workbookId: zf.jardinesFromWb, workbookLabel: `ZERO_FALLBACK ${zf.cohorte}·${zf.anio}`, tab: zf.jardinesFromTab, agg: 'zero-fallback' },
        };
        allResults.push(doc);
        yaEmitido.add(key);
        stats.parv++;
        stats.byEstado.validado = (stats.byEstado.validado || 0) + 1;
        emitidos++;
      }
    }
    console.log(`  ${zf.cohorte}·${zf.anio} (${jardines.size} jardines × ${zf.ids.length} inds): ${emitidos} emitidos${saltados ? ` · ${saltados} saltados (no en roster)` : ''}`);
  }
}

if (TRACK === 'both' || TRACK === 'escolar') {
  const escResults = await ingestEscolar2025();
  for (const r of escResults) {
    allResults.push(r);
    stats.esc++;
    stats.byEstado[r.estado] = (stats.byEstado[r.estado] || 0) + 1;
  }
}

// ─── Dedup + collision report ────────────────────────────────────────────────

const seen = new Map();
const collisions = [];
const deduped = [];
for (const r of allResults) {
  const key = `${r.programa}|${r.establecimientoId}|${r.indicadorId}|${r.anio}`;
  if (seen.has(key)) { collisions.push({ key, existing: seen.get(key).fuente.tab, incoming: r.fuente.tab }); continue; }
  seen.set(key, r);
  deduped.push(r);
}
if (collisions.length) {
  console.log(`\n⚠ ${collisions.length} colisiones de (programa,est,ind,año) — mantengo la primera:`);
  for (const c of collisions.slice(0, 8)) console.log(`  ${c.key}  ← ${c.incoming} (ya tenía ${c.existing})`);
}

// ─── Cross-check against audit CSV: how many gaps closed? ────────────────────

const auditRows = (await readFile(pathResolve(ROOT, 'docs/auditoria-llenado.csv'), 'utf8'))
  .split('\n').slice(1).filter(Boolean).map(line => {
    // naive parse ok — no embedded commas in relevant cols
    const c = line.split(',');
    return { programa: c[0], indicadorIdFs: c[3], establecimientoIdFs: c[7], anio: c[11], estado: c[12], confianza: c[17] };
  });
const auditGapKeys = new Set(auditRows
  .filter(a => a.estado === 'existe+no-mostrado' && a.confianza === 'confirmada')
  .map(a => `${a.programa}|${a.establecimientoIdFs}|${a.indicadorIdFs}|${a.anio}`));

const wouldClose = deduped.filter(r => auditGapKeys.has(`${r.programa}|${r.establecimientoId}|${r.indicadorId}|${r.anio}`)).length;
const outsideGap = deduped.length - wouldClose;

// Break down "fuera del gap" — is it re-escribe cell ya mostrada, o out-of-catalog?
const auditKeys = new Set(auditRows.map(a => `${a.programa}|${a.establecimientoIdFs}|${a.indicadorIdFs}|${a.anio}`));
let outCategory = { alreadyShown: 0, outsideCatalog: 0, samples: [] };
for (const r of deduped) {
  const k = `${r.programa}|${r.establecimientoId}|${r.indicadorId}|${r.anio}`;
  if (auditGapKeys.has(k)) continue;
  if (auditKeys.has(k)) outCategory.alreadyShown++;
  else { outCategory.outsideCatalog++; if (outCategory.samples.length < 8) outCategory.samples.push(k); }
}

console.log('\n─── Resumen ──────────────────────────────────────────────');
console.log(`  Total emitido:       ${deduped.length}`);
console.log(`     · parvulario:     ${stats.parv}`);
console.log(`     · escolar:        ${stats.esc}`);
console.log(`  Por estado:`);
console.log(`     · validado:       ${stats.byEstado.validado || 0}`);
console.log(`     · provisional:    ${stats.byEstado.provisional || 0}`);
console.log(`  Cierra gap auditado: ${wouldClose}  (del target 1893 confirmadas)`);
console.log(`  Fuera del gap:       ${outsideGap}`);
console.log(`    · re-escribe cell ya mostrada: ${outCategory.alreadyShown}`);
console.log(`    · fuera del catálogo/matriz:   ${outCategory.outsideCatalog}`);
if (outCategory.samples.length) {
  console.log(`    · muestras fuera-del-catálogo:`);
  for (const s of outCategory.samples) console.log(`        ${s}`);
}
console.log(`  Cols saltadas por tab: ${stats.skippedByTab.length}`);
if (stats.skippedByTab.length) {
  for (const s of stats.skippedByTab) console.log(`    ${s.tab}: ${s.id} ${s.header ? '· '+s.header : ''} — ${s.reason}`);
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] muestra de 5 docs:');
  for (const r of deduped.slice(0, 5)) {
    console.log(`  ${r.programa} · ${r.establecimientoId} · ${r.indicadorId} · ${r.anio}  = ${r.valor}  (${r.estado})`);
  }
  console.log('\n[DRY-RUN] Nada escrito. Corre sin --dry-run para persistir.');
  process.exit(0);
}

// ─── Write ───────────────────────────────────────────────────────────────────

console.log('\n─── Escribiendo a resultados_real ────────────────────────');
const batches = [];
let batch = db.batch(); let count = 0; let total = 0;
for (const r of deduped) {
  const prefix = r.programa === 'escolar' ? 'esc' : 'parv';
  const docId = `${prefix}_${r.establecimientoId}_${r.indicadorId}_${r.periodo}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  batch.set(db.collection('resultados_real').doc(docId), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  count++; total++;
  if (count >= 400) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
}
if (count) batches.push(batch.commit());
await Promise.all(batches);
console.log(`  ${total} docs upserted (idempotente)`);

console.log('\nDone.');
process.exit(0);
