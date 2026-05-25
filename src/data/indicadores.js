// Catálogo de indicadores PAF
// Basado en matriz_unica_PAF_Escolar.xlsx y Sistema_indicadores_TDC_PAF_Parvulario.xlsx
// Estructura: programa → ámbito → actividad → indicador

export const AMBITOS_ESCOLAR = [
  { id: 'A1', codigo: 'A.1', nombre: 'Liderazgo y gestión de la alianza familia-escuela', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación de apoderados', color: 'lime' },
  { id: 'A4', codigo: 'A.4', nombre: 'Fomento lector y desarrollo del lenguaje', color: 'navy' },
];

export const AMBITOS_PARVULARIO = [
  { id: 'A1', codigo: 'A.1', nombre: 'Gestión institucional de la alianza familia-jardín', color: 'navy' },
  { id: 'A2', codigo: 'A.2', nombre: 'Formación equipos educativos', color: 'sky' },
  { id: 'A3', codigo: 'A.3', nombre: 'Participación y formación de apoderados', color: 'lime' },
];

// Indicadores escolar (subset representativo de los 50 reales)
export const INDICADORES_ESCOLAR = [
  // Ámbito 1
  { id: 'I.1',  ambito: 'A1', actividad: 'Equipo de Gestión',       nombre: 'Se conforma Equipo de Gestión Escolar',          tipo: 'táctico',   meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',     fuente: 'Consultor' },
  { id: 'I.2',  ambito: 'A1', actividad: 'Equipo de Gestión',       nombre: 'N° reuniones anuales del Equipo de Gestión',     tipo: 'operativo', meta: 10,   metaNum: 10,  unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.3',  ambito: 'A1', actividad: 'Equipo de Gestión',       nombre: '% asistencia anual de directores a reuniones',   tipo: 'táctico',   meta: '100%', metaNum: 1.0, unidad: '%',       frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.4',  ambito: 'A1', actividad: 'Equipo de Gestión',       nombre: '% asistencia coordinadores a reuniones',          tipo: 'táctico',   meta: '100%', metaNum: 1.0, unidad: '%',       frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.5',  ambito: 'A1', actividad: 'Coordinación',            nombre: 'N° de reuniones de coordinación',                 tipo: 'operativo', meta: 8,    metaNum: 8,   unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.6',  ambito: 'A1', actividad: 'Formación Liderazgo',     nombre: 'Director asiste a formación de liderazgo',        tipo: 'táctico',   meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'semestral', fuente: 'Consultor' },
  { id: 'I.9',  ambito: 'A1', actividad: 'Plan de Acción',          nombre: 'Existe plan de acción familia-escuela diseñado',  tipo: 'táctico',   meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',     fuente: 'Consultor' },
  { id: 'I.10', ambito: 'A1', actividad: 'Plan de Acción',          nombre: 'Plan de acción familia-escuela actualizado',      tipo: 'táctico',   meta: 'Sí', metaNum: 1.0, unidad: 'binario', frecuencia: 'anual',     fuente: 'Consultor' },

  // Ámbito 2
  { id: 'I.11', ambito: 'A2', actividad: 'Módulos formativos',      nombre: 'N° módulos formativos en la escuela',             tipo: 'operativo', meta: 8,    metaNum: 8,   unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.12', ambito: 'A2', actividad: 'Módulos formativos',      nombre: '% profesores jefe en módulos formativos',         tipo: 'táctico',   meta: '85%',  metaNum: 0.85, unidad: '%',      frecuencia: 'mensual',   fuente: 'Consultor' },
  { id: 'I.15', ambito: 'A2', actividad: 'Formaciones territoriales', nombre: 'N° formaciones territoriales anuales',         tipo: 'operativo', meta: 4,    metaNum: 4,   unidad: 'conteo',  frecuencia: 'trimestral',fuente: 'Consultor' },
  { id: 'I.16', ambito: 'A2', actividad: 'Formaciones territoriales', nombre: '% profesores jefe en formaciones territoriales',tipo: 'táctico', meta: '80%',  metaNum: 0.80, unidad: '%',     frecuencia: 'trimestral',fuente: 'Consultor' },
  { id: 'I.19', ambito: 'A2', actividad: 'Entrevista de apoderados',nombre: '% familias entrevistadas (≥1 vez por sala)',      tipo: 'táctico',   meta: '90%',  metaNum: 0.90, unidad: '%',      frecuencia: 'semestral', fuente: 'UTP' },
  { id: 'I.20', ambito: 'A2', actividad: 'Entrevista de apoderados',nombre: '% familias entrevistadas (≥2 veces por sala)',    tipo: 'táctico',   meta: '70%',  metaNum: 0.70, unidad: '%',      frecuencia: 'semestral', fuente: 'UTP' },

  // Ámbito 3
  { id: 'I.21', ambito: 'A3', actividad: 'Talleres apoderados',     nombre: 'N° Talleres Apoderados presenciales por sala',    tipo: 'operativo', meta: 4,    metaNum: 4,   unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.22', ambito: 'A3', actividad: 'Talleres apoderados',     nombre: '% asistencia anual a Talleres presenciales',      tipo: 'táctico',   meta: '70%',  metaNum: 0.70, unidad: '%',      frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.23', ambito: 'A3', actividad: 'Talleres digitales',      nombre: 'N° Talleres Digitales enviados por sala',         tipo: 'operativo', meta: 2,    metaNum: 2,   unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.25', ambito: 'A3', actividad: 'Formación monitores',     nombre: 'N° formaciones a apoderados monitores',           tipo: 'operativo', meta: 3,    metaNum: 3,   unidad: 'conteo',  frecuencia: 'trimestral',fuente: 'Consultor' },
  { id: 'I.26', ambito: 'A3', actividad: 'Formación monitores',     nombre: 'N° apoderados monitores formados',                tipo: 'táctico',   meta: 20,   metaNum: 20,  unidad: 'conteo',  frecuencia: 'trimestral',fuente: 'Consultor' },
  { id: 'I.27', ambito: 'A3', actividad: 'Implementación monitores',nombre: 'N° salas cubiertas por apoderados monitores',     tipo: 'táctico',   meta: 8,    metaNum: 8,   unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Consultor' },

  // Ámbito 4 — Fomento lector
  { id: 'I.28', ambito: 'A4', actividad: 'Biblioteca Viajera',      nombre: 'N° semanas envío Biblioteca Viajera',             tipo: 'operativo', meta: 24,   metaNum: 24,  unidad: 'conteo',  frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.29', ambito: 'A4', actividad: 'Biblioteca Viajera',      nombre: 'Promedio libros BV recibidos por estudiante',      tipo: 'táctico',   meta: 8,    metaNum: 8,   unidad: 'promedio',frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.30', ambito: 'A4', actividad: 'Lecturas Viajeras',       nombre: 'Promedio envío Lecturas Viajeras por sala',        tipo: 'operativo', meta: 12,   metaNum: 12,  unidad: 'promedio',frecuencia: 'mensual',   fuente: 'Docente' },
  { id: 'I.31', ambito: 'A4', actividad: 'Mantel de Palabras',      nombre: '% salas que envían Mantel de Palabras',            tipo: 'táctico',   meta: '100%', metaNum: 1.0, unidad: '%',       frecuencia: 'semestral', fuente: 'Docente' },
  { id: 'I.32', ambito: 'A4', actividad: 'Talleres estudiantes',    nombre: 'N° talleres para estudiantes por sala (1°-8°)',    tipo: 'operativo', meta: 6,    metaNum: 6,   unidad: 'conteo',  frecuencia: 'trimestral',fuente: 'Docente' },
  { id: 'I.43', ambito: 'A4', actividad: 'Biblioteca Viajera',      nombre: 'Promedio libros BV que declaran usar familias',   tipo: 'táctico',   meta: 5,    metaNum: 5,   unidad: 'promedio',frecuencia: 'semestral', fuente: 'Consultor' },
  { id: 'I.45', ambito: 'A4', actividad: 'Mantel de Palabras',      nombre: '% apoderados que declara usar Mantel de Palabras',tipo: 'táctico',   meta: '60%',  metaNum: 0.60, unidad: '%',      frecuencia: 'semestral', fuente: 'Consultor' },
];

// Indicadores parvulario (subset representativo)
export const INDICADORES_PARVULARIO = [
  { id: 'I.1',  ambito: 'A1', actividad: 'Reuniones directora',       nombre: 'N° reuniones desarrolladas con directora',        tipo: 'operativo', meta: 11,    metaNum: 11,  unidad: 'conteo', frecuencia: 'mensual', fuente: 'Consultor' },
  { id: 'I.2',  ambito: 'A1', actividad: 'Reuniones educadoras',      nombre: 'N° reuniones desarrolladas con educadoras',       tipo: 'operativo', meta: 11,    metaNum: 11,  unidad: 'conteo', frecuencia: 'mensual', fuente: 'Consultor' },
  { id: 'I.3',  ambito: 'A1', actividad: 'Reuniones educadoras',      nombre: '% educadoras que participan en reuniones',         tipo: 'táctico',   meta: '75%',  metaNum: 0.75, unidad: '%',     frecuencia: 'mensual', fuente: 'Consultor' },
  { id: 'I.4',  ambito: 'A1', actividad: 'Reuniones directoras',      nombre: 'N° reuniones territoriales con directoras',        tipo: 'operativo', meta: 2,     metaNum: 2,   unidad: 'conteo', frecuencia: 'semestral', fuente: 'Consultor' },
  { id: 'I.5',  ambito: 'A1', actividad: 'Reuniones directoras',      nombre: '% directoras en reuniones territoriales',          tipo: 'táctico',   meta: '90%',  metaNum: 0.90, unidad: '%',     frecuencia: 'semestral', fuente: 'Consultor' },

  { id: 'I.8',  ambito: 'A2', actividad: 'Sensibilización',           nombre: 'N° instancias sensibilización del Programa',      tipo: 'operativo', meta: 1,     metaNum: 1,   unidad: 'conteo', frecuencia: 'anual',   fuente: 'Consultor' },
  { id: 'I.9',  ambito: 'A2', actividad: 'Sensibilización',           nombre: '% agentes educativas en sensibilización',          tipo: 'táctico',   meta: '90%',  metaNum: 0.90, unidad: '%',     frecuencia: 'anual',   fuente: 'Consultor' },
  { id: 'I.11', ambito: 'A2', actividad: 'Formaciones AE',            nombre: 'N° formaciones anuales para agentes educativas',  tipo: 'operativo', meta: 4,     metaNum: 4,   unidad: 'conteo', frecuencia: 'trimestral', fuente: 'Consultor' },
  { id: 'I.12', ambito: 'A2', actividad: 'Formaciones AE',            nombre: '% agentes educativas en formaciones',              tipo: 'táctico',   meta: '85%',  metaNum: 0.85, unidad: '%',     frecuencia: 'trimestral', fuente: 'Consultor' },
  { id: 'I.13', ambito: 'A2', actividad: 'Módulos CAUE',              nombre: 'N° módulos formativos desarrollados en CAUE',     tipo: 'operativo', meta: 4,     metaNum: 4,   unidad: 'conteo', frecuencia: 'trimestral', fuente: 'Consultor' },

  { id: 'I.15', ambito: 'A3', actividad: 'Biblioteca Viajera',        nombre: 'N° semanas envío libros BV',                       tipo: 'operativo', meta: 24,    metaNum: 24,  unidad: 'conteo', frecuencia: 'mensual', fuente: 'Jardín' },
  { id: 'I.16', ambito: 'A3', actividad: 'Biblioteca Viajera',        nombre: '% familias que reciben libros',                    tipo: 'táctico',   meta: '90%',  metaNum: 0.90, unidad: '%',     frecuencia: 'mensual', fuente: 'Jardín' },
  { id: 'I.17', ambito: 'A3', actividad: 'Biblioteca Viajera',        nombre: 'Promedio libros recibidos por familias',           tipo: 'táctico',   meta: 6,     metaNum: 6,   unidad: 'promedio',frecuencia: 'mensual', fuente: 'Jardín' },
  { id: 'I.23', ambito: 'A3', actividad: 'Talleres apoderados',       nombre: 'N° talleres formativos para apoderados (prom)',    tipo: 'operativo', meta: 6,     metaNum: 6,   unidad: 'conteo', frecuencia: 'mensual', fuente: 'Jardín' },
  { id: 'I.24', ambito: 'A3', actividad: 'Talleres apoderados',       nombre: 'Promedio asistencia a talleres apoderados',        tipo: 'táctico',   meta: '70%',  metaNum: 0.70, unidad: '%',     frecuencia: 'mensual', fuente: 'Jardín' },
  { id: 'I.34', ambito: 'A3', actividad: 'Plan de acción',            nombre: 'Plan de acción diseñado e incorporado en PME/PEI', tipo: 'táctico',   meta: 'Sí',  metaNum: 1.0, unidad: 'binario',frecuencia: 'anual',  fuente: 'Consultor' },
  { id: 'I.35', ambito: 'A3', actividad: 'Plan de acción',            nombre: '% acciones implementadas del plan de acción',      tipo: 'táctico',   meta: '75%',  metaNum: 0.75, unidad: '%',     frecuencia: 'semestral', fuente: 'Consultor' },
  { id: 'I.36', ambito: 'A3', actividad: 'Plan de acción',            nombre: '% metas logradas del plan de acción',              tipo: 'táctico',   meta: '75%',  metaNum: 0.75, unidad: '%',     frecuencia: 'semestral', fuente: 'Consultor' },
];

// Acceso por perfil (basado en matriz_única real)
export const ACCESO_PERFIL = {
  escuela:      { nivel: 'Centro', label: 'Escuela / Jardín' },
  sostenedor:   { nivel: 'SLEP',   label: 'Sostenedor' },
  consultor:    { nivel: 'Total',  label: 'Consultor / Coordinación / CAP' },
};
