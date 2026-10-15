// Lógica compartida de IDs Parvulario: extracción tolerante de IDs desde
// headers de las pestañas VISUALIZADOR (JARDÍN / SALAS) y traducción de la
// numeración planilla → catálogo canónico.
//
// Consumida por:
//   - scripts/ingestParvulario.mjs (ingesta real a Firestore)
//   - scripts/mapeoParvulario.mjs  (reporte de cobertura para Focus)
//
// Historia:
//   2026-07-29 — con la renumeración canónica del catálogo, la planilla y el
//   catálogo compartían numeración en I.1–I.43 y la planilla saltaba el I.44,
//   así que I.45–I.54 se traducían con un shift de −1.
//   2026-10-15 — Focus renumeró las tres planillas centrales a la numeración
//   canónica (I.44 "% de apoderados entrevistados por sala en una ocasión" …
//   I.53 "% de familias que completan ciclo"). El shift heredado corría
//   I.44–I.53 en un indicador (el valor de I.45 se guardaba como I.44, etc.) y
//   dejaba I.53 sin cargar. Verificado contra las tres centrales (2025 y 2026)
//   y Firestore con Caballito Feliz; ver docs/tech-debt.md y la planilla de
//   seguimiento Retro 1 ("Casos para validar", filas 20–27).
//
// Regla actual: planilla I.n → canónico I.n para n en 1..53. Cualquier otro
// id devuelve null y la ingesta lo reporta como columna no reconocida.

export const PARVULARIO_MAX_ID = 53;

// Extrae el ID de indicador del header de una columna, tolerando el typo
// "I.,20" que aparece en las 3 planillas centrales y "I.46%" sin espacio.
export function extractPlanillaId(header) {
  if (typeof header !== 'string') return null;
  const m = header.match(/\bI[\s\.,-]*(\d{1,3})\b/i);
  return m ? `I.${Number(m[1])}` : null;
}

// Traduce un ID de planilla ("I.<n>") al ID equivalente en el catálogo canónico.
// Hoy es la identidad para I.1–I.53; retorna `null` fuera de ese rango.
export function planillaToCanonical(planillaId) {
  if (typeof planillaId !== 'string') return null;
  const m = planillaId.match(/^I\.(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= PARVULARIO_MAX_ID ? `I.${n}` : null;
}
