// Pipeline: snapshot de matrícula (n° de niños) para el perfil CAP.
//
// Fundación CAP reporta matrícula con datos congelados dos veces al año:
//   - Snapshot de mayo   → se lee y guarda una vez en junio para el reporte
//                          jun/jul/ago.
//   - Snapshot de agosto → se lee y guarda una vez en septiembre para el
//                          reporte sep-dic.
//
// Este script copia `nNinos` (dato vivo) al campo snapshot correspondiente en
// `establecimientos_real`. Es idempotente: si el snapshot del corte+año ya
// existe, no se sobreescribe (a menos que se pase --force).
//
// Uso:
//   npm run snapshot-matricula -- --corte=mayo   [--anio=2026] [--dry-run] [--force]
//   npm run snapshot-matricula -- --corte=agosto [--anio=2026] [--dry-run] [--force]

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args.filter(a => a.startsWith('--'))
      .map(a => a.replace(/^--/, '').split('='))
      .map(([k, v]) => [k, v ?? true])
);

const CORTE = String(argMap.corte || '').toLowerCase();
if (CORTE !== 'mayo' && CORTE !== 'agosto') {
  console.error('Falta --corte=mayo|agosto');
  process.exit(1);
}
const ANIO = Number(argMap.anio) || new Date().getFullYear();
const DRY = argMap['dry-run'] === true;
const FORCE = argMap.force === true;

const FIELD = CORTE === 'mayo' ? 'Mayo' : 'Agosto';
const NOW = new Date();

async function main() {
  const svcPath = pathResolve(__dirname, 'service-account.json');
  const svc = JSON.parse(await readFile(svcPath, 'utf-8'));
  initializeApp({ credential: cert(svc) });
  const db = getFirestore();

  const snap = await db.collection('establecimientos_real').get();
  console.log(`Leyendo ${snap.size} establecimientos…`);

  let escritos = 0, saltados = 0, sinNninos = 0;
  const batchSize = 400;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const nNinos = data.nNinos;
    if (nNinos === null || nNinos === undefined) {
      sinNninos += 1;
      continue;
    }
    const anioActual = data[`nNinosSnapshot${FIELD}Anio`];
    if (anioActual === ANIO && !FORCE) {
      saltados += 1;
      continue;
    }
    const update = {
      [`nNinosSnapshot${FIELD}`]: nNinos,
      [`nNinosSnapshot${FIELD}Fecha`]: FieldValue.serverTimestamp(),
      [`nNinosSnapshot${FIELD}Anio`]: ANIO,
      [`nNinosSnapshot${FIELD}UltimaEjecucion`]: NOW.toISOString(),
    };
    if (DRY) {
      console.log(`[dry] ${doc.id} ← ${JSON.stringify(update)}`);
    } else {
      batch.update(doc.ref, update);
      inBatch += 1;
      if (inBatch >= batchSize) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    escritos += 1;
  }

  if (!DRY && inBatch > 0) await batch.commit();

  console.log('');
  console.log(`Snapshot de ${CORTE} · año ${ANIO} · ${DRY ? 'DRY-RUN' : 'OK'}`);
  console.log(`  Escritos : ${escritos}`);
  console.log(`  Saltados : ${saltados} (snapshot del año ya existe, usar --force para reescribir)`);
  console.log(`  Sin dato : ${sinNninos} (no tenían nNinos)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
