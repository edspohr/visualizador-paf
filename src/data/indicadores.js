// Placeholder post Fase A.
//
// Antes este archivo contenía los arrays INDICADORES_ESCOLAR (52), INDICADORES_PARVULARIO (54),
// AMBITOS_ESCOLAR y AMBITOS_PARVULARIO como constantes JS.
//
// Post Fase A esos datos viven en Firestore:
//   /indicadores/{programa}_{id}  → useIndicadores(programa) en src/lib/queries.js
//   /ambitos/{programa}_{id}      → useAmbitos(programa) en src/lib/queries.js
//
// El script scripts/seed.mjs importa este archivo, así que lo mantenemos como
// export vacío para no romper el import histórico. Si alguna vez se reseedea
// hay que restaurar los arrays temporalmente.

export const INDICADORES_ESCOLAR = [];
export const INDICADORES_PARVULARIO = [];
export const AMBITOS_ESCOLAR = [];
export const AMBITOS_PARVULARIO = [];

// Acceso por perfil (metadata útil, no dependiente de arrays)
export const ACCESO_PERFIL = {
  escuela:    { nivel: 'Centro', label: 'Escuela / Jardín' },
  sostenedor: { nivel: 'SLEP',   label: 'Sostenedor' },
  consultor:  { nivel: 'Total',  label: 'Consultor / Coordinación / CAP' },
};
