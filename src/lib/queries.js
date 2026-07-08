// Punto de entrada unificado para hooks de datos.
// Etapa 3: switch por track (escolar/parvulario) controlado por src/data/dataSource.js.
// El flag default es 'synthetic' para ambos → comportamiento idéntico al de antes.
// Cuando el flag de un track pase a 'real', los hooks track-specific se enrutan a
// src/data/realQueries.js. Los hooks track-agnostic (sleps, catálogo, ámbitos, metadata)
// se sirven siempre desde el sintético hasta que ambos tracks estén en 'real'.

import * as synth from '../data/syntheticQueries.js';
import * as real from '../data/realQueries.js';
import { sourceFor } from '../data/dataSource.js';

// ─── Cross-cutting (no track) ────────────────────────────────────────────

export const useSleps = synth.useSleps;
export const useSlep = synth.useSlep;
export const useAmbitos = synth.useAmbitos;
export const useMesCerrado = synth.useMesCerrado;
export const usePipelineMetadata = synth.usePipelineMetadata;

// ─── Indicadores del catálogo (siempre sintético) ────────────────────────
// El catálogo de 106 indicadores vive en catalog.json comprometido; no se lee de Firestore.

export const useIndicadores = synth.useIndicadores;

// ─── Track-specific: Establecimientos ─────────────────────────────────────

export function useEscuelas() {
  return sourceFor('escolar') === 'real' ? real.useEscuelas() : synth.useEscuelas();
}

export function useJardines() {
  return sourceFor('parvulario') === 'real' ? real.useJardines() : synth.useJardines();
}

function anyReal() {
  return sourceFor('escolar') === 'real' || sourceFor('parvulario') === 'real';
}

export function useEstablecimientos() {
  const es = sourceFor('escolar');
  const pv = sourceFor('parvulario');
  if (es === 'synthetic' && pv === 'synthetic') return synth.useEstablecimientos();
  if (es === 'real' && pv === 'real') return real.useEstablecimientos();
  // Mixed → tomar cada track de su fuente y concatenar
  const escuelas = useEscuelas();
  const jardines = useJardines();
  if (escuelas.isLoading || jardines.isLoading) return { data: null, isLoading: true, error: null };
  if (escuelas.error || jardines.error) return { data: null, isLoading: false, error: escuelas.error || jardines.error };
  return { data: [...(escuelas.data || []), ...(jardines.data || [])], isLoading: false, error: null };
}

export function useEstablecimiento(estId) {
  return anyReal() ? real.useEstablecimiento(estId) : synth.useEstablecimiento(estId);
}

export function useEstablecimientosPorSlep(slepId) {
  return anyReal()
    ? real.useEstablecimientosPorSlep(slepId)
    : synth.useEstablecimientosPorSlep(slepId);
}

// ─── Progreso trimestral / Valores por indicador ─────────────────────────
// El llamador no siempre conoce el programa; se enruta consultando el flag combinado.
// El hook real filtra por establecimientoId y devuelve lo que exista.

export function useProgresoTrimestral(establecimientoId, anio) {
  return anyReal()
    ? real.useProgresoTrimestral(establecimientoId, anio)
    : synth.useProgresoTrimestral(establecimientoId, anio);
}

export function useProgresoAnio(anio) {
  return anyReal() ? real.useProgresoAnio(anio) : synth.useProgresoAnio(anio);
}

export function useValoresIndicador(establecimientoId, anio) {
  return anyReal()
    ? real.useValoresIndicador(establecimientoId, anio)
    : synth.useValoresIndicador(establecimientoId, anio);
}

export function useValoresAnio(anio) {
  return anyReal() ? real.useValoresAnio(anio) : synth.useValoresAnio(anio);
}
