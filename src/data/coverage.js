import MANIFEST from './escolarCoverageManifest.json';

// Build lookup Map<"estId|anio|indicadorId", state> once at module load.
// Keyed by escuela slug (e.g. "esc-villa-san-miguel"), año (2025|2026), and
// canonical indicador ID (e.g. "I.1").
const _lookup = new Map();
// State priority when several cursos report for the same indicator (worst →
// best for display).
const PRIORITY = {
  FUENTE_NO_ACCESIBLE: 7,
  SIN_FUENTE_MAPEADA: 6,
  SIN_DATO_REPORTADO: 5,
  NO_CORRESPONDE_AUN: 4,
  NO_CORRESPONDE: 3,
  CERO_REPORTADO: 2,
  CON_DATO_REPORTADO: 1,
};
// `esc.indicadores` is an array of { anio, indicadorId, curso, estado }; the
// previous Object.entries() loop never matched, so every state fell back to
// "Sin datos" in the UI (X-01).
for (const esc of (MANIFEST.escuelas ?? [])) {
  if (!esc.establecimientoId) continue;
  for (const ind of (esc.indicadores ?? [])) {
    const lookupKey = `${esc.establecimientoId}|${ind.anio}|${ind.indicadorId}`;
    const prev = _lookup.get(lookupKey);
    if (!prev || (PRIORITY[ind.estado] ?? 0) > (PRIORITY[prev] ?? 0)) {
      _lookup.set(lookupKey, ind.estado);
    }
  }
}

/**
 * Returns the coverage state for an Escolar indicator at a given
 * establishment and year. Returns null if not in manifest (Parvulario,
 * or if the manifest has no entry).
 *
 * @param {string} estId   - e.g. "esc-villa-san-miguel"
 * @param {number} anio    - 2025 | 2026
 * @param {string} indId   - canonical indicator ID e.g. "I.1"
 * @returns {string|null}
 */
export function getCoberturaEscolar(estId, anio, indId) {
  return _lookup.get(`${estId}|${anio}|${indId}`) ?? null;
}

export function getCoberturaParvulario() {
  // Parvulario uses Planillas Centrales — SIN_FUENTE_MAPEADA doesn't apply.
  // Fall back to estadoValor from establecimientos.js everywhere.
  return null;
}
