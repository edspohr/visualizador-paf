/**
 * Computes the expected accrued value for an indicator at a given month.
 *
 * Logic by frequency:
 *  - 'mensual':    linear monthly accrual → metaNum × (mes / 12)
 *  - 'trimestral': step by closed quarters → metaNum × (floor(mes / 3) / 4)
 *  - 'semestral':  step by closed semesters → metaNum × (floor(mes / 6) / 2)
 *  - 'anual':      0 until December; full metaNum at December
 *
 * Special case for 'binario': expected = 1 if mes >= 7, else 0.
 * Binary indicators are typically year-end deliverables confirmed at midyear;
 * we use midyear as the threshold so CAP can see whether the commitment exists.
 *
 * Returns the expected numeric value (not normalized to [0,1]).
 */
export function expectedToDate(indicador, mes) {
  const { metaNum, unidad, frecuencia } = indicador;

  if (unidad === 'binario') {
    return mes >= 7 ? 1 : 0;
  }

  switch (frecuencia) {
    case 'mensual':
      return metaNum * (mes / 12);
    case 'trimestral':
      return metaNum * (Math.floor(mes / 3) / 4);
    case 'semestral':
      return metaNum * (Math.floor(mes / 6) / 2);
    case 'anual':
      return mes >= 12 ? metaNum : 0;
    default:
      return metaNum * (mes / 12);
  }
}

/**
 * "Avance esperado a la fecha" (L-02, D-03): automatic, proportional to the
 * school year (March–December). With the current month counted as elapsed,
 * September → 7/10 of the annual meta.
 *
 * Only for cumulative counts (unidad 'conteo': N° de…, instancias/talleres por
 * sala). Percentages (attendance, coverage) and Sí/No indicators have no
 * proportional progress, so they return null. Also null outside the school
 * year's span or when the meta is missing.
 *
 * Rounded down to a whole count (Retro 2, 2026-10-22): an event happens or
 * not, so with 2 territorial meetings a year "1,6 expected" read as a debt
 * while the second one had not taken place. A floor of 0 shows no mark.
 */
export const MES_INICIO_ANIO_ESCOLAR = 3;
export const MES_FIN_ANIO_ESCOLAR = 12;
export function esperadoALaFecha(indicador, mes) {
  if (!indicador || indicador.unidad !== 'conteo') return null;
  const { metaNum } = indicador;
  if (metaNum === null || metaNum === undefined || !(metaNum > 0)) return null;
  const total = MES_FIN_ANIO_ESCOLAR - MES_INICIO_ANIO_ESCOLAR + 1;
  const transcurridos = Math.max(0, Math.min(total, mes - MES_INICIO_ANIO_ESCOLAR + 1));
  if (transcurridos === 0 || transcurridos === total) return null;
  const esperado = Math.floor(metaNum * (transcurridos / total));
  return esperado > 0 ? esperado : null;
}

/** Format a raw value for display given the indicator's unit.
 *
 * Binario:
 *  - Valor exacto 0 o 1 → 'No' / 'Sí' (vista individual del centro).
 *  - Valor fraccional en (0,1) → '% Sí' (agregado, p. ej. ranking a nivel red).
 *
 * Blindaje: si un indicador declarado como '%' recibe un valor > 1.2 (o sea,
 * más de 120%), casi siempre es señal de que la ingesta guardó un conteo
 * absoluto en un campo declarado como fracción. En lugar de mostrar un número
 * absurdo (p. ej. "547%") mostramos "fuera de rango" para que sea evidente
 * que hay que revisar la fuente. El umbral 1.2 es coherente con el clamp de
 * calcularLogro.
 */
const OUT_OF_RANGE = 'fuera de rango';

export function formatValue(indicador, v) {
  if (v === null || v === undefined) return '—';
  if (indicador.unidad === 'binario') {
    if (v === 0 || v === 1) return v ? 'Sí' : 'No';
    if (v < 0 || v > 1) return OUT_OF_RANGE;
    return `${Math.round(v * 100)}% Sí`;
  }
  if (indicador.unidad === '%') {
    if (v < 0 || v > 1.2) return OUT_OF_RANGE;
    return `${Math.round(v * 100)}%`;
  }
  if (indicador.unidad === 'conteo' || indicador.unidad === 'promedio') {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  return String(v);
}
