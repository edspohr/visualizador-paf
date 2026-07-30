// Genera docs/escolar-metas-discrepancy.md — reporte de discrepancias entre:
//   (a) las metas declaradas por Focus en `Base Vertical` del consolidado 2025
//       (fuente: docs/escolar-2025-consolidated-import.json)
//   (b) las metas del catálogo canónico Escolar 2026 (src/data/catalog.json)
//
// E6 pide importar Meta/Tipo Meta/Meta Numérica/Meta Cualitativa/Cumplimiento
// como capa de contraste; NO overwrite. Este reporte materializa la diferencia
// para que Sebastián la resuelva caso por caso.
//
// El reporte se genera contra la reconciliación por NOMBRE APROXIMADO. Los
// IDs 2025 y 2026 no son comparables (instrumentos distintos, ver E2).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const imp = JSON.parse(await readFile(pathResolve(ROOT, 'docs/escolar-2025-consolidated-import.json'), 'utf8'));
const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf8'));

const cat2026 = catalog.indicadores.escolar2026;
const cat2025 = imp.catalog2025;

function normNombre(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  // Simple Jaccard sobre trigramas de caracteres
  function trigrams(s) {
    const t = new Set();
    for (let i = 0; i < s.length - 2; i++) t.add(s.slice(i, i + 3));
    return t;
  }
  const A = trigrams(normNombre(a));
  const B = trigrams(normNombre(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// Para cada indicador 2025, encontrar el best match en 2026 (>= 0.4 similarity)
const matches = [];
for (const c25 of cat2025) {
  let best = null, bestSim = 0.4;
  for (const c26 of cat2026) {
    const s = similarity(c25.nombre, c26.nombre);
    if (s > bestSim) { best = c26; bestSim = s; }
  }
  matches.push({ c25, c26: best, similarity: bestSim });
}

// Discrepancias de meta
const discrepMeta = [];
const noMatch2025 = [];
for (const { c25, c26, similarity } of matches) {
  if (!c26) { noMatch2025.push(c25); continue; }
  const meta25 = c25.meta;
  const meta26 = c26.meta;
  const bvRowsInd = imp.baseVertical.rows.filter(r => r.indicador === c25.id);
  const uniqueMetasEnBV = [...new Set(bvRowsInd.map(r => String(r.meta ?? '')).filter(Boolean))];
  if (String(meta25) !== String(meta26)) {
    discrepMeta.push({
      id2025: c25.id, id2026: c26.id, similarity: Number(similarity.toFixed(2)),
      nombre2025: c25.nombre,
      nombre2026: c26.nombre,
      meta2025: meta25,
      meta2026: meta26,
      metasEnBaseVertical: uniqueMetasEnBV,
      filasBV: bvRowsInd.length,
    });
  }
}

// Indicadores 2026 canónicos sin match razonable en 2025
const matched2026Ids = new Set(matches.filter(m => m.c26).map(m => m.c26.id));
const noMatch2026 = cat2026.filter(c => !matched2026Ids.has(c.id));

// Escribir markdown
const md = `# Discrepancias de metas — Escolar

Generado ${new Date().toISOString().slice(0, 10)}.

Este reporte cruza:

- **Catálogo 2025** (${cat2025.length} indicadores), tal como está en el consolidado \`Resultados indicadores\` que administra Focus.
- **Catálogo canónico 2026** (${cat2026.length} indicadores) que gobierna la plataforma hoy.

La comparación se hace por **nombre aproximado** (los IDs son incomparables entre años: son instrumentos distintos, ver hallazgo E2).

## Resumen

- Indicadores 2025 que emparejan con uno 2026: **${matches.filter(m => m.c26).length} de ${cat2025.length}**.
- Indicadores 2025 sin match: **${noMatch2025.length}** — probablemente removidos, fusionados o renombrados en el instrumento 2026.
- Indicadores 2026 sin match en 2025: **${noMatch2026.length}** — indicadores nuevos del rediseño.
- **Discrepancias de meta entre 2025 y 2026 (mismos indicadores, meta distinta)**: **${discrepMeta.length}**.

## Discrepancias de meta (para revisar con Sebastián)

${discrepMeta.length === 0 ? 'Ninguna.' : discrepMeta.map(d => `
### ${d.id2025} (2025) ↔ ${d.id2026} (2026) · similitud ${d.similarity}

**Nombre 2025**: ${d.nombre2025}
**Nombre 2026**: ${d.nombre2026}

| Fuente | Meta |
|---|---|
| Catálogo 2025 (columna \`Meta\` en tab \`Indicadores\`) | \`${d.meta2025 ?? '—'}\` |
| Catálogo canónico 2026 (planilla \`Sistema indicadores PAF Escolar 2026.xlsx\`) | \`${d.meta2026 ?? '—'}\` |
| Metas efectivas en \`Base Vertical\` (${d.filasBV} filas) | ${d.metasEnBaseVertical.length ? d.metasEnBaseVertical.map(m => `\`${m}\``).join(', ') : '—'} |
`).join('\n')}

## Indicadores 2025 sin match en 2026 (para descartar o migrar)

${noMatch2025.length === 0 ? 'Ninguno.' : noMatch2025.map(c => `- **${c.id}** (${c.tipoIndicador === 2 ? 'producto' : 'estrategia'}): ${c.nombre}`).join('\n')}

## Indicadores 2026 sin correspondencia clara en 2025 (nuevos)

${noMatch2026.length === 0 ? 'Ninguno.' : noMatch2026.map(c => `- **${c.id}** (${c.ambito}, ${c.clasificacion}): ${c.nombre}`).join('\n')}

## Recomendación

Para cada discrepancia de meta, Sebastián debe confirmar cuál es la meta vigente. La plataforma se actualiza en un paso posterior; hoy usa la 2026 canónica.

Este reporte cierra parcialmente el hallazgo N.2 (metas conflictivas en el sheet \`Indicadores PAF Escolar\`). Las tres pestañas de ese sheet (año 1 2025 / año 1 2026 / año 2 2026) también tienen desalineaciones internas y quedan pendientes de reconciliar en un segundo paso.
`;

await writeFile(pathResolve(ROOT, 'docs/escolar-metas-discrepancy.md'), md);
console.log(`[metas-discrep] ✅ docs/escolar-metas-discrepancy.md`);
console.log(`  Matches: ${matches.filter(m => m.c26).length}/${cat2025.length}`);
console.log(`  Discrepancias de meta: ${discrepMeta.length}`);
console.log(`  Sin match 2025→2026: ${noMatch2025.length}`);
console.log(`  Sin match 2026→2025: ${noMatch2026.length}`);
