// Read-only diagnostic script for the comparador. Dumps `resultados_real` docs
// side-by-side for two years and one indicator (optionally scoped to a
// sostenedor), so we can tell whether the comparador is seeing genuinely equal
// numbers or hitting a rendering bug.
//
// Usage:
//   node scripts/diagnoseComparador.mjs \
//     --indicador='N° de semanas' \
//     --sostenedor=santa-rosa \
//     --years=2025,2026
//
// Flags:
//   --indicador=<substring>   Case-insensitive substring match on indicador.nombre
//   --indicadorId=<id>        Exact indicadorId (e.g. "I.15"). Overrides --indicador.
//   --sostenedor=<slugOrId>   Case-insensitive substring match on est.slep / est.sostenedor / est.id
//   --years=2025,2026         Comma-separated years to compare (default 2025,2026)
//   --programa=parvulario|escolar  (default parvulario for this case)
//
// Never writes.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const programa = argValue('programa', 'parvulario');
const catalogList = programa === 'escolar' ? catalog.indicadores.escolar2026 : catalog.indicadores.parvulario;

const indicadorId = argValue('indicadorId');
const indicadorSubstr = argValue('indicador');
const sostenedorNeedle = (argValue('sostenedor') || '').toLowerCase();
const years = (argValue('years', '2025,2026')).split(',').map((s) => Number(s.trim())).filter(Boolean);

if (!indicadorId && !indicadorSubstr) {
  console.error('[diagnose] Debes pasar --indicadorId o --indicador');
  process.exit(2);
}

const indicadores = catalogList.filter((i) => {
  if (indicadorId) return i.id === indicadorId;
  return String(i.nombre || '').toLowerCase().includes(indicadorSubstr.toLowerCase());
});

if (indicadores.length === 0) {
  console.error(`[diagnose] Ningún indicador matchea. programa=${programa}, id=${indicadorId}, sub=${indicadorSubstr}`);
  process.exit(3);
}
if (indicadores.length > 1) {
  console.log(`[diagnose] ${indicadores.length} indicadores matchean. Muestro todos.`);
}

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const estsSnap = await db.collection('establecimientos_real').get();
const ests = new Map();
for (const d of estsSnap.docs) ests.set(d.id, { id: d.id, ...d.data() });

function matchSostenedor(est) {
  if (!sostenedorNeedle) return true;
  const hay = [est.slep, est.sostenedor, est.id, est.nombre]
    .map((s) => String(s || '').toLowerCase());
  return hay.some((s) => s.includes(sostenedorNeedle));
}

for (const ind of indicadores) {
  console.log(`\n═══ ${ind.id} — ${ind.nombre}`);
  console.log(`    ámbito=${ind.ambito} · clasificación=${ind.clasificacion} · unidad=${ind.unidad} · metaNum=${ind.metaNum} · frecuencia=${ind.frecuencia}`);

  const filasPorEst = new Map();
  for (const yr of years) {
    const snap = await db.collection('resultados_real')
      .where('anio', '==', yr)
      .where('indicadorId', '==', ind.id)
      .get();
    for (const d of snap.docs) {
      const data = d.data();
      if (data.nivel) continue; // solo agregado por establecimiento
      const est = ests.get(data.establecimientoId);
      if (!est || !matchSostenedor(est)) continue;
      if (!filasPorEst.has(est.id)) filasPorEst.set(est.id, { est });
      filasPorEst.get(est.id)[`v${yr}`] = data.valor;
      filasPorEst.get(est.id)[`e${yr}`] = data.estado;
    }
  }

  const filas = Array.from(filasPorEst.values()).sort((a, b) => a.est.nombre.localeCompare(b.est.nombre));
  if (filas.length === 0) {
    console.log('    (sin documentos para los filtros)');
    continue;
  }

  const header = ['Establecimiento', ...years.flatMap((y) => [`${y}·valor`, `${y}·estado`])];
  console.log('    ' + header.join(' | '));
  console.log('    ' + header.map(() => '---').join(' | '));
  for (const fila of filas) {
    const cells = [fila.est.nombre];
    for (const y of years) {
      cells.push(fila[`v${y}`] ?? '—');
      cells.push(fila[`e${y}`] ?? '—');
    }
    console.log('    ' + cells.join(' | '));
  }

  // Promedio simple por año, sobre valores no-null.
  const proms = {};
  for (const y of years) {
    const vals = filas.map((f) => f[`v${y}`]).filter((v) => typeof v === 'number');
    proms[y] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }
  console.log(`    promedios: ${JSON.stringify(proms)}`);

  const iguales = years.length === 2 && proms[years[0]] !== null && proms[years[0]] === proms[years[1]];
  if (iguales) {
    console.log(`    ⚠  Los promedios de ${years[0]} y ${years[1]} son idénticos. Revisar si es esperado o si es un arrastre de datos.`);
  }
}

console.log('\n[diagnose] listo. Ejecución solo-lectura, no se escribió nada.');
