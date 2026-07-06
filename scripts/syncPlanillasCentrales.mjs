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
    tipoEst: 'Jardín',
  },
  {
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    label: 'Cohorte 2025-2026 Año 2',
    anio: 2026,
    cohorte: '2025-2026',
    programa: 'parvulario',
    tipoEst: 'Jardín',
  },
  {
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    label: 'Cohorte 2026-2027 Año 1',
    anio: 2026,
    cohorte: '2026-2027',
    programa: 'parvulario',
    tipoEst: 'Jardín',
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

// Palabras clave que identifican encabezados o filas de resumen (a saltar).
const HEADER_KEYWORDS = new Set([
  'scji', 'objetivos', 'comuna', 'porcentaje de progreso',
  't1', 't2', 't3', 't4', 'meta', 'check',
  'progreso general de las metas', 'progreso general',
]);

// Mapea el nombre de un jardín (columna SCJI) al doc de establecimiento en Firestore.
// tipoFiltro (opcional): 'Jardín' o 'Escuela' — restringe el match a ese tipo.
// Estrategia: prioriza matches más específicos (exacto > inclusión > palabras compartidas).
function encontrarEstablecimiento(scjiTexto, tipoFiltro = null) {
  const target = normalizar(scjiTexto);
  if (!target) return null;
  if (HEADER_KEYWORDS.has(target)) return null;

  const universo = tipoFiltro
    ? establecimientos.filter(e => e.tipo === tipoFiltro)
    : establecimientos;

  // Nivel 1: match exacto
  let match = universo.find(e => normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, '')) === target);
  if (match) return match;

  // Nivel 2: uno contiene al otro completamente (ej. "santa fe" en "jardin santa fe")
  match = universo.find(e => {
    const nombreN = normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, ''));
    return (nombreN.length > target.length && nombreN.includes(target)) ||
           (target.length > nombreN.length && target.includes(nombreN));
  });
  if (match) return match;

  // Nivel 3: todas las palabras significativas del target están en el nombre (o viceversa).
  // Ej. "angel fantuzzi" tiene ["angel", "fantuzzi"]; solo matchea con "jardin angel fantuzzi".
  match = universo.find(e => {
    const nombreN = normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, ''));
    const nombreWords = new Set(nombreN.split(/\s+/).filter(w => w.length > 2));
    const targetWords = target.split(/\s+/).filter(w => w.length > 2);
    if (!targetWords.length) return false;
    // Match si TODAS las palabras significativas del target están en el nombre
    return targetWords.every(tw => nombreWords.has(tw));
  });
  return match ?? null;
}

// Fallback: mapa manual de abreviaciones de tab-name a nombre del establecimiento.
// El pipeline lo usa cuando la fila del sheet no tiene SCJI legible pero sí conocemos el jardín por el tab.
const TAB_ABREV = {
  // Cohorte 2025-2026 Santa Rosa (jardines en San Ramón, San Miguel, Pedro Aguirre Cerda)
  'AP':  'Akun Pichiwentxu',
  'PR':  'Príncipes del Reino',
  'MOD': 'Modelo',
  'EB':  'Enrique Backausse',
  'LH':  'La Hormiguita',
  'SF':  'Santa Fe',
  'VSM': 'Villa San Miguel',
  'CF':  'Caballito Feliz',
  'AB':  'Andres Bello',
  'PA':  'Pequeño Aymará',
  'PAY': 'Pequeño Aymará',
  'CB':  'Ciudad de Barcelona',
  'CDB': 'Ciudad de Barcelona',
  'PCH': 'Poetas de Chile',
  'PDC': 'Poetas de Chile',
  'LLS': 'Llano Subercaseaux',
  'LM':  'La Marina',
  'OCH': 'Ochagavía',
  // Cohorte 2026-2027 Del Pino + Santa Corina
  'PJ':  'Paula Jaraquemada',
  'CED': 'Cedin',
  'ELU': 'Eluney',
  'AF':  'Angel Fantuzzi',
  'ET':  'El Tranque',
  'SS':  'Salomón Sack',
  'EA':  'Estación Alegría',
  'SDC': 'Sueño de Colores',
  'TDA': 'Tierra de Ángeles',
};

// Devuelve el establecimiento inferido por el nombre del tab (ej. "AP" → Akun Pichiwentxu)
function establecimientoPorTab(tabName, tipoFiltro = null) {
  const clave = tabName.trim().toUpperCase();
  const nombre = TAB_ABREV[clave];
  if (!nombre) return null;
  return encontrarEstablecimiento(nombre, tipoFiltro);
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
// IMPORTANTE: solo acepta strings que TENGAN el símbolo % o sean claramente proporciones (0.0-1.0).
// Esto evita capturar valores como "120", "10", "TRUE" que aparecen en otras tablas.
function parsePorcentaje(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const tienePctSign = s.includes('%');
  if (!tienePctSign) {
    // Solo aceptamos si es una proporción entre 0 y 1 (formato decimal)
    const n = parseFloat(s.replace(',', '.'));
    if (isNaN(n)) return null;
    if (n < 0 || n > 1) return null;
    return n;
  }
  const s2 = s.replace('%', '').replace(',', '.').trim();
  const n = parseFloat(s2);
  if (isNaN(n)) return null;
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
    range: `${hojaTitulo}!A1:H50`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values ?? [];
  if (!rows.length) return { docs: [], warnings: [`Hoja ${hojaTitulo} vacía`] };

  const warnings = [];
  // Estrategia: intentar identificar el establecimiento por el nombre del tab (más confiable
  // que buscar SCJI en las filas, que a veces está mal etiquetado).
  let establecimiento = establecimientoPorTab(hojaTitulo, planilla.tipoEst);
  const docs = [];

  for (const row of rows) {
    if (!row.length) continue;
    const [colA, colB, colC, colD, colE, colF, colG] = row.map(v => v ?? '');

    // Si aún no tenemos establecimiento y esta fila tiene SCJI en colB, intentar detectarlo.
    // Excluir headers literales.
    if (!establecimiento && colB) {
      const posibleEst = encontrarEstablecimiento(colB, planilla.tipoEst);
      if (posibleEst) {
        establecimiento = posibleEst;
      }
    }

    // Fila de objetivos: colC debe traer el texto del objetivo
    const objetivoTexto = colC;
    if (!objetivoTexto) continue;
    const objetivoNorm = normalizar(objetivoTexto);

    // Filtrar headers y filas de resumen
    if (HEADER_KEYWORDS.has(objetivoNorm)) continue;
    if (objetivoNorm.includes('progreso general')) continue;

    // Extraer % de las 4 columnas de trimestre
    const p1 = parsePorcentaje(colD);
    const p2 = parsePorcentaje(colE);
    const p3 = parsePorcentaje(colF);
    const p4 = parsePorcentaje(colG);

    // Si ninguna es un %, saltar (probablemente fila de meta/check)
    if ([p1, p2, p3, p4].every(v => v === null)) continue;

    if (!establecimiento) {
      warnings.push(`Progreso encontrado en "${hojaTitulo}" pero sin establecimiento matcheado (objetivo="${objetivoTexto.slice(0, 50)}…")`);
      continue;
    }

    const ambito = encontrarAmbito(objetivoTexto, planilla.programa);
    const trimestres = [p1, p2, p3, p4];
    for (let i = 0; i < 4; i++) {
      const p = trimestres[i];
      if (p === null) continue;
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

  if (!establecimiento && !docs.length) {
    warnings.push(`No se pudo identificar establecimiento en hoja "${hojaTitulo}"`);
  }
  return { docs, warnings };
}

// Hojas que sabemos que son de resumen/coordinación/plantillas y hay que saltar
const HOJAS_A_SALTAR = /^(RES\s|MON|CONS|COORDINADOR|LINKS|REPORTE|PLANTILLA|TEMPLATE|INSTRUCC|ACT\.|IDENTIFICAR)/i;

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
      if (HOJAS_A_SALTAR.test(titulo)) {
        console.log(`   ⏭  ${titulo}: saltada (no es hoja de jardín)`);
        continue;
      }
      const { docs, warnings } = await parsearHoja(planilla.id, titulo, planilla);
      docsAcumulados.push(...docs);
      warningsAcumulados.push(...warnings);
      if (docs.length > 0) {
        console.log(`   ✓ ${titulo}: ${docs.length} progresos extraídos`);
      } else {
        console.log(`   ○ ${titulo}: sin progresos`);
      }
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
