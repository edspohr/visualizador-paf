// Establecimientos reales del proyecto PAF 2026
// Escuelas: SLEP Los Parques (cohorte 2025-2027) — son las que tienen URLs verificadas
// Jardines: SLEP Santa Rosa (cohorte 2025-2026), Del Pino y Santa Corina (2026-2027)

export const SLEPS = [
  { id: 'SLEP-LP', nombre: 'SLEP Los Parques',  comuna: 'La Florida / Puente Alto' },
  { id: 'SLEP-SR', nombre: 'SLEP Santa Rosa',   comuna: 'San Miguel / La Cisterna / PAC' },
  { id: 'SLEP-DP', nombre: 'SLEP Del Pino',     comuna: 'San Bernardo / La Pintana' },
  { id: 'SLEP-SC', nombre: 'SLEP Santa Corina', comuna: 'Maipú / Cerrillos' },
];

// Deterministic PRNG (same seed = same data always)
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

// Assign a comuna from the SLEP's "/" list, round-robin by establishment index within its SLEP
function assignComuna(slepId, indexInSlep) {
  const slep = SLEPS.find(s => s.id === slepId);
  if (!slep) return '';
  const comunas = slep.comuna.split(' / ').map(c => c.trim());
  return comunas[indexInSlep % comunas.length];
}

// Deterministic nNinos and nAgentes seeded by establishment id
function syntheticCounts(id, isEscuela) {
  const rng = mulberry32(hashSeed(id, 'counts'));
  if (isEscuela) {
    const nNinos  = Math.round(200 + rng() * 400);  // 200–600
    const nAgentes = Math.round(15 + rng() * 25);    // 15–40
    return { nNinos, nAgentes };
  } else {
    const nNinos  = Math.round(40 + rng() * 80);     // 40–120
    const nAgentes = Math.round(6 + rng() * 9);      // 6–15
    return { nNinos, nAgentes };
  }
}

const CONSULTOR_EMAILS = ['rcontreras@focus.cl', 'pmunoz@focus.cl', 'jsoto@focus.cl'];
function assignConsultorEmail(id) {
  const rng = mulberry32(hashSeed(id, 'email'));
  return CONSULTOR_EMAILS[Math.floor(rng() * CONSULTOR_EMAILS.length)];
}

// Compute 1-based year of implementation (clamped to valid range for that cohorte)
export function anioImplementacion(est, anio = new Date().getFullYear()) {
  const [startYear, endYear] = est.cohorte.split('-').map(Number);
  const maxYears = endYear - startYear + 1;
  return Math.max(1, Math.min(maxYears, anio - startYear + 1));
}

// Build enriched ESCUELAS
const _rawEscuelas = [
  { id: 'ESC-001', nombre: 'Escuela Gil de Castro',  slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-002', nombre: 'Escuela Abate Molina',   slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-003', nombre: 'Escuela Inglaterra',     slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-004', nombre: 'Escuela España',         slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
  { id: 'ESC-005', nombre: 'Escuela Platón',         slep: 'SLEP-LP', cohorte: '2025-2027', tipo: 'Escuela' },
];

// Counts of escuelas per SLEP (for round-robin commune assignment)
const _escBySlep = {};
_rawEscuelas.forEach(e => { _escBySlep[e.slep] = (_escBySlep[e.slep] ?? 0); });

export const ESCUELAS = _rawEscuelas.map((e, globalIdx) => {
  // Index within its SLEP for round-robin
  const idxInSlep = _rawEscuelas.filter((x, i) => x.slep === e.slep && i <= globalIdx).length - 1;
  const { nNinos, nAgentes } = syntheticCounts(e.id, true);
  return {
    ...e,
    comuna: assignComuna(e.slep, idxInSlep),
    nNinos,
    nAgentes,
    consultorEmail: assignConsultorEmail(e.id),
  };
});

// Build enriched JARDINES
// NOTE: Added JAR-014 (SLEP-LP) so that Los Parques has BOTH escuelas AND jardines,
// enabling the sostenedor escuela/jardín toggle demo across all SLEPs.
const _rawJardines = [
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
  // Synthetic: gives Los Parques a jardín so every SLEP has both types
  { id: 'JAR-014', nombre: 'Jardín Los Alamos',         slep: 'SLEP-LP', cohorte: '2025-2026', tipo: 'Jardín' },
];

export const JARDINES = _rawJardines.map((j, globalIdx) => {
  const idxInSlep = _rawJardines.filter((x, i) => x.slep === j.slep && i <= globalIdx).length - 1;
  const { nNinos, nAgentes } = syntheticCounts(j.id, false);
  return {
    ...j,
    comuna: assignComuna(j.slep, idxInSlep),
    nNinos,
    nAgentes,
    consultorEmail: assignConsultorEmail(j.id),
  };
});

// Salas por escuela (PK A/B → 8° A/B = 18 salas potenciales, simplificamos a las habituales)
export const SALAS_ESCUELA = ['PK A', 'PK B', 'K A', 'K B', '1° A', '1° B', '2° A', '2° B', '3° A', '3° B', '4° A', '4° B', '5° A', '5° B', '6° A', '6° B', '7° A', '7° B', '8° A'];

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

// Determinar color del semáforo: <60% rojo, <85% ámbar, >=85% verde
export function colorSemaforo(logro) {
  if (logro === null) return 'gray';
  if (logro < 0.6) return 'red';
  if (logro < 0.85) return 'amber';
  return 'lime';
}

// Etiqueta del semáforo
export function labelSemaforo(logro) {
  if (logro === null) return 'Sin meta';
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
// Indicators with sin_meta / null are excluded from the average
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

// Para timeseries: % logro de un ámbito mes a mes
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

// Promedio del valor RAW de un indicador para establecimientos del mismo territorio y tipo
// "territorio" = mismo slep; "tipo" = mismo est.tipo (Escuela vs Jardín)
export function promedioTerritorioIndicador(indicador, est, mes, anio = 2026) {
  if (indicador.unidad === 'sin_meta' || indicador.metaNum === null) return null;
  const fuente = [...ESCUELAS, ...JARDINES].filter(e => e.slep === est.slep && e.tipo === est.tipo);
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
