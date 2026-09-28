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
// ultimoSyncExitoso: false.
//
// Locally: node scripts/runPipeline.mjs [--sin-cierre] [--forzar-cierre]
// In Cloud Functions it is started by functions/src/index.mjs.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { credenciales } from './lib/runtime.mjs';

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
    let cola = '';
    const guardar = (chunk) => { process.stdout.write(chunk); cola = (cola + chunk).slice(-2000); };
    p.stdout.on('data', guardar);
    p.stderr.on('data', guardar);
    p.on('close', (code) => resolve({ code, segundos: Math.round((Date.now() - t0) / 1000), cola }));
  });
}

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

const inicio = new Date();
const pasos = [];
let fallo = null;
for (const [nombre, script, scriptArgs] of PASOS) {
  console.log(`\n═══ ${nombre} (${script} ${scriptArgs.join(' ')}) ═══`);
  const r = await correr(script, scriptArgs);
  pasos.push({ nombre, script, codigo: r.code, segundos: r.segundos });
  if (r.code !== 0) {
    fallo = { paso: nombre, codigo: r.code, detalle: r.cola.split('\n').filter(Boolean).slice(-5).join(' | ') };
    break;
  }
}

await db.doc('config/pipelineMetadata').set({
  ultimoSyncExitoso: !fallo,
  ultimaEjecucion: {
    inicio, fin: new Date(), pasos, cierre: conCierre, error: fallo ?? null,
  },
  ...(fallo ? {} : { ultimoSyncAt: FieldValue.serverTimestamp() }),
}, { merge: true });

if (fallo) {
  console.error(`PIPELINE_FALLIDO paso="${fallo.paso}" codigo=${fallo.codigo} detalle=${fallo.detalle}`);
  process.exit(1);
}
console.log(`\n✅ Pipeline completo en ${Math.round((Date.now() - inicio) / 1000)} s${conCierre ? ' (con cierre mensual)' : ''}.`);
