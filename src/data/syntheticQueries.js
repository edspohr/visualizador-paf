// Capa de datos sintéticos locales.
// Exporta hooks con la misma firma que src/lib/queries.js pero devuelven
// datos estáticos del catálogo local (sin Firestore).
// Cada hook devuelve { data, isLoading: false, error: null } de forma síncrona.

import { SLEPS, ESCUELAS, JARDINES } from './establecimientos.js';
import { INDICADORES_ESCOLAR, INDICADORES_PARVULARIO, AMBITOS_ESCOLAR, AMBITOS_PARVULARIO } from './indicadores.js';

const TODOS_ESTABLECIMIENTOS = [...ESCUELAS, ...JARDINES];

const SLEPS_MAP = Object.fromEntries(SLEPS.map(s => [s.id, s]));

// Metadato de mes cerrado: mes anterior al actual
function mesCerradoSintetico() {
  const hoy = new Date();
  const mes = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
  const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  return { mes, anio, cerradoPor: 'synthetic', ultimoSyncExitoso: true };
}

function ok(data) {
  return { data, isLoading: false, error: null };
}

// ─── Sostenedores ─────────────────────────────────────────────────────────

export function useSleps() {
  return ok(SLEPS);
}

export function useSlep(slepId) {
  return ok(SLEPS_MAP[slepId] ?? null);
}

// ─── Establecimientos ─────────────────────────────────────────────────────

export function useEstablecimientos() {
  return ok(TODOS_ESTABLECIMIENTOS);
}

export function useEscuelas() {
  return ok(ESCUELAS);
}

export function useJardines() {
  return ok(JARDINES);
}

export function useEstablecimiento(estId) {
  return ok(TODOS_ESTABLECIMIENTOS.find(e => e.id === estId) ?? null);
}

export function useEstablecimientosPorSlep(slepId) {
  return ok(TODOS_ESTABLECIMIENTOS.filter(e => e.slep === slepId));
}

// ─── Indicadores ──────────────────────────────────────────────────────────

export function useIndicadores(programa) {
  const data = programa === 'parvulario' ? INDICADORES_PARVULARIO : INDICADORES_ESCOLAR;
  return ok(data);
}

// ─── Ámbitos ──────────────────────────────────────────────────────────────

export function useAmbitos(programa) {
  const data = programa === 'parvulario' ? AMBITOS_PARVULARIO : AMBITOS_ESCOLAR;
  return ok(data);
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export function useMesCerrado() {
  return ok(mesCerradoSintetico());
}

export function usePipelineMetadata() {
  // Devuelve null para que PipelineStatusBanner no renderice nada
  return ok(null);
}

// ─── Progreso trimestral (sin datos sintéticos: devuelve array vacío) ─────
// ProgresoTrimestralPanel maneja el array vacío mostrando estado vacío.

export function useProgresoTrimestral(_establecimientoId, _anio) {
  return ok([]);
}

export function useProgresoAnio(_anio) {
  return ok([]);
}

// ─── Valores por indicador (sin datos atómicos: devuelve array vacío) ─────
// IndicatorPanel cae al generarValorIndicador cuando valoresReales está vacío.

export function useValoresIndicador(_establecimientoId, _anio) {
  return ok([]);
}

export function useValoresAnio(_anio) {
  return ok([]);
}
