// Lógica compartida de IDs Parvulario: extracción tolerante de IDs desde headers
// de las pestañas VISUALIZADOR (JARDÍN / SALAS) y traducción de la numeración
// planilla → catálogo.
//
// Consumida por:
//   - scripts/ingestParvulario.mjs (ingesta real a Firestore)
//   - scripts/mapeoParvulario.mjs  (reporte de cobertura para Focus)
//
// Origen: la refactorización 21-jul-2026 extrajo estas dos funciones desde
// ingestParvulario.mjs para que ambos scripts razonen en el mismo espacio
// (coordenadas de catálogo). El bug histórico era que `mapeoParvulario` usaba
// una regex propia y comparaba los IDs planilla directo contra el catálogo,
// produciendo faltantes/huérfanos/desagregaNivel incorrectos.
//
// Reglas de la traducción (verificadas contra las 6 tabs VISUALIZADOR):
//   planilla I.1  (N° visitas al jardín) → NO existe en catálogo (huérfano)
//   planilla I.2..I.22 → catálogo I.1..I.21    (shift −1)
//   planilla I.23..I.43 → catálogo I.24..I.44  (shift +1; catálogo I.22/I.23 sin fuente)
//   planilla I.44 → NO EXISTE (saltada en las planillas)
//   planilla I.45..I.54 → catálogo I.45..I.54  (identidad)

// Extrae el ID de indicador del header de una columna, tolerando el typo
// "I.,20" que aparece en las 3 planillas centrales.
export function extractPlanillaId(header) {
  if (typeof header !== 'string') return null;
  const m = header.match(/\bI[\s\.,-]*(\d{1,3})\b/i);
  return m ? `I.${Number(m[1])}` : null;
}

// Traduce un ID de planilla ("I.<n>") al ID equivalente en el catálogo.
// Retorna `null` si el indicador de planilla no tiene equivalente en catálogo.
export function planillaToCatalog(planillaId) {
  if (typeof planillaId !== 'string') return null;
  const m = planillaId.match(/^I\.(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 1) return null;                        // "N° visitas" — no está en catálogo
  if (n >= 2 && n <= 22) return `I.${n - 1}`;      // shift −1
  if (n >= 23 && n <= 43) return `I.${n + 1}`;     // shift +1
  if (n === 44) return null;                       // no existe
  if (n >= 45 && n <= 54) return `I.${n}`;         // identidad
  return null;
}
