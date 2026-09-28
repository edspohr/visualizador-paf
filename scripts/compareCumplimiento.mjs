#!/usr/bin/env node
// Compliance (% cumplimiento) per establishment, before vs after a change,
// computed with the same helpers the UI uses (src/data/scope.js).
//
// Read-only, works on local files:
//   --before-data=<Firestore export json>   (resultados_real + establecimientos_real)
//   --before-catalog=<catalog json>         (e.g. `git show main:src/data/catalog.json`)
//   --after-data=<dump1.json>[,<dump2.json>] (ingest --dump output)
//   --after-catalog=<catalog json>          (default: src/data/catalog.json)
//   --after-est=<ingestEscolar report json> (optional: salasPorEscuela → nSalas)
//   --mes=<1-12>                            (default: current month)
//   --label=<name>
//
// Writes reports/<label>-YYYY-MM-DD.{json,md}.

import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { cumplimientoIndicadores, indicadoresAplicables } from '../src/data/scope.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (n) => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || null;
const read = (p) => JSON.parse(readFileSync(pathResolve(ROOT, p), 'utf8'));

const beforeExport = read(arg('before-data'));
const beforeCatalog = read(arg('before-catalog'));
const afterCatalog = read(arg('after-catalog') || 'src/data/catalog.json');
// --after-data accepts ingest dumps or a full Firestore export (then its
// establecimientos_real, with nSalas, is used for the "after" side).
const afterInputs = (arg('after-data') || '').split(',').filter(Boolean).map(read);
const afterExport = afterInputs.find(x => x.resultados_real);
const afterDocs = Object.assign({}, ...afterInputs.map(x => x.resultados_real ?? x));
const afterEstReport = arg('after-est') ? read(arg('after-est')) : null;
const MES = Number(arg('mes')) || (new Date().getMonth() + 1);
const LABEL = arg('label') || 'cumplimiento';

const ests = Object.values(beforeExport.establecimientos_real);
const estsAfter = ests.map(e => {
  if (afterExport?.establecimientos_real?.[e.id]) return { ...afterExport.establecimientos_real[e.id], id: e.id };
  const s = afterEstReport?.salasPorEscuela?.[e.id];
  return s?.nSalas ? { ...e, nSalas: s.nSalas } : e;
});

// Map<estId, Map<indicadorId, valor>> for 2026 establishment-level docs.
function valores(docs) {
  const m = new Map();
  for (const d of Object.values(docs)) {
    if (d.nivel || String(d.periodo ?? d.anio) !== '2026') continue;
    if (d.valor === null || d.valor === undefined || !d.indicadorId) continue;
    if (!m.has(d.establecimientoId)) m.set(d.establecimientoId, new Map());
    m.get(d.establecimientoId).set(d.indicadorId, d.valor);
  }
  return m;
}
const vBefore = valores(beforeExport.resultados_real);
// Programs not covered by the after dumps keep their before values.
const afterProgramas = new Set(Object.values(afterDocs).map(d => d.programa));
const vAfter = valores(Object.fromEntries([
  ...Object.entries(beforeExport.resultados_real).filter(([, d]) => !afterProgramas.has(d.programa)),
  ...Object.entries(afterDocs),
]));

const inds = (cat, programa) => (programa === 'parvulario' ? cat.indicadores.parvulario : cat.indicadores.escolar2026);
function cumpl(cat, est, vals) {
  const aplic = indicadoresAplicables(inds(cat, est.programa), est, MES);
  return { pct: cumplimientoIndicadores(aplic, vals.get(est.id) ?? new Map()), n: aplic.filter(i => i.tipoMeta !== 'sin_meta' && i.metaNum !== null).length };
}

const rows = ests.map((e, i) => {
  const a = cumpl(beforeCatalog, e, vBefore);
  const b = cumpl(afterCatalog, estsAfter[i], vAfter);
  return { id: e.id, nombre: e.nombre, programa: e.programa, cohorte: e.cohorte, antes: a.pct, despues: b.pct, delta: b.pct - a.pct, nAntes: a.n, nDespues: b.n };
}).sort((x, y) => x.programa.localeCompare(y.programa) || y.delta - x.delta);

const today = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
await writeFile(pathResolve(ROOT, `reports/${LABEL}-${today}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), mes: MES, rows }, null, 2));
const pct = (v) => `${Math.round(v * 100)}%`;
let md = `# Cumplimiento por establecimiento — ${LABEL} (${today}, mes ${MES})\n\n| Establecimiento | Programa | Cohorte | Antes | Después | Δ | Indicadores con meta (antes → después) |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.nombre} | ${r.programa} | ${r.cohorte} | ${pct(r.antes)} | ${pct(r.despues)} | ${r.delta >= 0 ? '+' : ''}${Math.round(r.delta * 100)} pts | ${r.nAntes} → ${r.nDespues} |\n`;
await writeFile(pathResolve(ROOT, `reports/${LABEL}-${today}.md`), md);
console.log(md);
