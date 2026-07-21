// Pipeline: mapeo Parvulario contra las planillas centrales + bases de
// identificación en Drive.
//
// Compara el catálogo local (`src/data/catalog.json` → indicadores.parvulario)
// contra los indicadores presentes en las pestañas "VISUALIZADOR JARDÍN" y
// "VISUALIZADOR SALAS" de cada Planilla Central, más los rosters de
// establecimientos de las bases de datos por cohorte.
//
// Reporta en coordenadas de CATÁLOGO (no de planilla). La numeración de las
// planillas está desfasada respecto al catálogo — la traducción vive en
// scripts/lib/parvularioIds.mjs y es compartida con ingestParvulario.mjs.
//
// Salida:
//   docs/mapeo-parvulario-YYYY-MM-DD.md — reporte listo para compartir con Luis.
//
// Uso:
//   npm run mapeo-parvulario                 → escribe el reporte
//   npm run mapeo-parvulario -- --dry-run    → solo imprime en consola
//
// Requiere: `scripts/service-account.json` con acceso Viewer a las planillas.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { google } from 'googleapis';
import { extractPlanillaId, planillaToCatalog } from './lib/parvularioIds.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

const PLANILLAS_CENTRALES = [
  {
    id: '1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A',
    label: 'Cohorte 2025-2026 · Año 1 (2025)',
    cohorte: '2025-2026',
    anio: 2025,
  },
  {
    id: '1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo',
    label: 'Cohorte 2025-2026 · Año 2 (2026)',
    cohorte: '2025-2026',
    anio: 2026,
  },
  {
    id: '1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk',
    label: 'Cohorte 2026-2027 · Año 1 (2026)',
    cohorte: '2026-2027',
    anio: 2026,
  },
];

const BASES_IDENTIFICACION = [
  { id: '1mTQJdFv9iTIcGbqKQHVq6VDhbP0mInoZ2OZqrcwzysE', cohorte: '2025-2026' },
  { id: '1yUWIdwLGxoS_CeonNpDYIV2M03IQ4bS-IT9yBomAxJY', cohorte: '2026-2027' },
];

async function getSheets() {
  const svc = JSON.parse(await readFile(pathResolve(__dirname, 'service-account.json'), 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: svc,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Analiza una planilla: lee headers de las tabs VISUALIZADOR JARDÍN / SALAS y
// registra, por cada header, tanto el ID de planilla como su traducción a
// catálogo (o null si es huérfano).
async function analizarPlanilla(sheets, planilla) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: planilla.id });
  const tabs = meta.data.sheets.map(s => s.properties.title);

  const relevantes = tabs.filter(t => /visualizador\s+(jard[ií]n|sala)/i.test(t));
  const result = {
    ...planilla,
    tabsTotal: tabs.length,
    tabsRelevantes: relevantes,
    // Sets en coordenadas de catálogo:
    catalogoJardin: new Set(),
    catalogoSala: new Set(),
    // Sets en coordenadas de planilla (para trazabilidad y huérfanos):
    planillaJardin: new Set(),
    planillaSala: new Set(),
    // Huérfanos: {planillaId, header, tab}
    huerfanos: [],
    huerfanosHeader: [],
  };

  for (const tab of relevantes) {
    const isSala = /sala/i.test(tab);
    try {
      const range = `'${tab}'!1:3`;
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: planilla.id, range });
      const rows = res.data.values ?? [];
      const headers = rows.flat().filter(Boolean);
      for (const h of headers) {
        const planillaId = extractPlanillaId(String(h));
        if (planillaId) {
          (isSala ? result.planillaSala : result.planillaJardin).add(planillaId);
          const catId = planillaToCatalog(planillaId);
          if (catId) {
            (isSala ? result.catalogoSala : result.catalogoJardin).add(catId);
          } else {
            result.huerfanos.push({ tab, planillaId, header: String(h) });
          }
        } else if (/indicador|indic\./i.test(String(h))) {
          result.huerfanosHeader.push({ tab, header: h });
        }
      }
    } catch (e) {
      console.warn(`  · ${tab}: no legible (${e.message})`);
    }
  }
  return result;
}

async function analizarBaseIdentificacion(sheets, base) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: base.id });
    const tab = meta.data.sheets[0]?.properties?.title;
    if (!tab) return { ...base, filas: 0, tabs: [] };
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: base.id, range: `'${tab}'` });
    const rows = res.data.values ?? [];
    return {
      ...base,
      tab,
      filasTotal: Math.max(0, rows.length - 1),
      tabs: meta.data.sheets.map(s => s.properties.title),
    };
  } catch (e) {
    return { ...base, error: e.message };
  }
}

function sortIds(ids) {
  return [...new Set(ids)].sort((a, b) => {
    const na = Number(String(a).replace('I.', ''));
    const nb = Number(String(b).replace('I.', ''));
    return na - nb;
  });
}

function renderMarkdown({ catalogoIds, planillas, bases, fecha }) {
  // Unión de indicadores presentes en cualquier planilla (en coordenadas de catálogo).
  const catalogoPresente = new Set();
  const desagregaCatalogo = new Set();
  const huerfanosMap = new Map(); // planillaId -> {planillaId, headers:[{tab,label,header}]}
  for (const p of planillas) {
    for (const id of p.catalogoJardin) catalogoPresente.add(id);
    for (const id of p.catalogoSala) { catalogoPresente.add(id); desagregaCatalogo.add(id); }
    for (const h of p.huerfanos) {
      const entry = huerfanosMap.get(h.planillaId) || { planillaId: h.planillaId, apariciones: [] };
      entry.apariciones.push({ planilla: p.label, tab: h.tab, header: h.header });
      huerfanosMap.set(h.planillaId, entry);
    }
  }

  const mapeados = [...catalogoIds].filter(id => catalogoPresente.has(id));
  const faltantes = [...catalogoIds].filter(id => !catalogoPresente.has(id));
  const huerfanos = [...huerfanosMap.values()];

  let md = `# Mapeo Parvulario · ${fecha}\n\n`;
  md += `Comparación del catálogo local \`src/data/catalog.json\` (${catalogoIds.size} indicadores) contra las pestañas "VISUALIZADOR JARDÍN" / "VISUALIZADOR SALAS" de las 3 planillas centrales.\n\n`;
  md += `Todos los conteos se reportan en **coordenadas de catálogo** (los IDs de planilla se traducen antes de comparar). Ver "Notas sobre la numeración" al final.\n\n`;

  md += `## Resumen\n\n`;
  md += `| | Cantidad |\n|---|---:|\n`;
  md += `| Indicadores en catálogo | ${catalogoIds.size} |\n`;
  md += `| Mapeados (en catálogo y en alguna planilla) | ${mapeados.length} |\n`;
  md += `| Faltantes (en catálogo, en ninguna planilla) | ${faltantes.length} |\n`;
  md += `| Huérfanos (en planillas, sin equivalente en catálogo) | ${huerfanos.length} |\n`;
  md += `| Con desglose por sala (catálogo) | ${desagregaCatalogo.size} |\n\n`;

  md += `## Por planilla\n\n`;
  for (const p of planillas) {
    md += `### ${p.label}\n\n`;
    md += `- Spreadsheet ID: \`${p.id}\`\n`;
    md += `- Pestañas totales: ${p.tabsTotal}\n`;
    md += `- Pestañas relevantes: ${p.tabsRelevantes.length ? p.tabsRelevantes.map(t => `\`${t}\``).join(', ') : '_ninguna encontrada_'}\n`;
    md += `- Indicadores en "VISUALIZADOR JARDÍN": ${p.catalogoJardin.size} (catálogo) → ${renderCatWithPlanilla(p.catalogoJardin, p.planillaJardin) || '_ninguno_'}\n`;
    md += `- Indicadores en "VISUALIZADOR SALAS": ${p.catalogoSala.size} (catálogo) → ${renderCatWithPlanilla(p.catalogoSala, p.planillaSala) || '_ninguno_'}\n`;
    if (p.huerfanos?.length) {
      md += `- Huérfanos detectados en esta planilla (sin equivalente en catálogo):\n`;
      for (const h of p.huerfanos) md += `  - planilla \`${h.planillaId}\` en \`${h.tab}\` — "${h.header}"\n`;
    }
    if (p.huerfanosHeader?.length) {
      md += `- Headers sospechosos que no parsean como I.N:\n`;
      for (const h of p.huerfanosHeader) md += `  - \`${h.tab}\`: "${h.header}"\n`;
    }
    md += `\n`;
  }

  md += `## Faltantes (${faltantes.length})\n\n`;
  md += `Indicadores del catálogo que ninguna planilla reporta.\n\n`;
  md += faltantes.length ? sortIds(faltantes).map(id => `- ${id}`).join('\n') + '\n\n' : '_Todos los indicadores del catálogo están cubiertos._\n\n';

  md += `## Huérfanos (${huerfanos.length})\n\n`;
  md += `IDs presentes en alguna planilla que no tienen equivalente en el catálogo (después de aplicar la traducción de numeración).\n\n`;
  if (!huerfanos.length) {
    md += '_No hay indicadores en planillas sin equivalente en el catálogo._\n\n';
  } else {
    for (const h of sortHuerfanos(huerfanos)) {
      const apariciones = h.apariciones.slice(0, 3).map(a => `${a.planilla} · \`${a.tab}\``).join('; ');
      const header = h.apariciones[0]?.header ?? '';
      md += `- planilla \`${h.planillaId}\` — "${header}" _(aparece en: ${apariciones}${h.apariciones.length > 3 ? '; …' : ''})_\n`;
    }
    md += `\n`;
  }

  md += `## Desglose por sala (${desagregaCatalogo.size})\n\n`;
  md += `Estos indicadores del catálogo llegan con granularidad sala (aparecen como columnas en "VISUALIZADOR SALAS" de alguna planilla, traducidos ya a coordenadas de catálogo). Son los que deben tener \`desagregaNivel: true\` en \`catalog.json\`.\n\n`;
  md += desagregaCatalogo.size ? sortIds([...desagregaCatalogo]).map(id => `- ${id}`).join('\n') + '\n\n' : '_Ninguno detectado._\n\n';

  md += `## Bases de identificación\n\n`;
  for (const b of bases) {
    md += `- Cohorte ${b.cohorte} (\`${b.id}\`): `;
    if (b.error) md += `error → ${b.error}\n`;
    else md += `${b.filasTotal ?? 0} filas de roster (pestaña \`${b.tab}\`)\n`;
  }

  md += `\n## Notas sobre la numeración\n\n`;
  md += `La numeración de las pestañas VISUALIZADOR está desfasada respecto al catálogo. Este reporte aplica la traducción **planilla → catálogo** antes de comparar, para que los conteos coincidan con lo que la UI y \`ingestParvulario.mjs\` consumen.\n\n`;
  md += `Reglas (ver \`scripts/lib/parvularioIds.mjs\`):\n\n`;
  md += `- planilla \`I.1\` ("N° de visitas al jardín") → **no existe** en catálogo (huérfano).\n`;
  md += `- planilla \`I.2..I.22\` → catálogo \`I.1..I.21\` (shift −1).\n`;
  md += `- planilla \`I.23..I.43\` → catálogo \`I.24..I.44\` (shift +1; catálogo \`I.22\` y \`I.23\` no tienen fuente).\n`;
  md += `- planilla \`I.44\` → **no existe** (saltada en las planillas).\n`;
  md += `- planilla \`I.45..I.54\` → catálogo \`I.45..I.54\` (identidad).\n\n`;
  md += `La extracción de IDs desde los headers tolera el typo \`"I.,20"\` presente en las 3 planillas.\n`;

  md += `\n---\n\nGenerado por \`scripts/mapeoParvulario.mjs\`.\n`;
  return md;
}

// Renderiza la lista de IDs de catálogo con el ID de planilla original en
// paréntesis, para que Luis pueda auditar la traducción. Se ordena por catálogo.
function renderCatWithPlanilla(catSet, planillaSet) {
  const pairs = [];
  const planillaList = [...planillaSet];
  for (const catId of catSet) {
    // Encontrar el ID planilla que mapea a este catId.
    const planillaId = planillaList.find(pid => planillaToCatalog(pid) === catId);
    pairs.push({ catId, planillaId });
  }
  pairs.sort((a, b) => Number(a.catId.slice(2)) - Number(b.catId.slice(2)));
  return pairs.map(p => p.planillaId && p.planillaId !== p.catId
    ? `${p.catId} (planilla ${p.planillaId})`
    : p.catId
  ).join(', ');
}

function sortHuerfanos(arr) {
  return [...arr].sort((a, b) => {
    const na = Number(String(a.planillaId).replace('I.', ''));
    const nb = Number(String(b.planillaId).replace('I.', ''));
    return na - nb;
  });
}

async function main() {
  const sheets = await getSheets();

  const catalog = JSON.parse(await readFile(pathResolve(ROOT, 'src/data/catalog.json'), 'utf-8'));
  const catalogoIds = new Set(catalog.indicadores.parvulario.map(i => i.id));
  console.log(`Catálogo local: ${catalogoIds.size} indicadores parvulario`);

  const planillas = [];
  for (const p of PLANILLAS_CENTRALES) {
    console.log(`\n${p.label} (${p.id})`);
    try {
      const r = await analizarPlanilla(sheets, p);
      console.log(`  jardín (catálogo): ${r.catalogoJardin.size}   salas (catálogo): ${r.catalogoSala.size}   huérfanos: ${r.huerfanos.length}`);
      planillas.push(r);
    } catch (e) {
      console.warn(`  error: ${e.message}`);
      planillas.push({
        ...p, error: e.message,
        catalogoJardin: new Set(), catalogoSala: new Set(),
        planillaJardin: new Set(), planillaSala: new Set(),
        huerfanos: [], huerfanosHeader: [],
      });
    }
  }

  const bases = [];
  for (const b of BASES_IDENTIFICACION) {
    console.log(`\nBase identificación ${b.cohorte} (${b.id})`);
    const r = await analizarBaseIdentificacion(sheets, b);
    console.log(`  ${r.error ? 'error: ' + r.error : `filas: ${r.filasTotal}`}`);
    bases.push(r);
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const md = renderMarkdown({ catalogoIds, planillas, bases, fecha });

  if (DRY) {
    console.log('\n───── REPORTE (dry-run) ─────\n');
    console.log(md);
    return;
  }

  const docsDir = pathResolve(ROOT, 'docs');
  await mkdir(docsDir, { recursive: true });
  const outPath = pathResolve(docsDir, `mapeo-parvulario-${fecha}.md`);
  await writeFile(outPath, md, 'utf-8');
  console.log(`\nReporte escrito en ${outPath}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
