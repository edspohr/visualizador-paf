// Helpers de dominio puros del programa PAF.
//
// Post eliminación de datos sintéticos: no hay establecimientos hardcoded ni PRNG.
// Todo lo que la UI consume viene de Firestore vía src/data/realQueries.js.
// Este módulo solo aloja utilidades puras usadas transversalmente.

// ─── Cálculo de logro ─────────────────────────────────────────────────────

// Retro-compat: infer tipoMeta from unidad for indicators that lack the field.
function tipoMetaFromUnidad(unidad) {
  switch (unidad) {
    case 'binario':   return 'booleano';
    case '%':         return 'porcentaje';
    case 'conteo':
    case 'promedio':  return 'numero';
    case 'sin_meta':  return 'sin_meta';
    default:          return 'sin_meta';
  }
}

/**
 * Devuelve el ratio de logro de un valor contra su meta.
 *  - `sin_meta` o meta ausente → `null` (excluir de agregados).
 *  - `binario` → devuelve el valor tal cual (0 o 1). Un valor fraccional en [0,1]
 *    (por ejemplo un promedio de "% de Sí" precomputado) se preserva.
 *  - numérico / % → `min(1.2, valor / metaNum)` (permite hasta 120% para
 *    dejar visible la sobre-ejecución).
 *
 * Importante: `valor === undefined` (no llegó el doc de Firestore) se considera
 * "sin dato reportado", NO "sin meta". Los agregados lo tratan como 0 —
 * pero eso se decide en el sitio de agregación (ver src/data/scope.js), no
 * aquí. Este helper devuelve `null` en ese caso para que quien lo consuma
 * distinga el caso "no reportó" del "sin meta".
 */
export function calcularLogro(valor, indicador) {
  const tipoMeta = indicador.tipoMeta ?? tipoMetaFromUnidad(indicador.unidad);
  if (tipoMeta === 'sin_meta' || indicador.metaNum === null || indicador.metaNum === undefined) return null;
  if (valor === null || valor === undefined) return null;
  if (tipoMeta === 'booleano') return valor;
  if (indicador.metaNum === 0) return 0;
  return Math.min(1.2, valor / indicador.metaNum);
}

/**
 * Distingue tres estados de reporte para un indicador:
 *   - 'sin_meta'  : el indicador no tiene meta definida (no es medible).
 *   - 'sin_dato'  : hay meta pero aún no llegó el valor a Firestore.
 *   - 'con_dato'  : hay meta y hay valor.
 *
 * Esta distinción es la que UI mostraba fusionada como "Sin meta definida",
 * confundiendo al usuario cuando en realidad el problema era falta de reporte.
 */
export function estadoValor(valor, indicador) {
  const tipoMeta = indicador.tipoMeta ?? tipoMetaFromUnidad(indicador.unidad);
  if (tipoMeta === 'sin_meta' || indicador.metaNum === null || indicador.metaNum === undefined) return 'sin_meta';
  if (valor === null || valor === undefined) return 'sin_dato';
  return 'con_dato';
}

/**
 * Logro exhibible al usuario. Distinto de `calcularLogro` (que se usa para
 * agregados). Para actividades en año en curso devuelve `null` — la UI debe
 * mostrar "N de M" hacia meta anual en lugar de un % que induzca a error
 * (Sebastián: "salen cumplidos aún cuando no lo están").
 *
 * Reglas:
 *   - `tipo === 'actividad'` y `anio` en curso  → null  (mostrar "N de M")
 *   - `tipo === 'producto'` o año cerrado       → calcularLogro
 *
 * `anioEnCurso` viene del caller (VistaConsultor/Sostenedor/Escuela) que sabe
 * qué año está mirando y si el año calendario aún no cierra.
 */
export function logroVisible(valor, indicador, anioEnCurso = true) {
  if (indicador.tipo === 'actividad' && anioEnCurso) return null;
  return calcularLogro(valor, indicador);
}

// ─── Semáforo (conservado para componentes que aún lo usan) ───────────────

export function colorSemaforo(logro) {
  if (logro === null) return 'gray';
  if (logro < 0.6) return 'red';
  if (logro < 0.85) return 'amber';
  return 'lime';
}

export function labelSemaforo(logro) {
  if (logro === null) return 'Sin meta';
  if (logro < 0.6) return 'Requiere atención';
  if (logro < 0.85) return 'En desarrollo';
  return 'En meta';
}

// ─── Helpers temporales ────────────────────────────────────────────────────

export function currentMonth() {
  return new Date().getMonth() + 1;
}

export function lastClosedMonth() {
  const m = currentMonth();
  return m === 1 ? 12 : m - 1;
}

/**
 * Mes cerrado publicado para la vista Fundación CAP.
 *
 * Regla operativa: el cierre del mes N se publica el día 15 del mes N+1.
 * Ejemplos:
 *   - hoy = 8-jul → todavía se ve el cierre de mayo (junio se libera el 15-jul).
 *   - hoy = 15-jul → ya se ve el cierre de junio.
 *
 * Devuelve `{ mes, anio }` con wrap correcto para enero/febrero.
 */
export function capClosedPeriod(now = new Date()) {
  const day = now.getDate();
  const monthsBack = day >= 15 ? 1 : 2;
  let mes = now.getMonth() + 1 - monthsBack;
  let anio = now.getFullYear();
  while (mes <= 0) { mes += 12; anio -= 1; }
  return { mes, anio };
}

export const MES_ACTUAL = currentMonth();

// ─── Año de implementación ────────────────────────────────────────────────
// Deriva de la cohorte del centro (p. ej. '2025-2027') el número de año 1-based
// que le corresponde en el año calendario dado. Usado por el helper de
// scope para decidir aplicabilidad por cohorte × semestre.

export function anioImplementacion(est, anio = 2026) {
  if (!est?.cohorte) return 1;
  const [startYear, endYear] = est.cohorte.split('-').map(Number);
  const maxYears = endYear - startYear + 1;
  return Math.max(1, Math.min(maxYears, anio - startYear + 1));
}
