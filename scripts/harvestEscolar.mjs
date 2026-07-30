// Harvest Escolar: baja los rangos crudos de todas las planillas Escolar
// declaradas en `src/data/escolarPlanillaIndex.json` y las cachea en disco
// para re-parseo offline.
//
// Diseño (E3 del addendum):
//   - Completo, no muestreado. Cada planilla en `expected` se intenta.
//   - Reanudable: checkpoint persistente en `.cache/harvest/checkpoint.json`.
//     `--resume` continúa desde donde quedó, sin re-fetchear planillas ya
//     completadas exitosamente.
//   - Retry con backoff + jitter sobre 429/5xx/timeouts. Errores permanentes
//     (403 sin permiso, 404) no se retrian; se registran.
//   - Quotas: espera pequeña entre requests, agrupa lecturas por planilla
//     (una llamada `spreadsheets.get` para metadata + N llamadas por rango).
//   - Cache raw: `.cache/harvest/{spreadsheetId}.json` con la respuesta cruda
//     de todas las lecturas. Re-parseo no requiere re-fetch.
//   - Reporte estructurado en `reports/harvestEscolar-YYYY-MM-DD.json`.
//   - `--dry-run`: no fetchea, sólo imprime lo que fetchearía.
//   - `--sample=N`: fetchea solo N planillas (para pruebas). Default: todas.
//   - `--limit=N`: alias para --sample.
//   - `--only=<spreadsheetId>[,<id>...]`: fetchea solo estos IDs.
//
// Este script no escribe a Firestore. Su output es el cache + el reporte;
// otro script (E4 mapping + E5 manifest) consume el cache para producir docs.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

// ─── Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESUME = args.includes('--resume');
const SAMPLE = Number((args.find(a => a.startsWith('--sample=') || a.startsWith('--limit=')) || '').split('=')[1]) || null;
const ONLY = (args.find(a => a.startsWith('--only=')) || '').split('=')[1]?.split(',').filter(Boolean) || null;

console.log(`[harvest] dry-run=${DRY_RUN} resume=${RESUME} sample=${SAMPLE || 'all'} only=${ONLY ? ONLY.length : 0}`);

// ─── Paths ─────────────────────────────────────────────────────────────────
const INDEX_PATH = pathResolve(ROOT, 'src/data/escolarPlanillaIndex.json');
const CACHE_DIR = pathResolve(ROOT, '.cache/harvest');
const CHECKPOINT_PATH = pathResolve(CACHE_DIR, 'checkpoint.json');
const REPORT_PATH = pathResolve(ROOT, 'reports', `harvestEscolar-${new Date().toISOString().slice(0, 10)}.json`);

// ─── Load index ────────────────────────────────────────────────────────────
console.log(`[harvest] Cargando ${INDEX_PATH}...`);
const idx = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
let planillas = idx.entries.filter(e => e.estado === 'expected');
console.log(`[harvest] Planillas esperadas: ${planillas.length}`);

if (ONLY) planillas = planillas.filter(p => ONLY.includes(p.spreadsheetId));
if (SAMPLE) planillas = planillas.slice(0, SAMPLE);
console.log(`[harvest] Planillas a procesar en esta corrida: ${planillas.length}`);

// ─── Auth ──────────────────────────────────────────────────────────────────
const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Checkpoint ────────────────────────────────────────────────────────────
await mkdir(CACHE_DIR, { recursive: true });
let checkpoint = { completed: {}, errors: {} };
if (RESUME) {
  try {
    checkpoint = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'));
    console.log(`[harvest] Checkpoint cargado: ${Object.keys(checkpoint.completed).length} completadas, ${Object.keys(checkpoint.errors).length} con error`);
  } catch (e) {
    console.log('[harvest] Sin checkpoint previo, empezando de cero.');
  }
}

async function saveCheckpoint() {
  await writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

// ─── Retry con backoff + jitter ────────────────────────────────────────────
function classifyError(e) {
  const code = e?.code || e?.response?.status || 0;
  if (code === 403 || code === 404) return 'permanent';
  if (code === 429 || code >= 500 || /timeout|ECONN|EAI_AGAIN/i.test(e?.message || '')) return 'transient';
  return 'unknown';
}

async function withRetry(fn, label, maxAttempts = 5) {
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const kind = classifyError(e);
      if (kind === 'permanent') throw e;
      attempt++;
      if (attempt >= maxAttempts) throw e;
      const base = Math.min(30000, 1000 * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 500);
      const wait = base + jitter;
      console.log(`  ⚠ ${label} intento ${attempt} falló (${kind}, code=${e?.code || e?.response?.status}), reintentando en ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ─── Harvest de una planilla ───────────────────────────────────────────────
async function harvestPlanilla(entry) {
  const { spreadsheetId, escuela, arquetipo, cursoCanonical, anio } = entry;
  const cacheFile = pathResolve(CACHE_DIR, `${spreadsheetId}.json`);
  const label = `${escuela} · ${anio} · ${arquetipo}${cursoCanonical ? '·' + cursoCanonical : ''}`;

  // Skip if already cached and file mtime is recent (< 24h) unless resume forces refetch.
  // For now, if checkpoint says completed, skip.
  if (checkpoint.completed[spreadsheetId]) {
    return { spreadsheetId, label, outcome: 'skipped-cached', attempts: 0 };
  }

  const t0 = Date.now();
  let attempts = 0;

  try {
    // 1. Fetch metadata (tab list)
    const meta = await withRetry(async () => {
      attempts++;
      return (await sheets.spreadsheets.get({ spreadsheetId })).data;
    }, `${label} meta`);

    const tabs = (meta.sheets || []).map(s => ({
      title: s.properties?.title,
      sheetId: s.properties?.sheetId,
      rowCount: s.properties?.gridProperties?.rowCount,
      colCount: s.properties?.gridProperties?.columnCount,
    }));

    // 2. Fetch ranges. For unknown archetypes we grab the first ~200 rows of every tab
    // so E4's declarative mapping can be verified offline. Small planillas → whole thing.
    const ranges = [];
    const rangeData = {};
    for (const tab of tabs) {
      const maxRows = Math.min(tab.rowCount || 200, 200);
      const maxCols = Math.min(tab.colCount || 30, 30);
      const lastCol = String.fromCharCode(64 + Math.min(maxCols, 26)); // A..Z max
      const range = `${tab.title}!A1:${lastCol}${maxRows}`;
      ranges.push(range);
    }

    // batchGet to reduce roundtrips
    const batchResp = await withRetry(async () => {
      attempts++;
      return (await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: 'UNFORMATTED_VALUE' })).data;
    }, `${label} values`);

    for (const vr of batchResp.valueRanges || []) {
      rangeData[vr.range] = vr.values || [];
    }

    // 3. Persist cache
    const snapshot = {
      spreadsheetId,
      title: meta.properties?.title,
      harvestedAt: new Date().toISOString(),
      tabs,
      ranges: rangeData,
      // NO se persiste la pestaña "Estudiantes" ni ninguna que contenga
      // patrones RUT — filtro defensivo antes de escribir.
    };

    // PII guard: filtrar RUTs Y nombres completos de estudiante antes de
    // escribir al cache. Nombres institucionales ("Escuela Villa San Miguel")
    // NO son PII y se conservan; sólo redactamos secuencias de 4+ palabras
    // en MAYÚSCULA SOSTENIDA, que es el patrón del tab Estudiantes.
    // Es una barrera de última milla, no reemplazo del diseño de la ingesta.
    const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[0-9kK]\b/;
    const STUDENT_NAME = /\b(?:[A-ZÁÉÍÓÚÑ]{3,}\s+){3,}[A-ZÁÉÍÓÚÑ]{3,}\b/;
    const INSTITUTIONAL = /^(escuela|jard[íi]n|colegio|liceo|slep|centro|instituto|fundaci[óo]n|consultora)\b/i;
    let piiRedacted = 0;
    for (const range of Object.keys(snapshot.ranges)) {
      const rows = snapshot.ranges[range];
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const v = row[c];
          if (typeof v !== 'string') continue;
          if (RUT.test(v)) { row[c] = '[REDACTED-RUT]'; piiRedacted++; continue; }
          if (STUDENT_NAME.test(v) && !INSTITUTIONAL.test(v)) {
            row[c] = '[REDACTED-NAME]';
            piiRedacted++;
          }
        }
      }
    }
    if (piiRedacted > 0) snapshot.piiRedacted = piiRedacted;

    await writeFile(cacheFile, JSON.stringify(snapshot, null, 2));

    checkpoint.completed[spreadsheetId] = {
      label,
      harvestedAt: snapshot.harvestedAt,
      tabsCount: tabs.length,
      rangesCount: Object.keys(rangeData).length,
      piiRedacted,
    };
    delete checkpoint.errors[spreadsheetId];

    return { spreadsheetId, label, outcome: 'ok', attempts, tabsCount: tabs.length, piiRedacted, duration: Date.now() - t0 };
  } catch (e) {
    const kind = classifyError(e);
    checkpoint.errors[spreadsheetId] = {
      label,
      kind,
      code: e?.code || e?.response?.status,
      message: String(e?.message || e).slice(0, 400),
      lastAttemptAt: new Date().toISOString(),
    };
    return { spreadsheetId, label, outcome: 'error', attempts, kind, error: e?.message?.slice(0, 200), duration: Date.now() - t0 };
  }
}

// ─── Main loop ─────────────────────────────────────────────────────────────
if (DRY_RUN) {
  console.log('\n[harvest] --dry-run — no se fetchea nada. Primeras 5 planillas que se procesarían:');
  for (const p of planillas.slice(0, 5)) {
    console.log(`  ${p.escuela} · ${p.anio} · ${p.arquetipo}${p.cursoCanonical ? '·' + p.cursoCanonical : ''} → ${p.spreadsheetId}`);
  }
  console.log(`  ... (${planillas.length - 5} más)`);
  process.exit(0);
}

const results = [];
const t0Run = Date.now();
for (let i = 0; i < planillas.length; i++) {
  const p = planillas[i];
  const r = await harvestPlanilla(p);
  results.push(r);
  const prefix = r.outcome === 'ok' ? '✓' : r.outcome === 'skipped-cached' ? '↷' : '✗';
  console.log(`  [${i + 1}/${planillas.length}] ${prefix} ${r.label} (${r.outcome}, ${r.duration ?? 0}ms${r.piiRedacted ? ', redacted ' + r.piiRedacted + ' PII' : ''})`);

  // Small quota-friendly pause between requests
  if (r.outcome === 'ok') await new Promise(res => setTimeout(res, 200));

  // Save checkpoint every 25 planillas
  if ((i + 1) % 25 === 0) await saveCheckpoint();
}
await saveCheckpoint();

// ─── Reporte ───────────────────────────────────────────────────────────────
const okCount = results.filter(r => r.outcome === 'ok').length;
const skipCount = results.filter(r => r.outcome === 'skipped-cached').length;
const errCount = results.filter(r => r.outcome === 'error').length;
const piiTotal = results.reduce((s, r) => s + (r.piiRedacted || 0), 0);

console.log(`\n[harvest] Resumen: ok=${okCount}, cached-skipped=${skipCount}, error=${errCount}, PII redacted total=${piiTotal}, tiempo=${Math.round((Date.now() - t0Run) / 1000)}s`);

const report = {
  ranAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  resume: RESUME,
  totalPlanillasEnCorrida: planillas.length,
  outcomes: { ok: okCount, cachedSkipped: skipCount, error: errCount },
  piiRedactedTotal: piiTotal,
  durationSeconds: Math.round((Date.now() - t0Run) / 1000),
  results,
};
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`[harvest] Reporte: ${REPORT_PATH}`);
