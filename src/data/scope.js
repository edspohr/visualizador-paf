// Universo esperado 2026 — quién aplica y cómo se calcula el cumplimiento.
//
// Decisión con el cliente:
//   - Base de análisis: siempre 2026. 2025 es solo referencia comparativa.
//   - Faltantes en 2026 sobre indicadores aplicables → cuentan 0 en agregados.
//   - Semestres/años futuros que un centro aún no ha ejecutado → NO forman parte
//     del universo (ni cuentan, ni se muestran).
//
// La aplicabilidad se decide con `indicador.inicio` (Sem N o "Primer/Segundo año")
// contra el semestre acumulado del centro en 2026 (derivado de su cohorte).

import { anioImplementacion, resolverIndicador } from './establecimientos.js';

// Semestre calendario 2026: mes ≤ 6 → 1, else → 2.
export function semestreDeMes(mes) {
  return mes <= 6 ? 1 : 2;
}

// Semestre acumulado en la trayectoria del centro para 2026, dado el mes en curso.
// Cohorte de 2 años (p. ej. '2025-2026') en 2026 → año 2; sem acumulado = 3 o 4.
// Cohorte que empieza en 2026 → año 1; sem acumulado = 1 o 2.
export function semestreAcumulado2026(est, mes) {
  const anio = anioImplementacion(est, 2026);
  return (anio - 1) * 2 + semestreDeMes(mes);
}

// Parsea `indicador.inicio` a semestre mínimo requerido en la trayectoria del centro.
// Valores conocidos en catalog.json: null, 'Primer año'/'Primero año',
// 'Segundo año', 'Sem 1..4'. Todo lo demás → aplica desde el inicio (Sem 1).
function semestreMinimoRequerido(inicio) {
  if (!inicio || typeof inicio !== 'string') return 1;
  const t = inicio.trim();
  const semMatch = t.match(/^Sem\s+([1-4])$/i);
  if (semMatch) return Number(semMatch[1]);
  if (/^Primer[oa]?\s+a[nñ]o$/i.test(t)) return 1;
  if (/^Segundo\s+a[nñ]o$/i.test(t)) return 3; // Sem 1 del año 2 en la trayectoria
  return 1;
}

/**
 * ¿Este indicador aplica al centro en el mes dado dentro de la gestión 2026?
 * True si el semestre mínimo requerido ≤ semestre acumulado del centro.
 */
// `indicador.vigencia` lists the years of implementation the indicator belongs
// to (e.g. [1] for año 1 only). Missing → every year.
function vigenteEnAnio(indicador, est) {
  if (!Array.isArray(indicador.vigencia) || !indicador.vigencia.length) return true;
  return indicador.vigencia.includes(anioImplementacion(est, 2026));
}

export function isAplicable2026(indicador, est, mes) {
  if (!est) return false;
  if (!vigenteEnAnio(indicador, est)) return false;
  const min = semestreMinimoRequerido(indicador.inicio);
  return min <= semestreAcumulado2026(est, mes);
}

/**
 * Filtra la lista de indicadores a los aplicables para el centro en el mes dado
 * dentro de 2026. NO excluye `sin_meta`: eso lo decide el agregador.
 */
export function indicadoresAplicables(indicadores, est, mes) {
  return indicadores
    .filter(ind => isAplicable2026(ind, est, mes))
    .map(ind => resolverIndicador(ind, est));
}

/**
 * Estado de aplicabilidad para propósitos de UI:
 *   'aplicable'          — el semestre mínimo requerido ya se alcanzó.
 *   'no-corresponde-anio'— el indicador no forma parte del año de
 *                          implementación del centro (`indicador.vigencia`),
 *                          p. ej. metas de año 1 vistas por un centro en año 2.
 *   'no-aplicable-aun'   — el indicador existe en el catálogo pero su semestre
 *                          de inicio aún no fue alcanzado por este centro (por
 *                          ejemplo `inicio: 'Sem 3'` con cohorte 2026-2027 en
 *                          año 1). No entra en agregados, pero se muestra con
 *                          una nota para que el usuario no lo interprete como
 *                          "sin datos".
 *
 * Devuelve también el semestre mínimo requerido y el semestre acumulado del
 * centro, para que la capa de UI pueda construir un mensaje específico
 * ("aplica desde año 2", "aplica desde el semestre 3", etc.).
 */
export function estadoAplicabilidad(indicador, est, mes) {
  if (!est) {
    return { estado: 'aplicable', minReq: 1, acumulado: 4 };
  }
  const minReq = semestreMinimoRequerido(indicador.inicio);
  const acumulado = semestreAcumulado2026(est, mes);
  if (!vigenteEnAnio(indicador, est)) {
    return { estado: 'no-corresponde-anio', minReq, acumulado };
  }
  return {
    estado: minReq <= acumulado ? 'aplicable' : 'no-aplicable-aun',
    minReq,
    acumulado,
  };
}

/**
 * Copy en es-CL para explicar por qué un indicador aún no aplica. Se apoya en
 * el `inicio` original para dar un mensaje cercano al lenguaje del catálogo.
 */
export function descripcionNoAplicable(indicador, est) {
  if (est && !vigenteEnAnio(indicador, est)) {
    const anios = indicador.vigencia;
    if (anios.length === 1) return `Corresponde solo al año ${anios[0]} de implementación del programa.`;
    return 'No corresponde al año de implementación actual de este centro.';
  }
  const inicio = indicador.inicio;
  if (typeof inicio === 'string') {
    const t = inicio.trim();
    if (/^Sem\s+([2-4])$/i.test(t)) {
      const n = t.match(/([2-4])/)[1];
      return `Aplica desde el semestre ${n} de la implementación del programa.`;
    }
    if (/^Segundo\s+a[nñ]o$/i.test(t)) {
      return 'Aplica desde el segundo año de implementación del programa.';
    }
  }
  return 'Aplica en una etapa posterior de la implementación del programa.';
}

// ─── Cumplimiento 2026 ────────────────────────────────────────────────────

import { calcularLogro } from './establecimientos.js';

/**
 * % de cumplimiento sobre un conjunto de indicadores aplicables 2026:
 *   AVG(min(1, calcularLogro(valor, ind))) donde:
 *     - `sin_meta` se excluye del universo.
 *     - valor ausente (undefined | null) para un indicador aplicable cuenta como 0.
 *
 * `valoresMap` es un Map<indicadorId, valorNumerico> o Map<indicadorId, { valor, ... }>.
 * Ambas formas se aceptan.
 */
export function cumplimientoIndicadores(indicadores, valoresMap) {
  const aplicables = indicadores.filter(i => (i.tipoMeta ?? unidadATipoMeta(i.unidad)) !== 'sin_meta' && i.metaNum !== null);
  if (!aplicables.length) return 0;
  let suma = 0;
  let n = 0;
  for (const ind of aplicables) {
    const entry = valoresMap?.get(ind.id);
    const valor = entry && typeof entry === 'object' ? entry.valor : entry;
    const logro = calcularLogro(valor, ind);
    // Faltante o no reportado → cuenta 0 en el universo esperado.
    const contribucion = logro === null ? 0 : Math.min(1, logro);
    suma += contribucion;
    n += 1;
  }
  return n ? suma / n : 0;
}

function unidadATipoMeta(unidad) {
  switch (unidad) {
    case 'binario':  return 'booleano';
    case '%':        return 'porcentaje';
    case 'conteo':
    case 'promedio': return 'numero';
    default:         return 'sin_meta';
  }
}
