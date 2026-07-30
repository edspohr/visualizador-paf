// Aserción de PII (E7 del addendum).
//
// Objetivo: fallar RUIDOSAMENTE si algún documento persistido en Firestore
// contiene un patrón que se parece a un RUT chileno o a nombre completo de
// estudiante. Esto es una barrera de última milla: la primera línea de
// defensa está en el diseño de la ingesta (agregados de sala, nunca
// filas-estudiante), y esto valida que no haya fugas.
//
// Uso:
//   node scripts/piiAssertion.mjs            → chequea resultados_real (default)
//   node scripts/piiAssertion.mjs --all      → chequea todas las colecciones de datos
//   node scripts/piiAssertion.mjs --cache    → adicional: chequea .cache/harvest/
//
// Exit code:
//   0 → limpio, sin PII
//   1 → PII detectada, aborta

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const CHECK_ALL = args.includes('--all');
const CHECK_CACHE = args.includes('--cache');

// ─── Patrones prohibidos ───────────────────────────────────────────────────

// RUT chileno: 8-9 dígitos (con o sin puntos) + guión + dígito o K.
// Aceptamos con y sin puntos: 12.345.678-9 o 12345678-9 o 26672003-3.
const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[0-9kK]\b/;

// Nombres completos de estudiante: la señal más fuerte es una secuencia de
// palabras en MAYÚSCULA SOSTENIDA (ej: "ACEVEDO LAZO LEANDRO DAMIÁN"), como
// aparecen en el tab Estudiantes del consolidado 2025. Nombres institucionales
// mixtos ("Escuela Villa San Miguel") NO cuentan.
const STUDENT_NAME_PATTERN = /\b(?:[A-ZÁÉÍÓÚÑ]{3,}\s+){3,}[A-ZÁÉÍÓÚÑ]{3,}\b/;

// Prefijos institucionales que NO son PII aunque tengan varias palabras
// capitalizadas.
const INSTITUTIONAL_PREFIXES = /^(escuela|jard[íi]n|colegio|liceo|slep|centro|instituto|fundaci[óo]n|consultora)\b/i;

// Campos por nombre que jamás deben aparecer en Firestore.
const FORBIDDEN_FIELD_NAMES = new Set([
  'rut', 'rutEstudiante', 'nombreAlumno', 'nombreEstudiante',
  'nombreCompleto', 'apellidoPaterno', 'apellidoMaterno', 'primerNombre',
]);

// ─── Chequeo recursivo de un objeto ────────────────────────────────────────

function findPII(obj, path = '') {
  const hits = [];
  if (obj === null || obj === undefined) return hits;
  if (typeof obj === 'string') {
    if (RUT_PATTERN.test(obj)) hits.push({ kind: 'rut-pattern', path, value: obj.slice(0, 50) });
    if (STUDENT_NAME_PATTERN.test(obj) && !INSTITUTIONAL_PREFIXES.test(obj)) {
      hits.push({ kind: 'student-name-pattern', path, value: obj.slice(0, 60) });
    }
    return hits;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return hits;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...findPII(v, `${path}[${i}]`)));
    return hits;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (FORBIDDEN_FIELD_NAMES.has(k)) hits.push({ kind: 'forbidden-field-name', path: `${path}.${k}`, value: String(obj[k]).slice(0, 60) });
      hits.push(...findPII(obj[k], `${path}.${k}`));
    }
  }
  return hits;
}

// ─── Chequear Firestore ────────────────────────────────────────────────────

console.log('[pii-assert] Iniciando chequeo de PII...');
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

let totalHits = 0;
const collections = CHECK_ALL
  ? ['resultados_real', 'establecimientos_real', 'progresoTrimestral_real', 'usuarios']
  : ['resultados_real'];

for (const collName of collections) {
  console.log(`\n[pii-assert] Colección: ${collName}`);
  const snap = await db.collection(collName).get();
  console.log(`  Docs: ${snap.docs.length}`);
  let collHits = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const hits = findPII({ ...data, __docId: d.id }, `${collName}/${d.id}`);
    if (hits.length) {
      collHits += hits.length;
      for (const h of hits.slice(0, 3)) {
        console.error(`  ❌ ${h.kind} en ${h.path}: "${h.value}"`);
      }
      if (hits.length > 3) console.error(`  ... y ${hits.length - 3} más en este doc`);
    }
  }
  console.log(`  → ${collHits} hits en ${collName}`);
  totalHits += collHits;
}

// ─── Chequear cache de harvest ─────────────────────────────────────────────

if (CHECK_CACHE) {
  const cacheDir = pathResolve(ROOT, '.cache/harvest');
  console.log(`\n[pii-assert] Cache de harvest: ${cacheDir}`);
  try {
    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.json') && f !== 'checkpoint.json');
    console.log(`  Snapshots: ${files.length}`);
    let cacheHits = 0;
    for (const f of files) {
      const snapshot = JSON.parse(await readFile(pathResolve(cacheDir, f), 'utf8'));
      const hits = findPII(snapshot, `.cache/harvest/${f}`);
      // Filter out hits that landed on already-redacted content (contain [REDACTED-RUT])
      const realHits = hits.filter(h => !/REDACTED-RUT/.test(h.value));
      if (realHits.length) {
        cacheHits += realHits.length;
        console.error(`  ❌ ${f}: ${realHits.length} PII hits`);
        for (const h of realHits.slice(0, 3)) console.error(`     - ${h.kind}: "${h.value}"`);
      }
    }
    console.log(`  → ${cacheHits} hits en cache`);
    totalHits += cacheHits;
  } catch (e) {
    console.log(`  (cache no accesible: ${e.message})`);
  }
}

console.log(`\n[pii-assert] Total PII detectada: ${totalHits}`);
if (totalHits > 0) {
  console.error(`\n❌ PII assertion FALLÓ. Revisar los hits arriba y limpiar antes de deployar.`);
  process.exit(1);
}
console.log(`✅ PII assertion OK.`);
