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

/** Format a raw value for display given the indicator's unit. */
export function formatValue(indicador, v) {
  if (indicador.unidad === 'binario') return v ? 'Sí' : 'No';
  if (indicador.unidad === '%') return `${Math.round(v * 100)}%`;
  if (indicador.unidad === 'conteo' || indicador.unidad === 'promedio') {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  return String(v);
}
