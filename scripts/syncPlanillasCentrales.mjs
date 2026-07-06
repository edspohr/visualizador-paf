// Pipeline: Planillas Centrales de Focus → Firestore
//
// Lee las 3 Planillas Centrales por cohorte (via Google Sheets API con service account),
// parsea el progreso trimestral por (establecimiento × ámbito × trimestre), y hace upsert
// idempotente en la colección /progresoTrimestral de Firestore.
//
// Uso:
//   npm run sync-planillas [-- --dry-run]
//
// Requiere:
//   - scripts/service-account.json (ya existe para el seed)
//   - Que las 3 Planillas Centrales estén compartidas como Viewer con la service account
//   - Sheets API habilitada en el proyecto GCP

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// ─── Config: las 3 Planillas Centrales ────────────────────────────────────
// Cada planilla tiene un tab por establecimiento. La primera pestaña suele traer
// el nombre corto del jardín ("AKUN", "AP", "PJ"). El nombre completo va en la
// columna SCJI dentro de las filas de datos.
const PLANILLAS = [
  {
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    label: 'Cohorte 2025-2026 Año 1',
    anio: 2025,
    cohorte: '2025-2026',
    programa: 'parvulario',
  },
  {
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    label: 'Cohorte 2025-2026 Año 2',
    anio: 2026,
    cohorte: '2025-2026',
    programa: 'parvulario',
  },
  {
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    label: 'Cohorte 2026-2027 Año 1',
    anio: 2026,
    cohorte: '2026-2027',
    programa: 'parvulario',
  },
];

// ─── Init Firebase Admin + Google Auth ─────────────────────────────────────

const saPath = pathResolve(ROOT, 'scripts/service-account.json');
const serviceAccount = JSON.parse(await readFile(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Cargar establecimientos de Firestore para mapear nombre → ID ──────────

console.log('Cargando establecimientos desde Firestore…');
const establecimientosSnap = await db.collection('establecimientos').get();
const establecimientos = establecimientosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`  ✓ ${establecimientos.length} establecimientos cargados`);

const ambitosSnap = await db.collection('ambitos').get();
const ambitos = ambitosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`  ✓ ${ambitos.length} ámbitos cargados`);

// ─── Helpers de matching ───────────────────────────────────────────────────

// Normaliza un texto para hacer match: minúsculas, sin acentos, sin espacios extra.
function normalizar(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapea el nombre de un jardín (columna SCJI) al doc de establecimiento en Firestore.
function encontrarEstablecimiento(scjiTexto) {
  const target = normalizar(scjiTexto);
  if (!target) return null;
  // Match aproximado: el nombre del establecimiento en Firestore es "Jardín X",
  // el SCJI de la planilla suele venir en mayúsculas ("X PICHIWENTXU" o similar).
  return establecimientos.find(e => {
    const nombreN = normalizar(e.nombre.replace(/^jardin\s+/i, ''));
    // El nombre corto del sheet puede ser subset del nombre completo o viceversa
    return nombreN.includes(target) || target.includes(nombreN);
  });
}

// Mapea el texto de un objetivo (columna Objetivos) al ámbito del catálogo.
// La lógica: buscamos palabras clave características de cada ámbito.
function encontrarAmbito(objetivoTexto, programa) {
  const t = normalizar(objetivoTexto);
  if (!t) return null;
  // Buscar ámbitos del programa correspondiente
  const candidatos = ambitos.filter(a => a.programa === programa);
  // Heurística por palabra clave
  if (t.includes('liderazgo') || t.includes('gestion') || t.includes('alianza') || t.includes('institucional'))
    return candidatos.find(a => a.id === 'A1');
  if (t.includes('formacion') && (t.includes('equipo') || t.includes('agente') || t.includes('educativ')))
    return candidatos.find(a => a.id === 'A2');
  if (t.includes('apoderad') || t.includes('parentalid') || t.includes('familia') || t.includes('padres'))
    return candidatos.find(a => a.id === 'A3');
  if (t.includes('lector') || t.includes('lenguaje') || t.includes('lectura'))
    return candidatos.find(a => a.id === 'A3'); // Parvulario colapsa en A3
  return null;
}

// Parsea un % que puede venir como "83%", "100,00%", "0.75", "" etc.
function parsePorcentaje(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // Si es > 1, asumimos que viene en escala 0-100
  return n > 1 ? n / 100 : n;
}

// ─── Parsear una hoja (tab) de Planilla Central ────────────────────────────
// Estructura observada:
//   Fila 1-2: encabezados (COMUNA, SCJI, Objetivos, T1, T2, T3, T4, ...)
//   Fila 3: COMUNA + SCJI + Objetivo1 + T1% + T2% + T3% + T4% + ...
//   Filas siguientes: Objetivo2 (COMUNA/SCJI vacías) + T1% + T2% + T3% + T4%
//   Al final: "Progreso general de las metas" + %s (ignorar)

async function parsearHoja(sheetId, hojaTitulo, planilla) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${hojaTitulo}!A1:H50`, // Los porcentajes están en columnas D-G aprox
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values ?? [];
  if (!rows.length) return { docs: [], warnings: [`Hoja ${hojaTitulo} vacía`] };

  const warnings = [];
  let establecimiento = null;
  let scjiEncontrado = null;
  const docs = [];

  for (const row of rows) {
    if (!row.length) continue;
    const [colA, colB, colC, colD, colE, colF, colG] = row.map(v => v ?? '');

    // Detectar fila con SCJI (jardín): tiene comuna y SCJI en las primeras dos columnas
    if (colA && colB && !scjiEncontrado) {
      const posibleEst = encontrarEstablecimiento(colB);
      if (posibleEst) {
        establecimiento = posibleEst;
        scjiEncontrado = colB;
      } else {
        warnings.push(`No matcheé establecimiento para SCJI="${colB}" en hoja "${hojaTitulo}"`);
        return { docs, warnings };
      }
    }

    // Detectar fila con % por objetivo:
    // Puede venir con colA/colB vacías (objetivos 2 y 3) o con colA/colB llenas (objetivo 1)
    const objetivoTexto = colC;
    if (!objetivoTexto || objetivoTexto === 'Objetivos') continue;
    // Excluir la fila de "Progreso general"
    if (normalizar(objetivoTexto).includes('progreso general')) continue;

    // Los 4 % están en las columnas D-G
    const p1 = parsePorcentaje(colD);
    const p2 = parsePorcentaje(colE);
    const p3 = parsePorcentaje(colF);
    const p4 = parsePorcentaje(colG);

    // Si ninguna columna tiene un %, la fila probablemente sea de meta/check, saltar
    if ([p1, p2, p3, p4].every(v => v === null)) continue;

    const ambito = encontrarAmbito(objetivoTexto, planilla.programa);
    if (!establecimiento) {
      warnings.push(`Progreso encontrado en "${hojaTitulo}" pero sin establecimiento matcheado`);
      continue;
    }

    const trimestres = [p1, p2, p3, p4];
    for (let i = 0; i < 4; i++) {
      const p = trimestres[i];
      if (p === null) continue; // no persistimos NULL
      const trimestre = i + 1;
      const docId = `${establecimiento.id}_${ambito?.id ?? 'sin-ambito'}_${planilla.anio}_T${trimestre}`;
      docs.push({
        docId,
        data: {
          establecimientoId: establecimiento.id,
          ambitoId: ambito?.id ?? null,
          ambitoNombre: objetivoTexto,
          anio: planilla.anio,
          trimestre,
          progreso: p,
          programa: planilla.programa,
          fuenteSync: 'planilla-central',
          sheetId,
          hojaTitulo,
          syncAt: FieldValue.serverTimestamp(),
        },
      });
    }
  }

  if (!establecimiento) warnings.push(`No se detectó establecimiento en hoja "${hojaTitulo}"`);
  return { docs, warnings };
}

// ─── Loop principal ────────────────────────────────────────────────────────

async function sincronizarPlanilla(planilla) {
  console.log(`\n📄 Procesando ${planilla.label} (${planilla.id})`);
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: planilla.id, fields: 'sheets.properties' });
    const hojas = meta.data.sheets.map(s => s.properties.title);
    console.log(`   ${hojas.length} hojas encontradas: ${hojas.join(', ')}`);

    let docsAcumulados = [];
    const warningsAcumulados = [];

    for (const titulo of hojas) {
      // Saltar hojas que suelen ser resumen/plantilla
      if (/plantilla|template|instrucci/i.test(titulo)) {
        console.log(`   ⏭  ${titulo}: saltada (parece plantilla)`);
        continue;
      }
      const { docs, warnings } = await parsearHoja(planilla.id, titulo, planilla);
      docsAcumulados.push(...docs);
      warningsAcumulados.push(...warnings);
      console.log(`   ✓ ${titulo}: ${docs.length} progresos extraídos`);
    }

    if (warningsAcumulados.length) {
      console.log(`   ⚠  Warnings:`);
      warningsAcumulados.forEach(w => console.log(`      - ${w}`));
    }

    return { docs: docsAcumulados, warnings: warningsAcumulados, planilla };
  } catch (err) {
    console.error(`   ❌ Error procesando ${planilla.label}: ${err.message}`);
    return { docs: [], warnings: [err.message], planilla };
  }
}

async function escribirBatch(docs) {
  if (!docs.length) return 0;
  if (dryRun) {
    console.log(`   [dry-run] Se escribirían ${docs.length} documentos`);
    return docs.length;
  }
  const CHUNK = 400;
  let escritos = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const slice = docs.slice(i, i + CHUNK);
    for (const { docId, data } of slice) {
      batch.set(db.collection('progresoTrimestral').doc(docId), data, { merge: true });
    }
    await batch.commit();
    escritos += slice.length;
  }
  return escritos;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  const resultados = [];

  for (const planilla of PLANILLAS) {
    const r = await sincronizarPlanilla(planilla);
    resultados.push(r);
  }

  const todosDocs = resultados.flatMap(r => r.docs);
  const todosWarnings = resultados.flatMap(r => r.warnings);
  console.log(`\n📊 Total: ${todosDocs.length} progresos a escribir`);

  const escritos = await escribirBatch(todosDocs);

  const duracionMs = Date.now() - t0;

  // Metadata del sync
  if (!dryRun) {
    await db.collection('metadata').doc('pipeline').set({
      ultimoSyncAt: FieldValue.serverTimestamp(),
      ultimoSyncExitoso: todosWarnings.length === 0,
      docsEscritos: escritos,
      docsError: 0,
      duracionMs,
      warnings: todosWarnings,
      fuente: 'planillas-centrales',
    });
  }

  console.log(`\n✅ Sync completado: ${escritos} docs escritos en ${duracionMs}ms`);
  if (todosWarnings.length) {
    console.log(`⚠️  ${todosWarnings.length} warnings (revisá arriba)`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
