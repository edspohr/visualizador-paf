// Parses docs/homologacion-indicadores-escolar-2025-206.xlsx into
// src/data/homologacionEscolar.json — the cross-year indicator mapping
// used by the comparator to align Escolar 2025 ↔ 2026 indicator IDs.
//
// Usage:
//   node scripts/parseHomologacion.mjs [--dry-run]
//
// Idempotent. Safe to re-run after the source XLSX is updated.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const SOURCE = pathResolve(ROOT, 'docs/homologacion-indicadores-escolar-2025-206.xlsx');
const OUT_JSON = pathResolve(ROOT, 'src/data/homologacionEscolar.json');

const wb = XLSX.readFile(SOURCE);

function norm(raw) { return String(raw).trim().replace(/^I(\d+)$/, 'I.$1'); }
function isCleanId(raw) { return /^I\.\d+$/.test(norm(raw)); }

// Sheet 1: año 1, 2025 — indicator list (col E = 2025 id, col G = name, col H = meta)
const ws1 = wb.Sheets['Indicadores año 1, 2025'];
const aoa1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });
const byId2025 = {};
for (const r of aoa1.slice(1)) {
  if (!String(r[4]).match(/^I\d+$/)) continue;
  const id = norm(r[4]);
  if (!byId2025[id]) byId2025[id] = { nombre: String(r[6]).trim(), meta: r[7] === '' ? null : r[7] };
}

// Sheet 2: año 1, 2026 — indicator list (col E = 2026 id, col F = name, col G = meta)
const ws2 = wb.Sheets['Indicadores año 1, 2026'];
const aoa2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
const byId2026 = {};
for (const r of aoa2.slice(1)) {
  if (!String(r[4]).match(/^I\d+$/)) continue;
  const id = norm(r[4]);
  if (!byId2026[id]) byId2026[id] = { nombre: String(r[5]).trim(), meta: r[6] === '' ? null : r[6] };
}

// Sheet 3: año 2, 2026 — cross-year map (col D = 2025 id, col E = 2026 id)
const ws3 = wb.Sheets['Indicadores año 2, 2026'];
const aoa3 = XLSX.utils.sheet_to_json(ws3, { header: 1, defval: '' });
const mapping = [];
for (const r of aoa3.slice(1)) {
  const raw2025 = String(r[3]).trim();
  const raw2026 = String(r[4]).trim();
  if (!raw2025.match(/^I\d+$/) || !raw2026.match(/^I\d+$/)) continue;
  const id2025 = norm(raw2025);
  const id2026 = norm(raw2026);
  mapping.push({
    id2025,
    id2026,
    nombre2025: byId2025[id2025]?.nombre ?? null,
    nombre2026: byId2026[id2026]?.nombre ?? null,
    meta2025: byId2025[id2025]?.meta ?? null,
    meta2026: byId2026[id2026]?.meta ?? null,
  });
}

const mapped2025 = new Set(mapping.map(m => m.id2025));
const mapped2026 = new Set(mapping.map(m => m.id2026));

const discontinued2025 = Object.keys(byId2025)
  .filter(id => !mapped2025.has(id))
  .sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)))
  .map(id => ({ id, nombre: byId2025[id].nombre, meta: byId2025[id].meta }));

const newIn2026 = Object.keys(byId2026)
  .filter(id => !mapped2026.has(id))
  .sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)))
  .map(id => ({ id, nombre: byId2026[id].nombre, meta: byId2026[id].meta }));

const output = {
  generatedAt: new Date().toISOString(),
  sourceFile: 'docs/homologacion-indicadores-escolar-2025-206.xlsx',
  description: 'Cross-year indicator mapping for Escolar 2025 <-> 2026. IDs use canonical dot notation (I.1). Used by the comparator to align indicators across years.',
  mapping,
  discontinued2025,
  newIn2026,
};

console.log(`Mapping: ${mapping.length} pairs`);
console.log(`Discontinued (2025 only): ${discontinued2025.length}`);
console.log(`New in 2026: ${newIn2026.length}`);

if (DRY_RUN) {
  console.log('\nDRY RUN — no writes.');
} else {
  await writeFile(OUT_JSON, JSON.stringify(output, null, 2));
  console.log(`\nWrote → ${OUT_JSON}`);
}

// Report
const date = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const reportPath = pathResolve(ROOT, `reports/parseHomologacion-${date}.json`);
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  mappingCount: mapping.length,
  discontinuedCount: discontinued2025.length,
  newIn2026Count: newIn2026.length,
}, null, 2));
console.log(`Report → ${reportPath}`);
if (DRY_RUN) console.log('Re-run without --dry-run to apply.');
