// Enriquece `establecimientos_real` con campos derivables desde datos ya presentes:
//   - `slep` (id): derivado desde el string `sostenedor` según la tabla `SOSTENEDOR_TO_SLEP`.
//
// El resto de campos (cohorte, tipo, comuna, nNinos, nAgentes) se cargan desde
// los pipelines de ingesta o desde el propio operador. Este script ya NO importa
// roster sintético: solo trabaja con los datos que ya viven en Firestore.
//
// Uso:
//   node scripts/enrichEstablecimientos.mjs --dry-run
//   node scripts/enrichEstablecimientos.mjs

import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(await readFile('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`Enrich establecimientos_real · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
console.log(`SA: ${sa.client_email}\n`);

// Mapeo canónico string sostenedor → id SLEP.
// Es la única "tabla" del universo PAF; se mantiene aquí para que la ingesta y
// el enrich no necesiten datos sintéticos.
const SOSTENEDOR_TO_SLEP = {
  'SLEP Los Parques':   'SLEP-LP',
  'SLEP Santa Rosa':    'SLEP-SR',
  'SLEP Del Pino':      'SLEP-DP',
  'SLEP Santa Corina':  'SLEP-SC',
};

const snap = await db.collection('establecimientos_real').get();
console.log(`${snap.size} docs en establecimientos_real\n`);

const updates = [];
const sinSostenedor = [];
for (const d of snap.docs) {
  const x = d.data();
  const patch = {};

  if (!x.slep && x.sostenedor) {
    const slepId = SOSTENEDOR_TO_SLEP[x.sostenedor];
    if (slepId) patch.slep = slepId;
  }

  if (Object.keys(patch).length === 0) {
    if (!x.slep && !x.sostenedor) sinSostenedor.push({ id: d.id, nombre: x.nombre, programa: x.programa });
    continue;
  }
  updates.push({ id: d.id, nombre: x.nombre, programa: x.programa, patch });
}

console.log(`${updates.length} docs necesitan enriquecimiento`);
if (sinSostenedor.length) {
  console.log(`\n${sinSostenedor.length} docs sin slep ni sostenedor (revisar manualmente):`);
  for (const u of sinSostenedor) console.log(`  · ${u.programa} ${u.id} "${u.nombre}"`);
}

console.log('\nMuestra (primeros 5):');
for (const u of updates.slice(0, 5)) {
  console.log(`  ${u.programa} ${u.id} "${u.nombre}":`, u.patch);
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] Nada escrito.');
  process.exit(0);
}

console.log('\nEscribiendo merges…');
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
