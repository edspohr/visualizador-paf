// Rename one-off: 'Escuela Profesor Ramón del Río' → 'Escuela Ramón del Río'.
// Consistente con la planilla oficial del cliente (SLEP Santa Corina, cohorte 2026-2028).
// Idempotente: si el doc ya tiene el nombre nuevo, no hace nada.

import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const sa = JSON.parse(await readFile('scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const DOC_ID = 'esc-profesor-ramon-del-rio';
const NUEVO_NOMBRE = 'Escuela Ramón del Río';

const ref = db.collection('establecimientos_real').doc(DOC_ID);
const snap = await ref.get();
if (!snap.exists) {
  console.log(`⚠️  Doc ${DOC_ID} no existe. Nada que hacer.`);
  process.exit(0);
}
const data = snap.data();
console.log(`Doc actual: ${DOC_ID} → nombre="${data.nombre}"`);

if (data.nombre === NUEVO_NOMBRE) {
  console.log('✅ Ya tiene el nombre nuevo. Nada que hacer.');
  process.exit(0);
}

console.log(`Rename: "${data.nombre}" → "${NUEVO_NOMBRE}"`);
if (DRY_RUN) {
  console.log('[DRY-RUN] Nada escrito.');
  process.exit(0);
}
await ref.set({ nombre: NUEVO_NOMBRE, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log('✅ Rename aplicado.');
process.exit(0);
