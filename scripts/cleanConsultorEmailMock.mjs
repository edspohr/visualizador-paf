// Limpia el campo `consultorEmail` (placeholder sintético) de todos los docs
// de `establecimientos_real`. La app real de asignación consultor↔centro vive
// en `usuarios/{uid}.establecimientoIds`; este campo residual venía del roster
// sintético eliminado.
//
// Uso:
//   node scripts/cleanConsultorEmailMock.mjs --dry-run
//   node scripts/cleanConsultorEmailMock.mjs

import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(await readFile('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

console.log(`Clean consultorEmail (mock) · ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);

const snap = await db.collection('establecimientos_real').get();
const conConsultorEmail = snap.docs.filter(d => 'consultorEmail' in d.data());
console.log(`${snap.size} docs totales; ${conConsultorEmail.length} con consultorEmail`);

if (!conConsultorEmail.length) {
  console.log('Nada que limpiar.');
  process.exit(0);
}

// Muestra distintos valores para confirmar que son mock
const valores = new Set();
for (const d of conConsultorEmail) valores.add(d.data().consultorEmail);
console.log('Valores distintos encontrados:');
for (const v of valores) console.log(`  · ${v}`);

if (DRY_RUN) {
  console.log('\n[DRY-RUN] Nada escrito.');
  process.exit(0);
}

console.log('\nEliminando campo consultorEmail…');
let batch = db.batch(); let count = 0; const batches = [];
for (const d of conConsultorEmail) {
  batch.update(d.ref, { consultorEmail: FieldValue.delete() });
  count++;
  if (count >= 400) { batches.push(batch.commit()); batch = db.batch(); count = 0; }
}
if (count) batches.push(batch.commit());
await Promise.all(batches);
console.log(`${conConsultorEmail.length} docs limpiados.`);
process.exit(0);
