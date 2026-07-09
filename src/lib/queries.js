// Punto de entrada unificado para hooks de datos.
// Post eliminación de datos sintéticos: todos los hooks se sirven desde Firestore
// (o desde el catálogo local para ámbitos/indicadores). No hay dispatcher ni flags.

export {
  useSleps,
  useSlep,
  useEscuelas,
  useJardines,
  useEstablecimientos,
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
} from '../data/realQueries.js';
