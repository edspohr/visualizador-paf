#!/usr/bin/env node
// Seeds the sostenedores catalog (collection sostenedores_real, ADR-0002) from
// the sostenedores already present in establecimientos_real. After this, new
// sostenedores are created from the platform ("Establecimientos y
// sostenedores") and the ingests resolve a sostenedor name to its SLEP id
// through this catalog instead of a table in code.
//
// Usage: node scripts/seedSostenedores.mjs [--dry-run]
// Idempotent: existing docs are left untouched. Report in reports/.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { credenciales, salida } from './lib/runtime.mjs';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: credenciales(ROOT).firebaseCredential });
const db = getFirestore();

const [estSnap, sosSnap] = await Promise.all([
  db.collection('establecimientos_real').get(),
  db.collection('sostenedores_real').get(),
]);
const existentes = new Set(sosSnap.docs.map(d => d.id));

const porSlep = new Map();
const conflictos = [];
for (const d of estSnap.docs) {
  const { slep, sostenedor } = d.data();
  if (!slep) continue;
  const nombre = sostenedor || slep;
  if (porSlep.has(slep) && porSlep.get(slep) !== nombre) conflictos.push({ slep, nombres: [porSlep.get(slep), nombre], est: d.id });
  if (!porSlep.has(slep)) porSlep.set(slep, nombre);
}

const crear = [...porSlep.entries()].filter(([id]) => !existentes.has(id)).map(([id, nombre]) => ({ id, nombre }));
console.log(`Seed sostenedores — ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`  ${existentes.size} en el catálogo, ${porSlep.size} en establecimientos_real, ${crear.length} por crear`);
for (const c of crear) console.log(`  + ${c.id} · ${c.nombre}`);
for (const c of conflictos) console.warn(`  ⚠ ${c.slep}: nombres distintos ${JSON.stringify(c.nombres)} (${c.est})`);

if (!DRY_RUN && crear.length) {
  const batch = db.batch();
  for (const c of crear) {
    batch.set(db.collection('sostenedores_real').doc(c.id), { nombre: c.nombre, alias: [], origen: 'seed', createdAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  console.log(`✅ ${crear.length} sostenedores creados.`);
}

const reportPath = salida(ROOT, `reports/seedSostenedores-${new Date().toISOString().slice(0, 10)}${DRY_RUN ? '-dryrun' : ''}.json`);
await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: DRY_RUN, creados: crear, conflictos }, null, 2));
console.log(`Reporte → ${reportPath}`);
process.exit(conflictos.length ? 1 : 0);
