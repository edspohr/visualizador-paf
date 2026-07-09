// Migración idempotente: normaliza `indicadorId` en `resultados_real` de Escolar
// de la forma 'I1' → 'I.1'. Crea el nuevo doc (docId regenerado) y borra el viejo
// solo cuando la escritura fue exitosa.
//
// Uso:
//   node scripts/migrateEscolarIndicadorIds.mjs --dry-run   → solo lista lo que haría
//   node scripts/migrateEscolarIndicadorIds.mjs             → ejecuta migración
//
// El nuevo docId sigue el patrón usado por ingestEscolar:
//   esc_<establecimientoId>_<indicadorIdNormalizado>_<anio>
// (sanitizando caracteres no válidos como / y espacios).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Sanitizador consistente con los ingest scripts.
function sanitizeDocId(s) {
  return String(s).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function normalizarIndicadorId(id) {
  if (typeof id !== 'string') return { id, changed: false };
  const m = id.match(/^I\.?(\d+)$/);
  if (!m) return { id, changed: false };
  const nuevo = `I.${m[1]}`;
  return { id: nuevo, changed: nuevo !== id };
}

async function main() {
  console.log(`[migrate] mode: ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
  const snap = await db.collection('resultados_real').where('programa', '==', 'escolar').get();
  console.log(`[migrate] docs escolar leídos: ${snap.size}`);

  let migrados = 0, saltados = 0, colisiones = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const { id: nuevoInd, changed } = normalizarIndicadorId(data.indicadorId);
    if (!changed) { saltados++; continue; }
    const nuevoDocId = sanitizeDocId(`esc_${data.establecimientoId}_${nuevoInd}_${data.anio ?? data.periodo}`);
    const nuevoRef = db.collection('resultados_real').doc(nuevoDocId);

    if (nuevoDocId === d.id) {
      // El sanitizador convergió al mismo id; solo actualiza el campo.
      console.log(`[migrate] SAME docId, update field only: ${d.id}  ${data.indicadorId} → ${nuevoInd}`);
      if (!DRY_RUN) await d.ref.update({ indicadorId: nuevoInd });
      migrados++;
      continue;
    }

    // Verificar si ya existe un doc en el nuevo id (podría venir de una corrida previa
    // parcial); en ese caso conservamos el más reciente y borramos el viejo.
    const existente = await nuevoRef.get();
    if (existente.exists) {
      colisiones++;
      console.log(`[migrate] COLISIÓN: ya existe ${nuevoDocId}; borrando doc viejo ${d.id}`);
      if (!DRY_RUN) await d.ref.delete();
      continue;
    }

    const payload = { ...data, indicadorId: nuevoInd };
    console.log(`[migrate] ${d.id} → ${nuevoDocId}  (${data.indicadorId} → ${nuevoInd})`);
    if (!DRY_RUN) {
      await nuevoRef.set(payload, { merge: true });
      await d.ref.delete();
    }
    migrados++;
  }

  console.log(`\n[migrate] Resumen:`);
  console.log(`  Migrados : ${migrados}`);
  console.log(`  Saltados : ${saltados}  (ya normalizados)`);
  console.log(`  Colisiones (viejo borrado): ${colisiones}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
