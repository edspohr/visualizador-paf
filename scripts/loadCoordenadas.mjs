#!/usr/bin/env node
// Load real coordinates of the establishments (L-03, D-04).
//
//   node scripts/loadCoordenadas.mjs --plantilla
//       → docs/plantilla-coordenadas.csv with the 42 establishments, for Focus
//         to fill (lat/lng, or paste "lat, lng" copied from Google Maps into
//         the `coordenadas` column).
//   node scripts/loadCoordenadas.mjs --file=<csv> --dry-run
//   node scripts/loadCoordenadas.mjs --file=<csv>
//       → writes lat, lng, coordenadasFuente on establecimientos_real.
//
// Only rows with valid coordinates inside the Santiago region are written;
// the rest are listed in the report. Idempotent. Report in
// reports/loadCoordenadas-YYYY-MM-DD.json. The map (VistaGeografia) uses these
// fields and falls back to the approximate comuna position.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (n) => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || null;
const DRY_RUN = args.includes('--dry-run');
const PLANTILLA = args.includes('--plantilla');
const FILE = arg('file');

// Región Metropolitana, with margin.
const LAT = [-34.3, -32.9];
const LNG = [-71.8, -69.9];

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('establecimientos_real').get();
const ests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.programa.localeCompare(b.programa) || a.nombre.localeCompare(b.nombre));

const COLS = ['id', 'programa', 'nombre', 'comuna', 'direccion', 'lat', 'lng', 'coordenadas'];
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

if (PLANTILLA) {
  const lines = [COLS.join(';'), ...ests.map(e => COLS.map(c => csvCell(
    c === 'lat' || c === 'lng' ? e[c] : c === 'coordenadas' || c === 'direccion' ? '' : e[c],
  )).join(';'))];
  const out = pathResolve(ROOT, 'docs/plantilla-coordenadas.csv');
  await writeFile(out, '﻿' + lines.join('\n') + '\n');
  console.log(`Plantilla: ${out} (${ests.length} establecimientos)`);
  process.exit(0);
}

if (!FILE) {
  console.error('Uso: --plantilla | --file=<csv> [--dry-run]');
  process.exit(1);
}

// Minimal CSV parser (';' or ',' separated, quoted fields).
function parseCsv(text) {
  const sep = text.split('\n')[0].includes(';') ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...data] = rows.filter(r => r.some(c => c.trim()));
  const header = h.map(x => x.replace(/^﻿/, '').trim().toLowerCase());
  return data.map(r => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const num = (s) => {
  const n = Number(String(s ?? '').replace(',', '.'));
  return String(s ?? '').trim() && Number.isFinite(n) ? n : null;
};
function coordenadas(r) {
  let lat = num(r.lat), lng = num(r.lng);
  if ((lat === null || lng === null) && r.coordenadas) {
    const m = r.coordenadas.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if (m) { lat = Number(m[1]); lng = Number(m[2]); }
  }
  return { lat, lng };
}

const byId = new Map(ests.map(e => [e.id, e]));
const filas = parseCsv((await readFile(pathResolve(process.cwd(), FILE), 'utf8')));
const ok = [], problemas = [];
for (const r of filas) {
  const e = byId.get(r.id);
  if (!e) { problemas.push({ id: r.id, motivo: 'id no existe en establecimientos_real' }); continue; }
  const { lat, lng } = coordenadas(r);
  if (lat === null || lng === null) { problemas.push({ id: r.id, nombre: e.nombre, motivo: 'sin coordenadas' }); continue; }
  if (lat < LAT[0] || lat > LAT[1] || lng < LNG[0] || lng > LNG[1]) {
    problemas.push({ id: r.id, nombre: e.nombre, motivo: `fuera de la Región Metropolitana (${lat}, ${lng})` });
    continue;
  }
  const cambia = e.lat !== lat || e.lng !== lng;
  ok.push({ id: r.id, nombre: e.nombre, lat, lng, cambia });
}

if (!DRY_RUN) {
  const batch = db.batch();
  for (const o of ok.filter(o => o.cambia)) {
    batch.set(db.collection('establecimientos_real').doc(o.id), {
      lat: o.lat, lng: o.lng, coordenadasFuente: FILE, coordenadasUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

const today = new Date().toISOString().slice(0, 10);
await mkdir(pathResolve(ROOT, 'reports'), { recursive: true });
const report = { generatedAt: new Date().toISOString(), dryRun: DRY_RUN, file: FILE, cargados: ok, problemas };
await writeFile(pathResolve(ROOT, `reports/loadCoordenadas-${today}${DRY_RUN ? '-dryrun' : ''}.json`), JSON.stringify(report, null, 2));
console.log(`${DRY_RUN ? '[dry-run] ' : ''}${ok.filter(o => o.cambia).length} establecimientos con coordenadas nuevas, ${ok.length - ok.filter(o => o.cambia).length} sin cambios, ${problemas.length} con problemas.`);
for (const p of problemas) console.log(`  ✗ ${p.id}${p.nombre ? ` (${p.nombre})` : ''}: ${p.motivo}`);
