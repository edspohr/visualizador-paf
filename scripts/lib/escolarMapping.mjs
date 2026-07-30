// Escolar — mapeo declarativo (año × arquetipo × indicador canónico × nivel).
//
// Diseño (E4 del addendum):
//   - Cada indicador canónico Escolar 2026 aparece en al menos un arquetipo
//     con una fuente declarada, o queda explícitamente en `NO_MAPEADO` con
//     una razón. La ausencia como silencio no es un estado permitido.
//   - `desagregaNivel` en Escolar NO es booleano. Algunos indicadores aplican
//     sólo a un conjunto restringido de niveles (por ej. Biblioteca Viajera
//     sólo carga PKA/PKB/KA/KB/1A/1B). Modelamos ese conjunto explícitamente.
//   - Cuando el mismo indicador es derivable de más de un arquetipo,
//     declaramos precedencia.
//
// Alcance actual: refleja lo que `scripts/ingestEscolar.mjs` ya sabe extraer,
// que está documentado en `docs/mapeo-escolar-2026-07-29.md`. Los indicadores
// que hoy no tienen mapeo entran como `NO_MAPEADO`. Cuando Sebastián confirme
// dónde se reportan, se actualiza este archivo.

// Arquetipos canónicos:
//   'registro-coordinacion' — Registro Coordinación (2026) o Registro UTP (2025)
//   'datos-consultor'       — Datos Consultor por escuela
//   'curso'                 — Planilla per-curso (por ejemplo PKA_Platon)

// Niveles operativos Escolar: PKA, PKB, KA, KB, 1A..8B (+8C en 2025).
export const CURSOS_2025 = [
  'PKA','PKB','KA','KB',
  '1A','1B','2A','2B','3A','3B','4A','4B',
  '5A','5B','6A','6B','7A','7B','8A','8B','8C',
];
export const CURSOS_2026 = CURSOS_2025.slice(0, -1); // sin 8C

// Universo por indicador: por defecto TODOS los cursos aplicables. Overrides
// abajo para BV, LV, mantel de palabras y talleres para estudiantes.
export function cursosAplicables(indicadorId, anio) {
  const CURSOS = anio === 2025 ? CURSOS_2025 : CURSOS_2026;
  // Biblioteca Viajera → sólo PK/K/1º (comprensión lectora inicial)
  if (['I.28','I.43','I.48'].includes(indicadorId)) {
    return CURSOS.filter(c => /^(PK|K|1)[A-C]$/.test(c));
  }
  // Lecturas Viajeras → sólo 2º–4º (según convención informada por consultor)
  if (['I.30','I.44','I.49'].includes(indicadorId)) {
    return CURSOS.filter(c => /^[234][A-C]$/.test(c));
  }
  // Mantel de Palabras → 5º–8º
  if (['I.31','I.45','I.50','I.51'].includes(indicadorId)) {
    return CURSOS.filter(c => /^[5678][A-C]$/.test(c));
  }
  // Talleres para estudiantes 1ro–8vo
  if (indicadorId === 'I.32') {
    return CURSOS.filter(c => /^[1-8][A-C]$/.test(c));
  }
  return CURSOS;
}

// ─── Mapeo por indicador ───────────────────────────────────────────────────
// Formato:
//   {
//     id: 'I.1',
//     scope: 'escuela' | 'curso',
//     fuentes: [
//       { anio, arquetipo, tab, columna | rango, transformacion, estado, notas }
//     ],
//     universoCursos?: (id, anio) => cursos[]   // sólo si scope='curso' y difiere del default
//     precedencia?: ['arquetipo1', 'arquetipo2']  // primer match gana
//   }
// O bien:
//   { id: 'I.10', mapeo: 'NO_MAPEADO', razon: 'texto' }

export const ESCOLAR_MAPPING = [
  // ─── A.1 · Gestión institucional (I.1–I.10 estrategia, I.33–I.35 producto) ─
  { id: 'I.1',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Se conforma Equipo de Gestión"', transformacion: 'first_bool', estado: 'validado' },
  ]},
  { id: 'I.2',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Reuniones equipo de Gestión', rango: 'sesiones × asistencia', transformacion: 'count_true', estado: 'validado' },
  ]},
  { id: 'I.3',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Reuniones equipo de Gestión', columna: '"Director/a"', transformacion: 'first_number_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.4',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Reuniones equipo de Gestión', columna: '"Coordinador"', transformacion: 'first_number_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.5',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Reuniones equipo de Gestión', notas: 'semántica igual a I.2, marcada provisional', transformacion: 'igual_a_I.2', estado: 'provisional' },
  ]},
  { id: 'I.6',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Director asiste × Encuentro territorial I+II"', transformacion: 'count_true', estado: 'validado' },
  ]},
  { id: 'I.7',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Coordinador asiste × Encuentro territorial I+II"', transformacion: 'count_true', estado: 'provisional' },
  ]},
  { id: 'I.8',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Director asiste × Reunión director/a"', transformacion: 'first_bool', estado: 'provisional' },
  ]},
  { id: 'I.9',  scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Existe plan de acción familia escuela diseñado"', transformacion: 'first_bool_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.10', mapeo: 'NO_MAPEADO', razon: 'Existe plan actualizado — probablemente derivable del tab Actividades, junto a I.9. Confirmar con Sebastián.' },
  { id: 'I.33', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Director cumple meta de liderazgo planificada"', transformacion: 'first_bool_from_col1', estado: 'validado' },
  ]},
  { id: 'I.34', mapeo: 'NO_MAPEADO', razon: 'La regex del ingest actual coincide con "porcentaje de cumplimiento del plan de acción" pero la celda llega vacía en todas las escuelas hoy. Estructurado pero sin datos.' },
  { id: 'I.35', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Plan de acción diseñado e incorporado en PME y PEI"', transformacion: 'first_bool_from_col1', estado: 'provisional' },
  ]},

  // ─── A.2 · Formación Equipo educativo (I.11–I.20 estrategia, I.36–I.38 producto) ─
  { id: 'I.11', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Módulos formativos"', transformacion: 'count_true_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.12', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Datos docentes', rango: 'por profesor jefe', transformacion: 'mean_over_docentes', estado: 'validado' },
  ]},
  { id: 'I.13', mapeo: 'NO_MAPEADO', razon: 'Director asiste a módulos formativos. Sin fuente declarada. Confirmar planilla.' },
  { id: 'I.14', mapeo: 'NO_MAPEADO', razon: 'Coordinador asiste a módulos formativos. Sin fuente declarada. Confirmar planilla.' },
  { id: 'I.15', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Instancias de formación territorial para docentes"', transformacion: 'count_true_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.16', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Datos docentes', rango: 'sobre docentes activos', transformacion: 'ratio_provisional', estado: 'provisional', notas: 'no se distingue Prof. Jefe explícitamente en Cargo' },
  ]},
  { id: 'I.17', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Director asiste × Encuentro territorial I+II"', transformacion: 'count_true', estado: 'provisional' },
  ]},
  { id: 'I.18', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Coordinador asiste × Encuentro territorial I+II"', transformacion: 'count_true', estado: 'provisional' },
  ]},
  { id: 'I.19', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'entrevistas anual', transformacion: 'with1_over_active', estado: 'provisional' },
  ]},
  { id: 'I.20', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'entrevistas anual', transformacion: 'with2_over_active', estado: 'provisional' },
  ]},
  { id: 'I.36', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Nota promedio evaluación consejo de profesores"', transformacion: 'first_number_from_col1', estado: 'validado' },
  ]},
  { id: 'I.37', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Nota promedio formación docente"', transformacion: 'first_number_from_col1', estado: 'provisional' },
  ]},
  { id: 'I.38', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Sistema de planificación, pauta y monitoreo"', transformacion: 'first_bool_from_col1', estado: 'provisional' },
  ]},

  // ─── A.3 · Formación Apoderados (I.21–I.27 estrategia, I.39–I.47 producto) ─
  { id: 'I.21', mapeo: 'NO_MAPEADO', razon: 'Nº talleres presenciales por sala. Sin fuente declarada.' },
  { id: 'I.22', mapeo: 'NO_MAPEADO', razon: 'Se reporta por Encuesta Apoderados, tab estructurada pero sin datos hoy.' },
  { id: 'I.23', mapeo: 'NO_MAPEADO', razon: 'Nº talleres digitales enviados por sala. Sin fuente declarada.' },
  { id: 'I.24', mapeo: 'NO_MAPEADO', razon: 'Visualizaciones de talleres digitales. Sin fuente declarada.' },
  { id: 'I.25', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Instancia de formación para apoderados monitores"', transformacion: 'count_true_from_col1', estado: 'validado' },
  ]},
  { id: 'I.26', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'monitores formados', transformacion: 'count', estado: 'validado' },
  ]},
  { id: 'I.27', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'salas con monitor activo', transformacion: 'ratio_salas_cubiertas', estado: 'provisional' },
  ]},
  { id: 'I.39', mapeo: 'NO_MAPEADO', razon: '% Talleres liderados por dupla monitor-profesor. Sin fuente declarada.' },
  { id: 'I.40', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'Talleres TF1..4', transformacion: 'atLeast_over_total', estado: 'provisional' },
  ]},
  { id: 'I.41', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'Talleres TF1..4', transformacion: 'all4_over_total', estado: 'provisional' },
  ]},
  { id: 'I.42', mapeo: 'NO_MAPEADO', razon: 'Se reporta por Encuesta Apoderados, tab estructurada pero sin datos hoy.' },
  { id: 'I.43', mapeo: 'NO_MAPEADO', razon: 'BV que declaran usar familias. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.44', mapeo: 'NO_MAPEADO', razon: 'LV que declaran usar familias. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.45', mapeo: 'NO_MAPEADO', razon: 'Mantel que declaran usar familias. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.46', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'monitores activos', transformacion: 'count', estado: 'validado' },
  ]},
  { id: 'I.47', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'datos-consultor', tab: 'Actividades', columna: '"Nota promedio formación a apoderados monitores"', transformacion: 'first_number_from_col1', estado: 'validado' },
  ]},

  // ─── A.4 · Formación Estudiantes (I.28–I.32 estrategia, I.48–I.51 producto) ─
  { id: 'I.28', scope: 'escuela', fuentes: [
    { anio: 2026, arquetipo: 'registro-coordinacion', tab: 'Registro Coordinación · PKA..8B', rango: 'Bibliotecas Viajeras', transformacion: 'mean_over_salas', estado: 'provisional' },
  ]},
  { id: 'I.29', mapeo: 'NO_MAPEADO', razon: 'Libros de BV recibidos por estudiante. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.30', mapeo: 'NO_MAPEADO', razon: 'Envío de Lecturas Viajeras. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.31', mapeo: 'NO_MAPEADO', razon: 'Salas que envían Mantel. Encuesta Apoderados. Sin datos hoy.' },
  { id: 'I.32', mapeo: 'NO_MAPEADO', razon: 'Nº talleres para estudiantes. Sin fuente declarada.' },
  { id: 'I.48', mapeo: 'NO_MAPEADO', razon: 'Mediación BV. Sin fuente declarada.' },
  { id: 'I.49', mapeo: 'NO_MAPEADO', razon: 'Mediación LV. Sin fuente declarada.' },
  { id: 'I.50', mapeo: 'NO_MAPEADO', razon: 'Mediación Mantel previo. Sin fuente declarada.' },
  { id: 'I.51', mapeo: 'NO_MAPEADO', razon: 'Mediación Mantel post-envío. Sin fuente declarada.' },
];

// ─── Aserción: cada indicador canónico tiene entrada explícita ─────────────
// La ausencia como silencio no es un estado permitido. Este assert corre
// desde `scripts/parseCatalogs.mjs` y `scripts/harvestEscolar.mjs` (o un
// script de check dedicado) y falla el build/run si un indicador Escolar
// canónico no aparece en ESCOLAR_MAPPING (mapeado o explícitamente NO_MAPEADO).

export function assertMappingCompleto(catalogEscolar2026) {
  const mapIds = new Set(ESCOLAR_MAPPING.map(m => m.id));
  const missing = catalogEscolar2026.filter(i => !mapIds.has(i.id));
  if (missing.length) {
    throw new Error(
      `[escolarMapping] Indicadores canónicos sin entrada en ESCOLAR_MAPPING (ni mapeado ni NO_MAPEADO):\n` +
      missing.map(m => `  - ${m.id}: ${m.nombre}`).join('\n')
    );
  }
  // También chequea que no hayamos declarado IDs que ya no existen en el catálogo.
  const catIds = new Set(catalogEscolar2026.map(i => i.id));
  const extra = ESCOLAR_MAPPING.filter(m => !catIds.has(m.id));
  if (extra.length) {
    throw new Error(
      `[escolarMapping] IDs en ESCOLAR_MAPPING que ya no existen en el catálogo:\n` +
      extra.map(m => `  - ${m.id}`).join('\n')
    );
  }
}

// ─── Helpers de consulta ───────────────────────────────────────────────────

export function fuentesParaIndicador(id) {
  const entry = ESCOLAR_MAPPING.find(m => m.id === id);
  if (!entry) return null;
  if (entry.mapeo === 'NO_MAPEADO') return { estado: 'NO_MAPEADO', razon: entry.razon };
  return entry.fuentes;
}

export function esNoMapeado(id) {
  const entry = ESCOLAR_MAPPING.find(m => m.id === id);
  return entry?.mapeo === 'NO_MAPEADO';
}

export function razonNoMapeado(id) {
  const entry = ESCOLAR_MAPPING.find(m => m.id === id);
  return entry?.mapeo === 'NO_MAPEADO' ? entry.razon : null;
}
