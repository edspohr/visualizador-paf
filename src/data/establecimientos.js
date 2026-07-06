// Establecimientos reales del proyecto PAF 2026
// Escuelas: SLEP Los Parques (cohorte 2025-2027) — son las que tienen URLs verificadas
// Jardines: SLEP Santa Rosa (cohorte 2025-2026), Del Pino y Santa Corina (2026-2027)

// SLEPs con las comunas reales derivadas del roster
// (columna COMUNA de las planillas maestras PAF Escolar y Parvulario)
export const SLEPS = [
  { id: 'SLEP-LP', nombre: 'SLEP Los Parques',  comuna: 'Quinta Normal' },
  { id: 'SLEP-SR', nombre: 'SLEP Santa Rosa',   comuna: 'La Cisterna / Lo Espejo / Pedro Aguirre Cerda / San Miguel / San Ramón' },
  { id: 'SLEP-DP', nombre: 'SLEP Del Pino',     comuna: 'El Bosque / La Pintana / San Bernardo' },
  { id: 'SLEP-SC', nombre: 'SLEP Santa Corina', comuna: 'Cerrillos / Estación Central / Maipú' },
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

// Deriva nNinos y nAgentes desde el # de salas del establecimiento.
// Supuestos (razones típicas Chile educación básica y parvularia):
//   Escolar:    ~30 estudiantes/sala, ~2 docentes/asistentes por sala + 5 apoyos (UTP, dirección, etc.)
//   Parvulario: ~20 niños/sala, ~3 agentes por sala (educadora + 2 técnicas)
// El # de salas viene del roster real (columna "salas activas" del sheet maestro Focus).
// Jitter ±10% determinístico para que no todos los establecimientos con el mismo # de salas
// tengan exactamente el mismo valor (refleja la variabilidad natural de matrícula).
function derivedCounts(id, nSalas, isEscuela) {
  const rng = mulberry32(hashSeed(id, 'counts'));
  const jitter = 0.9 + rng() * 0.2;  // 0.9–1.1
  if (isEscuela) {
    const nNinos   = Math.round(nSalas * 30 * jitter);
    const nAgentes = Math.round(nSalas * 2 + 5);       // 2 por sala + 5 apoyos fijos
    return { nNinos, nAgentes };
  } else {
    const nNinos   = Math.round(nSalas * 20 * jitter);
    const nAgentes = Math.round(nSalas * 3 + 2);       // 3 por sala + 2 apoyos (directora + aux)
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

// Roster real de escuelas — fuente: "Planillas PAF Escolar" (planilla maestra Focus)
// 18 escuelas · 3 SLEP · Cohortes 2025-2027 (Los Parques) y 2026-2028 (Santa Rosa, Santa Corina)
// nSalas viene del # de columnas por curso activas en el sheet maestro:
//   - Los Parques: la mayoría con una letra (PK-A, K-A, 1°A…8°A) = 10 salas
//   - Los Parques (Inglaterra): doble letra A/B en cada curso = 20 salas
//   - Santa Rosa y Santa Corina cohorte 2026-2028: template completo A/B = 20 salas
// nNinos y nAgentes se derivan de nSalas usando derivedCounts (razones típicas).
// consultorEmail sigue asignado por PRNG (fuente no disponible).
const _rawEscuelas = [
  // ── Los Parques · Cohorte 2025-2027 · Quinta Normal ──
  { id: 'ESC-001', nombre: 'Escuela Gil de Castro',              slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',      tipo: 'Escuela', nSalas: 10 },
  { id: 'ESC-002', nombre: 'Escuela Abate Molina',               slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',      tipo: 'Escuela', nSalas: 10 },
  { id: 'ESC-003', nombre: 'Escuela Inglaterra',                 slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',      tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-004', nombre: 'Escuela España',                     slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',      tipo: 'Escuela', nSalas: 10 },
  { id: 'ESC-005', nombre: 'Escuela Platón',                     slep: 'SLEP-LP', cohorte: '2025-2027', comuna: 'Quinta Normal',      tipo: 'Escuela', nSalas: 10 },
  // ── Santa Rosa · Cohorte 2026-2028 ──
  { id: 'ESC-006', nombre: 'Escuela Esperanza Joven',            slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'La Cisterna',         tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-007', nombre: 'Escuela República de las Filipinas', slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Lo Espejo',           tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-008', nombre: 'Escuela Ciudad de Barcelona',        slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda', tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-009', nombre: 'Escuela Ricardo Latcham',            slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda', tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-010', nombre: 'Escuela La Victoria',                slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda', tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-011', nombre: 'Escuela Lo Valledor',                slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'Pedro Aguirre Cerda', tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-012', nombre: 'Escuela Territorio Antártico',       slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Miguel',          tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-013', nombre: 'Escuela Villa San Miguel',           slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Miguel',          tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-014', nombre: 'Escuela Básica Sendero del Saber',   slep: 'SLEP-SR', cohorte: '2026-2028', comuna: 'San Ramón',           tipo: 'Escuela', nSalas: 20 },
  // ── Santa Corina · Cohorte 2026-2028 ──
  { id: 'ESC-015', nombre: 'Escuela Pedro Aguirre Cerda',        slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Cerrillos',           tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-016', nombre: 'Escuela República de Austria',       slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Estación Central',    tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-017', nombre: 'Escuela Ramón del Río',              slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Estación Central',    tipo: 'Escuela', nSalas: 20 },
  { id: 'ESC-018', nombre: 'Escuela Ramón Freire',               slep: 'SLEP-SC', cohorte: '2026-2028', comuna: 'Maipú',               tipo: 'Escuela', nSalas: 20 },
];

export const ESCUELAS = _rawEscuelas.map(e => {
  const { nNinos, nAgentes } = derivedCounts(e.id, e.nSalas, true);
  return {
    ...e,
    nNinos,
    nAgentes,
    consultorEmail: assignConsultorEmail(e.id),
  };
});

// Roster real de jardines infantiles — fuente: "Planillas PAF Parvulario" (planilla maestra Focus)
// 24 jardines · 3 SLEP (Santa Rosa cohorte 2025-2026, Del Pino y Santa Corina cohorte 2026-2027)
// Los Parques NO tiene jardines en el programa.
// nSalas: default 4 (Sala Cuna Menor + Mayor + Medio Menor + Medio Mayor).
// Cuando Focus confirme el nSalas real por jardín, se ajusta caso por caso.
const _rawJardines = [
  // ── Santa Rosa · Cohorte 2025-2026 · Pedro Aguirre Cerda ──
  { id: 'JAR-001', nombre: 'Jardín Pequeño Aymará',      slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-002', nombre: 'Jardín Enrique Backausse',   slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-003', nombre: 'Jardín Poetas de Chile',     slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-004', nombre: 'Jardín Ciudad de Barcelona', slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-005', nombre: 'Jardín Ochagavía',           slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-006', nombre: 'Jardín La Marina',           slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-007', nombre: 'Jardín Llano Subercaseaux',  slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'Pedro Aguirre Cerda', tipo: 'Jardín', nSalas: 4 },
  // ── Santa Rosa · Cohorte 2025-2026 · San Miguel ──
  { id: 'JAR-008', nombre: 'Jardín Villa San Miguel',    slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-009', nombre: 'Jardín Andres Bello',        slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-010', nombre: 'Jardín Santa Fe',            slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-011', nombre: 'Jardín Akun Pichiwentxu',    slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Miguel',          tipo: 'Jardín', nSalas: 4 },
  // ── Santa Rosa · Cohorte 2025-2026 · San Ramón ──
  { id: 'JAR-012', nombre: 'Jardín La Hormiguita',       slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-013', nombre: 'Jardín Caballito Feliz',     slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-014', nombre: 'Jardín Príncipes del Reino', slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-015', nombre: 'Jardín Modelo',              slep: 'SLEP-SR', cohorte: '2025-2026', comuna: 'San Ramón',           tipo: 'Jardín', nSalas: 4 },
  // ── Del Pino · Cohorte 2026-2027 ──
  { id: 'JAR-016', nombre: 'Jardín Paula Jaraquemada',   slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'El Bosque',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-017', nombre: 'Jardín Cedin',               slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'La Pintana',          tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-018', nombre: 'Jardín Eluney',              slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-019', nombre: 'Jardín Sueño de Colores',    slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-020', nombre: 'Jardín Tierra de Ángeles',   slep: 'SLEP-DP', cohorte: '2026-2027', comuna: 'San Bernardo',        tipo: 'Jardín', nSalas: 4 },
  // ── Santa Corina · Cohorte 2026-2027 ──
  { id: 'JAR-021', nombre: 'Jardín Angel Fantuzzi',      slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Cerrillos',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-022', nombre: 'Jardín Salomón Sack',        slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Cerrillos',           tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-023', nombre: 'Jardín Estación Alegría',    slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Estación Central',    tipo: 'Jardín', nSalas: 4 },
  { id: 'JAR-024', nombre: 'Jardín El Tranque',          slep: 'SLEP-SC', cohorte: '2026-2027', comuna: 'Maipú',               tipo: 'Jardín', nSalas: 4 },
];

export const JARDINES = _rawJardines.map(j => {
  const { nNinos, nAgentes } = derivedCounts(j.id, j.nSalas, false);
  return {
    ...j,
    nNinos,
    nAgentes,
    consultorEmail: assignConsultorEmail(j.id),
  };
});

// Salas por escuela (PK A/B → 8° A/B = 18 salas potenciales, simplificamos a las habituales)
export const SALAS_ESCUELA = ['PK A', 'PK B', 'K A', 'K B', '1° A', '1° B', '2° A', '2° B', '3° A', '3° B', '4° A', '4° B', '5° A', '5° B', '6° A', '6° B', '7° A', '7° B', '8° A'];

// Genera un valor para un indicador dado en un establecimiento y período
// Sesgo por SLEP: las cohortes más antiguas (Los Parques 2025-2027, año 2 en 2026,
// y Santa Rosa parvulario 2025-2026 año 2) rinden mejor. Las cohortes nuevas (Santa Rosa
// escolar 2026-2028, Del Pino y Santa Corina 2026-2027, todas año 1 en 2026) tienen bias
// más bajo — narrativa: llevan menos rodaje.
// NOTA: valores sintéticos para la demo; se reemplazan al conectar Supabase.
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
