// Helpers de dominio del programa PAF.
// Post migración a datos sintéticos locales este archivo contiene:
//   - Arrays completos de SLEPs, ESCUELAS y JARDINES (18 + 24 = 42 establecimientos)
//   - Funciones puras: generarValorIndicador, calcularLogro, semáforos, currentMonth/lastClosedMonth
//   - Helpers de agregación que reciben los datos como parámetro

// ─── Deterministic PRNG ────────────────────────────────────────────────────

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

function syntheticCounts(id, isEscuela) {
  const rng = mulberry32(hashSeed(id, 'counts'));
  if (isEscuela) {
    return { nNinos: Math.round(200 + rng() * 400), nAgentes: Math.round(15 + rng() * 25) };
  }
  return { nNinos: Math.round(40 + rng() * 80), nAgentes: Math.round(6 + rng() * 9) };
}

const CONSULTOR_EMAILS = ['rcontreras@focus.cl', 'pmunoz@focus.cl', 'jsoto@focus.cl'];
function assignConsultorEmail(id) {
  const rng = mulberry32(hashSeed(id, 'email'));
  return CONSULTOR_EMAILS[Math.floor(rng() * CONSULTOR_EMAILS.length)];
}

// ─── SLEPs ────────────────────────────────────────────────────────────────

export const SLEPS = [
  { id: 'SLEP-LP', nombre: 'SLEP Los Parques',  comuna: 'Quinta Normal' },
  { id: 'SLEP-SR', nombre: 'SLEP Santa Rosa',   comuna: 'La Cisterna / Lo Espejo / Pedro Aguirre Cerda / San Miguel / San Ramón' },
  { id: 'SLEP-DP', nombre: 'SLEP Del Pino',     comuna: 'El Bosque / La Pintana / San Bernardo' },
  { id: 'SLEP-SC', nombre: 'SLEP Santa Corina', comuna: 'Cerrillos / Estación Central / Maipú' },
];

// ─── ESCUELAS (18 total) ──────────────────────────────────────────────────
// 5 Los Parques (2025-2027) + 9 Santa Rosa (2026-2028) + 4 Santa Corina (2026-2028)

const _rawEscuelas = [
  // ── Los Parques · Cohorte 2025-2027 · Quinta Normal ──
  { id: 'ESC-001', nombre: 'Escuela Gil de Castro',              slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',       tipo: 'Escuela' },
  { id: 'ESC-002', nombre: 'Escuela Abate Molina',               slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',       tipo: 'Escuela' },
  { id: 'ESC-003', nombre: 'Escuela Inglaterra',                 slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',       tipo: 'Escuela' },
  { id: 'ESC-004', nombre: 'Escuela España',                     slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',       tipo: 'Escuela' },
  { id: 'ESC-005', nombre: 'Escuela Platón',                     slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',       tipo: 'Escuela' },
  // ── Santa Rosa · Cohorte 2026-2028 ──
  { id: 'ESC-006', nombre: 'Escuela Esperanza Joven',            slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'La Cisterna',          tipo: 'Escuela' },
  { id: 'ESC-007', nombre: 'Escuela República de las Filipinas', slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Lo Espejo',            tipo: 'Escuela' },
  { id: 'ESC-008', nombre: 'Escuela Ciudad de Barcelona',        slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda',  tipo: 'Escuela' },
  { id: 'ESC-009', nombre: 'Escuela Ricardo Latcham',            slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda',  tipo: 'Escuela' },
  { id: 'ESC-010', nombre: 'Escuela La Victoria',                slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda',  tipo: 'Escuela' },
  { id: 'ESC-011', nombre: 'Escuela Lo Valledor',                slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda',  tipo: 'Escuela' },
  { id: 'ESC-012', nombre: 'Escuela Territorio Antártico',       slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Miguel',           tipo: 'Escuela' },
  { id: 'ESC-013', nombre: 'Escuela Villa San Miguel',           slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Miguel',           tipo: 'Escuela' },
  { id: 'ESC-014', nombre: 'Escuela Básica Sendero del Saber',   slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Ramón',            tipo: 'Escuela' },
  // ── Santa Corina · Cohorte 2026-2028 ──
  { id: 'ESC-015', nombre: 'Escuela Pedro Aguirre Cerda',        slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Cerrillos',            tipo: 'Escuela' },
  { id: 'ESC-016', nombre: 'Escuela República de Austria',       slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Estación Central',     tipo: 'Escuela' },
  { id: 'ESC-017', nombre: 'Escuela Ramón del Río',              slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Estación Central',     tipo: 'Escuela' },
  { id: 'ESC-018', nombre: 'Escuela Ramón Freire',               slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Maipú',                tipo: 'Escuela' },
];

export const ESCUELAS = _rawEscuelas.map(e => ({
  ...e,
  ...syntheticCounts(e.id, true),
  consultorEmail: assignConsultorEmail(e.id),
}));

// ─── JARDINES (24 total) ──────────────────────────────────────────────────
// 15 Santa Rosa (2025-2026) + 5 Del Pino (2026-2027) + 4 Santa Corina (2026-2027)

const _rawJardines = [
  // ── Santa Rosa · Cohorte 2025-2026 · Pedro Aguirre Cerda ──
  { id: 'JAR-001', nombre: 'Jardín Pequeño Aymará',      slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-002', nombre: 'Jardín Enrique Backausse',   slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-003', nombre: 'Jardín Poetas de Chile',     slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-004', nombre: 'Jardín Ciudad de Barcelona', slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-005', nombre: 'Jardín Ochagavía',           slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-006', nombre: 'Jardín La Marina',           slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  { id: 'JAR-007', nombre: 'Jardín Llano Subercaseaux',  slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín' },
  // ── Santa Rosa · Cohorte 2025-2026 · San Miguel ──
  { id: 'JAR-008', nombre: 'Jardín Villa San Miguel',    slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín' },
  { id: 'JAR-009', nombre: 'Jardín Andrés Bello',        slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín' },
  { id: 'JAR-010', nombre: 'Jardín Santa Fe',            slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín' },
  { id: 'JAR-011', nombre: 'Jardín Akun Pichiwentxu',    slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín' },
  // ── Santa Rosa · Cohorte 2025-2026 · San Ramón ──
  { id: 'JAR-012', nombre: 'Jardín La Hormiguita',       slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín' },
  { id: 'JAR-013', nombre: 'Jardín Caballito Feliz',     slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín' },
  { id: 'JAR-014', nombre: 'Jardín Príncipes del Reino', slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín' },
  { id: 'JAR-015', nombre: 'Jardín Modelo',              slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín' },
  // ── Del Pino · Cohorte 2026-2027 ──
  { id: 'JAR-016', nombre: 'Jardín Paula Jaraquemada',   slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'El Bosque',           tipo: 'Jardín' },
  { id: 'JAR-017', nombre: 'Jardín Cedin',               slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'La Pintana',          tipo: 'Jardín' },
  { id: 'JAR-018', nombre: 'Jardín Eluney',              slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín' },
  { id: 'JAR-019', nombre: 'Jardín Sueño de Colores',    slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín' },
  { id: 'JAR-020', nombre: 'Jardín Tierra de Ángeles',   slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín' },
  // ── Santa Corina · Cohorte 2026-2027 ──
  { id: 'JAR-021', nombre: 'Jardín Angel Fantuzzi',      slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Cerrillos',           tipo: 'Jardín' },
  { id: 'JAR-022', nombre: 'Jardín Salomón Sack',        slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Cerrillos',           tipo: 'Jardín' },
  { id: 'JAR-023', nombre: 'Jardín Estación Alegría',    slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Estación Central',    tipo: 'Jardín' },
  { id: 'JAR-024', nombre: 'Jardín El Tranque',          slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Maipú',               tipo: 'Jardín' },
];

export const JARDINES = _rawJardines.map(j => ({
  ...j,
  ...syntheticCounts(j.id, false),
  consultorEmail: assignConsultorEmail(j.id),
}));

// ─── Sesgo por SLEP ────────────────────────────────────────────────────────

function biasBySlep(slep, anio = 2026) {
  const base = ({ 'SLEP-LP': 0.88, 'SLEP-SR': 0.82, 'SLEP-DP': 0.75, 'SLEP-SC': 0.73 })[slep] ?? 0.7;
  return anio === 2025 ? base - 0.10 : base;
}

// ─── Generación de valores por indicador (sintética) ─────────────────────

export function generarValorIndicador(indicador, establecimientoId, slep, mes, anio = 2026) {
  const rng = mulberry32(hashSeed(indicador.id, establecimientoId, mes, anio));
  const base = biasBySlep(slep, anio);
  const jitter = (rng() - 0.5) * 0.20;
  const monthBoost = (mes / 12) * 0.08;
  const factor = Math.max(0.25, Math.min(1.15, base + jitter + monthBoost));

  const tipoMeta = indicador.tipoMeta ?? tipoMetaFromUnidad(indicador.unidad);
  if (tipoMeta === 'sin_meta' || indicador.metaNum === null || indicador.metaNum === undefined) {
    return { valor: null, factor };
  }

  let valor;
  if (tipoMeta === 'booleano') {
    // SI/NO clustered around the meta (factor > 0.75 → 1, factor > 0.55 → probabilistic, else 0)
    valor = rng() < Math.max(0.15, Math.min(0.95, factor)) ? 1 : 0;
  } else if (tipoMeta === 'porcentaje') {
    // metaNum stored as 0–1 fraction; produce a plausible fraction ≤ 1
    valor = Math.max(0, Math.min(1, indicador.metaNum * factor));
  } else if (tipoMeta === 'numero') {
    // Count/integer target. For monthly cadence, accrue up to the current month.
    const esperado = indicador.frecuencia === 'mensual'
      ? (indicador.metaNum * (mes / 12))
      : indicador.metaNum;
    // Round to integer when meta itself is integer, else keep 1 decimal
    const raw = Math.max(0, esperado * factor);
    valor = Number.isInteger(indicador.metaNum) ? Math.round(raw) : Math.round(raw * 10) / 10;
  } else {
    valor = indicador.metaNum * factor;
  }
  return { valor, factor };
}

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

export function calcularLogro(valor, indicador) {
  const tipoMeta = indicador.tipoMeta ?? tipoMetaFromUnidad(indicador.unidad);
  if (tipoMeta === 'sin_meta' || indicador.metaNum === null || indicador.metaNum === undefined || valor === null) return null;
  if (tipoMeta === 'booleano') return valor;
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
  return new Date().getMonth() + 1;
}

export function lastClosedMonth() {
  const m = currentMonth();
  return m === 1 ? 12 : m - 1;
}

export const MES_ACTUAL = currentMonth();

// ─── Año de implementación ────────────────────────────────────────────────

export function anioImplementacion(est, anio = new Date().getFullYear()) {
  if (!est?.cohorte) return 1;
  const [startYear, endYear] = est.cohorte.split('-').map(Number);
  const maxYears = endYear - startYear + 1;
  return Math.max(1, Math.min(maxYears, anio - startYear + 1));
}

// ─── Agregadores (reciben datos por parámetro) ────────────────────────────

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
