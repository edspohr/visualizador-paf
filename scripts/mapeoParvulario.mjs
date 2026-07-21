// Pipeline: mapeo Parvulario contra las planillas centrales + bases de
// identificación en Drive.
//
// Compara el catálogo local (`src/data/catalog.json` → indicadores.parvulario)
// contra los indicadores presentes en las nuevas pestañas "Visualizador Jardín"
// y "Visualizador Sala" de cada Planilla Central, más los rosters de
// establecimientos de las bases de datos por cohorte.
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

// Detecta si un texto de header apunta a un indicador con id "I.N" o "IN".
const RE_INDICADOR = /\bI[\.\s-]*(\d{1,3})\b/i;

function normalizarIndicadorId(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.match(RE_INDICADOR);
  return m ? `I.${Number(m[1])}` : null;
}

async function getSheets() {
  const svc = JSON.parse(await readFile(pathResolve(__dirname, 'service-account.json'), 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: svc,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function analizarPlanilla(sheets, planilla) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: planilla.id });
  const tabs = meta.data.sheets.map(s => s.properties.title);

  const relevantes = tabs.filter(t => /visualizador\s+(jard[ií]n|sala)/i.test(t));
  const result = {
    ...planilla,
    tabsTotal: tabs.length,
    tabsRelevantes: relevantes,
    indicadoresJardin: new Set(),
    indicadoresSala: new Set(),
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
        const id = normalizarIndicadorId(String(h));
        if (id) {
          (isSala ? result.indicadoresSala : result.indicadoresJardin).add(id);
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

function renderMarkdown({ catalogoIds, planillas, bases, fecha }) {
  const unionPresente = new Set();
  for (const p of planillas) {
    for (const id of p.indicadoresJardin) unionPresente.add(id);
    for (const id of p.indicadoresSala) unionPresente.add(id);
  }
  const mapeados = [...catalogoIds].filter(id => unionPresente.has(id));
  const faltantes = [...catalogoIds].filter(id => !unionPresente.has(id));
  const huerfanos = [...unionPresente].filter(id => !catalogoIds.has(id));
  const desagrega = new Set();
  for (const p of planillas) for (const id of p.indicadoresSala) desagrega.add(id);

  let md = `# Mapeo Parvulario · ${fecha}\n\n`;
  md += `Comparación del catálogo local \`src/data/catalog.json\` (${catalogoIds.size} indicadores) contra las pestañas "Visualizador Jardín" / "Visualizador Sala" de las 3 planillas centrales.\n\n`;

  md += `## Resumen\n\n`;
  md += `| | Cantidad |\n|---|---:|\n`;
  md += `| Indicadores en catálogo | ${catalogoIds.size} |\n`;
  md += `| Mapeados (en catálogo y en alguna planilla) | ${mapeados.length} |\n`;
  md += `| Faltantes (en catálogo, en ninguna planilla) | ${faltantes.length} |\n`;
  md += `| Huérfanos (en planillas, no en catálogo) | ${huerfanos.length} |\n`;
  md += `| Con desglose por sala | ${desagrega.size} |\n\n`;

  md += `## Por planilla\n\n`;
  for (const p of planillas) {
    md += `### ${p.label}\n\n`;
    md += `- Spreadsheet ID: \`${p.id}\`\n`;
    md += `- Pestañas totales: ${p.tabsTotal}\n`;
    md += `- Pestañas relevantes: ${p.tabsRelevantes.length ? p.tabsRelevantes.map(t => `\`${t}\``).join(', ') : '_ninguna encontrada_'}\n`;
    md += `- Indicadores en "Visualizador Jardín": ${p.indicadoresJardin.size} → ${sortIds([...p.indicadoresJardin]).join(', ') || '_ninguno_'}\n`;
    md += `- Indicadores en "Visualizador Sala": ${p.indicadoresSala.size} → ${sortIds([...p.indicadoresSala]).join(', ') || '_ninguno_'}\n`;
    if (p.huerfanosHeader?.length) {
      md += `- Headers sospechosos que no parsean como I.N:\n`;
      for (const h of p.huerfanosHeader) md += `  - \`${h.tab}\`: "${h.header}"\n`;
    }
    md += `\n`;
  }

  md += `## Faltantes (${faltantes.length})\n\n`;
  md += faltantes.length ? sortIds(faltantes).map(id => `- ${id}`).join('\n') + '\n\n' : '_Todos los indicadores del catálogo están cubiertos._\n\n';

  md += `## Huérfanos (${huerfanos.length})\n\n`;
  md += huerfanos.length ? sortIds(huerfanos).map(id => `- ${id}`).join('\n') + '\n\n' : '_No hay indicadores en planillas que no estén en el catálogo._\n\n';

  md += `## Desglose por sala (${desagrega.size})\n\n`;
  md += `Estos indicadores llegan con granularidad sala y deben marcarse \`desagregaNivel: true\` en \`catalog.json\`.\n\n`;
  md += desagrega.size ? sortIds([...desagrega]).map(id => `- ${id}`).join('\n') + '\n\n' : '_Ninguno detectado._\n\n';

  md += `## Bases de identificación\n\n`;
  for (const b of bases) {
    md += `- Cohorte ${b.cohorte} (\`${b.id}\`): `;
    if (b.error) md += `error → ${b.error}\n`;
    else md += `${b.filasTotal ?? 0} filas de roster (pestaña \`${b.tab}\`)\n`;
  }
  md += `\n---\n\nGenerado por \`scripts/mapeoParvulario.mjs\`.\n`;
  return md;
}

function sortIds(ids) {
  return [...new Set(ids)].sort((a, b) => {
    const na = Number(a.replace('I.', ''));
    const nb = Number(b.replace('I.', ''));
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
      console.log(`  jardín: ${r.indicadoresJardin.size}  sala: ${r.indicadoresSala.size}`);
      planillas.push(r);
    } catch (e) {
      console.warn(`  error: ${e.message}`);
      planillas.push({ ...p, error: e.message, indicadoresJardin: new Set(), indicadoresSala: new Set() });
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
