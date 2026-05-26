// Establecimientos reales del proyecto PAF 2026
// Escuelas: SLEP Los Parques (cohorte 2025-2027) — son las que tienen URLs verificadas
// Jardines: SLEP Santa Rosa (cohorte 2025-2026), Del Pino y Santa Corina (2026-2027)

export const SLEPS = [
  { id: 'SLEP-LP', nombre: 'SLEP Los Parques',  comuna: 'La Florida / Puente Alto' },
  { id: 'SLEP-SR', nombre: 'SLEP Santa Rosa',   comuna: 'San Miguel / La Cisterna / PAC' },
  { id: 'SLEP-DP', nombre: 'SLEP Del Pino',     comuna: 'San Bernardo / La Pintana' },
  { id: 'SLEP-SC', nombre: 'SLEP Santa Corina', comuna: 'Maipú / Cerrillos' },
];

export const ESCUELAS = [
  { id: 'ESC-001', nombre: 'Escuela Gil de Castro',  slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-002', nombre: 'Escuela Abate Molina',   slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-003', nombre: 'Escuela Inglaterra',     slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-004', nombre: 'Escuela España',         slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-005', nombre: 'Escuela Platón',         slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
];

export const JARDINES = [
  { id: 'JAR-001', nombre: 'Jardín Pequeño Aymará',     slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-002', nombre: 'Jardín Enrique Backausse',  slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-003', nombre: 'Jardín Poetas de Chile',    slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-004', nombre: 'Jardín Ciudad de Barcelona',slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-005', nombre: 'Jardín Ochagavía',          slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-006', nombre: 'Jardín La Marina',          slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-007', nombre: 'Jardín Llano Subercaseaux', slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-008', nombre: 'Jardín Andrés Bello',       slep: 'SLEP-SR', cohorte: '2025-2026', tipo: 'Jardín' },
  { id: 'JAR-009', nombre: 'Jardín Paula Jaraquemada',  slep: 'SLEP-DP', cohorte: '2026-2027', tipo: 'Jardín' },
  { id: 'JAR-010', nombre: 'Jardín Cedin',              slep: 'SLEP-DP', cohorte: '2026-2027', tipo: 'Jardín' },
  { id: 'JAR-011', nombre: 'Jardín Eluney',             slep: 'SLEP-DP', cohorte: '2026-2027', tipo: 'Jardín' },
  { id: 'JAR-012', nombre: 'Jardín Angel Fantuzzi',     slep: 'SLEP-SC', cohorte: '2026-2027', tipo: 'Jardín' },
  { id: 'JAR-013', nombre: 'Jardín El Tranque',         slep: 'SLEP-SC', cohorte: '2026-2027', tipo: 'Jardín' },
];

// Salas por escuela (PK A/B → 8° A/B = 18 salas potenciales, simplificamos a las habituales)
export const SALAS_ESCUELA = ['PK A', 'PK B', 'K A', 'K B', '1° A', '1° B', '2° A', '2° B', '3° A', '3° B', '4° A', '4° B', '5° A', '5° B', '6° A', '6° B', '7° A', '7° B', '8° A'];

// PRNG determinístico simple (mismo seed = mismos datos siempre)
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

// Genera un valor para un indicador dado en un establecimiento y período
// Sesgo: SLEP Los Parques rinde mejor (cohorte más antigua), Santa Rosa intermedio, otros más bajo
function biasBySlep(slep, anio = 2026) {
  const base = ({ 'SLEP-LP': 0.88, 'SLEP-SR': 0.82, 'SLEP-DP': 0.75, 'SLEP-SC': 0.73 })[slep] ?? 0.7;
  return anio === 2025 ? base - 0.10 : base;
}

export function generarValorIndicador(indicador, establecimientoId, slep, mes, anio = 2026) {
  const rng = mulberry32(hashSeed(indicador.id, establecimientoId, mes, anio));
  const base = biasBySlep(slep, anio);
  // Pequeño jitter por establecimiento, tendencia ascendente leve por mes
  const jitter = (rng() - 0.5) * 0.20;
  const monthBoost = (mes / 12) * 0.08;
  const factor = Math.max(0.25, Math.min(1.15, base + jitter + monthBoost));

  let valor;
  if (indicador.unidad === 'binario') {
    valor = rng() < factor ? 1 : 0;
  } else if (indicador.unidad === '%') {
    valor = Math.max(0, Math.min(1, indicador.metaNum * factor));
  } else if (indicador.unidad === 'conteo' || indicador.unidad === 'promedio') {
    // Para conteos mensuales, escalar al avance del año
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
  if (indicador.unidad === 'binario') return valor;
  if (indicador.metaNum === 0) return 0;
  return Math.min(1.2, valor / indicador.metaNum);
}

// Determinar color del semáforo: <60% rojo, <85% ámbar, >=85% verde
export function colorSemaforo(logro) {
  if (logro < 0.6) return 'red';
  if (logro < 0.85) return 'amber';
  return 'lime';
}

// Etiqueta del semáforo
export function labelSemaforo(logro) {
  if (logro < 0.6) return 'Requiere atención';
  if (logro < 0.85) return 'En desarrollo';
  return 'En meta';
}

// Helpers temporales
export function currentMonth() {
  return new Date().getMonth() + 1; // getMonth() is 0-based
}

export function lastClosedMonth() {
  const m = currentMonth();
  return m === 1 ? 12 : m - 1;
}

// Backwards-compat constant
export const MES_ACTUAL = currentMonth();

// Agregado: % logro por ámbito para un establecimiento dado
export function logroPorAmbito(indicadores, establecimientoId, slep, mes = MES_ACTUAL, anio = 2026) {
  const porAmbito = {};
  for (const ind of indicadores) {
    if (!porAmbito[ind.ambito]) porAmbito[ind.ambito] = { suma: 0, n: 0 };
    const { valor } = generarValorIndicador(ind, establecimientoId, slep, mes, anio);
    const logro = calcularLogro(valor, ind);
    porAmbito[ind.ambito].suma += Math.min(1, logro);
    porAmbito[ind.ambito].n += 1;
  }
  return Object.fromEntries(
    Object.entries(porAmbito).map(([k, v]) => [k, v.n ? v.suma / v.n : 0])
  );
}

// Para timeseries: % logro de un ámbito mes a mes
export function evolucionAmbito(indicadores, establecimientoId, slep, ambitoId, mesHasta = MES_ACTUAL, anio = 2026) {
  const data = [];
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const indsAmbito = indicadores.filter(i => i.ambito === ambitoId);
  for (let m = 1; m <= mesHasta; m++) {
    let suma = 0, n = 0;
    for (const ind of indsAmbito) {
      const { valor } = generarValorIndicador(ind, establecimientoId, slep, m, anio);
      suma += Math.min(1, calcularLogro(valor, ind));
      n += 1;
    }
    data.push({ mes: meses[m - 1], logro: Math.round((n ? suma / n : 0) * 100) });
  }
  return data;
}

// Promedio SLEP para un ámbito (para comparativa)
export function promedioSlepAmbito(indicadores, establecimientos, slepId, ambitoId, mes = MES_ACTUAL, anio = 2026) {
  const filtrados = establecimientos.filter(e => e.slep === slepId);
  if (!filtrados.length) return 0;
  let suma = 0, n = 0;
  for (const est of filtrados) {
    const indsAmbito = indicadores.filter(i => i.ambito === ambitoId);
    for (const ind of indsAmbito) {
      const { valor } = generarValorIndicador(ind, est.id, est.slep, mes, anio);
      suma += Math.min(1, calcularLogro(valor, ind));
      n += 1;
    }
  }
  return n ? suma / n : 0;
}
