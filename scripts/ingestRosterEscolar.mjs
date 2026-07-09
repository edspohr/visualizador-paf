// Ingesta del roster Escolar real (matrícula + equipos educativos).
//
// Lee todos los `.xlsx` en scripts/datos/ y actualiza `nNinos` + `nAgentes`
// (y `rbd` cuando exista) en `establecimientos_real` por match de nombre
// normalizado. Idempotente vía `merge: true`.
//
// PII (nombres, teléfonos, emails de director/coordinador) se lee y se
// descarta en memoria — nunca se persiste ni se loguea.
//
// Uso:
//   node scripts/ingestRosterEscolar.mjs --inspect   → lista pestañas/headers/muestra
//   node scripts/ingestRosterEscolar.mjs --dry-run   → parsea y reporta, sin escribir
//   node scripts/ingestRosterEscolar.mjs             → escribe a Firestore

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve, basename } from 'node:path';
import XLSX from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const DATA_DIR = pathResolve(ROOT, 'scripts/datos');

const args = process.argv.slice(2);
const INSPECT = args.includes('--inspect');
const DRY_RUN = args.includes('--dry-run');

// ─── Init Firebase (solo si vamos a leer/escribir Firestore) ───────────────

let db = null;
async function initDb() {
  if (db) return db;
  const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
  return db;
}

// ─── Helpers de normalización ─────────────────────────────────────────────

// Igual que scripts/enrichEstablecimientos.mjs:28 — mantiene consistencia con el
// resto del pipeline. Lowercasing, sin tildes, sin prefijo "Escuela", colapsa
// espacios y símbolos.
function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^escuela\s+/, '').replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Normaliza un header (para match tolerante contra los rótulos del Excel).
function normHeader(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').replace(/[°º]/g, '').trim();
}

// ─── Match tolerante de columnas ──────────────────────────────────────────

// Cada entrada devuelve el índice de la primera columna cuyo header normalizado
// hace match con al menos uno de los patrones. `-1` si no la encuentra.
function findColumn(headers, patterns) {
  const norm = headers.map(normHeader);
  for (let i = 0; i < norm.length; i++) {
    for (const p of patterns) {
      if (p.test(norm[i])) return i;
    }
  }
  return -1;
}

// Patrones por campo. Toleran variaciones esperadas (mayúsc/minúsc, con/sin tilde,
// "SELP" typo detectado en la Hoja 1). Cada match es sobre el header ya normalizado.
// - Cohorte 2025-2027 (Los Parques): usa MATRICULA 2025 + TOTAL AGENTES EDUCATIVOS.
// - Cohorte 2026-2028 (Santa Rosa + Corina): usa MATRICULA 2026 + TOTAL EQUIPO EDUCATIVO.
const HEADER_PATTERNS = {
  escuela:   [/^escuela$/, /^establecimiento$/, /^colegio$/, /^nombre$/],
  comuna:    [/^comuna$/],
  rbd:       [/^rbd$/],
  matricula: [/^matricula/],
  totalEquipo: [/total.*(equipo|agentes).*educativos?/, /(equipo|agentes) educativos? total/],
};

// Valores que aparecen a veces en la columna COMUNA como encabezados de bloque
// (p. ej. "SELP Santa Rosa", "SLEP Santa Corina"). Se descartan silenciosamente
// para no contaminar el filtro de comuna en la UI. Aceptamos tanto "SLEP" como
// el typo "SELP" que aparece en la Hoja 1.
const COMUNA_NOISE = /\b(slep|selp)\b/i;

// ─── Extracción de una planilla ───────────────────────────────────────────

// Devuelve { file, sheet, headers, rows: [{ nombre, comuna, rbd, nNinos, nAgentes }] }
function parseXlsx(filepath) {
  const wb = XLSX.readFile(filepath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!rows.length) return { file: basename(filepath), sheet: sheetName, headers: [], rows: [] };

  // Buscamos la fila-encabezado: la primera fila que tenga tanto un header de
  // "escuela" como uno de "matricula". Así funcionamos aunque el archivo tenga
  // filas de título/portada arriba.
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i];
    if (!r) continue;
    const cIdx = findColumn(r, HEADER_PATTERNS.escuela);
    const mIdx = findColumn(r, HEADER_PATTERNS.matricula);
    if (cIdx >= 0 && mIdx >= 0) { hdrIdx = i; break; }
  }
  if (hdrIdx < 0) return { file: basename(filepath), sheet: sheetName, headers: rows[0] ?? [], rows: [] };

  const headers = rows[hdrIdx];
  const colEscuela = findColumn(headers, HEADER_PATTERNS.escuela);
  const colComuna  = findColumn(headers, HEADER_PATTERNS.comuna);
  const colRbd     = findColumn(headers, HEADER_PATTERNS.rbd);
  const colMat     = findColumn(headers, HEADER_PATTERNS.matricula);
  const colEquipo  = findColumn(headers, HEADER_PATTERNS.totalEquipo);

  const extracted = [];
  // Estado para heredar la comuna cuando la celda viene vacía (patrón típico
  // de celdas mergeadas en Excel donde solo la primera fila del grupo la trae).
  let lastComuna = null;
  const asInt = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const cleanComuna = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const s = String(raw).trim();
    if (!s || COMUNA_NOISE.test(s)) return null; // filtra "SELP Santa Rosa" y similares
    return s;
  };
  for (let i = hdrIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const nombre = r[colEscuela];
    const matricula = r[colMat];
    // Skip filas de bloque anexo (Matrícula Ideal por sala) que no tienen matrícula real.
    if (!nombre || matricula === null || matricula === undefined || matricula === '') continue;
    const comunaRaw = colComuna >= 0 ? cleanComuna(r[colComuna]) : null;
    if (comunaRaw) lastComuna = comunaRaw;
    const row = {
      nombre: String(nombre).trim(),
      comuna: comunaRaw ?? lastComuna,
      rbd:    colRbd >= 0 ? asInt(r[colRbd]) : null,
      nNinos: asInt(matricula),
      nAgentes: colEquipo >= 0 ? asInt(r[colEquipo]) : null,
    };
    if (row.nNinos === null && row.nAgentes === null) continue; // fila sin datos útiles
    extracted.push(row);
  }
  return { file: basename(filepath), sheet: sheetName, headers, rows: extracted, hdrIdx };
}

// ─── Modo inspect ─────────────────────────────────────────────────────────

async function runInspect(files) {
  console.log(`Modo --inspect · ${files.length} archivo(s) en scripts/datos/\n`);
  for (const filepath of files) {
    const wb = XLSX.readFile(filepath);
    console.log(`📄 ${basename(filepath)}`);
    console.log(`   Pestañas: ${wb.SheetNames.join(', ')}`);
    const parsed = parseXlsx(filepath);
    console.log(`   Headers detectados (fila ${parsed.hdrIdx ?? '?'}): ${(parsed.headers || []).map(h => h ?? '∅').join(' | ')}`);
    console.log(`   Filas parseadas: ${parsed.rows.length}`);
    if (parsed.rows.length) {
      console.log('   Muestra (primeras 5):');
      for (const r of parsed.rows.slice(0, 5)) {
        console.log(`     · ${r.nombre.padEnd(45)} comuna=${r.comuna ?? '—'}  rbd=${r.rbd ?? '—'}  nNinos=${r.nNinos}  nAgentes=${r.nAgentes}`);
      }
    }
    console.log('');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  let entries;
  try {
    entries = await readdir(DATA_DIR);
  } catch (err) {
    console.error(`❌ No se pudo leer ${DATA_DIR}: ${err.message}`);
    process.exit(1);
  }
  const files = entries
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .map(f => pathResolve(DATA_DIR, f));

  if (!files.length) {
    console.log(`⚠️  No hay archivos .xlsx en ${DATA_DIR}`);
    console.log('   Deposita las planillas del cliente ahí y vuelve a correr el script.');
    process.exit(0);
  }

  if (INSPECT) {
    await runInspect(files);
    return;
  }

  // Parseamos todas las planillas
  const parseAll = files.map(parseXlsx);
  let totalFilas = 0;
  for (const p of parseAll) {
    console.log(`📄 ${p.file}: ${p.rows.length} filas`);
    totalFilas += p.rows.length;
  }
  console.log(`\nTotal filas parseadas: ${totalFilas}\n`);

  // Snapshot de Firestore
  await initDb();
  console.log('Leyendo establecimientos_real (escolar)…');
  const snap = await db.collection('establecimientos_real').where('programa', '==', 'escolar').get();
  console.log(`  ${snap.size} docs escolares en Firestore\n`);

  // Index por nombre normalizado
  const byNormName = new Map();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.nombre) byNormName.set(normName(data.nombre), { id: d.id, ref: d.ref, data });
  }

  // Match + queue de patches
  const patches = [];
  const noMatch = [];
  const matched = new Set();
  for (const p of parseAll) {
    for (const row of p.rows) {
      const key = normName(row.nombre);
      const hit = byNormName.get(key);
      if (!hit) {
        noMatch.push({ archivo: p.file, nombre: row.nombre, comuna: row.comuna });
        continue;
      }
      const patch = { updatedAt: FieldValue.serverTimestamp() };
      if (row.nNinos !== null)   patch.nNinos = row.nNinos;
      if (row.nAgentes !== null) patch.nAgentes = row.nAgentes;
      if (row.rbd !== null)      patch.rbd = row.rbd;
      if (row.comuna && !hit.data.comuna) patch.comuna = row.comuna; // solo si Firestore no la tenía
      patches.push({ ref: hit.ref, id: hit.id, nombreFirestore: hit.data.nombre, patch, source: p.file });
      matched.add(hit.id);
    }
  }

  const orphans = [...snap.docs].filter(d => !matched.has(d.id)).map(d => ({ id: d.id, nombre: d.data().nombre }));

  console.log(`Matches: ${patches.length}`);
  console.log(`Sin match en Firestore: ${noMatch.length}`);
  console.log(`Docs Escolares en Firestore sin cubrir (huérfanos): ${orphans.length}`);

  if (noMatch.length) {
    console.log('\n⚠️  Filas sin match:');
    for (const w of noMatch) console.log(`  · ${w.archivo}: "${w.nombre}" (comuna=${w.comuna ?? '—'})`);
  }
  if (orphans.length) {
    console.log('\n⚠️  Docs escolares no cubiertos por ninguna planilla:');
    for (const o of orphans) console.log(`  · ${o.id}: "${o.nombre}"`);
  }

  console.log('\nMuestra de patches (primeros 5):');
  for (const p of patches.slice(0, 5)) {
    const { updatedAt, ...visible } = p.patch;
    console.log(`  ${p.id} "${p.nombreFirestore}" ⇐ ${p.source}:`, visible);
  }

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Nada escrito.');
    return;
  }

  console.log('\nEscribiendo merges…');
  let batch = db.batch(); let count = 0; const commits = [];
  for (const p of patches) {
    batch.set(p.ref, p.patch, { merge: true });
    count++;
    if (count >= 400) { commits.push(batch.commit()); batch = db.batch(); count = 0; }
  }
  if (count) commits.push(batch.commit());
  await Promise.all(commits);
  console.log(`✅ ${patches.length} docs actualizados en establecimientos_real.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
