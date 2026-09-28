// Cascading filters for the national view and the comparador (L-08, S-09):
// each dropdown only lists values that exist given the other active filters,
// so combinations with no establishments (e.g. "2025 – Del Pino") cannot be
// picked.

import { comunaCanonica } from './comunas.js';

export const canon = (v) => (v == null ? '' : String(v).trim());
export const canonComuna = (v) => comunaCanonica(v) ?? '';

// `anio`: calendar year selected. An establishment only takes part from the
// first year of its cohort ("2026-2027" is not in the program in 2025).
export function cumpleFiltros(e, { anio = null, slep = 'TODOS', cohorte = 'TODAS', comuna = 'TODAS' }) {
  const inicio = Number(canon(e.cohorte).split('-')[0]);
  return (anio == null || !inicio || inicio <= anio)
    && (slep === 'TODOS' || canon(e.slep) === slep)
    && (cohorte === 'TODAS' || canon(e.cohorte) === cohorte)
    && (comuna === 'TODAS' || canonComuna(e.comuna) === comuna);
}

/**
 * Options for each filter, computed from the establishments that match the
 * *other* active filters.
 * @returns {{ sleps: string[], cohortes: string[], comunas: string[] }}
 */
export function opcionesCascada(todos, filtros) {
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  return {
    sleps: uniq(todos.filter(e => cumpleFiltros(e, { ...filtros, slep: 'TODOS' })).map(e => canon(e.slep))),
    cohortes: uniq(todos.filter(e => cumpleFiltros(e, { ...filtros, cohorte: 'TODAS' })).map(e => canon(e.cohorte))).sort(),
    comunas: uniq(todos.filter(e => cumpleFiltros(e, { ...filtros, comuna: 'TODAS' })).map(e => canonComuna(e.comuna))).sort(),
  };
}

/**
 * Returns the filters with any selection that is no longer among the options
 * reset to "all". Returns the same object when nothing changes.
 */
export function sanearFiltros(filtros, opciones) {
  const next = { ...filtros };
  if (next.slep !== 'TODOS' && !opciones.sleps.includes(next.slep)) next.slep = 'TODOS';
  if (next.cohorte !== 'TODAS' && !opciones.cohortes.includes(next.cohorte)) next.cohorte = 'TODAS';
  if (next.comuna !== 'TODAS' && !opciones.comunas.includes(next.comuna)) next.comuna = 'TODAS';
  const changed = next.slep !== filtros.slep || next.cohorte !== filtros.cohorte || next.comuna !== filtros.comuna;
  return changed ? next : filtros;
}
