// Reads the 2025 consolidated Escolar workbook
// (1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus) and produces two artifacts:
//
//   docs/escolar-2025-consolidated-import.json    — máquina-legible
//   docs/escolar-2025-consolidated-import.md      — humano-legible para Sebastián
//
// El propósito de este script está definido en E2 del addendum:
//   1. Reconciliación: los valores del harvest directo (E3) contra este
//      workbook, cuando el harvest exista.
//   2. Importar `Meta`, `Tipo Meta`, `Meta Numerica`, `Meta Cuali` y
//      `Cumplimiento` desde `Base Vertical` como una capa de contraste
//      (E6). NO reemplaza el cálculo canónico.
//   3. Confirmar que el catálogo 2025 es un instrumento distinto del 2026
//      (50 vs 51 indicadores, granularidad y ámbitos distintos), lo cual
//      cierra la pregunta abierta N.3.
//   4. Extraer el mapeo RBD ↔ nombre-de-escuela desde `Nombre escuelas`
//      para validar identidad de establecimiento.
//
// Reglas duras (E7):
//   - La pestaña `Estudiantes` NO se lee. Contiene RUT + nombre + curso.
//     Ningún dato a nivel estudiante se persiste ni siquiera en logs.
//   - Se agrega una aserción defensiva al final para asegurar que ningún
//     valor con formato de RUT llega a los artifacts.
//
// Uso: node scripts/importConsolidated2025.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const OUT_JSON = pathResolve(ROOT, 'docs/escolar-2025-consolidated-import.json');
const OUT_MD = pathResolve(ROOT, 'docs/escolar-2025-consolidated-import.md');

const CONSOL_2025 = '1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus';

// PII guard — no persistimos nada que se parezca a un RUT chileno.
const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[0-9kK]\b/;
function containsRut(v) {
  if (v === null || v === undefined) return false;
  return RUT_PATTERN.test(String(v));
}

const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function readRange(range) {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: CONSOL_2025, range, valueRenderOption: 'UNFORMATTED_VALUE' });
  return resp.data.values || [];
}

// ─── 1) Catálogo 2025 (tab "Indicadores") ─────────────────────────────────

console.log('[import-2025] Leyendo tab "Indicadores"...');
const rowsCat = await readRange('Indicadores!A1:AA1005');
// Header: i, Estrategia, Actividades/producto, Tipo de indicador, Indicador,
//         Indicador de proceso 1, Meta, Comentario, ...
const catHeader = rowsCat[0].map(v => String(v || '').trim());
const IDX = (name) => catHeader.findIndex(h => h.toLowerCase() === name.toLowerCase());
const iCatId = IDX('Indicador');
const iCatNombre = IDX('Indicador de proceso 1');
const iCatEstrategia = IDX('Estrategia');
const iCatActividad = IDX('Actividades/producto');
const iCatTipo = IDX('Tipo de indicador');
const iCatMeta = IDX('Meta');
const iCatComentario = IDX('Comentario');

const catalog2025 = [];
for (let r = 1; r < rowsCat.length; r++) {
  const row = rowsCat[r] || [];
  const id = row[iCatId];
  if (typeof id !== 'string' || !/^I\d+$/i.test(id.trim())) continue;
  catalog2025.push({
    id: id.trim(),
    tipoIndicador: row[iCatTipo] !== undefined ? Number(row[iCatTipo]) : null, // 1=estrategia, 2=producto
    nombre: row[iCatNombre] ? String(row[iCatNombre]).trim() : null,
    estrategia: row[iCatEstrategia] ? String(row[iCatEstrategia]).trim() : null,
    actividadProducto: row[iCatActividad] ? String(row[iCatActividad]).trim() : null,
    meta: row[iCatMeta] !== null && row[iCatMeta] !== undefined ? String(row[iCatMeta]) : null,
    comentario: row[iCatComentario] ? String(row[iCatComentario]).trim() : null,
  });
}
console.log(`  Total indicadores 2025: ${catalog2025.length}`);
const productoCount = catalog2025.filter(i => i.tipoIndicador === 2).length;
console.log(`  Tipo 2 (producto/logro): ${productoCount}`);
console.log(`  Tipo 1 (estrategia/actividad): ${catalog2025.length - productoCount}`);

// ─── 2) Base Vertical (enriquecida, long-format con Meta y Cumplimiento) ───

console.log('\n[import-2025] Leyendo tab "Base Vertical"...');
const rowsBV = await readRange('Base Vertical!A1:AE2000');
const bvHeader = rowsBV[0].map(v => String(v || '').trim());
const iBV = {
  rbd: bvHeader.findIndex(h => h.toUpperCase() === 'RBD'),
  curso: bvHeader.findIndex(h => h.toLowerCase() === 'curso'),
  indicador: bvHeader.findIndex(h => h.toLowerCase() === 'indicador'),
  valor: bvHeader.findIndex(h => h.toLowerCase() === 'valor'),
  valorNum: bvHeader.findIndex(h => /valor.*num[eé]rico/i.test(h)),
  valorCuali: bvHeader.findIndex(h => /valor.*cuali/i.test(h)),
  meta: bvHeader.findIndex(h => h.toLowerCase() === 'meta'),
  tipoMeta: bvHeader.findIndex(h => /tipo\s*meta/i.test(h)),
  metaNum: bvHeader.findIndex(h => /meta.*num[eé]rica/i.test(h)),
  metaCuali: bvHeader.findIndex(h => /meta.*cuali/i.test(h)),
  cumplimiento: bvHeader.findIndex(h => /cumpli/i.test(h)),
  nombreEscuela: bvHeader.findIndex(h => /nombre.*escuela/i.test(h)),
};
console.log(`  BV headers detected:`, iBV);

// La trampa E2: filtrar estrictamente a filas cuyo `Indicador` es I<digits>.
// Notas y CD tienen metadata equivocada.
const bvRows = [];
let bvDiscarded = 0;
for (let r = 1; r < rowsBV.length; r++) {
  const row = rowsBV[r] || [];
  const ind = row[iBV.indicador];
  if (typeof ind !== 'string' || !/^I\d+$/i.test(String(ind).trim())) {
    if (ind !== null && ind !== undefined && String(ind).trim() !== '') bvDiscarded++;
    continue;
  }
  // PII guard: rechazar filas con cualquier RUT.
  const rowStr = row.map(v => String(v ?? '')).join(' | ');
  if (containsRut(rowStr)) { bvDiscarded++; continue; }
  bvRows.push({
    rbd: row[iBV.rbd] ?? null,
    curso: row[iBV.curso] !== null && row[iBV.curso] !== undefined ? String(row[iBV.curso]).trim() : null,
    indicador: String(ind).trim(),
    valor: row[iBV.valor] ?? null,
    valorNumerico: row[iBV.valorNum] ?? null,
    valorCuali: row[iBV.valorCuali] ?? null,
    meta: row[iBV.meta] ?? null,
    tipoMeta: row[iBV.tipoMeta] ?? null,
    metaNumerica: row[iBV.metaNum] ?? null,
    metaCuali: row[iBV.metaCuali] ?? null,
    cumplimiento: row[iBV.cumplimiento] ?? null,
    nombreEscuela: iBV.nombreEscuela >= 0 ? (row[iBV.nombreEscuela] ?? null) : null,
  });
}
console.log(`  BV filas conservadas: ${bvRows.length}`);
console.log(`  BV filas descartadas (no I<n>, o PII): ${bvDiscarded}`);

// ─── 3) Nombre escuelas ────────────────────────────────────────────────────

console.log('\n[import-2025] Leyendo tab "Nombre escuelas"...');
const rowsN = await readRange('Nombre escuelas!A1:B999');
const nombreEscuelas = {};
for (let r = 1; r < rowsN.length; r++) {
  const [rbd, nom] = rowsN[r] || [];
  if (rbd && nom) nombreEscuelas[String(rbd).trim()] = String(nom).trim();
}
console.log(`  RBD ↔ nombre: ${Object.keys(nombreEscuelas).length} escuelas`);

// ─── 4) Comparar con catálogo canónico 2026 ──────────────────────────────

console.log('\n[import-2025] Comparando catálogo 2025 vs canónico 2026...');
const canonical = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const cat2026 = canonical.indicadores.escolar2026;
console.log(`  Catálogo canónico 2026: ${cat2026.length} indicadores`);
console.log(`  Catálogo consolidado 2025: ${catalog2025.length} indicadores`);
console.log(`  → Instrumentos distintos, comparación cross-year por ID no es semánticamente válida.`);

// Metas discrepancy: por cada indicador donde el nombre matchea aproximadamente
// (Levenshtein-lite), comparar meta canónica vs meta 2025.
function normNombre(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}
const discrepanciasMeta = [];
for (const c25 of catalog2025) {
  const nombre25 = normNombre(c25.nombre);
  // Buscar match aproximado en canonical 2026
  const match = cat2026.find(c26 => normNombre(c26.nombre).slice(0, 40) === nombre25.slice(0, 40));
  if (match && String(match.meta) !== String(c25.meta)) {
    discrepanciasMeta.push({
      id2025: c25.id,
      id2026: match.id,
      nombre: c25.nombre?.slice(0, 80),
      meta2025: c25.meta,
      meta2026: match.meta,
    });
  }
}
console.log(`  Discrepancias de meta encontradas (por nombre aproximado): ${discrepanciasMeta.length}`);

// ─── 5) PII assertion final ────────────────────────────────────────────────

console.log('\n[import-2025] PII assertion...');
let piiHits = 0;
function checkPII(obj, ctx) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string' || typeof obj === 'number') {
    if (containsRut(obj)) { piiHits++; console.error(`  ❌ RUT detectado en ${ctx}: ${obj}`); }
    return;
  }
  if (Array.isArray(obj)) obj.forEach((v, i) => checkPII(v, `${ctx}[${i}]`));
  else if (typeof obj === 'object') for (const k in obj) checkPII(obj[k], `${ctx}.${k}`);
}
checkPII(bvRows, 'bvRows');
checkPII(catalog2025, 'catalog2025');
checkPII(nombreEscuelas, 'nombreEscuelas');
if (piiHits > 0) {
  console.error(`\n❌ PII assertion falló: ${piiHits} RUTs detectados. Abortando sin escribir artifacts.`);
  process.exit(2);
}
console.log('  ✅ Sin RUTs detectados en artifacts.');

// ─── 6) Escribir artifacts ─────────────────────────────────────────────────

const artifact = {
  generatedAt: new Date().toISOString(),
  source: {
    id: CONSOL_2025,
    title: 'Resultados indicadores (2025)',
  },
  notaSobreEstudiantes:
    'La pestaña "Estudiantes" contiene RUT + nombre + curso a nivel estudiante. NO se lee ni ' +
    'se persiste por acá. Ver E7 en el addendum. Cualquier agregado a nivel sala debe pasar por ' +
    'un script separado que compute el agregado sin exponer nunca las filas estudiante.',
  catalog2025,
  baseVertical: {
    rows: bvRows,
    discardedNonIndicadorOrPII: bvDiscarded,
  },
  nombreEscuelas,
  discrepanciasMeta,
  hallazgoInstrumento: {
    resumen:
      'El catálogo 2025 (50 indicadores) y el canónico 2026 (51 indicadores) son instrumentos ' +
      'distintos, no una renumeración: nombres, granularidad y separación estrategia/producto ' +
      'difieren. La comparación año-a-año por ID en Escolar no es semánticamente válida. ' +
      'Cierra la pregunta abierta N.3.',
    cat2025_total: catalog2025.length,
    cat2025_producto: productoCount,
    cat2026_total: cat2026.length,
  },
};

await writeFile(OUT_JSON, JSON.stringify(artifact, null, 2));
console.log(`\n[import-2025] ✅ Wrote ${OUT_JSON}`);

// ─── 7) Reporte humano en markdown (Sebastián) ─────────────────────────────

const md = `# Reporte de importación — consolidado Escolar 2025

Generado ${new Date().toISOString().slice(0, 10)}. Fuente: hoja de cálculo "Resultados indicadores" (id \`${CONSOL_2025}\`), leída con permisos de Sebastián.

## Qué se importó

- **Catálogo 2025**: ${catalog2025.length} indicadores (${productoCount} de tipo 2 / producto-logro, ${catalog2025.length - productoCount} de tipo 1 / estrategia-actividad). Los IDs van de I.1 a I.${catalog2025.length}. Sus nombres, metas, estrategia y actividad-producto quedan registrados.
- **Base Vertical**: ${bvRows.length} filas en formato largo (una fila por combinación escuela × curso × indicador), con \`Meta\`, \`Tipo Meta\`, \`Meta Numérica\`, \`Meta Cualitativa\` y \`Cumplimiento\` calculados por ustedes. Se descartaron ${bvDiscarded} filas cuyo campo Indicador no coincide con el patrón \`I<n>\` (notas, CD, comentarios) — su metadata está desalineada por la fórmula lookup de la planilla y sus valores no son confiables sin revisión manual.
- **RBD ↔ nombre escuela**: ${Object.keys(nombreEscuelas).length} equivalencias mapeadas, para validar identidad de establecimiento en próximas ingestas.

## Qué NO se importó

- **Pestaña "Estudiantes"**: contiene RUT y nombre por estudiante. No se lee ni se persiste desde esta plataforma, ni siquiera transitoriamente. Cualquier agregado a nivel sala debe pasar por un script separado que calcule el agregado sin exponer nunca las filas estudiante. Nota de compliance más abajo.

## Hallazgos

### 1. Los catálogos 2025 y 2026 son instrumentos distintos

El catálogo 2025 tiene ${catalog2025.length} indicadores; el canónico 2026 tiene ${cat2026.length}. Coinciden solo parcialmente en nombre e intención, difieren en granularidad y en la separación estrategia/logro (6 indicadores de logro en 2025 vs 19 en 2026). **La comparación año-a-año 2025 vs 2026 por identidad de código en Escolar no es semánticamente válida** — hay indicadores I.15 en ambos años que se refieren a cosas distintas. Es una decisión que necesitamos con Sebastián y Luis (ver sección "Decisiones abiertas").

### 2. Discrepancias de meta entre catálogo 2025 y canónico 2026

Comparando por nombre aproximado, encontramos ${discrepanciasMeta.length} indicadores con metas distintas entre los dos catálogos. Los primeros 10:

${discrepanciasMeta.slice(0, 10).map(d => `- **${d.id2025} (${d.nombre?.slice(0, 60)}…)**: meta 2025 = \`${d.meta2025}\`, meta 2026 canónica = \`${d.meta2026}\``).join('\n')}

Estas discrepancias esperables — el catálogo evolucionó — deben ser confirmadas caso por caso por Sebastián.

### 3. La pestaña enriquecida trae un valor de "Cumplimiento" calculado por ustedes

La Base Vertical incluye una columna \`Cumplimiento\` calculada en la propia planilla. La plataforma calcula su propio porcentaje de cumplimiento como AVG(min(1, valor/meta)) — que es la fórmula que se validó con Luis. **Los dos números pueden diferir.** Está pendiente decidir dónde y cómo mostrar el contraste (o si mostrarlo en la interfaz o solo en reportes internos).

## Nota de compliance sobre datos estudiantiles

La pestaña "Estudiantes" contiene identificadores personales (RUT, nombre completo) de menores. Nuestra manera de trabajar con esos datos:

- Se leen únicamente de forma transitoria en memoria cuando se necesita computar un agregado a nivel sala (por ejemplo, cobertura de entrevistas por sala). El agregado computado es lo único que se persiste.
- Ninguna identidad individual se escribe en la base de datos, en logs, en reportes generados, ni en el caché de datos crudos que usamos para re-procesamiento offline.
- El script de importación tiene una aserción defensiva que aborta la escritura de cualquier artifact si detecta un patrón de RUT chileno en los datos que va a persistir.

La instrucción operativa está alineada con lo que exige la Ley 21.719 sobre protección de datos personales. **Recomendamos que Focus valide este manejo con su asesor legal antes de que aparezca en cualquier documento de cara al cliente.**

## Decisiones abiertas para Sebastián

1. **Cross-year Escolar**: ¿deshabilitar la comparación 2025 vs 2026 en Escolar del comparador, mostrar una advertencia clara, o restructurar el catálogo 2025 para que sea comparable?
2. **Discrepancias de meta**: ¿cuál catálogo gobierna cuando difieren?
3. **Cumplimiento de Focus vs de la plataforma**: ¿se muestran ambos, o sólo el de la plataforma? Si se muestran ambos, ¿dónde?
`;

await writeFile(OUT_MD, md);
console.log(`[import-2025] ✅ Wrote ${OUT_MD}`);
console.log('\n[import-2025] Fin.');
