// Punto de entrada unificado para hooks de datos.
// En modo sintético (actual) re-exporta desde syntheticQueries.js —
// todos los datos vienen del catálogo local, sin Firestore.
//
// Para volver a Firestore: reemplazar esta línea por la implementación
// original de useQuery + getDocs que estaba aquí antes del 2026-07-07.

export {
  useSleps,
  useSlep,
  useEstablecimientos,
  useEscuelas,
  useJardines,
  useEstablecimiento,
  useEstablecimientosPorSlep,
  useIndicadores,
  useAmbitos,
  useMesCerrado,
  usePipelineMetadata,
  useProgresoTrimestral,
  useProgresoAnio,
  useValoresIndicador,
  useValoresAnio,
} from '../data/syntheticQueries.js';
