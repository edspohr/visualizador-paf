// Canonical indicator IDs and ámbito membership.
//
// Fuente de verdad: `Orden de indicadores para visualizador` (Parvulario y
// Escolar), documentos entregados por el cliente el 2026-07-29 y referenciados
// en `docs/references-paf.docx`. Cualquier drift del XLSX fuente respecto a
// este canónico se re-canonicaliza en tiempo de parseo, no en Firestore.
//
// El pipeline en `scripts/parseCatalogs.mjs` corre `applyCanonical` como
// último paso y luego `assertCanonical` para fallar el build si la estructura
// resultante no coincide con las expectativas declaradas aquí.
//
// Usar también desde `scripts/migrateCanonicalIndicadorIds.mjs` para llevar
// los `resultados_real` de Firestore a la misma numeración.

// ─── Parvulario ────────────────────────────────────────────────────────────
// - Add:    I.1 "N° de visitas al jardín infantil" (ámbito A1, estrategia)
// - Shift  +1: catálogo I.1–I.21 → canónico I.2–I.22
// - Delete: catálogo I.22, I.23 (sin fuente en planillas; confirmado en
//           reports/ingestParvulario-2026-07-21.json → indicadoresNoCubiertos)
// - Shift  −1: catálogo I.24–I.54 → canónico I.23–I.53

const parvularioRenames = {};
for (let n = 1; n <= 21; n++) parvularioRenames[`I.${n}`] = `I.${n + 1}`;
for (let n = 24; n <= 54; n++) parvularioRenames[`I.${n}`] = `I.${n - 1}`;

export const PARVULARIO_CANONICAL = {
  additions: [
    {
      // Ver Q1 en docs/plan-implementacion-2026-07-29.md: la metadata concreta
      // (metaNum, tipoMeta, unidad, frecuencia, fuente, inicio) debe venir de
      // la planilla `Indicadores PAF Parvulario` del cliente. Mientras tanto,
      // se persiste con `sin_meta` para que quede fuera de todos los agregados
      // pero visible en el catálogo. Ver `applyCanonical`: `fillDefaults`
      // completa los campos ausentes.
      id: 'I.1',
      programa: 'parvulario',
      version: '2026',
      estrategiaId: 'E1',
      estrategiaNombre: null,
      ambito: 'A1',
      actividadNombre: null,
      nombre: 'N° de visitas al jardín infantil',
      meta: '—',
      metaNum: null,
      tipoMeta: 'sin_meta',
      unidad: 'sin_meta',
      tipo: 'actividad',
      fuente: 'Planilla central',
      frecuencia: 'mensual',
      inicio: null,
      clasificacion: 'estrategia',
      // TODO(Focus): completar cuando llegue la metadata canónica desde
      // `Indicadores PAF Parvulario`. Ver Q1 en el plan.
    },
  ],
  renames: parvularioRenames,
  deletions: ['I.22', 'I.23'],
  overrides: {},
  expectations: {
    total: 53,
    porAmbito: {
      A1: { estrategia: 8, producto: 3 },
      A2: { estrategia: 6, producto: 6 },
      A3: { estrategia: 19, producto: 11 },
    },
  },
};

// ─── Escolar 2026 ──────────────────────────────────────────────────────────
// - Identity: I.1–I.45
// - Delete:   I.46 ("Cantidad promedio de instrumentos de fomento lector…")
// - Shift −1: I.47–I.52 → I.46–I.51
// - Overrides post-rename (sobre IDs canónicos):
//     I.29:            clasificación → estrategia
//     I.40, I.41, I.42: clasificación → producto
//     I.43, I.44, I.45: ámbito → A3
//     I.48 (era I.49): clasificación → producto

const escolar2026Renames = {};
for (let n = 1; n <= 45; n++) escolar2026Renames[`I.${n}`] = `I.${n}`;
for (let n = 47; n <= 52; n++) escolar2026Renames[`I.${n}`] = `I.${n - 1}`;

export const ESCOLAR2026_CANONICAL = {
  additions: [],
  renames: escolar2026Renames,
  deletions: ['I.46'],
  overrides: {
    'I.29': { clasificacion: 'estrategia', tipo: 'actividad' },
    'I.40': { clasificacion: 'producto', tipo: 'producto' },
    'I.41': { clasificacion: 'producto', tipo: 'producto' },
    'I.42': { clasificacion: 'producto', tipo: 'producto' },
    'I.43': { ambito: 'A3' },
    'I.44': { ambito: 'A3' },
    'I.45': { ambito: 'A3' },
    'I.48': { clasificacion: 'producto', tipo: 'producto' },
  },
  expectations: {
    total: 51,
    porAmbito: {
      A1: { estrategia: 10, producto: 3 },
      A2: { estrategia: 10, producto: 3 },
      A3: { estrategia: 7, producto: 9 },
      A4: { estrategia: 5, producto: 4 },
    },
  },
};

// ─── Nombres de ámbito (para catalog.ambitos) ──────────────────────────────
// Overrides de nombre display viven en src/lib/labels.js. Aquí solo actualizamos
// el nombre almacenado en catalog.json para que quede internamente consistente.

export const AMBITO_NAMES = {
  parvulario: {
    A1: 'Gestión institucional',
    A2: 'Formación Equipos educativos',
    A3: 'Formación Apoderados',
  },
  escolar: {
    A1: 'Gestión institucional',
    A2: 'Formación Equipo educativo',
    A3: 'Formación Apoderados',
    A4: 'Formación Estudiantes',
  },
};

// ─── Aplicación ────────────────────────────────────────────────────────────

// Aplica `canonical` sobre una lista de indicadores parseada del XLSX. Devuelve
// una nueva lista canonical, ordenada por número de indicador.
export function applyCanonical(indicadores, canonical) {
  const { renames, deletions, overrides, additions } = canonical;
  const delSet = new Set(deletions);

  // Paso 1: renombrar y quitar eliminados.
  const remapped = [];
  for (const ind of indicadores) {
    if (delSet.has(ind.id)) continue;
    const nuevoId = renames[ind.id];
    if (nuevoId === undefined) {
      // ID no mencionado en el mapa: se conserva tal cual. Sirve para tolerar
      // indicadores del XLSX que aún no están renumerados pero tampoco chocan.
      remapped.push({ ...ind });
      continue;
    }
    remapped.push({ ...ind, id: nuevoId });
  }

  // Paso 2: agregar los nuevos.
  for (const nuevo of additions) {
    remapped.push({ ...nuevo });
  }

  // Paso 3: aplicar overrides estructurales.
  for (const ind of remapped) {
    const patch = overrides?.[ind.id];
    if (patch) Object.assign(ind, patch);
  }

  // Paso 4: colisiones (mismo id, dos veces) → error temprano.
  const seen = new Map();
  for (const ind of remapped) {
    if (seen.has(ind.id)) {
      throw new Error(`applyCanonical: colisión de ID canónico ${ind.id} (${ind.programa}). Revisar renames/additions.`);
    }
    seen.set(ind.id, true);
  }

  // Paso 5: ordenar por número numérico ascendente.
  remapped.sort((a, b) => {
    const na = Number(String(a.id).replace('I.', ''));
    const nb = Number(String(b.id).replace('I.', ''));
    return na - nb;
  });

  return remapped;
}

// Verifica que la lista resultante cumpla las expectativas declaradas. Lanza
// error si no. Modelado sobre scripts/checkColorTokens.mjs.
export function assertCanonical(indicadores, canonical, label = '') {
  const { expectations } = canonical;
  const errs = [];

  if (indicadores.length !== expectations.total) {
    errs.push(`total: got ${indicadores.length}, expected ${expectations.total}`);
  }

  const conteo = {};
  for (const ind of indicadores) {
    const amb = ind.ambito;
    if (!conteo[amb]) conteo[amb] = { estrategia: 0, producto: 0 };
    if (ind.clasificacion === 'estrategia') conteo[amb].estrategia++;
    else if (ind.clasificacion === 'producto') conteo[amb].producto++;
  }

  for (const [amb, esperado] of Object.entries(expectations.porAmbito)) {
    const actual = conteo[amb] ?? { estrategia: 0, producto: 0 };
    if (actual.estrategia !== esperado.estrategia || actual.producto !== esperado.producto) {
      errs.push(
        `ámbito ${amb}: got estrategia=${actual.estrategia}, producto=${actual.producto}; ` +
        `expected estrategia=${esperado.estrategia}, producto=${esperado.producto}`
      );
    }
  }

  // Detectar ámbitos inesperados.
  for (const amb of Object.keys(conteo)) {
    if (!(amb in expectations.porAmbito)) {
      errs.push(`ámbito inesperado presente: ${amb} (${conteo[amb].estrategia + conteo[amb].producto} indicadores)`);
    }
  }

  if (errs.length) {
    const prefix = label ? `[${label}] ` : '';
    throw new Error(`${prefix}assertCanonical falló:\n  - ${errs.join('\n  - ')}`);
  }
}
