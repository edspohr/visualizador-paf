#!/usr/bin/env node
// Nightly data pipeline (L-04, S-01, D-14). Runs the same scripts used by
// hand, in order, and stops at the first failing step:
//
//   1. ingestParvulario --prune
//   2. ingestEscolar --prune
//   3. backfillEscolarNullDocs
//   4. computeTerritorioAggregates
//   5. piiAssertion (resultados_real)
//   6. snapshotCierre --auto   — only on day 1 (Chile time): closure of the
//                                 previous month for the CAP profile
//
// Result in config/pipelineMetadata.ultimaEjecucion. A failure is logged with
// the marker PIPELINE_FALLIDO (the Cloud Monitoring alert matches it) and sets
// ultimoSyncExitoso: false. Every run ends with a status email (🟢 / 🟡 / 🔴,
// scripts/lib/correoPipeline.mjs).
//
// Locally: node scripts/runPipeline.mjs [--sin-cierre] [--forzar-cierre]
// In Cloud Functions it is started by functions/src/index.mjs.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { credenciales, salida } from './lib/runtime.mjs';
import { construirCorreo, detectarAdvertencias, enviarCorreo } from './lib/correoPipeline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);

const diaChile = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', day: 'numeric' }).format(new Date()));
const conCierre = !args.includes('--sin-cierre') && (diaChile === 1 || args.includes('--forzar-cierre'));

const PASOS = [
  ['Carga Parvulario', 'ingestParvulario.mjs', ['--prune']],
  ['Carga Escolar', 'ingestEscolar.mjs', ['--prune']],
  ['Espacios sin dato Escolar', 'backfillEscolarNullDocs.mjs', []],
  ['Promedios del territorio', 'computeTerritorioAggregates.mjs', []],
  ['Control de datos personales', 'piiAssertion.mjs', []],
  ...(conCierre ? [['Cierre mensual', 'snapshotCierre.mjs', ['--auto']]] : []),
];

function correr(script, scriptArgs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [pathResolve(__dirname, script), ...scriptArgs], { cwd: ROOT, env: process.env });
    let salidaCompleta = '';
    const guardar = (chunk) => { process.stdout.write(chunk); salidaCompleta += chunk; };
    p.stdout.on('data', guardar);
    p.stderr.on('data', guardar);
    p.on('close', (code) => resolve({ code, segundos: Math.round((Date.now() - t0) / 1000), cola: salidaCompleta.slice(-2000), salida: salidaCompleta }));
  });
}

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

// Issues known and accepted (reported to Focus): they appear in the detail
// but do not count as new reading errors.
const ERRORES_CONOCIDOS = [/Sendero del Saber.*planilla KA/i];

const hoy = new Date().toISOString().slice(0, 10);
const leerJson = (rel) => { const p = salida(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };

// Summary of each step, read from the reports the scripts leave behind.
function resumir(nombre, r, resumen, detalles) {
  if (nombre === 'Carga Parvulario') {
    const rep = leerJson(`reports/ingestParvulario-${hoy}.json`);
    if (!rep) return;
    const fuera = rep.warnings.filter(w => /no es un porcentaje|>100%/.test(w));
    resumen.parvulario = {
      jardines: rep.totals.jardines, docsJardin: rep.totals.jardinDocs, docsSala: rep.totals.salasDocs,
      indicadores: rep.totals.indicadoresCubiertos, marcadosSinDato: rep.pruned?.length ?? 0, fueraDeRango: fuera.length,
    };
    detalles.push(...rep.warnings.map(w => `Parvularia · ${w}`));
  }
  if (nombre === 'Carga Escolar') {
    const rep = leerJson('docs/etapa5-ingesta-escolar.json');
    const lineasError = r.salida.split('\n').filter(l => /ERROR|Requested entity|not found|permission|no se pudo/i.test(l));
    const nuevos = lineasError.filter(l => !ERRORES_CONOCIDOS.some(re => re.test(l)));
    if (rep) resumen.escolar = {
      escuelas: rep.totals.escuelasCubiertas, docs: rep.totals.resultados, indicadores: rep.totals.indicadoresCubiertos,
      marcadosSinDato: rep.pruned?.length ?? 0, erroresLectura: nuevos.length,
    };
    detalles.push(...lineasError.map(l => `Educación Básica · ${l.trim()}`));
  }
  if (nombre === 'Promedios del territorio') {
    const rep = leerJson(`reports/computeTerritorioAggregates-${hoy}.json`);
    if (rep) resumen.promedios = { total: rep.summary.total, publicables: rep.summary.publishable };
  }
  if (nombre === 'Cierre mensual') {
    const m = r.salida.match(/cierres_real\/(\d{4}-\d{2}) escrito \((\d+) docs\)/);
    if (m) resumen.cierre = { periodo: m[1], docs: Number(m[2]) };
  }
}

const inicio = new Date();
const pasos = [];
const resumen = {};
const detalles = [];
let fallo = null;
let anterior = null;

try {
  anterior = (await db.doc('config/pipelineMetadata').get()).data()?.ultimaEjecucion?.resumen ?? null;
  for (const [nombre, script, scriptArgs] of PASOS) {
    console.log(`\n═══ ${nombre} (${script} ${scriptArgs.join(' ')}) ═══`);
    const r = await correr(script, scriptArgs);
    pasos.push({ nombre, script, codigo: r.code, segundos: r.segundos });
    resumir(nombre, r, resumen, detalles);
    if (r.code !== 0) {
      fallo = { paso: nombre, codigo: r.code, detalle: r.cola.split('\n').filter(Boolean).slice(-8).join('\n') };
      break;
    }
  }
} catch (err) {
  fallo = { paso: pasos.length < PASOS.length ? PASOS[pasos.length][0] : 'orquestador', codigo: 'excepción', detalle: String(err?.stack ?? err).slice(0, 1500) };
}

const fin = new Date();
const advertencias = fallo ? [] : detectarAdvertencias(resumen, anterior);

try {
  await db.doc('config/pipelineMetadata').set({
    ultimoSyncExitoso: !fallo,
    ultimaEjecucion: {
      inicio, fin, pasos, cierre: conCierre, error: fallo ?? null, resumen, advertencias,
    },
    ...(fallo ? {} : { ultimoSyncAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
} catch (err) {
  console.error(`No se pudo registrar el resultado en Firestore: ${err.message}`);
  fallo ??= { paso: 'registro del resultado', codigo: 'excepción', detalle: err.message };
}

try {
  await enviarCorreo(construirCorreo({ exitoso: !fallo, fallo, pasos, inicio, fin, resumen, advertencias, detalles }));
} catch (err) {
  // The Cloud Monitoring alert still covers failures if the email cannot go out.
  console.error(`PIPELINE_CORREO_FALLIDO: ${err.message}`);
}

if (fallo) {
  console.error(`PIPELINE_FALLIDO paso="${fallo.paso}" codigo=${fallo.codigo} detalle=${fallo.detalle.replace(/\n/g, ' | ')}`);
  process.exit(1);
}
console.log(`\n✅ Pipeline completo en ${Math.round((fin - inicio) / 1000)} s${conCierre ? ' (con cierre mensual)' : ''}${advertencias.length ? ` · ${advertencias.length} advertencias` : ''}.`);
