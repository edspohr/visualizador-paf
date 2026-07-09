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

import { anioImplementacion } from './establecimientos.js';

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
export function isAplicable2026(indicador, est, mes) {
  if (!est) return false;
  const min = semestreMinimoRequerido(indicador.inicio);
  return min <= semestreAcumulado2026(est, mes);
}

/**
 * Filtra la lista de indicadores a los aplicables para el centro en el mes dado
 * dentro de 2026. NO excluye `sin_meta`: eso lo decide el agregador.
 */
export function indicadoresAplicables(indicadores, est, mes) {
  return indicadores.filter(ind => isAplicable2026(ind, est, mes));
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
