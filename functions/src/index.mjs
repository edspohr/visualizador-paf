// Cloud Functions v2 para el Visualizador PAF.
//
// Función principal: syncPlanillasCentrales
//   - Corre programada por Cloud Scheduler cada dom-jue a las 2:00 AM hora Chile.
//   - Lee las Planillas Centrales de Focus vía Google Sheets API.
//   - Parsea el progreso trimestral por (establecimiento × ámbito × trimestre).
//   - Escribe / actualiza documentos en /progresoTrimestral de Firestore.
//   - Registra metadata de sync en /metadata/pipeline.
//
// La lógica del parser es idéntica a scripts/syncPlanillasCentrales.mjs.
// La diferencia clave: usa Application Default Credentials (ADC) del runtime
// de Cloud Functions en lugar de un service-account.json local.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';

// Configuración global: región cercana a Chile.
setGlobalOptions({ region: 'us-central1', maxInstances: 1 });

initializeApp();
const db = getFirestore();

// ─── Config: las 3 Planillas Centrales ────────────────────────────────────

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

// ─── Helpers de matching ───────────────────────────────────────────────────

function normalizar(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADER_KEYWORDS = new Set([
  'scji', 'objetivos', 'comuna', 'porcentaje de progreso',
  't1', 't2', 't3', 't4', 'meta', 'check',
  'progreso general de las metas', 'progreso general',
]);

function encontrarEstablecimiento(scjiTexto, establecimientos, tipoFiltro = null) {
  const target = normalizar(scjiTexto);
  if (!target) return null;
  if (HEADER_KEYWORDS.has(target)) return null;

  const universo = tipoFiltro
    ? establecimientos.filter(e => e.tipo === tipoFiltro)
    : establecimientos;

  let match = universo.find(e => normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, '')) === target);
  if (match) return match;

  match = universo.find(e => {
    const nombreN = normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, ''));
    return (nombreN.length > target.length && nombreN.includes(target)) ||
           (target.length > nombreN.length && target.includes(nombreN));
  });
  if (match) return match;

  match = universo.find(e => {
    const nombreN = normalizar(e.nombre.replace(/^jardin\s+/i, '').replace(/^escuela\s+/i, ''));
    const nombreWords = new Set(nombreN.split(/\s+/).filter(w => w.length > 2));
    const targetWords = target.split(/\s+/).filter(w => w.length > 2);
    if (!targetWords.length) return false;
    return targetWords.every(tw => nombreWords.has(tw));
  });
  return match ?? null;
}

const TAB_ABREV = {
  'AP':  'Akun Pichiwentxu', 'PR': 'Príncipes del Reino', 'MOD': 'Modelo',
  'EB':  'Enrique Backausse', 'LH': 'La Hormiguita', 'SF': 'Santa Fe',
  'VSM': 'Villa San Miguel', 'CF': 'Caballito Feliz', 'AB': 'Andres Bello',
  'PA':  'Pequeño Aymará', 'PAY': 'Pequeño Aymará',
  'CB':  'Ciudad de Barcelona', 'CDB': 'Ciudad de Barcelona',
  'PCH': 'Poetas de Chile', 'PDC': 'Poetas de Chile',
  'LLS': 'Llano Subercaseaux', 'LM': 'La Marina', 'OCH': 'Ochagavía',
  'AKUN':       'Akun Pichiwentxu', 'MODE':       'Modelo',
  'LA HOR':     'La Hormiguita', 'ENRIQ':      'Enrique Backausse',
  'PRINCIP':    'Príncipes del Reino', 'CABALL':     'Caballito Feliz',
  'ANDRÉS B':   'Andres Bello', 'ANDRES B':   'Andres Bello',
  'PEQUEÑO AY': 'Pequeño Aymará', 'PEQUENO AY': 'Pequeño Aymará',
  'LLANO S':    'Llano Subercaseaux', 'VILLA SAN':  'Villa San Miguel',
  'POETAS':     'Poetas de Chile', 'CIUDAD B':   'Ciudad de Barcelona',
  'PJ':  'Paula Jaraquemada', 'CED': 'Cedin', 'ELU': 'Eluney',
  'AF':  'Angel Fantuzzi', 'ET':  'El Tranque', 'ETR': 'El Tranque',
  'SS':  'Salomón Sack', 'SSA': 'Salomón Sack',
  'EA':  'Estación Alegría', 'EAL': 'Estación Alegría',
  'SDC': 'Sueño de Colores', 'TDA': 'Tierra de Ángeles',
};

function establecimientoPorTab(tabName, establecimientos, tipoFiltro = null) {
  const clave = tabName.trim().toUpperCase();
  const nombre = TAB_ABREV[clave];
  if (!nombre) return null;
  return encontrarEstablecimiento(nombre, establecimientos, tipoFiltro);
}

function encontrarAmbito(objetivoTexto, ambitos, programa) {
  const t = normalizar(objetivoTexto);
  if (!t) return null;
  const candidatos = ambitos.filter(a => a.programa === programa);
  if (t.includes('liderazgo') || t.includes('gestion') || t.includes('alianza') || t.includes('institucional'))
    return candidatos.find(a => a.id === 'A1');
  if (t.includes('formacion') && (t.includes('equipo') || t.includes('agente') || t.includes('educativ')))
    return candidatos.find(a => a.id === 'A2');
  if (t.includes('apoderad') || t.includes('parentalid') || t.includes('familia') || t.includes('padres'))
    return candidatos.find(a => a.id === 'A3');
  if (t.includes('lector') || t.includes('lenguaje') || t.includes('lectura'))
    return candidatos.find(a => a.id === 'A3');
  return null;
}

function parsePorcentaje(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const tienePctSign = s.includes('%');
  if (!tienePctSign) {
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

const HOJAS_A_SALTAR_PREFIJO = /^(RES\s|MON|CONS|COORDINADOR|LINKS|REPORTE|PLANTILLA|TEMPLATE|INSTRUCC|ACT\.|IDENTIFICAR|INDICAD|IND\s|NMON|CÁLCULO|CALCULO|HOJA\s|RESUMEN)/i;
const HOJAS_A_SALTAR_EXACTO = new Set(['RA', 'EA', 'VOL', 'RP', 'RF']);

function debeSaltarHoja(titulo) {
  const t = titulo.trim();
  if (HOJAS_A_SALTAR_EXACTO.has(t.toUpperCase())) return true;
  if (HOJAS_A_SALTAR_PREFIJO.test(t)) return true;
  return false;
}

// ─── Parser de una hoja ────────────────────────────────────────────────────

async function parsearHoja(sheets, sheetId, hojaTitulo, planilla, establecimientos, ambitos) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${hojaTitulo}!A1:H50`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values ?? [];
  if (!rows.length) return { docs: [], warnings: [`Hoja ${hojaTitulo} vacía`] };

  const warnings = [];
  let establecimiento = establecimientoPorTab(hojaTitulo, establecimientos, planilla.tipoEst);
  const docs = [];

  for (const row of rows) {
    if (!row.length) continue;
    const [colA, colB, colC, colD, colE, colF, colG] = row.map(v => v ?? '');

    if (!establecimiento && colB) {
      const posible = encontrarEstablecimiento(colB, establecimientos, planilla.tipoEst);
      if (posible) establecimiento = posible;
    }

    const objetivoTexto = colC;
    if (!objetivoTexto) continue;
    const objetivoNorm = normalizar(objetivoTexto);
    if (HEADER_KEYWORDS.has(objetivoNorm)) continue;
    if (objetivoNorm.includes('progreso general')) continue;

    const p1 = parsePorcentaje(colD);
    const p2 = parsePorcentaje(colE);
    const p3 = parsePorcentaje(colF);
    const p4 = parsePorcentaje(colG);

    if ([p1, p2, p3, p4].every(v => v === null)) continue;
    if (!establecimiento) {
      warnings.push(`Progreso en "${hojaTitulo}" sin establecimiento matcheado`);
      continue;
    }

    const ambito = encontrarAmbito(objetivoTexto, ambitos, planilla.programa);
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

  return { docs, warnings };
}

// ─── Main pipeline ─────────────────────────────────────────────────────────

async function ejecutarPipeline() {
  const t0 = Date.now();
  logger.info('Iniciando pipeline de sincronización de Planillas Centrales');

  // Auth con ADC del runtime de Cloud Functions
  // La cuenta de servicio del runtime debe tener acceso a las planillas y a Sheets API.
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Cargar catálogo desde Firestore
  const [estSnap, ambSnap] = await Promise.all([
    db.collection('establecimientos').get(),
    db.collection('ambitos').get(),
  ]);
  const establecimientos = estSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ambitos = ambSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  logger.info(`Catálogo cargado: ${establecimientos.length} establecimientos, ${ambitos.length} ámbitos`);

  const todosDocs = [];
  const todosWarnings = [];
  const erroresPorPlanilla = [];

  for (const planilla of PLANILLAS) {
    try {
      logger.info(`Procesando ${planilla.label} (${planilla.id})`);
      const meta = await sheets.spreadsheets.get({ spreadsheetId: planilla.id, fields: 'sheets.properties' });
      const hojas = meta.data.sheets.map(s => s.properties.title);

      for (const titulo of hojas) {
        if (debeSaltarHoja(titulo)) continue;
        const { docs, warnings } = await parsearHoja(sheets, planilla.id, titulo, planilla, establecimientos, ambitos);
        todosDocs.push(...docs);
        todosWarnings.push(...warnings);
      }
      logger.info(`${planilla.label}: ${todosDocs.length} progresos acumulados`);
    } catch (err) {
      logger.error(`Error procesando ${planilla.label}: ${err.message}`);
      erroresPorPlanilla.push({ planilla: planilla.label, error: err.message });
    }
  }

  // Escribir en batches
  const CHUNK = 400;
  let escritos = 0;
  for (let i = 0; i < todosDocs.length; i += CHUNK) {
    const batch = db.batch();
    todosDocs.slice(i, i + CHUNK).forEach(({ docId, data }) => {
      batch.set(db.collection('progresoTrimestral').doc(docId), data, { merge: true });
    });
    await batch.commit();
    escritos += Math.min(CHUNK, todosDocs.length - i);
  }

  const duracionMs = Date.now() - t0;

  // Guardar metadata
  await db.collection('metadata').doc('pipeline').set({
    ultimoSyncAt: FieldValue.serverTimestamp(),
    ultimoSyncExitoso: erroresPorPlanilla.length === 0,
    docsEscritos: escritos,
    docsError: 0,
    duracionMs,
    warnings: todosWarnings.slice(0, 10),
    erroresPorPlanilla,
    fuente: 'planillas-centrales',
    ejecutadoDesde: 'cloud-scheduler',
  });

  logger.info(`Pipeline completado: ${escritos} docs escritos en ${duracionMs}ms. Errores: ${erroresPorPlanilla.length}`);
  return { escritos, duracionMs, errores: erroresPorPlanilla.length };
}

// ─── Trigger: Scheduler (dom-jue a las 2:00 AM Chile) ─────────────────────

export const syncPlanillasCentrales = onSchedule(
  {
    schedule: '0 2 * * 0-4',
    timeZone: 'America/Santiago',
    timeoutSeconds: 540, // 9 minutos (máximo permitido para funciones normales)
    memory: '512MiB',
  },
  async (event) => {
    logger.info('Trigger scheduled ejecutado', { scheduleTime: event.scheduleTime });
    await ejecutarPipeline();
  }
);

// ─── Trigger: HTTPS manual (invocación on-demand desde superadmin) ────────
// Endpoint: /syncManual
// Solo autenticado. En una versión posterior podemos exigir claim de superadmin.

export const syncManual = onRequest(
  { timeoutSeconds: 540, memory: '512MiB' },
  async (req, res) => {
    // Autorización básica: header X-Sync-Token debe coincidir con env SYNC_TOKEN.
    // (Simple y suficiente por ahora; en el futuro se puede mover a IAM.)
    const tokenEnviado = req.get('X-Sync-Token');
    const tokenEsperado = process.env.SYNC_TOKEN ?? '';
    if (!tokenEsperado || tokenEnviado !== tokenEsperado) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const resultado = await ejecutarPipeline();
      res.json({ ok: true, ...resultado });
    } catch (err) {
      logger.error('Error en sync manual', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);
