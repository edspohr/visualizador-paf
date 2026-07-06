// Script de seed inicial para Firestore.
// Lee los arrays actuales de establecimientos.js e indicadores.js
// y los escribe como documentos en Firestore usando el Admin SDK.
//
// Requiere:
//   - Archivo scripts/service-account.json (descargado desde consola Firebase)
//   - Correr con: npm run seed [-- --force]
//
// El script es idempotente: si ya hay docs en /establecimientos, aborta salvo que
// pases --force para confirmar sobrescritura.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes('--force');
const collectionsFilter = args.find(a => a.startsWith('--only='))?.slice(7)?.split(',');

// ─── Load service account ──────────────────────────────────────────────────
const saPath = pathResolve(ROOT, 'scripts/service-account.json');
if (!existsSync(saPath)) {
  console.error(`❌ Falta el archivo scripts/service-account.json`);
  console.error(`   Descargalo desde: https://console.firebase.google.com/project/visualizador-paf/settings/serviceaccounts/adminsdk`);
  process.exit(1);
}
const serviceAccount = JSON.parse(await readFile(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Load app data by importing the source files ───────────────────────────
// Los arrays viven en src/data/. Los importamos como ES modules.
const { SLEPS, ESCUELAS, JARDINES } = await import(pathResolve(ROOT, 'src/data/establecimientos.js'));
const { INDICADORES_ESCOLAR, INDICADORES_PARVULARIO, AMBITOS_ESCOLAR, AMBITOS_PARVULARIO } = await import(pathResolve(ROOT, 'src/data/indicadores.js'));

console.log(`Datos a cargar:`);
console.log(`  ${SLEPS.length} sostenedores`);
console.log(`  ${ESCUELAS.length + JARDINES.length} establecimientos (${ESCUELAS.length} escuelas + ${JARDINES.length} jardines)`);
console.log(`  ${INDICADORES_ESCOLAR.length + INDICADORES_PARVULARIO.length} indicadores`);
console.log(`  ${AMBITOS_ESCOLAR.length + AMBITOS_PARVULARIO.length} ámbitos`);
console.log('');

// ─── Idempotence check ─────────────────────────────────────────────────────
async function checkOverwrite() {
  const check = await db.collection('establecimientos').limit(1).get();
  if (!check.empty && !force) {
    console.error(`❌ Ya hay datos en /establecimientos. Usá --force para sobrescribir.`);
    process.exit(1);
  }
  if (!check.empty) {
    console.warn(`⚠️  --force activo: se sobrescribirán documentos existentes.`);
  }
}

// ─── Batch writes ──────────────────────────────────────────────────────────
async function commitInChunks(collectionName, docs) {
  const CHUNK = 400; // Firestore batch limit is 500; leave headroom
  let written = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const slice = docs.slice(i, i + CHUNK);
    for (const [id, data] of slice) {
      batch.set(db.collection(collectionName).doc(id), {
        ...data,
        seededAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
    process.stdout.write(`  ${collectionName}: ${written}/${docs.length}\r`);
  }
  process.stdout.write(`  ✓ ${collectionName}: ${written} docs\n`);
}

// ─── Runners por colección ────────────────────────────────────────────────

async function seedSostenedores() {
  const docs = SLEPS.map(s => [s.id, { id: s.id, nombre: s.nombre, comuna: s.comuna }]);
  await commitInChunks('sostenedores', docs);
}

async function seedEstablecimientos() {
  const all = [...ESCUELAS, ...JARDINES];
  const docs = all.map(e => [e.id, {
    id: e.id,
    nombre: e.nombre,
    slep: e.slep,
    cohorte: e.cohorte,
    comuna: e.comuna,
    tipo: e.tipo,
    nSalas: e.nSalas,
    nNinos: e.nNinos,
    nAgentes: e.nAgentes,
    consultorEmail: e.consultorEmail,
  }]);
  await commitInChunks('establecimientos', docs);
}

async function seedIndicadores() {
  const withPrograma = [
    ...INDICADORES_ESCOLAR.map(i => ({ ...i, programa: 'escolar' })),
    ...INDICADORES_PARVULARIO.map(i => ({ ...i, programa: 'parvulario' })),
  ];
  const docs = withPrograma.map(ind => [
    `${ind.programa}_${ind.id}`,
    ind,
  ]);
  await commitInChunks('indicadores', docs);
}

async function seedAmbitos() {
  const withPrograma = [
    ...AMBITOS_ESCOLAR.map(a => ({ ...a, programa: 'escolar' })),
    ...AMBITOS_PARVULARIO.map(a => ({ ...a, programa: 'parvulario' })),
  ];
  const docs = withPrograma.map(a => [
    `${a.programa}_${a.id}`,
    a,
  ]);
  await commitInChunks('ambitos', docs);
}

async function seedMetadata() {
  const hoy = new Date();
  // Mes cerrado = mes anterior al actual
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();
  const mesCerrado = mesActual === 1 ? 12 : mesActual - 1;
  const anioCerrado = mesActual === 1 ? anioActual - 1 : anioActual;
  await db.collection('metadata').doc('mesCerrado').set({
    anio: anioCerrado,
    mes: mesCerrado,
    cerradoAt: FieldValue.serverTimestamp(),
    cerradoPor: 'seed-script',
  });
  console.log(`  ✓ metadata/mesCerrado: ${anioCerrado}-${String(mesCerrado).padStart(2, '0')}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  await checkOverwrite();
  const allCollections = ['sostenedores', 'establecimientos', 'indicadores', 'ambitos', 'metadata'];
  const targets = collectionsFilter ?? allCollections;

  console.log(`\nEscribiendo colecciones: ${targets.join(', ')}\n`);

  if (targets.includes('sostenedores'))     await seedSostenedores();
  if (targets.includes('establecimientos')) await seedEstablecimientos();
  if (targets.includes('indicadores'))      await seedIndicadores();
  if (targets.includes('ambitos'))          await seedAmbitos();
  if (targets.includes('metadata'))         await seedMetadata();

  console.log(`\n✅ Seed completado. Verificá en https://console.firebase.google.com/project/visualizador-paf/firestore`);
  process.exit(0);
}

main().catch(err => {
  console.error(`❌ Error en seed:`, err);
  process.exit(1);
});
