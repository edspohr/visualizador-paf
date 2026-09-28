#!/usr/bin/env node
// Compare published resultados_real (a Firestore export) against the docs a
// fresh ingest would write (--dump output of ingestParvulario / ingestEscolar).
//
// Read-only. Classifies every doc id as:
//   same      — present in both, same valor
//   changed   — present in both, different valor
//   new       — only in the fresh ingest (would be created)
//   stale     — only in Firestore (a re-ingest would NOT touch it; merge upsert)
//
// Usage:
//   node scripts/diffBaseline.mjs \
//     --before=.cache/snapshots/firestore-pre-refresh-2026-09-27.json \
//     --after=.cache/snapshots/fresh-parvulario-2026-09-28.json,.cache/snapshots/fresh-escolar-2026-09-28.json \
//     [--label=baseline-retro1]
//
// Writes reports/<label>-YYYY-MM-DD.{json,md}. Only doc-level fields are
// written (ids, indicator, establishment, values); no personal data exists in
// resultados_real.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const args = process.argv.slice(2);
const arg = (name) => (args.find(a => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=') || null;
const BEFORE = arg('before');
const AFTER = (arg('after') || '').split(',').filter(Boolean);
const LABEL = arg('label') || 'baseline-retro1';
if (!BEFORE || !AFTER.length) {
  console.error('Usage: --before=<firestore export json> --after=<dump1.json>[,<dump2.json>]');
  process.exit(1);
}

const EPS = 1e-6;
const sameValor = (a, b) => {
  if (a == null && b == null) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPS;
  return a === b;
};
const programaOf = (id) => (id.startsWith('parv_') ? 'parvulario' : id.startsWith('esc_') ? 'escolar' : 'otro');

const exportJson = JSON.parse(await readFile(pathResolve(ROOT, BEFORE), 'utf8'));
const before = exportJson.resultados_real ?? exportJson;
const after = {};
for (const f of AFTER) Object.assign(after, JSON.parse(await readFile(pathResolve(ROOT, f), 'utf8')));

// Only compare programs covered by the --after dumps.
const programas = new Set(Object.keys(after).map(programaOf));

const rows = [];
for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const programa = programaOf(id);
  if (!programas.has(programa)) continue;
  const b = before[id];
  const a = after[id];
  const ref = a ?? b;
  let status;
  if (b && a) status = sameValor(b.valor, a.valor) ? 'same' : 'changed';
  else status = a ? 'new' : 'stale';
  rows.push({
    id, status, programa,
    establecimientoId: ref.establecimientoId,
    indicadorId: ref.indicadorId,
    periodo: ref.periodo ?? ref.anio,
    nivel: ref.nivel ?? null,
    valorAntes: b?.valor ?? null,
    valorDespues: a?.valor ?? null,
    rawAntes: b?.raw ?? null,
    fuenteAntes: b?.fuente?.agg ?? b?.fuente?.tab ?? null,
    estadoAntes: b?.estado ?? null,
    updatedAtAntes: b?.updatedAt?._seconds ? new Date(b.updatedAt._seconds * 1000).toISOString().slice(0, 10) : null,
  });
}

const count = (list, key) => list.reduce((acc, r) => (acc[r[key]] = (acc[r[key]] || 0) + 1, acc), {});
const agregados = rows.filter(r => !r.nivel);
const summary = {};
for (const p of programas) {
  const pr = agregados.filter(r => r.programa === p);
  summary[p] = {
    total: pr.length,
    porEstado: count(pr, 'status'),
    staleOrigen: count(pr.filter(r => r.status === 'stale'), 'fuenteAntes'),
    changedPorIndicador: count(pr.filter(r => r.status === 'changed'), 'indicadorId'),
  };
}

const today = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const jsonPath = pathResolve(ROOT, `reports/${LABEL}-${today}.json`);
await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), before: BEFORE, after: AFTER, summary, rows }, null, 2));

const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : String(v));
let md = `# Diff resultados_real — ${LABEL} (${today})\n\nBefore: \`${BEFORE}\`\nAfter: ${AFTER.map(f => `\`${f}\``).join(', ')}\n\nEstablishment-level docs only (sala docs excluded from the tables).\n`;
for (const [p, s] of Object.entries(summary)) {
  md += `\n## ${p}\n\n- Total: ${s.total}\n- By status: ${JSON.stringify(s.porEstado)}\n- Stale docs by original source: ${JSON.stringify(s.staleOrigen)}\n- Changed docs by indicator: ${JSON.stringify(s.changedPorIndicador)}\n`;
  const stale = agregados.filter(r => r.programa === p && r.status === 'stale');
  if (stale.length) {
    md += `\n### Stale (only in Firestore, ${stale.length})\n\n| Doc | Valor | Raw | Fuente | Estado | Updated |\n|---|---|---|---|---|---|\n`;
    for (const r of stale) md += `| ${r.id} | ${fmt(r.valorAntes)} | ${fmt(r.rawAntes)} | ${fmt(r.fuenteAntes)} | ${fmt(r.estadoAntes)} | ${fmt(r.updatedAtAntes)} |\n`;
  }
}
const mdPath = pathResolve(ROOT, `reports/${LABEL}-${today}.md`);
await writeFile(mdPath, md);

console.log(JSON.stringify(summary, null, 2));
console.log(`\nReport: ${jsonPath}\n        ${mdPath}`);
