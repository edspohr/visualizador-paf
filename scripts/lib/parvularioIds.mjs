// Lógica compartida de IDs Parvulario: extracción tolerante de IDs desde
// headers de las pestañas VISUALIZADOR (JARDÍN / SALAS) y traducción de la
// numeración planilla → catálogo canónico.
//
// Consumida por:
//   - scripts/ingestParvulario.mjs (ingesta real a Firestore)
//   - scripts/mapeoParvulario.mjs  (reporte de cobertura para Focus)
//
// Historia (2026-07-29): con la renumeración canónica del catálogo
// (`scripts/lib/canonicalIds.mjs`), la planilla y el catálogo comparten
// numeración en I.1–I.43 y difieren en un shift de −1 en I.45–I.54.
// Antes de esa fecha, `planillaToCatalog` hacía un shift de −1 en un rango
// y +1 en otro para compensar la diferencia; ahora la traducción es casi
// identidad.
//
// Reglas actuales (verificadas contra las 6 tabs VISUALIZADOR y el orden
// canónico del cliente):
//   planilla I.1  – I.43  → canónico I.1  – I.43   (identidad)
//   planilla I.44         → no existe en las planillas
//   planilla I.45 – I.54  → canónico I.44 – I.53   (shift −1)

// Extrae el ID de indicador del header de una columna, tolerando el typo
// "I.,20" que aparece en las 3 planillas centrales.
export function extractPlanillaId(header) {
  if (typeof header !== 'string') return null;
  const m = header.match(/\bI[\s\.,-]*(\d{1,3})\b/i);
  return m ? `I.${Number(m[1])}` : null;
}

// Traduce un ID de planilla ("I.<n>") al ID equivalente en el catálogo canónico.
// Retorna `null` si el indicador de planilla no existe (planilla I.44).
export function planillaToCanonical(planillaId) {
  if (typeof planillaId !== 'string') return null;
  const m = planillaId.match(/^I\.(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 1 && n <= 43) return `I.${n}`;          // identidad
  if (n === 44) return null;                       // no existe en planillas
  if (n >= 45 && n <= 54) return `I.${n - 1}`;     // shift −1
  return null;
}

