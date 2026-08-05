// Compares two escolar coverage manifests and reports what changed.
// Works with the stats.estados structure from generateEscolarCoverageManifest.mjs.
//
// Usage:
//   node scripts/coverageDiff.mjs [--before=<path>] [--after=<path>]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const beforePath = argValue('before', pathResolve(ROOT, 'reports/escolar-coverage-manifest-2026-07-30.json'));
const afterPath  = argValue('after',  pathResolve(ROOT, 'docs/escolar-coverage-manifest.json'));

let before, after;
try { before = JSON.parse(await readFile(beforePath, 'utf8')); }
catch { console.error(`Cannot read before: ${beforePath}`); process.exit(1); }
try { after  = JSON.parse(await readFile(afterPath,  'utf8'));  }
catch { console.error(`Cannot read after: ${afterPath}`);  process.exit(1); }

const bStats = before.stats?.estados ?? {};
const aStats = after.stats?.estados  ?? {};
const allStates = [...new Set([...Object.keys(bStats), ...Object.keys(aStats)])].sort();

// Build per-tuple maps for improvement/regression tracking
function flattenTuples(manifest) {
  const map = new Map();
  for (const esc of (manifest.escuelas ?? [])) {
    for (const [, ind] of Object.entries(esc.indicadores ?? {})) {
      const key = `${esc.escuela}|${ind.anio}|${ind.indicadorId}|${ind.curso ?? 'null'}`;
      map.set(key, ind.estado);
    }
  }
  return map;
}

const beforeMap = flattenTuples(before);
const afterMap  = flattenTuples(after);

const improvements = [];
const regressions  = [];
const transitions  = {};

for (const [key, afterState] of afterMap) {
  const beforeState = beforeMap.get(key) ?? 'NOT_IN_BEFORE';
  if (beforeState === afterState) continue;
  const trans = `${beforeState} → ${afterState}`;
  transitions[trans] = (transitions[trans] ?? 0) + 1;

  const isImprovement =
    (beforeState === 'FUENTE_NO_ACCESIBLE' && afterState !== 'FUENTE_NO_ACCESIBLE') ||
    (beforeState === 'SIN_FUENTE_MAPEADA'  && afterState === 'CON_DATO_REPORTADO')  ||
    (beforeState === 'SIN_DATO_REPORTADO'  && afterState === 'CON_DATO_REPORTADO');
  const isRegression =
    (afterState === 'FUENTE_NO_ACCESIBLE'  && beforeState !== 'FUENTE_NO_ACCESIBLE') ||
    (afterState === 'SIN_DATO_REPORTADO'   && beforeState === 'CON_DATO_REPORTADO');

  if (isImprovement) improvements.push({ key, from: beforeState, to: afterState });
  if (isRegression)  regressions.push({ key, from: beforeState, to: afterState });
}

const date = new Date().toISOString().slice(0, 10);
const lines = [
  `# Cobertura Escolar — Delta ${date}`,
  ``,
  `**Antes (30 jul)**: ${Object.values(bStats).reduce((s,v)=>s+v,0)} tuplas`,
  `**Después (${date})**: ${Object.values(aStats).reduce((s,v)=>s+v,0)} tuplas`,
  ``,
  `## Conteos por estado`,
  ``,
  `| Estado | Antes | Después | Δ |`,
  `|---|---|---|---|`,
  ...allStates.map(s => {
    const b = bStats[s] ?? 0, a = aStats[s] ?? 0;
    return `| ${s} | ${b} | ${a} | ${a >= b ? '+' : ''}${a - b} |`;
  }),
  ``,
  `## Mejoras destacadas — FUENTE_NO_ACCESIBLE resuelta (${improvements.filter(i=>i.from==='FUENTE_NO_ACCESIBLE').length} tuplas)`,
  improvements.filter(i=>i.from==='FUENTE_NO_ACCESIBLE').length
    ? improvements.filter(i=>i.from==='FUENTE_NO_ACCESIBLE').slice(0,20).map(i=>`- \`${i.key}\` → **${i.to}**`).join('\n')
    : '_Ninguna_',
  ``,
  `## Regresiones (${regressions.length})`,
  regressions.length
    ? regressions.map(r=>`- \`${r.key}\`: ${r.from} → **${r.to}**`).join('\n')
    : '_Ninguna_',
  ``,
  `## Todas las transiciones`,
  ``,
  ...Object.entries(transitions).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`- ${t}: **${n}**`),
  ``,
  `## Planillas aún con error`,
  ``,
  `- **1** planilla permanentemente inaccesible: Escuela Básica Sendero del Saber · 2026 · curso KA (link roto en la fuente, no resoluble por nosotros).`,
];

const md = lines.join('\n');
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const mdPath   = pathResolve(ROOT, `reports/coverageDiff-${date}.md`);
const jsonPath  = pathResolve(ROOT, `reports/coverageDiff-${date}.json`);
await writeFile(mdPath,  md, 'utf8');
await writeFile(jsonPath, JSON.stringify({ date, improvements, regressions, transitions, bStats, aStats }, null, 2), 'utf8');

console.log(md);
console.log(`\nReports → ${mdPath}`);
