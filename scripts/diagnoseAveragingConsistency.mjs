// Read-only diagnostic for the averaging audit (docs/auditoria-indicadores-promedio-2026-08-06.md).
//
// Two probes:
//   1. Parvulario mean-of-means: for a given indicator (default I.43), for every jardín
//      that has at least one sala-level doc, print `agg` (the stored aggregate doc,
//      no `nivel` field) side-by-side with `mean(salas)` (unweighted mean of the
//      per-sala docs). If they match, the aggregate IS the unweighted mean of salas
//      (Hallazgo #1). If they differ, another source is winning the dedup (line 574
//      of ingestParvulario.mjs).
//
//   2. Denominator consistency (Hallazgo #3): for the same indicator, compute the
//      network-wide number six different ways and show them side by side. If they
//      all agree, no defect. If they differ, quantify the gap.
//
// Never writes. No PII touched. Uses the Admin SDK because these queries need to
// span all establecimientos.
//
// Usage:
//   node scripts/diagnoseAveragingConsistency.mjs \
//     --programa=parvulario \
//     --indicador=I.43 \
//     --anio=2026
//
// Flags:
//   --programa=parvulario|escolar  (default parvulario)
//   --indicador=<id>               canonical id, e.g. "I.43" (default I.43)
//   --anio=2025|2026               (default 2026)

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

const programa = argValue('programa', 'parvulario');
const indicadorId = argValue('indicador', 'I.43');
const anio = Number(argValue('anio', '2026'));

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const catalogList = programa === 'escolar' ? catalog.indicadores.escolar2026 : catalog.indicadores.parvulario;
const ind = catalogList.find(i => i.id === indicadorId);
if (!ind) {
  console.error(`Indicador ${indicadorId} no existe en catálogo ${programa}.`);
  process.exit(1);
}

console.log(`\n=== Diagnóstico agregación · ${programa} · ${indicadorId} · ${anio} ===`);
console.log(`Nombre: ${ind.nombre}`);
console.log(`Unidad: ${ind.unidad} · metaNum: ${ind.metaNum} · tipoMeta: ${ind.tipoMeta ?? '(inferido)'}\n`);

// ─── Load establecimientos ────────────────────────────────────────────────────
const estSnap = await db.collection('establecimientos_real').where('programa', '==', programa).get();
const ests = estSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`Establecimientos: ${ests.length}`);

const estById = new Map(ests.map(e => [e.id, e]));

// ─── Load all resultados_real for this indicator × año ────────────────────────
const resSnap = await db.collection('resultados_real')
  .where('programa', '==', programa)
  .where('indicadorId', '==', indicadorId)
  .where('anio', '==', anio)
  .get();
const docs = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const aggDocs = docs.filter(d => !d.nivel);
const salaDocs = docs.filter(d => d.nivel);
console.log(`Docs en resultados_real: ${docs.length} total (${aggDocs.length} agregados, ${salaDocs.length} por sala/nivel)\n`);

// ─── Probe 1: agg vs mean(salas) per jardín ──────────────────────────────────
console.log('─── PROBE 1 · agg vs mean(salas) por establecimiento ──────────────────────────\n');
console.log('Est                                    agg       mean(salas)   nSalas   diff    salaValues');
console.log('─────────────────────────────────────────────────────────────────────────────────────────────');

const salasByEst = new Map();
for (const d of salaDocs) {
  if (!salasByEst.has(d.establecimientoId)) salasByEst.set(d.establecimientoId, []);
  salasByEst.get(d.establecimientoId).push({ nivel: d.nivel, valor: d.valor });
}
const aggByEst = new Map(aggDocs.map(d => [d.establecimientoId, d.valor]));

const allEstIds = new Set([...salasByEst.keys(), ...aggByEst.keys()]);
let n_agg_only = 0, n_salas_only = 0, n_both_match = 0, n_both_differ = 0;

for (const estId of [...allEstIds].sort()) {
  const est = estById.get(estId);
  const nombre = est?.nombre ?? estId;
  const agg = aggByEst.get(estId);
  const salas = salasByEst.get(estId) ?? [];
  const meanSalas = salas.length ? salas.reduce((s, x) => s + x.valor, 0) / salas.length : null;

  let diff = '—';
  if (agg != null && meanSalas != null) {
    const d = agg - meanSalas;
    diff = Math.abs(d) < 1e-6 ? '≈0 (match)' : d.toFixed(4);
    if (Math.abs(d) < 1e-6) n_both_match++; else n_both_differ++;
  } else if (agg != null) {
    n_agg_only++;
  } else if (meanSalas != null) {
    n_salas_only++;
  }

  const salaStr = salas.length
    ? `[${salas.map(s => `${s.nivel}=${s.valor}`).join(', ')}]`
    : '';

  console.log(
    `${(nombre || estId).slice(0, 38).padEnd(38)}  ` +
    `${(agg != null ? agg.toFixed(3) : '—').padStart(7)}   ` +
    `${(meanSalas != null ? meanSalas.toFixed(3) : '—').padStart(9)}   ` +
    `${String(salas.length).padStart(6)}   ` +
    `${diff.padStart(12)}   ` +
    `${salaStr.slice(0, 80)}`
  );
}

console.log('');
console.log(`Resumen probe 1:`);
console.log(`  Con ambos, agg === mean(salas)     : ${n_both_match}  ← agregado ES mean(salas) [Hallazgo #1]`);
console.log(`  Con ambos, agg ≠ mean(salas)       : ${n_both_differ}  ← otra fuente ganó (VISUALIZADOR JARDÍN)`);
console.log(`  Sólo agg (sin salas)               : ${n_agg_only}`);
console.log(`  Sólo salas (sin agg emitido)       : ${n_salas_only}\n`);

// ─── Probe 2: network-wide aggregation, 6 ways ────────────────────────────────
console.log('─── PROBE 2 · Agregación de red (todos los establecimientos aplicables) ──────\n');

// Applicability helper — inline copy of scope.js so this script stays self-contained.
function anioImplementacion(est, y = 2026) {
  if (!est?.cohorte) return 1;
  const [startYear, endYear] = est.cohorte.split('-').map(Number);
  const maxYears = endYear - startYear + 1;
  return Math.max(1, Math.min(maxYears, y - startYear + 1));
}
function semestreDeMes(mes) { return mes <= 6 ? 1 : 2; }
function semestreAcumulado(est, y, mes) {
  const a = anioImplementacion(est, y);
  return (a - 1) * 2 + semestreDeMes(mes);
}
function semestreMinimoRequerido(inicio) {
  if (!inicio || typeof inicio !== 'string') return 1;
  const t = inicio.trim();
  const semMatch = t.match(/^Sem\s+([1-4])$/i);
  if (semMatch) return Number(semMatch[1]);
  if (/^Primer[oa]?\s+a[nñ]o$/i.test(t)) return 1;
  if (/^Segundo\s+a[nñ]o$/i.test(t)) return 3;
  return 1;
}
function isAplicable(indicador, est, y, mes) {
  if (!est) return false;
  return semestreMinimoRequerido(indicador.inicio) <= semestreAcumulado(est, y, mes);
}
function calcularLogro(valor, indicador) {
  const tipoMeta = indicador.tipoMeta ?? (
    indicador.unidad === 'binario' ? 'booleano' :
    indicador.unidad === '%' ? 'porcentaje' :
    (indicador.unidad === 'conteo' || indicador.unidad === 'promedio') ? 'numero' :
    'sin_meta'
  );
  if (tipoMeta === 'sin_meta' || indicador.metaNum == null) return null;
  if (valor == null) return null;
  if (tipoMeta === 'booleano') return valor;
  if (indicador.metaNum === 0) return 0;
  return Math.min(1.2, valor / indicador.metaNum);
}

// For year 2026 use current-month; for prior years use december (matches VistaConsultor).
const mesRef = anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;

const aplicables = ests.filter(e => isAplicable(ind, e, anio, mesRef));
const withValue = aplicables.filter(e => aggByEst.has(e.id));
const withoutValue = aplicables.filter(e => !aggByEst.has(e.id));

console.log(`Universo aplicable (${programa}, ${anio}, mes=${mesRef}): ${aplicables.length} centros`);
console.log(`  con dato reportado : ${withValue.length}`);
console.log(`  sin dato reportado : ${withoutValue.length} (${withoutValue.map(e => e.id).slice(0, 5).join(', ')}${withoutValue.length > 5 ? '…' : ''})\n`);

// Six ways to compute the network number:
const values = withValue.map(e => aggByEst.get(e.id));

// (A) promedioValor pattern (ComparadorIndicador:76). Excludes faltantes.
const A_promedioValor = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

// (B) ratioLogro pattern (ComparadorIndicador:89). Faltantes = 0 in numerator, in denominator = all aplicables.
const B_ratioLogro = aplicables.length
  ? aplicables.reduce((s, e) => {
      const v = aggByEst.get(e.id) ?? null;
      const l = calcularLogro(v, ind);
      return s + (l == null ? 0 : Math.min(1, l));
    }, 0) / aplicables.length
  : null;

// (C) rankingItems.valor (VistaConsultor:174-186). Same as A, but scoped: faltantes excluded from valor mean.
const C_rankingValor = A_promedioValor;  // exactly the same formula

// (D) rankingItems.ratio (VistaConsultor:174-186). Same as B.
const D_rankingRatio = B_ratioLogro;

// (E) SostenedorAveragePicker (line 37-54). At the est level it computes logro
//     per est excluding faltantes internally, but then averages across ests. For a single
//     indicator, degenerates to B.
const E_averagePicker = B_ratioLogro;

// (F) Peer aggregate mean (queries.js:234-238). sumaValor / nReporters, excludes faltantes.
const F_peerAggregate = A_promedioValor;

// (G) Alternative: population-weighted mean by nNinos (matrícula) — for illustration only.
let sumaW = 0, wTot = 0;
for (const e of withValue) {
  const w = Number(e.nNinos ?? 0);
  if (w > 0) { sumaW += aggByEst.get(e.id) * w; wTot += w; }
}
const G_weightedByMatricula = wTot > 0 ? sumaW / wTot : null;

// (H) Sum of raw sala values / total salas — bypass the jardín aggregate entirely.
let sumaSalas = 0, nSalasTotal = 0;
for (const d of salaDocs) {
  if (d.valor == null) continue;
  const est = estById.get(d.establecimientoId);
  if (!est || !isAplicable(ind, est, anio, mesRef)) continue;
  sumaSalas += d.valor;
  nSalasTotal += 1;
}
const H_flatSalas = nSalasTotal > 0 ? sumaSalas / nSalasTotal : null;

const fmt = (v) => v == null ? '—' : (ind.unidad === '%' || ind.unidad === 'binario' ? `${(v * 100).toFixed(1)}%` : v.toFixed(4));

console.log('Método                                                       Valor        Denominador');
console.log('──────────────────────────────────────────────────────────────────────────────────────');
console.log(`A · promedioValor (comparador · eje valor nativo)             ${fmt(A_promedioValor).padStart(10)}   ${values.length} centros con dato`);
console.log(`B · ratioLogro (comparador · eje % cumplimiento)              ${fmt(B_ratioLogro).padStart(10)}   ${aplicables.length} aplicables (falt=0)`);
console.log(`C · rankingItems.valor (VistaConsultor.rankingItems.valor)    ${fmt(C_rankingValor).padStart(10)}   ${values.length}`);
console.log(`D · rankingItems.ratio (VistaConsultor.rankingItems.ratio)    ${fmt(D_rankingRatio).padStart(10)}   ${aplicables.length}`);
console.log(`E · SostenedorAveragePicker (cross-est cumpl.)                ${fmt(E_averagePicker).padStart(10)}   ${aplicables.length}`);
console.log(`F · Peer aggregate (drilldown "Promedio del territorio")      ${fmt(F_peerAggregate).padStart(10)}   ${values.length}`);
console.log(`G · [contraste] Weighted by matrícula (nNinos)                ${fmt(G_weightedByMatricula).padStart(10)}   ${wTot} niños`);
console.log(`H · [contraste] Flat mean sobre TODAS las salas (bypass agg)  ${fmt(H_flatSalas).padStart(10)}   ${nSalasTotal} salas`);

console.log('');
console.log('Interpretación:');
console.log('  A = C = F  → tres lugares que muestran lo mismo (faltantes excluidos).');
console.log('  B = D = E  → tres lugares que muestran lo mismo (faltantes = 0).');
console.log('  Si A ≠ B  → confirmación numérica de Hallazgo #3 (dos números distintos, mismo dashboard).');
console.log('  Si H ≠ A  → confirmación numérica de Hallazgo #1 (mean-of-means ≠ mean plano sobre salas).');
console.log('  G es SÓLO contraste — no se usa en producción. Muestra el orden de magnitud del sesgo por unweighted mean.');
console.log('');
