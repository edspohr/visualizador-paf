// Flip the dataSource flag for a track.
//
//   node scripts/setDataSourceFlag.mjs parvulario real
//   node scripts/setDataSourceFlag.mjs parvulario synthetic
//   node scripts/setDataSourceFlag.mjs escolar real
//
// Escribe { escolar, parvulario, updatedAt } al doc `config/dataSource`.
// Idempotente; imprime el estado ANTES y DESPUÉS. La UI se suscribe al doc y hace
// reload al detectar cambio, por lo que el rollback es una sola línea:
//
//   npm run set-flag parvulario synthetic
//
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const [track, value] = process.argv.slice(2);
if (!['escolar', 'parvulario'].includes(track) || !['real', 'synthetic'].includes(value)) {
  console.error('Uso: node scripts/setDataSourceFlag.mjs <escolar|parvulario> <real|synthetic>');
  process.exit(1);
}

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const ref = db.doc('config/dataSource');

const before = await ref.get();
const beforeData = before.exists ? before.data() : {};
console.log('Antes:', JSON.stringify({ escolar: beforeData.escolar, parvulario: beforeData.parvulario }));

await ref.set({ [track]: value, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

const after = await ref.get();
const afterData = after.data();
console.log('Ahora:', JSON.stringify({ escolar: afterData.escolar, parvulario: afterData.parvulario }));
console.log(`OK — ${track} = ${value}`);
