#!/usr/bin/env node
// Copies the nightly pipeline scripts and the data files they read into
// functions/pipeline/, keeping the repo layout (scripts/, src/data/, src/lib/)
// so relative imports and ROOT-based paths keep working inside Cloud
// Functions. Runs as the functions predeploy step (firebase.json).
//
// The service account key is never copied: in Cloud Functions the scripts use
// the function's own identity (scripts/lib/runtime.mjs).

import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const DEST = pathResolve(ROOT, 'functions/pipeline');

const ARCHIVOS = [
  'scripts/runPipeline.mjs',
  'scripts/ingestParvulario.mjs',
  'scripts/ingestEscolar.mjs',
  'scripts/backfillEscolarNullDocs.mjs',
  'scripts/syncSlepDenormalizado.mjs',
  'scripts/computeTerritorioAggregates.mjs',
  'scripts/piiAssertion.mjs',
  'scripts/snapshotCierre.mjs',
  'scripts/lib/runtime.mjs',
  'scripts/lib/correoPipeline.mjs',
  'scripts/lib/pruneStale.mjs',
  'scripts/lib/establecimientosRegistro.mjs',
  'scripts/lib/escolarMapping.mjs',
  'scripts/lib/parvularioIds.mjs',
  'src/data/catalog.json',
  'src/data/escolarPlanillaIndex.json',
  'src/data/establecimientos.js',
  'src/data/scope.js',
  'src/data/visibilidad.js',
  'src/lib/comunas.js',
  'src/lib/registro.js',
];

rmSync(DEST, { recursive: true, force: true });
for (const rel of ARCHIVOS) {
  const src = pathResolve(ROOT, rel);
  if (!existsSync(src)) throw new Error(`Falta ${rel}`);
  const dst = pathResolve(DEST, rel);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}
if (existsSync(pathResolve(DEST, 'scripts/service-account.json'))) throw new Error('La clave no debe copiarse');
console.log(`Pipeline empaquetado en functions/pipeline (${ARCHIVOS.length} archivos).`);
