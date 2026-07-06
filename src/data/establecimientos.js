// Helpers de dominio del programa PAF.
// Antes este archivo contenía todos los arrays (SLEPS, ESCUELAS, JARDINES, INDICADORES...).
// Post Fase A esos datos viven en Firestore y se leen con los hooks de src/lib/queries.js.
// Este archivo mantiene solo:
//   - Funciones puras (no dependen de datos): generarValorIndicador, calcularLogro, semáforos, currentMonth/lastClosedMonth.
//   - Helpers de agregación que ahora reciben los datos (establecimientos, indicadores) como parámetro.
//   - anioImplementacion (helper puro sobre un establecimiento).

// ─── Deterministic PRNG ────────────────────────────────────────────────────
// Se usa para generar valores sintéticos por indicador (Fase B lo reemplaza por
// lecturas de la colección /valores en Firestore).

function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const p of parts.join('|')) {
    h ^= p.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Sesgo por SLEP para dar variabilidad narrativa entre sostenedores.
// TODO Fase B: eliminar cuando los valores vengan de /valores en Firestore.
function biasBySlep(slep, anio = 2026) {
  const base = ({ 'SLEP-LP': 0.88, 'SLEP-SR': 0.82, 'SLEP-DP': 0.75, 'SLEP-SC': 0.73 })[slep] ?? 0.7;
  return anio === 2025 ? base - 0.10 : base;
}

// ─── Generación de valores por indicador (sintética por ahora) ────────────

export function generarValorIndicador(indicador, establecimientoId, slep, mes, anio = 2026) {
  const rng = mulberry32(hashSeed(indicador.id, establecimientoId, mes, anio));
  const base = biasBySlep(slep, anio);
  const jitter = (rng() - 0.5) * 0.20;
  const monthBoost = (mes / 12) * 0.08;
  const factor = Math.max(0.25, Math.min(1.15, base + jitter + monthBoost));

  if (indicador.metaNum === null || indicador.unidad === 'sin_meta') {
    return { valor: null, factor };
  }

  let valor;
  if (indicador.unidad === 'binario') {
    valor = rng() < factor ? 1 : 0;
  } else if (indicador.unidad === '%') {
    valor = Math.max(0, Math.min(1, indicador.metaNum * factor));
  } else if (indicador.unidad === 'conteo' || indicador.unidad === 'promedio') {
    const esperado = indicador.frecuencia === 'mensual'
      ? (indicador.metaNum * (mes / 12))
      : indicador.metaNum;
    valor = Math.max(0, Math.round(esperado * factor * 10) / 10);
  } else {
    valor = indicador.metaNum * factor;
  }
  return { valor, factor };
}

// Calcular % de logro de un indicador (valor / meta) clamped a [0, 1.2]
export function calcularLogro(valor, indicador) {
  if (indicador.unidad === 'sin_meta' || indicador.metaNum === null || valor === null) return null;
  if (indicador.unidad === 'binario') return valor;
  if (indicador.metaNum === 0) return 0;
  return Math.min(1.2, valor / indicador.metaNum);
}

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
  return new Date().getMonth() + 1; // getMonth() is 0-based
}

export function lastClosedMonth() {
  const m = currentMonth();
  return m === 1 ? 12 : m - 1;
}

// Backwards-compat constant. Se mantiene por ser usada en múltiples defaults.
export const MES_ACTUAL = currentMonth();

// ─── Año de implementación ────────────────────────────────────────────────

// Compute 1-based year of implementation clamped al rango de la cohorte
export function anioImplementacion(est, anio = new Date().getFullYear()) {
  if (!est?.cohorte) return 1;
  const [startYear, endYear] = est.cohorte.split('-').map(Number);
  const maxYears = endYear - startYear + 1;
  return Math.max(1, Math.min(maxYears, anio - startYear + 1));
}

// ─── Agregadores (reciben datos por parámetro) ────────────────────────────

// % logro por ámbito para un establecimiento dado
export function logroPorAmbito(indicadores, establecimientoId, slep, mes = MES_ACTUAL, anio = 2026) {
  const porAmbito = {};
  for (const ind of indicadores) {
    if (!porAmbito[ind.ambito]) porAmbito[ind.ambito] = { suma: 0, n: 0 };
    if (ind.unidad === 'sin_meta' || ind.metaNum === null) continue;
    const { valor } = generarValorIndicador(ind, establecimientoId, slep, mes, anio);
    const logro = calcularLogro(valor, ind);
    if (logro === null) continue;
    porAmbito[ind.ambito].suma += Math.min(1, logro);
    porAmbito[ind.ambito].n += 1;
  }
  return Object.fromEntries(
    Object.entries(porAmbito).map(([k, v]) => [k, v.n ? v.suma / v.n : 0])
  );
}

// Timeseries: % logro de un ámbito mes a mes
export function evolucionAmbito(indicadores, establecimientoId, slep, ambitoId, mesHasta = MES_ACTUAL, anio = 2026) {
  const data = [];
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const indsAmbito = indicadores.filter(i => i.ambito === ambitoId && i.unidad !== 'sin_meta' && i.metaNum !== null);
  for (let m = 1; m <= mesHasta; m++) {
    let suma = 0, n = 0;
    for (const ind of indsAmbito) {
      const { valor } = generarValorIndicador(ind, establecimientoId, slep, m, anio);
      const logro = calcularLogro(valor, ind);
      if (logro === null) continue;
      suma += Math.min(1, logro);
      n += 1;
    }
    data.push({ mes: meses[m - 1], logro: Math.round((n ? suma / n : 0) * 100) });
  }
  return data;
}

// Promedio del valor RAW de un indicador para establecimientos del mismo territorio y tipo.
// AHORA recibe la lista completa de establecimientos por parámetro.
// "territorio" = mismo slep; "tipo" = mismo est.tipo (Escuela vs Jardín)
export function promedioTerritorioIndicador(indicador, est, todosEstablecimientos, mes, anio = 2026) {
  if (indicador.unidad === 'sin_meta' || indicador.metaNum === null) return null;
  const fuente = todosEstablecimientos.filter(e => e.slep === est.slep && e.tipo === est.tipo);
  if (!fuente.length) return null;
  let suma = 0, n = 0;
  for (const e of fuente) {
    const { valor } = generarValorIndicador(indicador, e.id, e.slep, mes, anio);
    if (valor !== null) { suma += valor; n++; }
  }
  return n ? suma / n : null;
}

// Promedio SLEP para un ámbito (para comparativa)
export function promedioSlepAmbito(indicadores, establecimientos, slepId, ambitoId, mes = MES_ACTUAL, anio = 2026) {
  const filtrados = establecimientos.filter(e => e.slep === slepId);
  if (!filtrados.length) return 0;
  let suma = 0, n = 0;
  for (const est of filtrados) {
    const indsAmbito = indicadores.filter(i => i.ambito === ambitoId && i.unidad !== 'sin_meta' && i.metaNum !== null);
    for (const ind of indsAmbito) {
      const { valor } = generarValorIndicador(ind, est.id, est.slep, mes, anio);
      const logro = calcularLogro(valor, ind);
      if (logro === null) continue;
      suma += Math.min(1, logro);
      n += 1;
    }
  }
  return n ? suma / n : 0;
}
