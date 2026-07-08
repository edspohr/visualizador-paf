// Enrich establecimientos_real with missing fields the UI expects:
//   - slep (id like 'SLEP-LP' matching src/data/establecimientos.js SLEPS[])
//   - sostenedor (string; already present for Parvulario, missing for Escolar)
//   - comuna, nNinos, nAgentes (only for Escolar; Parvulario ya los tiene)
//
// The values come from the committed synthetic roster (src/data/establecimientos.js)
// joined by normalized establishment name. This is a one-shot cleanup; idempotente.
//
// Uso:
//   node scripts/enrichEstablecimientos.mjs --dry-run
//   node scripts/enrichEstablecimientos.mjs

import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ESCUELAS, JARDINES, SLEPS } from '../src/data/establecimientos.js';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(await readFile('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`Enrich establecimientos_real · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}\n`);

function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^escuela\s+/, '').replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Build name → synthetic-roster row
const SYNTH_BY_NAME = new Map();
for (const e of ESCUELAS) SYNTH_BY_NAME.set(`escolar|${normName(e.nombre)}`, e);
for (const j of JARDINES) SYNTH_BY_NAME.set(`parvulario|${normName(j.nombre)}`, j);

// sostenedor string → slep id
const SOSTENEDOR_TO_ID = {};
for (const s of SLEPS) SOSTENEDOR_TO_ID[s.nombre] = s.id;
console.log('SLEPS mapping:', SOSTENEDOR_TO_ID, '\n');

const snap = await db.collection('establecimientos_real').get();
console.log(`${snap.size} docs en establecimientos_real\n`);

const updates = [];
const unmatched = [];
for (const d of snap.docs) {
  const x = d.data();
  if (!x.programa || !x.nombre) continue;
  const key = `${x.programa}|${normName(x.nombre)}`;
  const synth = SYNTH_BY_NAME.get(key);

  const patch = {};

  if (synth) {
    // Primary path: enrich from synthetic roster (Escolar mostly).
    if (!x.slep) patch.slep = synth.slep;
    if (!x.cohorte && synth.cohorte) patch.cohorte = synth.cohorte;
    if (!x.tipo && synth.tipo) patch.tipo = synth.tipo;
    if (!x.sostenedor) {
      const s = SLEPS.find(s => s.id === synth.slep);
      if (s) patch.sostenedor = s.nombre;
    }
    if (!x.comuna && synth.comuna) patch.comuna = synth.comuna;
    if (x.nNinos == null && synth.nNinos != null) patch.nNinos = synth.nNinos;
    if (x.nAgentes == null && synth.nAgentes != null) patch.nAgentes = synth.nAgentes;
    if (!x.consultorEmail && synth.consultorEmail) patch.consultorEmail = synth.consultorEmail;
  } else {
    // Fallback path (Parvulario mostly): the roster came from Bases SCJI in Etapa 3,
    // has `sostenedor` string but no `slep` id. Derive slep from sostenedor mapping.
    if (!x.slep && x.sostenedor && SOSTENEDOR_TO_ID[x.sostenedor]) {
      patch.slep = SOSTENEDOR_TO_ID[x.sostenedor];
    }
    // Nothing else to add — this branch is for records already populated elsewhere.
    if (Object.keys(patch).length === 0) {
      unmatched.push({ id: d.id, nombre: x.nombre, programa: x.programa, hasSostenedor: !!x.sostenedor });
      continue;
    }
  }

  if (Object.keys(patch).length > 0) updates.push({ id: d.id, nombre: x.nombre, programa: x.programa, patch });
}

console.log(`${updates.length} docs necesitan enriquecimiento`);
console.log(`${unmatched.length} docs sin match en roster sintético\n`);

if (unmatched.length) {
  console.log('Unmatched:');
  for (const u of unmatched) console.log(`  · ${u.programa} ${u.id} "${u.nombre}"`);
}

// Sample first 5
console.log('\nMuestra de patches (primeros 5):');
for (const u of updates.slice(0, 5)) {
  console.log(`  ${u.programa} ${u.id} "${u.nombre}":`, u.patch);
}

// Break down what's being added
const fieldCounts = {};
for (const u of updates) {
  for (const k of Object.keys(u.patch)) fieldCounts[k] = (fieldCounts[k] || 0) + 1;
}
console.log('\nCampos a agregar:');
for (const [k, v] of Object.entries(fieldCounts)) console.log(`  ${k}: ${v} docs`);

if (DRY_RUN) {
  console.log('\n[DRY-RUN] Nada escrito.');
  process.exit(0);
}

console.log('\nEscribiendo enrichment merges…');
let batch = db.batch(); let count = 0; const batches = [];
for (const u of updates) {
  batch.set(db.collection('establecimientos_real').doc(u.id),
    { ...u.patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  count++;
  if (count >= 400) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
}
if (count) batches.push(batch.commit());
await Promise.all(batches);
console.log(`${updates.length} docs enriquecidos.`);
process.exit(0);
