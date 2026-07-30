// Genera el manifiesto de cobertura Escolar (E5 del addendum).
//
// Para cada tupla (año, escuela, indicador canónico, curso-cuando-aplique)
// resuelve UN estado según la escalera del addendum:
//
//   1. NO_CORRESPONDE_AUN   — fuera del universo por año de implementación
//   2. NO_CORRESPONDE       — fuera del universo estructural (curso no existe;
//                             indicador no aplica a ese nivel)
//   3. SIN_FUENTE_MAPEADA   — no hay coordenada declarada (ver escolarMapping)
//   4. FUENTE_NO_ACCESIBLE  — coordenada declarada pero la planilla no se pudo
//                             leer (harvest error, permisos, tab renombrado)
//   5. SIN_DATO_REPORTADO   — leído OK, celda vacía o sentinel
//
// Plus: `CON_DATO_REPORTADO` cuando hay valor; `CERO_REPORTADO` cuando
// ZERO_FALLBACK marca "sin actividad reportada" (raw sentinel).
//
// Fuentes:
//   - Universo: src/data/escolarPlanillaIndex.json (E1)
//   - Mapeo:    scripts/lib/escolarMapping.mjs (E4)
//   - Catálogo: src/data/catalog.json
//   - Scope:    src/data/scope.js
//   - Harvest:  .cache/harvest/checkpoint.json (E3, opcional)
//   - Ingest:   estado real de Firestore (opcional, requiere flag --with-firestore)
//
// El manifiesto es SEPARADO del value store (resultados_real). Declara
// universo y coordenadas. No cambia agregaciones.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ESCOLAR_MAPPING, esNoMapeado } from './lib/escolarMapping.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, '..');
const args = process.argv.slice(2);
const WITH_FIRESTORE = args.includes('--with-firestore');

const INDEX_PATH = pathResolve(ROOT, 'src/data/escolarPlanillaIndex.json');
const CATALOG_PATH = pathResolve(ROOT, 'src/data/catalog.json');
const CHECKPOINT_PATH = pathResolve(ROOT, '.cache/harvest/checkpoint.json');
const OUT_JSON = pathResolve(ROOT, 'docs/escolar-coverage-manifest.json');
const OUT_MD = pathResolve(ROOT, 'docs/escolar-coverage-manifest.md');

const idx = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
const escolar2026 = catalog.indicadores.escolar2026;

let checkpoint = { completed: {}, errors: {} };
if (existsSync(CHECKPOINT_PATH)) {
  checkpoint = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'));
  console.log(`[coverage] Harvest checkpoint cargado: ${Object.keys(checkpoint.completed).length} planillas OK, ${Object.keys(checkpoint.errors).length} con error`);
} else {
  console.log(`[coverage] Sin harvest checkpoint — todo lo mapeado se tratará como no-leído aún.`);
}

let firestoreValues = null;
if (WITH_FIRESTORE) {
  console.log(`[coverage] --with-firestore: consultando resultados_real...`);
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const sa = JSON.parse(await readFile(pathResolve(ROOT, 'scripts/service-account.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();
  const snap = await db.collection('resultados_real').where('programa', '==', 'escolar').get();
  firestoreValues = new Map();
  for (const d of snap.docs) {
    const data = d.data();
    const k = `${data.establecimientoId}|${data.indicadorId}|${data.anio}`;
    firestoreValues.set(k, { valor: data.valor, raw: data.raw, estado: data.estado });
  }
  console.log(`[coverage] Firestore Escolar values cargados: ${firestoreValues.size}`);
}

// ─── Mapeo escuela ↔ establecimientoId (jar-slug / esc-slug) ───────────────
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function estIdParaEscuela(nombre) {
  return `esc-${slugify(nombre)}`;
}

// ─── Cohorte → año de implementación (Escolar) ─────────────────────────────
// Cohorte '2025-2027' → año 1 en 2025, año 2 en 2026, año 3 en 2027.
// Cohorte '2026-2028' → año 0 (fuera del programa) en 2025, año 1 en 2026.
function anioImplementacionEscolar(cohorte, anio) {
  const startYear = Number(cohorte.split('-')[0]);
  if (anio < startYear) return 0; // fuera del programa
  return anio - startYear + 1;
}

// ─── Universo por cohorte/anio + curso ─────────────────────────────────────
// El index E1 ya declara qué cursos existen por escuela × año (los que tienen
// una planilla enlazada = 'expected'). Sacamos el set de cursos existentes:

function cursosExistentesEnEscuelaAnio(escuela, anio) {
  return new Set(
    idx.entries
      .filter(e => e.escuela === escuela && e.anio === anio && e.arquetipo === 'curso' && e.estado === 'expected')
      .map(e => e.cursoCanonical)
      .filter(Boolean)
  );
}

// ─── Escuelas del universo ─────────────────────────────────────────────────
const escuelas = [];
for (const e of idx.entries) {
  if (!escuelas.find(x => x.escuela === e.escuela)) {
    escuelas.push({
      escuela: e.escuela,
      cohorte: e.cohorte,
      sostenedor: e.sostenedor,
      comuna: e.comuna,
      tipoEstablecimiento: e.tipoEstablecimiento,
    });
  }
}
console.log(`[coverage] Escuelas en universo: ${escuelas.length}`);

// ─── Cursos aplicables a un indicador (per E4) ─────────────────────────────
import { cursosAplicables as cursosAplicablesE4 } from './lib/escolarMapping.mjs';

// ─── Scope (semestre requerido por indicador) ──────────────────────────────
function semestreMinimoRequerido(inicio) {
  if (!inicio || typeof inicio !== 'string') return 1;
  const t = inicio.trim();
  const semMatch = t.match(/^Sem\s+([1-4])$/i);
  if (semMatch) return Number(semMatch[1]);
  if (/^Primer[oa]?\s+a[nñ]o$/i.test(t)) return 1;
  if (/^Segundo\s+a[nñ]o$/i.test(t)) return 3;
  return 1;
}

// Un indicador aplica al centro en un año si su semestre mínimo requerido
// está dentro del acumulado que el centro ya recorrió al cierre de ese año.
// Simplificación: al cierre de año calendario, semestre acumulado = anio_impl × 2.
function aplicaScope(indicador, cohorte, anio) {
  const anioImpl = anioImplementacionEscolar(cohorte, anio);
  if (anioImpl < 1) return false; // fuera del programa
  const acumulado = anioImpl * 2;
  const minReq = semestreMinimoRequerido(indicador.inicio);
  return minReq <= acumulado;
}

// ─── Resolver estado para una tupla (escuela, indicador, curso?, anio) ────
function resolverEstado({ escuela, cohorte, indicador, curso, anio, cursosExistentes }) {
  // 1. NO_CORRESPONDE_AUN — fuera de scope por año de implementación
  if (!aplicaScope(indicador, cohorte, anio)) {
    return { estado: 'NO_CORRESPONDE_AUN', razon: `Semestre mínimo requerido (${indicador.inicio || 'Sem 1'}) no alcanzado en cohorte ${cohorte} en ${anio}` };
  }

  // 2. NO_CORRESPONDE — estructural
  if (curso && !cursosExistentes.has(curso)) {
    return { estado: 'NO_CORRESPONDE', razon: `Curso ${curso} no existe en ${escuela}` };
  }

  // 3. SIN_FUENTE_MAPEADA — no hay coordenada declarada en el mapeo E4
  if (esNoMapeado(indicador.id)) {
    const entry = ESCOLAR_MAPPING.find(m => m.id === indicador.id);
    return { estado: 'SIN_FUENTE_MAPEADA', razon: entry?.razon || 'Sin razón declarada' };
  }

  const fuentes = ESCOLAR_MAPPING.find(m => m.id === indicador.id)?.fuentes || [];
  const fuentesAnio = fuentes.filter(f => f.anio === anio);
  if (fuentesAnio.length === 0) {
    return { estado: 'SIN_FUENTE_MAPEADA', razon: `Sin fuente declarada para año ${anio}` };
  }

  // 4. FUENTE_NO_ACCESIBLE — la planilla del arquetipo declarado falló en el harvest
  // Necesitamos identificar la planilla correspondiente (por arquetipo).
  const fuente = fuentesAnio[0];
  const arquetipo = fuente.arquetipo;
  const planillaEntry = idx.entries.find(e =>
    e.escuela === escuela && e.anio === anio && e.arquetipo === arquetipo &&
    (!curso || e.cursoCanonical === curso) && e.estado === 'expected'
  );
  if (planillaEntry && checkpoint.errors[planillaEntry.spreadsheetId]) {
    const err = checkpoint.errors[planillaEntry.spreadsheetId];
    return { estado: 'FUENTE_NO_ACCESIBLE', razon: `Harvest falló: ${err.kind} ${err.code || ''}`, detalle: err.message?.slice(0, 100) };
  }

  // 5. Si estamos consultando Firestore y hay valor, es CON_DATO / CERO_REPORTADO / SIN_DATO_REPORTADO
  if (firestoreValues) {
    const k = `${estIdParaEscuela(escuela)}|${indicador.id}|${anio}`;
    const v = firestoreValues.get(k);
    if (v && v.valor !== null && v.valor !== undefined) {
      if (v.valor === 0 && /sin actividad/i.test(String(v.raw || ''))) {
        return { estado: 'CERO_REPORTADO', valor: v.valor, estadoDato: v.estado };
      }
      return { estado: 'CON_DATO_REPORTADO', valor: v.valor, estadoDato: v.estado };
    }
    return { estado: 'SIN_DATO_REPORTADO', razon: 'Fuente mapeada, harvest OK, sin valor en Firestore' };
  }

  // Sin flag --with-firestore, no podemos discriminar SIN_DATO vs CON_DATO;
  // dejamos indeterminado.
  return { estado: 'MAPEADO_NO_VERIFICADO', razon: 'Corre con --with-firestore para resolver SIN_DATO vs CON_DATO' };
}

// ─── Generar manifiesto ────────────────────────────────────────────────────
const manifest = { escuelas: [] };
const stats = { estados: {}, porIndicador: {}, porEscuela: {} };

for (const esc of escuelas) {
  const escManifest = { ...esc, indicadores: [] };

  for (const anio of [2025, 2026]) {
    const cursosExist = cursosExistentesEnEscuelaAnio(esc.escuela, anio);
    for (const indicador of escolar2026) {
      // Scope: sólo indicadores del catálogo 2026 (evitamos comparar 2025 catalog aquí).
      // Escala escuela vs curso:
      const mappingEntry = ESCOLAR_MAPPING.find(m => m.id === indicador.id);
      const scope = mappingEntry?.scope || 'escuela';
      const cursosParaEsteIndicador = scope === 'curso' ? cursosAplicablesE4(indicador.id, anio) : [null];

      for (const curso of cursosParaEsteIndicador) {
        const r = resolverEstado({
          escuela: esc.escuela,
          cohorte: esc.cohorte,
          indicador,
          curso,
          anio,
          cursosExistentes: cursosExist,
        });
        escManifest.indicadores.push({
          anio, indicadorId: indicador.id, curso, ...r,
        });
        stats.estados[r.estado] = (stats.estados[r.estado] || 0) + 1;
        stats.porIndicador[indicador.id] = stats.porIndicador[indicador.id] || {};
        stats.porIndicador[indicador.id][r.estado] = (stats.porIndicador[indicador.id][r.estado] || 0) + 1;
      }
    }
    stats.porEscuela[esc.escuela] = stats.porEscuela[esc.escuela] || {};
    for (const est of Object.keys(stats.estados)) {
      // no-op, just seed shape
    }
  }
  manifest.escuelas.push(escManifest);
}

manifest.generatedAt = new Date().toISOString();
manifest.stats = stats;
manifest.withFirestore = WITH_FIRESTORE;

await writeFile(OUT_JSON, JSON.stringify(manifest, null, 2));
console.log(`\n[coverage] ✅ ${OUT_JSON}`);
console.log(`  Total tuplas: ${Object.values(stats.estados).reduce((s, v) => s + v, 0)}`);
console.log(`  Por estado:`, stats.estados);

// ─── Reporte markdown breve ────────────────────────────────────────────────
const total = Object.values(stats.estados).reduce((s, v) => s + v, 0);
const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
const md = `# Manifiesto de cobertura Escolar

Generado ${manifest.generatedAt.slice(0, 10)}${WITH_FIRESTORE ? ' (con estado de Firestore)' : ' (sin consulta a Firestore)'}.

Total de tuplas (escuela × indicador × curso × año) declaradas: **${total}**.

## Distribución por estado

| Estado | Cantidad | Porcentaje | Dueño |
|---|---:|---:|---|
| NO_CORRESPONDE_AUN | ${stats.estados.NO_CORRESPONDE_AUN || 0} | ${pct(stats.estados.NO_CORRESPONDE_AUN || 0)} | Nadie (diseño del programa) |
| NO_CORRESPONDE | ${stats.estados.NO_CORRESPONDE || 0} | ${pct(stats.estados.NO_CORRESPONDE || 0)} | Nadie (estructura) |
| SIN_FUENTE_MAPEADA | ${stats.estados.SIN_FUENTE_MAPEADA || 0} | ${pct(stats.estados.SIN_FUENTE_MAPEADA || 0)} | **Nosotros** |
| FUENTE_NO_ACCESIBLE | ${stats.estados.FUENTE_NO_ACCESIBLE || 0} | ${pct(stats.estados.FUENTE_NO_ACCESIBLE || 0)} | **Nosotros** |
| SIN_DATO_REPORTADO | ${stats.estados.SIN_DATO_REPORTADO || 0} | ${pct(stats.estados.SIN_DATO_REPORTADO || 0)} | Focus |
| CON_DATO_REPORTADO | ${stats.estados.CON_DATO_REPORTADO || 0} | ${pct(stats.estados.CON_DATO_REPORTADO || 0)} | — |
| CERO_REPORTADO | ${stats.estados.CERO_REPORTADO || 0} | ${pct(stats.estados.CERO_REPORTADO || 0)} | — |
| MAPEADO_NO_VERIFICADO | ${stats.estados.MAPEADO_NO_VERIFICADO || 0} | ${pct(stats.estados.MAPEADO_NO_VERIFICADO || 0)} | Correr con \`--with-firestore\` |

## Indicadores con estado SIN_FUENTE_MAPEADA

${Object.entries(stats.porIndicador)
  .filter(([_, s]) => s.SIN_FUENTE_MAPEADA)
  .map(([id, s]) => {
    const ind = escolar2026.find(i => i.id === id);
    const razon = ESCOLAR_MAPPING.find(m => m.id === id)?.razon || '';
    return `- **${id} · ${ind?.nombre?.slice(0, 70)}**: ${s.SIN_FUENTE_MAPEADA} tuplas — ${razon}`;
  }).join('\n')}

## Nota

Este manifiesto declara qué se espera y qué se tiene declarado como fuente.
No cambia agregaciones. Un indicador aplicable sin valor sigue contando 0 en
el porcentaje del ámbito, exactamente como hoy. El manifiesto cambia lo que
se muestra y se reporta, no lo que se computa.
`;

await writeFile(OUT_MD, md);
console.log(`[coverage] ✅ ${OUT_MD}`);
