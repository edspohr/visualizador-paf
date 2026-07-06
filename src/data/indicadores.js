// Catálogo completo de indicadores PAF
// Fuente: Sistema_indicadores_PAF_Escolar_2026.xlsx (hoja "Indicadores año 1, 2026")
//         + Sistema_indicadores_PAF_Parvulario.xlsx
// Schema: { id, ambito, actividad, nombre, tipo, meta, metaNum, unidad, frecuencia, fuente, clasificacion }
// clasificacion ∈ {'estrategia','producto'}  ← columna "Comentario" del origen (actividad/producto)
// unidad ∈ {'binario','%','conteo','promedio','sin_meta'}
// indicadores con metaNum:null se excluyen del ratio pero se listan

// ─── ÁMBITOS ────────────────────────────────────────────────────────────────

export const AMBITOS_ESCOLAR = [
  { id: 'A1', codigo: 'A.1', nombre: 'Liderazgo para la gestión de la alianza familia-escuela', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación de apoderados en el desarrollo y aprendizaje', color: 'lime' },
  { id: 'A4', codigo: 'A.4', nombre: 'Fomento lector y desarrollo del lenguaje en niños, niñas y adolescentes', color: 'navy' },
];

export const AMBITOS_PARVULARIO = [
  { id: 'A1', codigo: 'A.1', nombre: 'Gestión institucional de la alianza familia-jardín', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación y formación de apoderados', color: 'lime' },
];

// ─── INDICADORES ESCOLAR (52 total, hoja 2026 Año 1) ───────────────────────
// Estructura oficial:
//   A1 (Liderazgo)                → I1–I10   (actividad)
//   A2 (Formación equipos)        → I11–I20  (actividad)
//   A3 (Participación apoderados) → I21–I27  (actividad)
//   A4 (Fomento lector)           → I28–I32  (actividad)
//   P1 (Liderazgo)                → I33–I35  (producto)
//   P2 (Formación equipos)        → I36–I38  (producto)
//   P2/P3 (Participación)         → I39–I42  (producto/actividad, según origen)
//   P3 (Fomento lector)           → I43–I46  (producto)
//   P4 (Participación)            → I47–I48  (producto)
//   P5 (Fomento lector)           → I49–I52  (producto/actividad, según origen)
// Los ámbitos P* se agrupan bajo el ámbito A* correspondiente (P1→A1, P2→A2, P3/P4→A3, P5→A4).
// Clasificación (columna "Comentario" del origen):
//   'actividad' → clasificacion: 'estrategia' (ámbitos A1–A4)
//   'producto'  → clasificacion: 'producto' (ámbitos P1–P5)
// Frecuencias: campo "Temporalidad de reporte"; cuando aparece "Anual" se conserva; cuando
//   está vacío o dice "Primer año" se marca 'anual' salvo que la actividad implique cadencia mensual.
// Notas de meta:
//   - "SI" → binario metaNum:1.0
//   - decimales ≤1 → % (metaNum = decimal)
//   - decimales >1 → count/promedio
//   - "-" o vacío → metaNum:null, unidad:'sin_meta'

export const INDICADORES_ESCOLAR = [

  // ═══ A1 · Liderazgo · Actividades (I1–I10) ══════════════════════════════
  {
    id: 'E.1',  ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: 'Se conforma Equipo de Gestión',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.2',  ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: 'Número de reuniones anuales del Equipo de Gestión',
    tipo: 'operativo', meta: '10', metaNum: 10, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.3',  ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: '% promedio de asistencia anual de directores a las reuniones del equipo de gestión',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.4',  ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: '% promedio de asistencia de coordinadores a las reuniones del equipo de gestión',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.5',  ambito: 'A1', actividad: '10 Reuniones de Coordinación',
    nombre: 'Número de reuniones de coordinación',
    tipo: 'operativo', meta: '10', metaNum: 10, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.6',  ambito: 'A1', actividad: '2 Formaciones en liderazgo (directores y coordinadores)',
    nombre: 'Director asiste a formación de liderazgo territorial',
    tipo: 'táctico', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.7',  ambito: 'A1', actividad: '2 Formaciones en liderazgo (directores y coordinadores)',
    nombre: 'Coordinador asiste a formación de liderazgo territorial',
    tipo: 'táctico', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.8',  ambito: 'A1', actividad: '1 Encuentro anual en liderazgo para directores',
    nombre: 'Director asiste a formación de liderazgo, por escuela',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.9',  ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: 'Existe plan de acción familia escuela diseñado',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.10', ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: 'Existe plan de acción familia escuela actualizado',
    tipo: 'táctico', meta: '—', metaNum: null, unidad: 'sin_meta', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },

  // ═══ A2 · Formación equipos educativos · Actividades (I11–I20) ═══════════
  {
    id: 'E.11', ambito: 'A2', actividad: '5 Instancias formativas anuales (por escuela)',
    nombre: 'Número de módulos formativos realizados anualmente en la escuela',
    tipo: 'operativo', meta: '5', metaNum: 5, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.12', ambito: 'A2', actividad: '5 Instancias formativas anuales (por escuela)',
    nombre: '% de profesores jefe que asisten a módulos formativos',
    tipo: 'táctico', meta: '80%', metaNum: 0.80, unidad: '%', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.13', ambito: 'A2', actividad: '5 Instancias formativas anuales (por escuela)',
    nombre: 'Director asiste a módulos formativos',
    tipo: 'táctico', meta: '5', metaNum: 5, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.14', ambito: 'A2', actividad: '5 Instancias formativas anuales (por escuela)',
    nombre: 'Coordinador asiste a módulos formativos',
    tipo: 'táctico', meta: '5', metaNum: 5, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.15', ambito: 'A2', actividad: '2 Instancias formativas territoriales anuales',
    nombre: 'Número de formaciones territoriales anuales para docentes y asistentes de la educación',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.16', ambito: 'A2', actividad: '2 Instancias formativas territoriales anuales',
    nombre: '% de profesores jefe que asisten a formaciones territoriales',
    tipo: 'táctico', meta: '80%', metaNum: 0.80, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.17', ambito: 'A2', actividad: '2 Instancias formativas territoriales anuales',
    nombre: 'Director asiste a formaciones territoriales',
    tipo: 'táctico', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.18', ambito: 'A2', actividad: '2 Instancias formativas territoriales anuales',
    nombre: 'Coordinador asiste a formaciones territoriales',
    tipo: 'táctico', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.19', ambito: 'A2', actividad: 'Docentes implementan estrategias IF',
    nombre: '% promedio de familias entrevistadas por profesor jefe al menos una vez en el año por sala',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'UTP', clasificacion: 'estrategia',
  },
  {
    id: 'E.20', ambito: 'A2', actividad: 'Docentes implementan estrategias IF',
    nombre: '% promedio de familias entrevistadas por profesor jefe al menos dos veces en el año por sala',
    tipo: 'táctico', meta: '50%', metaNum: 0.50, unidad: '%', frecuencia: 'semestral',
    fuente: 'UTP', clasificacion: 'estrategia',
  },

  // ═══ A3 · Participación de apoderados · Actividades (I21–I27) ════════════
  {
    id: 'E.21', ambito: 'A3', actividad: '4 Talleres presenciales de parentalidad',
    nombre: 'Número de talleres para apoderados presenciales realizados en promedio por sala',
    tipo: 'operativo', meta: '4', metaNum: 4, unidad: 'conteo', frecuencia: 'trimestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'E.22', ambito: 'A3', actividad: '4 Talleres presenciales de parentalidad',
    nombre: '% promedio de asistencia anual de apoderados a taller para apoderados presenciales',
    tipo: 'táctico', meta: '60%', metaNum: 0.60, unidad: '%', frecuencia: 'trimestral',
    fuente: 'Encuesta apoderados', clasificacion: 'estrategia',
  },
  {
    id: 'E.23', ambito: 'A3', actividad: '2 Talleres digitales de parentalidad',
    nombre: 'Número de Talleres digitales para Apoderados enviados en promedio por sala',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.24', ambito: 'A3', actividad: '2 Talleres digitales de parentalidad',
    nombre: 'Cantidad de visualizaciones promedio de los Talleres digitales para Apoderados',
    tipo: 'táctico', meta: '—', metaNum: null, unidad: 'sin_meta', frecuencia: 'anual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.25', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Número de formaciones realizadas a apoderados monitores',
    tipo: 'operativo', meta: '4', metaNum: 4, unidad: 'conteo', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.26', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Número de apoderados monitores formados (al menos una instancia de formación)',
    tipo: 'operativo', meta: '153', metaNum: 153, unidad: 'conteo', frecuencia: 'trimestral',
    fuente: 'Evaluación final actividad', clasificacion: 'estrategia',
  },
  {
    id: 'E.27', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Número de salas cubiertas por apoderados monitores',
    tipo: 'operativo', meta: '1', metaNum: 1, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },

  // ═══ A4 · Fomento lector · Actividades (I28–I32) ═════════════════════════
  {
    id: 'E.28', ambito: 'A4', actividad: 'Biblioteca viajera (NT1–2° básico)',
    nombre: 'Cantidad de semanas de envío de Biblioteca Viajera por sala',
    tipo: 'operativo', meta: '20', metaNum: 20, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },
  {
    id: 'E.29', ambito: 'A4', actividad: 'Biblioteca viajera (NT1–2° básico)',
    nombre: 'Cantidad promedio de libros de Bibliotecas Viajeras recibidos por estudiante por sala',
    tipo: 'táctico', meta: '10', metaNum: 10, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },
  {
    id: 'E.30', ambito: 'A4', actividad: 'Lecturas viajeras (3° a 8° básico)',
    nombre: 'Cantidad promedio de envío de Lecturas Viajeras por sala',
    tipo: 'táctico', meta: '15', metaNum: 15, unidad: 'promedio', frecuencia: 'mensual',
    fuente: 'Encuesta apoderados', clasificacion: 'estrategia',
  },
  {
    id: 'E.31', ambito: 'A4', actividad: 'Mantel de Palabras',
    nombre: '% de salas que envían Mantel de Palabras',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Encuesta apoderados', clasificacion: 'estrategia',
  },
  {
    id: 'E.32', ambito: 'A3', actividad: '5 Talleres anuales de aprendizaje y desarrollo para estudiantes',
    nombre: 'Número de talleres para estudiantes realizados por sala (1° a 8°)',
    tipo: 'operativo', meta: '5', metaNum: 5, unidad: 'conteo', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'estrategia',
  },

  // ═══ P1 · Liderazgo · Productos (I33–I35) ═══════════════════════════════
  {
    id: 'E.33', ambito: 'A1', actividad: '1 Encuentro anual en liderazgo para directores',
    nombre: 'Director cumple la meta propuesta para su liderazgo (revisión estándares PAF)',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'E.34', ambito: 'A1', actividad: '10 Reuniones Equipo de Gestión Escolar',
    nombre: '% de cumplimiento del plan de acción familia escuela',
    tipo: 'táctico', meta: '70%', metaNum: 0.70, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'E.35', ambito: 'A1', actividad: 'Plan de acción (PME/PEI)',
    nombre: 'Plan de acción diseñado e incorporado en PME y PEI',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'PME y PEI', clasificacion: 'producto',
  },

  // ═══ P2 · Formación equipos · Productos (I36–I39) ═══════════════════════
  {
    id: 'E.36', ambito: 'A2', actividad: '5 Instancias formativas anuales',
    nombre: 'Nota promedio que ponen los asistentes a los módulos formativos',
    tipo: 'táctico', meta: '6.0', metaNum: 6.0, unidad: 'promedio', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'E.37', ambito: 'A2', actividad: '2 Instancias formativas territoriales',
    nombre: 'Nota promedio que ponen los asistentes a las formaciones territoriales',
    tipo: 'táctico', meta: '6.0', metaNum: 6.0, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'E.38', ambito: 'A2', actividad: 'Docentes implementan estrategias IF',
    nombre: 'Existe sistema de planificación, pauta y monitoreo de entrevistas a apoderados con estándares PAF',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'E.39', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Porcentaje de Talleres para Apoderados liderados por la dupla monitor–profesor',
    tipo: 'táctico', meta: '50%', metaNum: 0.50, unidad: '%', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },

  // ═══ P3 · Participación de apoderados · Actividades/Productos (I40–I46) ══
  {
    id: 'E.40', ambito: 'A3', actividad: '4 Talleres presenciales de parentalidad',
    nombre: '% promedio de apoderados que participan de al menos un taller presencial',
    tipo: 'táctico', meta: '70%', metaNum: 0.70, unidad: '%', frecuencia: 'trimestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },
  {
    id: 'E.41', ambito: 'A3', actividad: '4 Talleres presenciales de parentalidad',
    nombre: '% promedio de apoderados que participan del 100% de los Talleres presenciales',
    tipo: 'táctico', meta: '50%', metaNum: 0.50, unidad: '%', frecuencia: 'trimestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },
  {
    id: 'E.42', ambito: 'A3', actividad: '2 Talleres digitales de parentalidad',
    nombre: '% de apoderados que declaran haber descargado y visualizado los dos Talleres digitales',
    tipo: 'táctico', meta: '70%', metaNum: 0.70, unidad: '%', frecuencia: 'semestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },
  {
    id: 'E.43', ambito: 'A4', actividad: 'Biblioteca viajera (NT1–2° básico)',
    nombre: 'Promedio de libros de Biblioteca Viajera que declaran utilizar las familias',
    tipo: 'táctico', meta: '7', metaNum: 7, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },
  {
    id: 'E.44', ambito: 'A4', actividad: 'Lecturas viajeras (3° a 8° básico)',
    nombre: 'Promedio de Lecturas Viajeras que declaran utilizar las familias',
    tipo: 'táctico', meta: '10', metaNum: 10, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.45', ambito: 'A4', actividad: 'Mantel de Palabras',
    nombre: '% de apoderados que declaran utilizar el Mantel de Palabras',
    tipo: 'táctico', meta: '80%', metaNum: 0.80, unidad: '%', frecuencia: 'semestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.46', ambito: 'A4', actividad: 'Apoderados usan estrategias IF',
    nombre: 'Cantidad promedio de instrumentos de fomento lector y lenguaje que declaran utilizar las familias',
    tipo: 'táctico', meta: '10', metaNum: 10, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Encuesta apoderados', clasificacion: 'producto',
  },

  // ═══ P4 · Participación · Productos (I47–I48) ═══════════════════════════
  {
    id: 'E.47', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Número de apoderados monitores que implementaron Taller de Apoderados (al menos un taller)',
    tipo: 'operativo', meta: '153', metaNum: 153, unidad: 'conteo', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.48', ambito: 'A3', actividad: 'Formación de apoderados monitores',
    nombre: 'Nota promedio que ponen los asistentes a las formaciones de monitores',
    tipo: 'táctico', meta: '6.0', metaNum: 6.0, unidad: 'promedio', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },

  // ═══ P5 · Fomento lector · Actividades/Productos (I49–I52) ══════════════
  {
    id: 'E.49', ambito: 'A4', actividad: 'Biblioteca viajera (NT1–2° básico)',
    nombre: 'Cantidad promedio de actividades de mediación de Biblioteca Viajera realizadas por sala',
    tipo: 'táctico', meta: '3', metaNum: 3, unidad: 'promedio', frecuencia: 'trimestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.50', ambito: 'A4', actividad: 'Lecturas viajeras (3° a 8° básico)',
    nombre: 'Cantidad promedio de actividades de aula de Lecturas Viajeras desarrolladas en salas',
    tipo: 'táctico', meta: '15', metaNum: 15, unidad: 'promedio', frecuencia: 'mensual',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.51', ambito: 'A4', actividad: 'Mantel de Palabras',
    nombre: '% de salas que realizan mediación del Mantel de Palabras, previo al envío',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
  {
    id: 'E.52', ambito: 'A4', actividad: 'Mantel de Palabras',
    nombre: 'Cantidad promedio de actividades de mediación del Mantel post envío por sala',
    tipo: 'táctico', meta: '2', metaNum: 2, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Registro establecimiento', clasificacion: 'producto',
  },
];

// ─── INDICADORES PARVULARIO (54 total) ───────────────────────────────────────
// I.1–I.34  → hoja "Ind_ Estrategias y Actividades", clasificacion: 'estrategia'
// I.35–I.54 → hoja "Ind_ Productos", clasificacion: 'producto'
// Ámbito mapping:
//   E1 → A1 (Gestión institucional)
//   E2 → A2 (Formación AE)
//   E3–E6 → A3 (Participación y formación apoderados)
//   Productos: P1 → A1, P2 → A2, P3+P4 → A3
// tipo: campo no disponible en la matriz parvularia; se mantiene 'operativo' por defecto
//   excepto indicadores de % que clasifican como 'táctico'.
// Defaults aplicados: frecuencia='anual' donde no estaba especificada; para las celdas
//   con valor decimal (ej. 0.75) se interpretó como porcentaje %; "SI" como binario.

export const INDICADORES_PARVULARIO = [

  // ── E1 → A1 · Gestión institucional ── (estrategia)
  {
    id: 'I.1',  ambito: 'A1', actividad: 'Reuniones con directora',
    nombre: 'N° de reuniones desarrolladas con directora o directora subrogante del jardín infantil',
    tipo: 'operativo', meta: '11', metaNum: 11, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.2',  ambito: 'A1', actividad: 'Reuniones con educadoras',
    nombre: 'N° de reuniones desarrolladas con educadoras del jardín infantil',
    tipo: 'operativo', meta: '11', metaNum: 11, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.3',  ambito: 'A1', actividad: 'Reuniones con educadoras',
    nombre: '% de educadoras que participan en reuniones',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.4',  ambito: 'A1', actividad: 'Reuniones territoriales con directoras',
    nombre: 'N° de reuniones territoriales con directoras desarrolladas',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.5',  ambito: 'A1', actividad: 'Reuniones territoriales con directoras',
    nombre: '% de directoras que participan en reuniones territoriales',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.6',  ambito: 'A1', actividad: 'Reuniones territoriales con coordinadoras',
    nombre: 'N° de reuniones territoriales con coordinadoras desarrolladas',
    tipo: 'operativo', meta: '1', metaNum: 1, unidad: 'conteo', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.7',  ambito: 'A1', actividad: 'Reuniones territoriales con coordinadoras',
    nombre: '% de coordinadoras que participan en reuniones territoriales',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },

  // ── E2 → A2 · Formación AE ── (estrategia)
  {
    id: 'I.8',  ambito: 'A2', actividad: 'Sensibilización del Programa',
    nombre: 'N° de instancias de sensibilización y presentación del Programa desarrolladas',
    tipo: 'operativo', meta: '1', metaNum: 1, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.9',  ambito: 'A2', actividad: 'Sensibilización del Programa',
    nombre: '% de agentes educativas que participan en instancia de sensibilización y presentación del Programa',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.10', ambito: 'A2', actividad: 'Formaciones anuales para AE',
    nombre: 'N° de formaciones anuales para agentes educativas desarrolladas',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.11', ambito: 'A2', actividad: 'Formaciones anuales para AE',
    nombre: '% de agentes educativas que participan en instancias de formación',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.12', ambito: 'A2', actividad: 'Módulos formativos CAUE',
    nombre: 'N° de módulos formativos desarrollados en CAUE',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.13', ambito: 'A2', actividad: 'Módulos formativos CAUE',
    nombre: '% de agentes educativas que participan en módulos formativos de CAUE',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },

  // ── E3 → A3 · Fomento lector (Biblioteca Viajera) ── (estrategia)
  {
    id: 'I.14', ambito: 'A3', actividad: 'Envío semanal de libros BV',
    nombre: 'N° semanas que fueron enviados libros de la Biblioteca Viajera al hogar',
    tipo: 'operativo', meta: '30', metaNum: 30, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.15', ambito: 'A3', actividad: 'Envío semanal de libros BV',
    nombre: '% de familias que reciben libros durante el año',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.16', ambito: 'A3', actividad: 'Envío semanal de libros BV',
    nombre: 'Promedio de libros recibidos por las familias',
    tipo: 'táctico', meta: '10', metaNum: 10, unidad: 'promedio', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.17', ambito: 'A3', actividad: 'Ritos al enviar libros',
    nombre: '% de salas que desarrollan ritos al momento de enviar los libros',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.18', ambito: 'A3', actividad: 'Cartillas formativas',
    nombre: 'Promedio de cartillas enviadas a las familias',
    tipo: 'operativo', meta: '4', metaNum: 4, unidad: 'promedio', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.19', ambito: 'A3', actividad: 'Cartillas formativas',
    nombre: '% de salas que envían cartillas a las familias',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.20', ambito: 'A3', actividad: 'Calendario de invierno',
    nombre: '% de salas que envían el calendario de invierno',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'anual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },

  // ── E4 → A3 · Narración (Baúl MFC) ── (estrategia)
  {
    id: 'I.21', ambito: 'A3', actividad: 'Actividades de narración con Baúl MFC',
    nombre: '% de salas que desarrollan actividades de narración basadas en el Baúl MFC',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },

  // ── E5 → A3 · Encuentros comunitarios ── (estrategia)
  {
    id: 'I.22', ambito: 'A3', actividad: 'Comités comunales',
    nombre: 'N° de comités comunales en los que participa el jardín infantil',
    tipo: 'operativo', meta: '3', metaNum: 3, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.23', ambito: 'A3', actividad: 'Fiesta de la familia',
    nombre: '% de familias que participan en la actividad (Fiesta de la familia)',
    tipo: 'táctico', meta: '25%', metaNum: 0.25, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },

  // ── E6 → A3 · Talleres y encuentros monitores ── (estrategia)
  {
    id: 'I.24', ambito: 'A3', actividad: 'Talleres formativos para MPC',
    nombre: 'N° de talleres formativos desarrollados para madres, padres y cuidadores en promedio por sala',
    tipo: 'operativo', meta: '4', metaNum: 4, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.25', ambito: 'A3', actividad: 'Talleres formativos para MPC',
    nombre: 'Promedio de asistencia a los talleres formativos para madres, padres y cuidadores',
    tipo: 'táctico', meta: '60%', metaNum: 0.60, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.26', ambito: 'A3', actividad: 'Talleres formativos para MPC',
    nombre: '% de talleres aplicados por dupla de monitores (apoderado-agente educativa)',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.27', ambito: 'A3', actividad: 'Encuentros padre/madre-hijo/a',
    nombre: 'N° de encuentros "padre/madre/cuidador-hijo/a" desarrollados en promedio por sala',
    tipo: 'operativo', meta: '2', metaNum: 2, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.28', ambito: 'A3', actividad: 'Encuentros padre/madre-hijo/a',
    nombre: 'Promedio de asistencia a los encuentros formativos para madres, padres y cuidadores, y sus hijos/as',
    tipo: 'táctico', meta: '80%', metaNum: 0.80, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'estrategia',
  },
  {
    id: 'I.29', ambito: 'A3', actividad: 'Formación territorial de monitores',
    nombre: 'N° formaciones territoriales de monitores desarrolladas',
    tipo: 'operativo', meta: '1', metaNum: 1, unidad: 'conteo', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.30', ambito: 'A3', actividad: 'Formación territorial de monitores',
    nombre: '% de salas representadas por apoderados en la formación territorial',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.31', ambito: 'A3', actividad: 'Formación territorial de monitores',
    nombre: '% de salas representadas por agentes educativas en la formación territorial',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.32', ambito: 'A3', actividad: 'Encuentros formativos de monitores en jardín',
    nombre: 'N° de encuentros formativos desarrollados en el jardín infantil',
    tipo: 'operativo', meta: '6', metaNum: 6, unidad: 'conteo', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.33', ambito: 'A3', actividad: 'Encuentros formativos de monitores en jardín',
    nombre: 'Promedio de asistencia de apoderados a los encuentros formativos de jardín infantil',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },
  {
    id: 'I.34', ambito: 'A3', actividad: 'Encuentros formativos de monitores en jardín',
    nombre: 'Promedio de asistencia de agentes educativas a los encuentros formativos de jardín infantil',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Consultor', clasificacion: 'estrategia',
  },

  // ── Productos P1 → A1 ── (producto)
  {
    id: 'I.35', ambito: 'A1', actividad: 'Plan de acción (PME/PEI)',
    nombre: 'Plan de acción para la alianza familia jardín diseñado e incorporado en PME y/o PEI',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.36', ambito: 'A1', actividad: 'Plan de acción (PME/PEI)',
    nombre: '% de acciones implementadas del plan de acción',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.37', ambito: 'A1', actividad: 'Plan de acción (PME/PEI)',
    nombre: '% de metas logradas del plan de acción',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },

  // ── Productos P2 → A2 ── (producto)
  {
    id: 'I.38', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: '% de agentes educativas con malla formativa completa',
    tipo: 'táctico', meta: '90%', metaNum: 0.90, unidad: '%', frecuencia: 'anual',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.39', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: 'Jardín infantil desarrolla definición operativa del Rol Pedagógico',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.40', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: '% de salas que desarrollan actividades de Relatos Familiares',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.41', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: '% de salas que desarrollan experiencias pedagógicas con familias',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.42', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: '% de salas que realizan procesos de documentación pedagógica con familias',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.43', ambito: 'A2', actividad: 'Agentes educativas formadas',
    nombre: '% de salas que realizan voluntariados con las familias',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },

  // ── Productos P3 → A3 ── (producto)
  {
    id: 'I.44', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: 'Jardín infantil cuenta con estrategia comunicacional clara y efectiva (multicanal y bidireccional)',
    tipo: 'táctico', meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.45', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de apoderados entrevistados por sala en una ocasión',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.46', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de apoderados entrevistados por sala en más de una ocasión',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.47', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% asistencia promedio a reuniones de apoderados',
    tipo: 'táctico', meta: '60%', metaNum: 0.60, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.48', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de salas que utilizan la bitácora como medio de comunicación',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'semestral',
    fuente: 'Consultor', clasificacion: 'producto',
  },
  {
    id: 'I.49', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de familias que participan en experiencias pedagógicas',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.50', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de familias que participan como voluntarios',
    tipo: 'táctico', meta: '50%', metaNum: 0.50, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.51', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de familias que cumplen con rol pedagógico definido por el jardín infantil',
    tipo: 'táctico', meta: '75%', metaNum: 0.75, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.52', ambito: 'A3', actividad: 'Familias participan en jardín',
    nombre: '% de familias que participan en actividades de narración basadas en el Baúl MFC',
    tipo: 'táctico', meta: '80%', metaNum: 0.80, unidad: '%', frecuencia: 'semestral',
    fuente: 'Jardín', clasificacion: 'producto',
  },

  // ── Productos P4 → A3 ── (producto)
  {
    id: 'I.53', ambito: 'A3', actividad: 'Apoderados formados Entre Familias',
    nombre: '% de familias que participan en talleres Entre Familias',
    tipo: 'táctico', meta: '100%', metaNum: 1.0, unidad: '%', frecuencia: 'mensual',
    fuente: 'Jardín', clasificacion: 'producto',
  },
  {
    id: 'I.54', ambito: 'A3', actividad: 'Apoderados formados Entre Familias',
    nombre: '% de familias que completan ciclo de formación de talleres Entre Familias',
    tipo: 'táctico', meta: '50%', metaNum: 0.50, unidad: '%', frecuencia: 'anual',
    fuente: 'Jardín', clasificacion: 'producto',
  },
];

// Acceso por perfil (basado en matriz_única real)
export const ACCESO_PERFIL = {
  escuela:      { nivel: 'Centro', label: 'Escuela / Jardín' },
  sostenedor:   { nivel: 'SLEP',   label: 'Sostenedor' },
  consultor:    { nivel: 'Total',  label: 'Consultor / Coordinación / CAP' },
};
