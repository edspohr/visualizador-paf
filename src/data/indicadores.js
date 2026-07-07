// Catálogo canónico de indicadores PAF.
// FUENTE ÚNICA: src/data/catalog.json, generado por scripts/parseCatalogs.mjs
// desde los dos Excel maestros bajo src/data/catalogs/.
//
// Regenerar el catálogo:  node scripts/parseCatalogs.mjs
//
// Este módulo re-exporta el catálogo con las mismas firmas que usaba el resto
// de la app (AMBITOS_ESCOLAR, INDICADORES_ESCOLAR, etc.) para que ninguna vista
// tenga que cambiar. INDICADORES_ESCOLAR expone el framework 2026 (52 items),
// que es el que se muestra por defecto. Para acceso al framework 2025 anterior
// se exporta INDICADORES_ESCOLAR_2025.

import catalog from './catalog.json';

export const AMBITOS_ESCOLAR    = catalog.ambitos.escolar;
export const AMBITOS_PARVULARIO = catalog.ambitos.parvulario;

// Escolar: por defecto el framework 2026 (52 indicadores del año actual).
export const INDICADORES_ESCOLAR      = catalog.indicadores.escolar2026;
export const INDICADORES_ESCOLAR_2025 = catalog.indicadores.escolar2025;
export const INDICADORES_ESCOLAR_2026 = catalog.indicadores.escolar2026;

// Parvulario: catálogo único (54 indicadores)
export const INDICADORES_PARVULARIO = catalog.indicadores.parvulario;

// Selector por (programa, año calendario). Escolar cambia de framework entre
// 2025 y 2026; parvulario es único.
export function catalogoPorAnio(programa, anio) {
  if (programa === 'parvulario') return INDICADORES_PARVULARIO;
  return anio === 2025 ? INDICADORES_ESCOLAR_2025 : INDICADORES_ESCOLAR_2026;
}

export const ACCESO_PERFIL = {
  escuela:    { nivel: 'Centro', label: 'Escuela / Jardín' },
  sostenedor: { nivel: 'SLEP',   label: 'Sostenedor' },
  consultor:  { nivel: 'Total',  label: 'Consultor / Coordinación / CAP' },
};

// Metadata útil para pantallas de "acerca de los datos"
export const CATALOG_METADATA = {
  generatedAt: catalog.generatedAt,
  source:      catalog.source,
  totals:      catalog.totals,
};
