// Registry of establishments and sostenedores (ADR-0002, ADR-0003).
//
// Shared by the ingests (scripts/ingest*.mjs), the nightly pipeline, the admin
// Cloud Function (functions/src/admin.mjs) and the admin screen, so that all
// of them agree on:
//   - how a name becomes a doc id (jar-… / esc-…),
//   - which fields an administrator edited in the platform and the ingests
//     must therefore stop overwriting (`camposPlataforma`),
//   - how a sostenedor name maps to its SLEP id (collection sostenedores_real),
//   - what counts as a new / missing / not-yet-anchored establishment.
//
// Pure module: no imports, safe to load from Node scripts and from Vite.

export const PROGRAMAS = ['escolar', 'parvulario'];

export const COHORTES = {
  escolar: ['2025-2027', '2026-2028'],
  parvulario: ['2025-2026', '2026-2027'],
};

// Fields an administrator can edit in the platform. Once edited, the field is
// listed in `camposPlataforma` on the doc and the ingests leave it alone.
export const CAMPOS_EDITABLES = ['nombre', 'cohorte', 'slep', 'sostenedor', 'comuna', 'rbd', 'nNinos'];

// ─── Ids ──────────────────────────────────────────────────────────────────

export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleanName(s) {
  return String(s || '').replace(/\s*\(.*?\)\s*/g, '').replace(/[.,;]+$/, '').trim();
}

export const jarId = (name) => `jar-${slug(cleanName(name))}`;
export const schoolId = (name) => `esc-${slug(String(name || '').replace(/^Escuela\s+/i, ''))}`;
export const establecimientoId = (programa, nombre) => (programa === 'escolar' ? schoolId(nombre) : jarId(nombre));

const clave = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Id for a new sostenedor: "SLEP Santa Rosa" → "SLEP-SR", avoiding the ids already taken. */
export function nuevoSlepId(nombre, existentes = []) {
  const palabras = clave(nombre).replace(/^slep\s+/, '').split(' ')
    .filter(w => w && !['de', 'del', 'la', 'las', 'los', 'y'].includes(w));
  const iniciales = palabras.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'X';
  const usados = new Set(existentes);
  let id = `SLEP-${iniciales}`;
  for (let n = 2; usados.has(id); n++) id = `SLEP-${iniciales}${n}`;
  return id;
}

// ─── Sostenedores ─────────────────────────────────────────────────────────

/**
 * SLEP id for a sostenedor name as written in a planilla, or null when the
 * name is not in the catalog (the pipeline then reports it).
 * @param sostenedores array of { id, nombre, alias?: string[] }
 */
export function slepDeSostenedor(nombre, sostenedores) {
  const k = clave(nombre);
  if (!k) return null;
  for (const s of sostenedores) {
    if (clave(s.nombre) === k || clave(s.id) === k) return s.id;
    if ((s.alias ?? []).some(a => clave(a) === k)) return s.id;
  }
  return null;
}

// ─── Platform-edited fields ───────────────────────────────────────────────

/**
 * Removes from `patch` the fields the platform owns for this doc.
 * @returns {{ patch, discrepancias: Array<{campo, plataforma, fuente}> }}
 */
export function respetarPlataforma(existente, patch) {
  const propios = new Set(existente?.camposPlataforma ?? []);
  if (!propios.size) return { patch, discrepancias: [] };
  const limpio = {};
  const discrepancias = [];
  for (const [campo, valor] of Object.entries(patch)) {
    if (!propios.has(campo)) { limpio[campo] = valor; continue; }
    const actual = existente[campo] ?? null;
    if (valor != null && valor !== '' && String(valor) !== String(actual)) {
      discrepancias.push({ campo, plataforma: actual, fuente: valor });
    }
  }
  return { patch: limpio, discrepancias };
}

// ─── Registry state ───────────────────────────────────────────────────────

/** Created in the platform and not yet found in any source: hidden from the views. */
export const esperaFuente = (est) => est?.origen === 'plataforma' && !est?.fuenteVistaAt;

const ETIQUETAS = {
  slep: 'sostenedor',
  comuna: 'comuna',
  nNinos: 'matrícula',
  rbd: 'RBD',
  cohorte: 'cohorte',
};

/** Human-readable list of what is still missing for an establishment. */
export function datosFaltantes(est) {
  const f = [];
  const vacio = (v) => v == null || v === '';
  if (vacio(est.slep)) f.push(ETIQUETAS.slep);
  if (vacio(est.comuna)) f.push(ETIQUETAS.comuna);
  if (vacio(est.nNinos)) f.push(ETIQUETAS.nNinos);
  if (vacio(est.cohorte)) f.push(ETIQUETAS.cohorte);
  if (est.programa === 'escolar') {
    if (vacio(est.rbd)) f.push(ETIQUETAS.rbd);
    // Only meaningful once the school has been seen in Drive.
    if (est.fuente && !est.fuente.dcId) f.push('planilla Datos Consultor');
    if (est.fuente && !est.fuente.rcId) f.push('planilla Registro Coordinación');
    if (est.sinPlanillasCurso) f.push('planillas por curso');
  }
  return f;
}

/**
 * Compares what a load found in the sources with what is registered.
 * @param descubiertos array of { id, nombre, cohorte }
 * @param existentes   Map<id, doc> of establecimientos_real for this programa
 * @returns {{ nuevos, sinFuente, desaparecidos }} arrays of { id, nombre, cohorte }
 */
export function detectarCambios(descubiertos, existentes) {
  const vistos = new Set(descubiertos.map(d => d.id));
  const corto = (e) => ({ id: e.id, nombre: e.nombre ?? e.id, cohorte: e.cohorte ?? null });
  const nuevos = descubiertos.filter(d => !existentes.has(d.id)).map(corto);
  const sinFuente = [];
  const desaparecidos = [];
  for (const [id, est] of existentes) {
    if (vistos.has(id)) continue;
    (esperaFuente(est) ? sinFuente : desaparecidos).push(corto({ id, ...est }));
  }
  return { nuevos, sinFuente, desaparecidos };
}
