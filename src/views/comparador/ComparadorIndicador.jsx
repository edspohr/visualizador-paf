import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { resolverIndicador } from '../../data/establecimientos.js';
import { isAplicable2026 } from '../../data/scope.js';
import { formatValue } from '../../data/expectedValue.js';
import { ambitoCodigo, ambitoNombre, indicadorCodigo } from '../../lib/labels.js';
import { useValoresAnioNivel, useValoresAnioNiveles } from '../../lib/queries.js';
import { getCoberturaEscolar } from '../../data/coverage.js';
import { getCoberturaLabel } from '../../data/establecimientos.js';
import homologacion from '../../data/homologacionEscolar.json';
import { cumpleFiltros, opcionesCascada, sanearFiltros } from '../../lib/filtros.js';

// ─── Homologación Escolar 2025 ↔ 2026 ────────────────────────────────────────
// Map from 2025 indicator ID → 2026 indicator ID (canonical dot-notation).
const HOMOL_2025_TO_2026 = new Map(homologacion.mapping.map(m => [m.id2025, m.id2026]));
const HOMOL_DISCONTINUED = new Set(homologacion.discontinued2025.map(m => m.id));
const HOMOL_NEW_IN_2026 = new Set(homologacion.newIn2026.map(m => m.id));

// Retranslate a per-establishment value map from 2025 indicator IDs → 2026 IDs.
// Entries without a 2026 equivalent are dropped (discontinued indicators).
function remapear2025(valoresMap2025) {
  const out = new Map();
  for (const [estId, indMap] of valoresMap2025) {
    const remapped = new Map();
    for (const [id2025, valor] of indMap) {
      const id2026 = HOMOL_2025_TO_2026.get(id2025);
      if (id2026) remapped.set(id2026, valor);
    }
    if (remapped.size > 0) out.set(estId, remapped);
  }
  return out;
}

// ─── Constantes de niveles operativos ────────────────────────────────────────
// Se declaran a nivel de módulo para evitar recreación entre renders y para
// que el orden de las filas al desglosar "por nivel" sea determinístico.
export const NIVELES_OPTS = [
  { v: 'TODOS', l: 'Todos los niveles' },
  { v: 'sala_cuna_menor', l: 'Sala cuna menor' },
  { v: 'sala_cuna_mayor', l: 'Sala cuna mayor' },
  { v: 'nivel_medio_menor', l: 'Nivel medio menor' },
  { v: 'nivel_medio_mayor', l: 'Nivel medio mayor' },
  { v: 'transicion_1', l: 'Transición 1' },
  { v: 'transicion_2', l: 'Transición 2' },
];
const NIVELES_LABEL = Object.fromEntries(NIVELES_OPTS.map(n => [n.v, n.l]));
const NIVELES_OPERATIVOS = NIVELES_OPTS.filter(n => n.v !== 'TODOS').map(n => n.v);

// ─── Helpers puros de agregación ─────────────────────────────────────────────

// Same rules as the page filters (comuna normalized, cohort started by `year`).
function filtrarEstablecimientos(todos, { year, slep, cohorte, comuna }) {
  return todos.filter(e => cumpleFiltros(e, { anio: year, slep, cohorte, comuna }));
}

// Per-side cascading options (L-08): only values that exist under that side's
// other filters.
function useOpcionesLado(todos, filters, setFilters, sostenedores) {
  const opciones = useMemo(
    () => opcionesCascada(todos, { anio: filters.year, slep: filters.slep, cohorte: filters.cohorte, comuna: filters.comuna }),
    [todos, filters.year, filters.slep, filters.cohorte, filters.comuna],
  );
  useEffect(() => {
    const saneado = sanearFiltros(filters, opciones);
    if (saneado !== filters) setFilters(saneado);
  }, [filters, opciones, setFilters]);
  return {
    sleps: opciones.sleps.map(id => sostenedores.find(s => s.id === id)).filter(Boolean),
    cohortes: opciones.cohortes,
    comunas: opciones.comunas,
  };
}

function buildLabel({ slep, cohorte, comuna, nivel, year }, sostenedores = []) {
  const parts = [String(year)];
  if (slep !== 'TODOS') parts.push(sostenedores.find(s => s.id === slep)?.nombre.replace(/^SLEP\s+/, '') ?? slep);
  else parts.push('Todos los sostenedores');
  if (cohorte !== 'TODAS') parts.push(`Cohorte ${cohorte}`);
  if (comuna !== 'TODAS') parts.push(comuna);
  if (nivel && nivel !== 'TODOS') parts.push(NIVELES_LABEL[nivel] ?? nivel);
  return parts.join(' · ');
}

// Cuenta activa de filtros avanzados (los que están dentro del disclosure "Más filtros").
function conteoFiltrosAvanzados({ cohorte, comuna, nivel }) {
  let n = 0;
  if (cohorte !== 'TODAS') n += 1;
  if (comuna !== 'TODAS') n += 1;
  if (nivel && nivel !== 'TODOS') n += 1;
  return n;
}

// One indicator for one side, in the indicator's own unit (R2-15, 2026-10-22):
// mean of the reported values (centres without a value do not enter), how
// many centres reported out of those it applies to, and the mean meta of
// those centres (metas change with the year of implementation and, for
// I.26/I.46, with each school's salas; see resolverIndicador).
function resumenNativo(ind, ests, valores, mesRef) {
  const aplican = ests.filter(e => isAplicable2026(ind, e, mesRef));
  let suma = 0, n = 0, sumaMeta = 0, nMeta = 0;
  for (const e of aplican) {
    const meta = resolverIndicador(ind, e).metaNum;
    if (meta !== null && meta !== undefined) { sumaMeta += meta; nMeta += 1; }
    const v = valores.get(e.id)?.get(ind.id);
    if (v === null || v === undefined) continue;
    suma += v;
    n += 1;
  }
  return {
    valor: n ? suma / n : null,
    nConDato: n,
    nAplican: aplican.length,
    meta: nMeta ? sumaMeta / nMeta : (ind.metaNum ?? null),
  };
}

// Devuelve las filas del bar chart para un lado (A o B).
//   - Modo agrupado + indicadorFocal='TODOS': una fila por indicador, en su unidad.
//   - Modo agrupado + indicadorFocal fijo: una fila con el promedio del indicador focal.
//   - Modo desglose 'establecimiento' + indicadorFocal fijo: una fila por establecimiento.
//   - Modo desglose 'nivel' + indicadorFocal fijo con `desagregaNivel:true`: una fila por nivel.
//   - `aplica === false`: fila deshabilitada (nivel elegido con indicador que no desagrega).
export function computeSideData({
  todos,
  filters,
  INDS,
  ambitoScope,
  indicadorFocal,
  valoresMapByYear,
  mesRef,
  desglose,
  valoresNivel = null,
  valoresPorNivelBucket = null, // Map<nivel, Map<estId, Map<indId, valor>>> para desglose 'nivel'
}) {
  const ests = filtrarEstablecimientos(todos, filters);
  const nivelActivo = filters.nivel && filters.nivel !== 'TODOS';
  const valoresAgregados = valoresMapByYear.get(filters.year) ?? new Map();

  // Indicators without a meta but with a unit (Escolar I.24) are shown too:
  // the comparison is in the indicator's unit, not against the meta.
  const indsElegibles = INDS.filter(ind =>
    ind.unidad !== 'sin_meta' &&
    (ambitoScope === 'TODOS' || ind.ambito === ambitoScope) &&
    (indicadorFocal === 'TODOS' || ind.id === indicadorFocal)
  );

  function fuenteValores(ind) {
    if (nivelActivo && ind.desagregaNivel === true && valoresNivel) return valoresNivel;
    return valoresAgregados;
  }

  // Desglose por nivel: una fila por nivel operativo, requiere indicador focal con desagregaNivel.
  if (desglose === 'nivel' && indicadorFocal !== 'TODOS') {
    const ind = indsElegibles[0];
    if (!ind || ind.desagregaNivel !== true || !valoresPorNivelBucket) {
      // Fila deshabilitada por nivel — permite ver la lista completa con "—".
      return NIVELES_OPTS.filter(n => n.v !== 'TODOS').map(n => ({
        key: n.v,
        nombre: n.l,
        valor: null,
        meta: ind?.metaNum ?? null,
        unidad: ind?.unidad,
        ind,
        aplica: false,
      }));
    }
    return NIVELES_OPTS.filter(n => n.v !== 'TODOS').map(n => {
      const fuente = valoresPorNivelBucket.get(n.v);
      const r = fuente ? resumenNativo(ind, ests, fuente, mesRef) : { valor: null, meta: ind.metaNum };
      return {
        key: n.v,
        nombre: n.l,
        valor: r.valor,
        meta: r.meta,
        unidad: ind.unidad,
        ind,
        aplica: true,
      };
    });
  }

  if (desglose === 'establecimiento' && indicadorFocal !== 'TODOS') {
    const ind = indsElegibles[0];
    if (!ind) return [];
    const soportaNivel = ind.desagregaNivel === true;
    if (nivelActivo && !soportaNivel) {
      return ests.map(e => ({
        key: e.id, nombre: e.nombre, valor: null, meta: ind.metaNum,
        unidad: ind.unidad, ind, aplica: false, cobertura: null,
      }));
    }
    const fuente = fuenteValores(ind);
    return ests.map(e => {
      const applies = isAplicable2026(ind, e, mesRef);
      const v = applies ? (fuente.get(e.id)?.get(ind.id) ?? null) : null;
      // For Escolar, surface the manifest state so a missing value renders as
      // "sin fuente" vs "sin dato" vs "cero" instead of a bare "—".
      // Parvulario has no manifest — cobertura stays null and row falls back to "—".
      const cobertura = (v == null && applies)
        ? getCoberturaEscolar(e.id, filters.year, ind.id)
        : null;
      return {
        key: e.id,
        nombre: e.nombre,
        valor: v,
        meta: resolverIndicador(ind, e).metaNum,
        unidad: ind.unidad,
        ind,
        aplica: applies,
        cobertura,
      };
    });
  }

  return indsElegibles.map(ind => {
    const soportaNivel = ind.desagregaNivel === true;
    if (nivelActivo && !soportaNivel) {
      return {
        key: ind.id,
        nombre: ind.nombre,
        valor: null,
        meta: ind.metaNum,
        unidad: ind.unidad,
        ind,
        aplica: false,
      };
    }
    const r = resumenNativo(ind, ests, fuenteValores(ind), mesRef);
    return {
      key: ind.id,
      nombre: ind.nombre,
      valor: r.valor,
      meta: r.meta,
      nConDato: r.nConDato,
      nAplican: r.nAplican,
      unidad: ind.unidad,
      ind,
      aplica: true,
    };
  });
}

// Etiqueta corta del indicador para el eje: "Código — nombre truncado".
function truncNombreInd(ind, max = 60) {
  const full = `${indicadorCodigo(ind.id)} — ${ind.nombre}`;
  return full.length > max ? full.slice(0, max - 1) + '…' : full;
}

// ─── SideSelector: filtros por lado (Año + Sostenedor visibles siempre) ─────

function SideSelector({
  label,
  color,
  filters,
  onChange,
  slepsDisponibles,
  cohortesDisponibles,
  comunasDisponibles,
  summary,
  centros,
  showNivel,
}) {
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);
  const sc = "w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-dark outline-none";
  const nAvanzados = conteoFiltrosAvanzados(filters);

  return (
    <div className="flex-1 min-w-0 border rounded-xl p-4" style={{ borderColor: color }}>
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</p>
        <span className="text-[11px] text-gray-ui shrink-0">{centros} centros</span>
      </div>
      <p className="text-xs text-gray-dark mb-3 leading-snug">{summary}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Año</label>
          <select value={filters.year} onChange={e => onChange({ ...filters, year: Number(e.target.value) })} className={sc}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
          <select value={filters.slep} onChange={e => onChange({ ...filters, slep: e.target.value })} className={sc}>
            <option value="TODOS">Todos</option>
            {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>)}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAvanzadoAbierto(o => !o)}
        className="mt-3 flex items-center gap-1.5 text-xs text-gray-ui hover:text-gray-dark transition"
      >
        {avanzadoAbierto ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        <span>Más filtros</span>
        {nAvanzados > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-white" style={{ background: color }}>
            {nAvanzados}
          </span>
        )}
      </button>

      {avanzadoAbierto && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Cohorte</label>
            <select value={filters.cohorte} onChange={e => onChange({ ...filters, cohorte: e.target.value })} className={sc}>
              <option value="TODAS">Todas</option>
              {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Comuna</label>
            <select value={filters.comuna} onChange={e => onChange({ ...filters, comuna: e.target.value })} className={sc}>
              <option value="TODAS">Todas</option>
              {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {showNivel && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Nivel</label>
              <select value={filters.nivel} onChange={e => onChange({ ...filters, nivel: e.target.value })} className={sc}>
                {NIVELES_OPTS.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Segmented control para desglose ─────────────────────────────────────────

function SegmentedDesglose({ value, onChange, disabledMap, hintMap }) {
  const [hintClicked, setHintClicked] = useState(null);
  const opts = [
    { v: 'agrupado', l: 'Agrupado' },
    { v: 'establecimiento', l: 'Por establecimiento' },
    { v: 'nivel', l: 'Por nivel' },
  ];
  return (
    <div>
      <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Desglose</label>
      <div className="inline-flex rounded-lg border border-border overflow-hidden bg-white" role="group">
        {opts.map(o => {
          const disabled = !!disabledMap[o.v];
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                if (disabled) { setHintClicked(o.v); return; }
                setHintClicked(null);
                onChange(o.v);
              }}
              title={disabled ? hintMap[o.v] : undefined}
              className={`px-3 py-1.5 text-sm transition ${active ? 'text-white' : disabled ? 'text-gray-ui/70 cursor-not-allowed' : 'text-gray-dark hover:bg-bg'}`}
              style={active ? { background: 'var(--color-cyan)' } : undefined}
              aria-pressed={active}
              aria-disabled={disabled || undefined}
            >
              {o.l}
            </button>
          );
        })}
      </div>
      {hintClicked && disabledMap[hintClicked] && (
        <p className="text-xs text-gray-dark mt-2">{hintMap[hintClicked]}</p>
      )}
    </div>
  );
}

// ─── Tooltip con delta ──────────────────────────────────────────────────────

// Motivo por el que un valor está ausente. Prioriza:
//   - "no aplica"       → indicador aún no aplica al centro (semestre no alcanzado)
//   - cobertura estado  → SIN_FUENTE / FUENTE_NO_ACCESIBLE / SIN_DATO / etc.
//   - null              → nada especial que decir
function razonAusencia(aplica, cobertura) {
  if (aplica === false) return 'No aplica al centro aún';
  if (!cobertura) return null;
  const { label } = getCoberturaLabel(cobertura);
  return label;
}

function ChartTooltip({ active, payload, valueFormat, labelA, labelB }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  const a = item?.A;
  const b = item?.B;
  const hasBoth = a !== null && a !== undefined && b !== null && b !== undefined;
  const delta = hasBoth ? a - b : null;
  const deltaStr = delta === null
    ? null
    : (delta > 0 ? '+' : '') + valueFormat(delta);
  const razonA = (a == null) ? razonAusencia(item?.aplicaA, item?.coberturaA) : null;
  const razonB = (b == null) ? razonAusencia(item?.aplicaB, item?.coberturaB) : null;
  return (
    <div className="rounded-lg border border-border bg-white shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-dark font-semibold mb-1 leading-tight">{item?.nombre}</p>
      <p className="text-gray-dark">
        <span className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: 'var(--color-cyan)' }}/>
        {labelA}: <span className="font-medium">{valueFormat(a)}</span>
        {razonA && <span className="text-gray-ui"> · {razonA}</span>}
      </p>
      <p className="text-gray-dark">
        <span className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: 'var(--color-magenta)' }}/>
        {labelB}: <span className="font-medium">{valueFormat(b)}</span>
        {razonB && <span className="text-gray-ui"> · {razonB}</span>}
      </p>
      {deltaStr && (
        <p className="text-gray-ui mt-1 pt-1 border-t border-border">
          Diferencia: <span className="text-gray-dark font-medium">{deltaStr}</span>
        </p>
      )}
    </div>
  );
}

// ─── "Todos los indicadores": una fila por indicador en su propia unidad ────
// Each row has its own scale (the larger of its metas and values) because a
// count, a grade and a percentage cannot share one axis (R2-15, ADR-0008).

// A group mean of a Sí/No indicator is a share of centres, so 1 reads
// "100% Sí" and not "Sí" (formatValue's per-centre reading).
function formatPromedio(ind, v) {
  if (ind?.unidad === 'binario' && v !== null && v !== undefined && v >= 0 && v <= 1) return `${Math.round(v * 100)}% Sí`;
  return formatValue(ind, v);
}

function escalaFila(r) {
  const xs = [r.A, r.B, r.metaA, r.metaB].filter(v => v !== null && v !== undefined);
  const base = (r.ind?.unidad === '%' || r.ind?.unidad === 'binario') ? 1 : 0;
  return Math.max(base, ...xs) || 1;
}

function textoMeta(r) {
  const { ind, metaA, metaB } = r;
  if (metaA === null && metaB === null) return 'Sin meta';
  const fa = metaA === null ? '—' : formatValue(ind, metaA);
  const fb = metaB === null ? '—' : formatValue(ind, metaB);
  return fa === fb ? `Meta ${fa}` : `Meta A ${fa} · B ${fb}`;
}

function BarraNativa({ valor, meta, escala, ind, color, nDato, nAplican, label, aplica, cobertura }) {
  const pct = (v) => `${Math.min(100, (v / escala) * 100)}%`;
  const razon = valor === null ? razonAusencia(aplica, cobertura) : null;
  const detalle = nAplican ? ` · ${nDato} de ${nAplican} centros con dato` : '';
  return (
    <div className="flex items-center gap-2" title={`${label}: ${formatPromedio(ind, valor)}${detalle}${razon ? ` · ${razon}` : ''}`}>
      <div className="relative flex-1 h-3.5 rounded-sm" style={{ background: 'var(--color-bg)' }}>
        {valor !== null && (
          <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: pct(valor), background: color }}/>
        )}
        {meta !== null && (
          <div className="absolute -top-0.5 -bottom-0.5 border-l-2" style={{ left: `calc(${pct(meta)} - 1px)`, borderColor: 'var(--color-gray-dark)' }}/>
        )}
      </div>
      <span className="w-24 shrink-0 text-[11px] text-gray-dark tabular-nums">
        <strong>{formatPromedio(ind, valor)}</strong>
        {nAplican ? <span className="text-gray-ui"> · {nDato}/{nAplican}</span> : null}
      </span>
    </div>
  );
}

function FilasNativas({ filas, labelA, labelB }) {
  return (
    <div role="list" className="divide-y divide-border">
      {filas.map(r => {
        const escala = escalaFila(r);
        return (
          <div role="listitem" key={r.key} className="py-2 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="text-[11px] text-gray-dark leading-snug truncate" title={r.ind ? `${indicadorCodigo(r.ind.id)} — ${r.ind.nombre}` : r.nombre}>{r.nombre}</p>
              <p className="text-[10px] text-gray-ui">{textoMeta(r)}</p>
            </div>
            <div className="space-y-1">
              <BarraNativa valor={r.A} meta={r.metaA} escala={escala} ind={r.ind} color="var(--color-cyan)"
                nDato={r.nA} nAplican={r.nAplicanA} label={labelA} aplica={r.aplicaA} cobertura={r.coberturaA}/>
              <BarraNativa valor={r.B} meta={r.metaB} escala={escala} ind={r.ind} color="var(--color-magenta)"
                nDato={r.nB} nAplican={r.nAplicanB} label={labelB} aplica={r.aplicaB} cobertura={r.coberturaB}/>
            </div>
          </div>
        );
      })}
      <p className="pt-2 text-[10px] text-gray-ui">
        Cada fila tiene su propia escala. La línea vertical marca la meta; "n/m" indica cuántos centros reportan de los que corresponde.
      </p>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

const DEFAULT_TOP_N = 15;

export default function ComparadorIndicador({
  INDS,
  AMBITOS,
  todos,
  slepsDisponibles,
  cohortesDisponibles,
  comunasDisponibles,
  filtrosPagina = null,
  defaultMes,
  sostenedores = [],
  valoresPorEstByYear,
  programa = 'escolar',
}) {
  // valoresPorEstByYear: Map<anio, Map<estId, Map<indicadorId, valor>>>
  // Se recibe pre-normalizado por año real (no por posición A/B), para que la
  // clave del map siempre refleje el año verdadero de los datos.
  // Group A starts from, and follows, the page's top filters (L-05). Group B
  // stays free for the comparison.
  const initA = {
    year: filtrosPagina?.anio ?? 2026,
    slep: filtrosPagina?.slep ?? 'TODOS',
    cohorte: filtrosPagina?.cohorte ?? 'TODAS',
    comuna: filtrosPagina?.comuna ?? 'TODAS',
    nivel: 'TODOS',
  };
  const initB = { year: 2025, slep: 'TODOS', cohorte: 'TODAS', comuna: 'TODAS', nivel: 'TODOS' };
  const [filtersA, setFiltersA] = useState(initA);
  const [filtersB, setFiltersB] = useState(initB);
  useEffect(() => {
    if (!filtrosPagina) return;
    setFiltersA(prev => ({ ...prev, year: filtrosPagina.anio, slep: filtrosPagina.slep, cohorte: filtrosPagina.cohorte, comuna: filtrosPagina.comuna }));
  }, [filtrosPagina]);
  const opcionesA = useOpcionesLado(todos, filtersA, setFiltersA, sostenedores);
  const opcionesB = useOpcionesLado(todos, filtersB, setFiltersB, sostenedores);
  const [indicadorFocal, setIndicadorFocal] = useState('TODOS');
  const [desglose, setDesglose] = useState('agrupado');
  const [ambitoScope, setAmbitoScope] = useState('TODOS');
  const [orden, setOrden] = useState('diferencia');
  const [mostrarTodos, setMostrarTodos] = useState(false);

  // Ingest writes tipo 'Jardín'; the old strict 'jardin' check never matched.
  const showNivelFilter = programa === 'parvulario' || todos.some(e => /jard/i.test(String(e.tipo ?? '')));

  const indicadoresElegibles = INDS.filter(i => i.unidad !== 'sin_meta');
  const focalInd = indicadorFocal !== 'TODOS' ? indicadoresElegibles.find(i => i.id === indicadorFocal) : null;
  const focalDesagregaNivel = focalInd?.desagregaNivel === true;

  // Gates para desglose. "Por establecimiento" solo requiere un indicador
  // seleccionado — el filtro de sostenedor es opcional y estrecha la lista.
  // Con la ley top-N (DEFAULT_TOP_N) las listas largas siguen siendo legibles.
  const enableDesgloseEst = !!focalInd;
  const enableDesgloseNivel = !!focalInd && focalDesagregaNivel;

  // Si el desglose activo deja de ser válido tras un cambio, cae a 'agrupado'.
  const desgloseEfectivo = useMemo(() => {
    if (desglose === 'establecimiento' && !enableDesgloseEst) return 'agrupado';
    if (desglose === 'nivel' && !enableDesgloseNivel) return 'agrupado';
    return desglose;
  }, [desglose, enableDesgloseEst, enableDesgloseNivel]);

  // Lecturas por nivel — filtro puntual por lado (útil para "vs nivel específico").
  const nivelValoresAQ = useValoresAnioNivel(filtersA.year, filtersA.nivel);
  const nivelValoresBQ = useValoresAnioNivel(filtersB.year, filtersB.nivel);
  const nivelValoresA = nivelValoresAQ.data ?? [];
  const nivelValoresB = nivelValoresBQ.data ?? [];

  // Lecturas de todos los niveles del año — solo se disparan cuando el desglose activo es 'nivel'.
  const desgloseNivelActivo = desgloseEfectivo === 'nivel';
  const nivelesAllAQ = useValoresAnioNiveles(filtersA.year, desgloseNivelActivo);
  const nivelesAllBQ = useValoresAnioNiveles(filtersB.year, desgloseNivelActivo);
  const nivelesAllA = nivelesAllAQ.data ?? [];
  const nivelesAllB = nivelesAllBQ.data ?? [];

  const valoresMapByYear = useMemo(() => {
    // Normalizes each entry by year: accepts `{ valor }` or plain value.
    // For Escolar, remaps 2025 indicator IDs to their 2026 equivalents using
    // the homologación map so both sides share the same ID namespace.
    const out = new Map();
    for (const [anio, porEst] of valoresPorEstByYear ?? new Map()) {
      const norm = new Map();
      for (const [estId, m] of porEst) {
        const inner = new Map();
        for (const [indId, entry] of m) inner.set(indId, entry?.valor ?? entry);
        norm.set(estId, inner);
      }
      const mapped = (programa === 'escolar' && anio === 2025) ? remapear2025(norm) : norm;
      out.set(anio, mapped);
    }
    return out;
  }, [valoresPorEstByYear, programa]);

  function buildNivelMap(docs) {
    const buckets = new Map();
    for (const d of docs) {
      if (d.valor === null || d.valor === undefined) continue;
      const inner = buckets.get(d.establecimientoId) || new Map();
      const prev = inner.get(d.indicadorId);
      if (prev) { prev.suma += d.valor; prev.n += 1; }
      else inner.set(d.indicadorId, { suma: d.valor, n: 1 });
      buckets.set(d.establecimientoId, inner);
    }
    const out = new Map();
    for (const [estId, inner] of buckets) {
      const m = new Map();
      for (const [indId, { suma, n }] of inner) m.set(indId, suma / n);
      out.set(estId, m);
    }
    return out;
  }
  const nivelMapA = useMemo(() => buildNivelMap(nivelValoresA), [nivelValoresA]);
  const nivelMapB = useMemo(() => buildNivelMap(nivelValoresB), [nivelValoresB]);

  // Buckets: Map<nivelId, Map<estId, Map<indId, valorPromedio>>>
  function buildNivelBuckets(docs) {
    const porNivel = new Map();
    for (const n of NIVELES_OPERATIVOS) porNivel.set(n, []);
    for (const d of docs) {
      if (!porNivel.has(d.nivel)) continue;
      porNivel.get(d.nivel).push(d);
    }
    const out = new Map();
    for (const [n, list] of porNivel) out.set(n, buildNivelMap(list));
    return out;
  }
  const bucketsA = useMemo(() => (desgloseNivelActivo ? buildNivelBuckets(nivelesAllA) : null), [desgloseNivelActivo, nivelesAllA]);
  const bucketsB = useMemo(() => (desgloseNivelActivo ? buildNivelBuckets(nivelesAllB) : null), [desgloseNivelActivo, nivelesAllB]);

  const dataA = useMemo(
    () => computeSideData({
      todos,
      filters: filtersA,
      INDS,
      ambitoScope,
      indicadorFocal,
      valoresMapByYear,
      mesRef: defaultMes,
      desglose: desgloseEfectivo,
      valoresNivel: nivelMapA,
      valoresPorNivelBucket: bucketsA,
    }),
    [todos, filtersA, INDS, ambitoScope, indicadorFocal, valoresMapByYear, defaultMes, desgloseEfectivo, nivelMapA, bucketsA]
  );
  const dataB = useMemo(
    () => computeSideData({
      todos,
      filters: filtersB,
      INDS,
      ambitoScope,
      indicadorFocal,
      valoresMapByYear,
      mesRef: defaultMes,
      desglose: desgloseEfectivo,
      valoresNivel: nivelMapB,
      valoresPorNivelBucket: bucketsB,
    }),
    [todos, filtersB, INDS, ambitoScope, indicadorFocal, valoresMapByYear, defaultMes, desgloseEfectivo, nivelMapB, bucketsB]
  );

  const chartDataAll = useMemo(() => {
    const keys = [...new Set([...dataA.map(d => d.key), ...dataB.map(d => d.key)])];
    return keys.map(k => {
      const a = dataA.find(d => d.key === k);
      const b = dataB.find(d => d.key === k);
      let nombre;
      if (desgloseEfectivo === 'establecimiento' || desgloseEfectivo === 'nivel') {
        nombre = (a || b)?.nombre ?? k;
      } else {
        const ind = (a || b)?.ind;
        nombre = ind ? truncNombreInd(ind) : k;
      }
      return {
        key: k, nombre, ind: (a || b)?.ind, A: a?.valor ?? null, B: b?.valor ?? null,
        metaA: a?.meta ?? null, metaB: b?.meta ?? null,
        nA: a?.nConDato ?? null, nAplicanA: a?.nAplican ?? null,
        nB: b?.nConDato ?? null, nAplicanB: b?.nAplican ?? null,
        coberturaA: a?.cobertura ?? null, aplicaA: a?.aplica ?? true,
        coberturaB: b?.cobertura ?? null, aplicaB: b?.aplica ?? true,
      };
    });
  }, [dataA, dataB, desgloseEfectivo]);

  const chartDataOrdenada = useMemo(() => {
    const arr = [...chartDataAll];
    if (orden === 'diferencia') {
      // Rows can be in different units, so the difference is measured
      // against each row's own scale (meta or largest value).
      const dif = (r) => (r.A === null || r.B === null) ? 0 : Math.abs(r.A - r.B) / escalaFila(r);
      arr.sort((r1, r2) => dif(r2) - dif(r1));
    } else if (orden === 'codigo') {
      // En modo agrupado ordenar por código de indicador; en desglose por 'nombre'.
      arr.sort((r1, r2) => {
        const k1 = r1.ind?.id ?? r1.key;
        const k2 = r2.ind?.id ?? r2.key;
        return String(k1).localeCompare(String(k2), 'es', { numeric: true });
      });
    }
    return arr;
  }, [chartDataAll, orden]);

  // Top-N gate: aplica en agrupado (todos los indicadores) y en desglose por
  // establecimiento — ambos pueden exceder 15 filas y merecen la misma UX
  // "Mostrar los N" que ya usaba el modo agrupado.
  const modoAgrupadoTodos = desgloseEfectivo === 'agrupado' && !focalInd;
  const modoDesgloseEst   = desgloseEfectivo === 'establecimiento';
  const excedeTope = (modoAgrupadoTodos || modoDesgloseEst) && chartDataOrdenada.length > DEFAULT_TOP_N;
  const chartData = (excedeTope && !mostrarTodos)
    ? chartDataOrdenada.slice(0, DEFAULT_TOP_N)
    : chartDataOrdenada;

  const labelA = buildLabel(filtersA, sostenedores);
  const labelB = buildLabel(filtersB, sostenedores);

  // Denominadores por lado: cuántos centros pasan el filtro y cuántos de esos
  // tienen al menos un valor en el año seleccionado. Sirve para distinguir
  // "cero por falta de datos" de "cero por dato real".
  function contarConDatos(filters) {
    const ests = filtrarEstablecimientos(todos, filters);
    const mapa = valoresMapByYear.get(filters.year);
    if (!mapa) return { centros: ests.length, conDatos: 0 };
    const conDatos = ests.filter(e => (mapa.get(e.id)?.size ?? 0) > 0).length;
    return { centros: ests.length, conDatos };
  }
  const denomA = contarConDatos(filtersA);
  const denomB = contarConDatos(filtersB);
  const estsA = denomA.centros;
  const estsB = denomB.centros;

  const summaryA = `${labelA} — ${estsA} centros · ${denomA.conDatos} con datos`;
  const summaryB = `${labelB} — ${estsB} centros · ${denomB.conDatos} con datos`;

  // Detecta lados apuntando a años sin datos cargados en Firestore.
  const aniosSinDatos = [];
  for (const yr of [filtersA.year, filtersB.year]) {
    const mapa = valoresMapByYear.get(yr);
    const hay = mapa && Array.from(mapa.values()).some(m => m.size > 0);
    if (!hay && !aniosSinDatos.includes(yr)) aniosSinDatos.push(yr);
  }

  const { xDomain, xTickFormat, valueFormat } = useMemo(() => {
    const ind = focalInd || chartData[0]?.ind;
    if (!ind) {
      return { xDomain: [0, 1], xTickFormat: v => `${v}`, valueFormat: v => v ?? '—' };
    }
    if (ind.unidad === '%' || ind.unidad === 'binario') {
      const vals = chartData.flatMap(d => [d.A, d.B]).filter(v => v !== null && v !== undefined);
      return {
        xDomain: [0, Math.max(1, ind.metaNum ?? 0, ...vals)],
        xTickFormat: (v) => `${Math.round(v * 100)}%`,
        valueFormat: (v) => (desgloseEfectivo === 'establecimiento' ? formatValue(ind, v) : formatPromedio(ind, v)),
      };
    }
    const vals = chartData.flatMap(d => [d.A, d.B]).filter(v => v !== null && v !== undefined);
    const maxV = Math.max(ind.metaNum ?? 0, ...vals, 0.1);
    return {
      xDomain: [0, Math.ceil(maxV * 1.1)],
      xTickFormat: (v) => Number.isInteger(v) ? String(v) : v.toFixed(1),
      valueFormat: (v) => formatValue(ind, v),
    };
  }, [chartData, focalInd, desgloseEfectivo]);

  const intercambiar = () => {
    setFiltersA(filtersB);
    setFiltersB(filtersA);
  };
  const restablecer = () => {
    setFiltersA(initA);
    setFiltersB(initB);
    setIndicadorFocal('TODOS');
    setDesglose('agrupado');
    setAmbitoScope('TODOS');
    setOrden('diferencia');
    setMostrarTodos(false);
  };

  const disabledMap = {
    agrupado: false,
    establecimiento: !enableDesgloseEst,
    nivel: !enableDesgloseNivel,
  };
  const hintMap = {
    establecimiento: 'Elige un indicador para desglosar por centro.',
    nivel: focalInd
      ? 'Este indicador no llega con desglose por sala.'
      : 'Elige un indicador que se reporte por sala para desglosar por nivel.',
  };

  return (
    <div className="mt-5">
      {/* Zone 1 — Qué comparar (global) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="lg:col-span-2">
          <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Indicador</label>
          <select
            value={indicadorFocal}
            onChange={e => setIndicadorFocal(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-dark outline-none"
          >
            <option value="TODOS">Todos los indicadores</option>
            {indicadoresElegibles.map(i => (
              <option key={i.id} value={i.id}>[{indicadorCodigo(i.id)}] {i.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Ámbito</label>
          <select
            value={ambitoScope}
            onChange={e => setAmbitoScope(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-dark outline-none"
          >
            <option value="TODOS">Todos los ámbitos</option>
            {AMBITOS.map(a => <option key={a.id} value={a.id}>{ambitoCodigo(a)} · {ambitoNombre(a, programa)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-ui font-medium mb-1 uppercase tracking-wider">Orden</label>
          <select
            value={orden}
            onChange={e => setOrden(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-dark outline-none"
          >
            <option value="diferencia">Por diferencia (A − B)</option>
            <option value="codigo">Por código</option>
          </select>
        </div>
      </div>

      <div className="mb-5">
        <SegmentedDesglose value={desgloseEfectivo} onChange={setDesglose} disabledMap={disabledMap} hintMap={hintMap}/>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-3 justify-end">
        <button
          type="button"
          onClick={intercambiar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-gray-dark hover:bg-bg transition"
        >
          <ArrowLeftRight size={13}/> Intercambiar A ↔ B
        </button>
        <button
          type="button"
          onClick={restablecer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-gray-dark hover:bg-bg transition"
        >
          <RotateCcw size={13}/> Restablecer
        </button>
      </div>

      {/* Zone 2 — Quiénes (per side) */}
      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        <SideSelector
          label="Grupo A"
          color="var(--color-cyan)"
          filters={filtersA}
          onChange={setFiltersA}
          slepsDisponibles={opcionesA.sleps}
          cohortesDisponibles={opcionesA.cohortes}
          comunasDisponibles={opcionesA.comunas}
          summary={summaryA}
          centros={estsA}
          showNivel={showNivelFilter}
        />
        <SideSelector
          label="Grupo B"
          color="var(--color-magenta)"
          filters={filtersB}
          onChange={setFiltersB}
          slepsDisponibles={opcionesB.sleps}
          cohortesDisponibles={opcionesB.cohortes}
          comunasDisponibles={opcionesB.comunas}
          summary={summaryB}
          centros={estsB}
          showNivel={showNivelFilter}
        />
      </div>

      {aniosSinDatos.length > 0 && (
        <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: 'rgb(252,244,231)', color: '#8a5a00' }}>
          {aniosSinDatos.length === 1
            ? `Sin datos cargados para ${aniosSinDatos[0]} en Firestore. Las barras de ese año aparecerán como "—".`
            : `Sin datos cargados para ${aniosSinDatos.join(' ni ')} en Firestore. Las barras correspondientes aparecerán como "—".`}
        </div>
      )}

      {programa === 'escolar' && (filtersA.year === 2025 || filtersB.year === 2025) && (
        <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: 'rgb(235,245,255)', color: '#1a4a7a' }}>
          <strong>Comparación entre años:</strong> los catálogos 2025 y 2026 son instrumentos distintos. Los valores 2025 se alinean con sus equivalentes 2026 usando la tabla de homologación ({homologacion.mapping.length} pares). <span style={{ color: 'var(--color-gray-ui)' }}>Los {HOMOL_NEW_IN_2026.size} indicadores nuevos en 2026 y los {HOMOL_DISCONTINUED.size} descontinuados de 2025 sin equivalente no aparecen en el gráfico.</span>
        </div>
      )}

      <div className="mb-3 p-2.5 rounded-xl text-[11px] text-gray-ui" style={{ background: 'var(--color-bg)' }}>
        Muestra el <strong>promedio reportado</strong> por los centros en la unidad de cada indicador
        (cantidad, nota, porcentaje o Sí/No){focalInd && focalInd.metaNum !== null ? <>, con meta {formatValue(focalInd, focalInd.metaNum)}</> : null}.
        Los centros sin dato no entran en el promedio{modoAgrupadoTodos ? '; cada fila indica cuántos centros reportan' : ''}.
        Este promedio es distinto del % de cumplimiento de las vistas por centro y por sostenedor, donde un dato faltante cuenta como 0.
        {filtersA.year !== filtersB.year && <> Al comparar años distintos, las metas pueden cambiar entre un año y otro: cada fila muestra la meta de cada grupo.</>}
      </div>

      {/* Leyenda compacta A/B con año explícito + chip de qué muestra el eje */}
      <div className="flex flex-wrap gap-3 items-center text-xs text-gray-ui mb-3">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-cyan)' }}/>
          Grupo A · {filtersA.year}
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-magenta)' }}/>
          Grupo B · {filtersB.year}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border">
          <span>Eje:</span>
          <strong className="text-gray-dark">
            {modoAgrupadoTodos ? 'Promedio en la unidad de cada indicador' : 'Promedio reportado'}
          </strong>
        </span>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-ui text-center py-8">Sin indicadores en común para los filtros seleccionados.</p>
      ) : modoAgrupadoTodos ? (
        <>
          <FilasNativas filas={chartData} labelA={labelA} labelB={labelB}/>
          {excedeTope && (
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={() => setMostrarTodos(m => !m)}
                className="text-xs text-gray-dark hover:underline"
              >
                {mostrarTodos ? 'Mostrar menos' : `Mostrar los ${chartDataOrdenada.length} indicadores`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ height: Math.max(220, chartData.length * 30 + 60) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 64, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false}/>
                <XAxis
                  type="number"
                  domain={xDomain}
                  tickFormatter={xTickFormat}
                  stroke="#6B7280"
                  fontSize={10}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  stroke="#6B7280"
                  fontSize={10}
                  width={220}
                  tick={{ fill: '#333333' }}
                  interval={0}
                />
                <Tooltip content={<ChartTooltip valueFormat={valueFormat} labelA={labelA} labelB={labelB}/>}/>
                <Legend
                  formatter={(value) => value === 'A' ? labelA : labelB}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Bar dataKey="A" fill="var(--color-cyan)" radius={[0, 3, 3, 0]} maxBarSize={16}
                  label={{ position: 'right', formatter: v => valueFormat(v), fontSize: 10, fill: '#6B7280' }}/>
                <Bar dataKey="B" fill="var(--color-magenta)" radius={[0, 3, 3, 0]} maxBarSize={16}
                  label={{ position: 'right', formatter: v => valueFormat(v), fontSize: 10, fill: '#6B7280' }}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {excedeTope && (
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={() => setMostrarTodos(m => !m)}
                className="text-xs text-gray-dark hover:underline"
              >
                {mostrarTodos
                  ? 'Mostrar menos'
                  : `Mostrar los ${chartDataOrdenada.length} ${modoDesgloseEst ? 'centros' : 'indicadores'}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
