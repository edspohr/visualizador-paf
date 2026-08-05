import MANIFEST from './escolarCoverageManifest.json';

// Build lookup Map<"estId|anio|indicadorId", state> once at module load.
// Keyed by escuela slug (e.g. "esc-villa-san-miguel"), año (2025|2026), and
// canonical indicador ID (e.g. "I.1").
const _lookup = new Map();
for (const esc of (MANIFEST.escuelas ?? [])) {
  for (const [key, ind] of Object.entries(esc.indicadores ?? {})) {
    // key format is "estId|anio|indicadorId" or "estId|anio|indicadorId|curso"
    // We store by the triple (estId, anio, indicadorId), ignoring curso —
    // the cobertura state per-indicator is aggregated at panel level.
    const parts = key.split('|');
    const lookupKey = `${parts[0]}|${parts[1]}|${parts[2]}`;
    // If multiple curso entries exist, prefer the worst state (most informative).
    const prev = _lookup.get(lookupKey);
    if (!prev) {
      _lookup.set(lookupKey, ind.estado);
    } else {
      // State priority (worst → best for display):
      // FUENTE_NO_ACCESIBLE > SIN_FUENTE_MAPEADA > SIN_DATO_REPORTADO >
      // NO_CORRESPONDE_AUN > NO_CORRESPONDE > CERO_REPORTADO > CON_DATO_REPORTADO
      const priority = {
        FUENTE_NO_ACCESIBLE: 7,
        SIN_FUENTE_MAPEADA: 6,
        SIN_DATO_REPORTADO: 5,
        NO_CORRESPONDE_AUN: 4,
        NO_CORRESPONDE: 3,
        CERO_REPORTADO: 2,
        CON_DATO_REPORTADO: 1,
      };
      if ((priority[ind.estado] ?? 0) > (priority[prev] ?? 0)) {
        _lookup.set(lookupKey, ind.estado);
      }
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
