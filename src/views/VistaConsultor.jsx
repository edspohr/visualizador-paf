import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useIndicadores, useAmbitos, useValoresAnio, useValoresAnioNivel } from '../lib/queries.js';
import { calcularLogro, currentMonth, capClosedPeriod } from '../data/establecimientos.js';
import { cumplimientoIndicadores, indicadoresAplicables, isAplicable2026 } from '../data/scope.js';
import { formatValue } from '../data/expectedValue.js';
import { matriculaVisible, formatearFechaCorte } from '../data/matricula.js';
import HeatmapEstablecimientosIndicadores from '../components/HeatmapEstablecimientosIndicadores.jsx';
import { FEATURES } from '../lib/features.js';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import SostenedorAveragePicker from '../components/SostenedorAveragePicker.jsx';
import { Filter, Building2, Users, GraduationCap, MapPin, ChevronDown, ChevronUp, GitCompareArrows, Grid3x3 } from 'lucide-react';
import { ambitoCodigo, indicadorCodigo } from '../lib/labels.js';
import Glosario from '../components/Glosario.jsx';
import PipelineStatusBanner from '../components/PipelineStatusBanner.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Sublabel del TotalCard "Niñas y niños" — refleja si el número corresponde a
// un snapshot congelado (perfil CAP) o al dato vivo.
function buildMatriculaSub(perfilId, usaSnapshot, fechaCorte) {
  if (perfilId !== 'cap') return 'matrícula estimada';
  if (!usaSnapshot) return 'matrícula vigente';
  const fechaFmt = formatearFechaCorte(fechaCorte);
  return fechaFmt ? `matrícula al ${fechaFmt}` : 'matrícula del cierre';
}

// Año actualmente navegable + año inmediato anterior como comparación de referencia.
const ANIO_ACTUAL = 2026;
const ANIOS_DISPONIBLES = [2025, 2026];
const LS_KEY_ANIO = 'paf_anio_gestion';

function anioInicial() {
  if (typeof window === 'undefined') return ANIO_ACTUAL;
  const stored = Number(window.localStorage.getItem(LS_KEY_ANIO));
  return ANIOS_DISPONIBLES.includes(stored) ? stored : ANIO_ACTUAL;
}

function fechaFormateada(mes, anio) {
  const hoy = new Date();
  if (mes === currentMonth() && anio === ANIO_ACTUAL) {
    return `${hoy.getDate()} de ${NOMBRES_MES[hoy.getMonth()]} de ${anio}`;
  }
  const lastDay = new Date(anio, mes, 0).getDate();
  return `${lastDay} de ${NOMBRES_MES[mes - 1]} de ${anio}`;
}

// Formatea "30 de mayo de 2026" a partir de { mes, anio }.
function labelMesCerrado({ mes, anio }) {
  const lastDay = new Date(anio, mes, 0).getDate();
  return `${lastDay} de ${NOMBRES_MES[mes - 1]} de ${anio}`;
}

export default function VistaConsultor() {
  const { perfil } = useApp();
  const isCAP = perfil.id === 'cap';

  const [anioSeleccionado, setAnioSeleccionado] = useState(anioInicial);
  const anioEnCurso = anioSeleccionado === ANIO_ACTUAL;
  const cambiarAnio = (a) => {
    setAnioSeleccionado(a);
    if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY_ANIO, String(a));
  };

  // Mes efectivo: en el año en curso respeta el calendario (CAP mira mes cerrado);
  // en años previos el "mes efectivo" es diciembre (año ya cerrado).
  const capCierre = capClosedPeriod();
  const effectiveMonth = !anioEnCurso ? 12 : (isCAP ? capCierre.mes : currentMonth());

  const programa = perfil.contexto.programa || 'escolar';

  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();
  const indicadoresQ = useIndicadores(programa);
  const ambitosQ = useAmbitos(programa);

  const valoresAnioQ = useValoresAnio(anioSeleccionado);
  // Map<estId, Map<indicadorId, { valor, estado }>>
  const valoresPorEst = useMemo(() => {
    const m = new Map();
    for (const v of (valoresAnioQ.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, { valor: v.valor, estado: v.estado ?? 'validado' });
    }
    return m;
  }, [valoresAnioQ.data]);
  const getValor = (indicadorId, estId) => valoresPorEst.get(estId)?.get(indicadorId)?.valor ?? null;

  // Valores 2025 para el comparador — solo se descargan cuando el usuario abre el panel.
  const valores2025Q = useValoresAnio(2025);
  const valoresPorEst2025 = useMemo(() => {
    const m = new Map();
    for (const v of (valores2025Q.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, v.valor);
    }
    return m;
  }, [valores2025Q.data]);

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || slepsQ.isLoading ||
                   indicadoresQ.isLoading || ambitosQ.isLoading;

  const AMBITOS = ambitosQ.data ?? [];
  const INDS    = indicadoresQ.data ?? [];
  const todos   = (programa === 'escolar' ? escuelasQ.data : jardinesQ.data) ?? [];
  const SLEPS_DATA = slepsQ.data ?? [];

  const [filtroSlep, setFiltroSlep] = useState('TODOS');
  const [filtroCohorte, setFiltroCohorte] = useState('TODAS');
  const [filtroComuna, setFiltroComuna] = useState('TODAS');
  const [drilldown, setDrilldown] = useState(null);
  const [comparadorOpen, setComparadorOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const heatmapVisible = FEATURES.heatmap && perfil.id === 'superadmin';

  const filtrados = useMemo(() => todos.filter(e =>
    (filtroSlep === 'TODOS' || e.slep === filtroSlep) &&
    (filtroCohorte === 'TODAS' || e.cohorte === filtroCohorte) &&
    (filtroComuna === 'TODAS' || e.comuna === filtroComuna)
  ), [todos, filtroSlep, filtroCohorte, filtroComuna]);

  const slepsDisponibles = [...new Set(todos.map(e => e.slep))].map(id => SLEPS_DATA.find(s => s.id === id)).filter(Boolean);
  const cohortesDisponibles = [...new Set(todos.map(e => e.cohorte))];
  const comunasDisponibles = [...new Set(todos.map(e => e.comuna))].sort();

  const conCumplimiento = useMemo(() => filtrados.map(e => {
    const aplicables = indicadoresAplicables(INDS, e, effectiveMonth);
    const cumpl = cumplimientoIndicadores(aplicables, valoresPorEst.get(e.id) ?? new Map());
    return { est: e, cumpl };
  }), [filtrados, INDS, valoresPorEst, effectiveMonth]);

  // Ranking de indicadores del conjunto filtrado, faltantes cuentan 0.
  const rankingItems = useMemo(() => (
    INDS
      .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
      .map(ind => {
        const aplican = filtrados.filter(e => isAplicable2026(ind, e, effectiveMonth));
        if (!aplican.length) return null;
        let sumaLogro = 0, sumaVal = 0, nVal = 0;
        for (const e of aplican) {
          const v = valoresPorEst.get(e.id)?.get(ind.id)?.valor ?? null;
          const l = calcularLogro(v, ind);
          sumaLogro += l === null ? 0 : Math.min(1, l);
          if (v !== null && v !== undefined) { sumaVal += v; nVal += 1; }
        }
        // Excluir indicadores sin ningún dato reportado (no rankeamos "0%").
        if (nVal === 0) return null;
        return {
          indicador: ind,
          valor: sumaVal / nVal,
          ratio: sumaLogro / aplican.length,
        };
      })
      .filter(Boolean)
  ), [INDS, filtrados, valoresPorEst, effectiveMonth]);

  const totales = useMemo(() => {
    let ninos = 0;
    let usaSnapshot = false;
    let fechaCorte = null;
    for (const e of filtrados) {
      const m = matriculaVisible(e, perfil.id, effectiveMonth, anioSeleccionado);
      ninos += m.valor;
      if (m.esSnapshot) {
        usaSnapshot = true;
        if (!fechaCorte && m.fechaCorte) fechaCorte = m.fechaCorte;
      }
    }
    return {
      establecimientos: filtrados.length,
      ninos,
      matriculaSub: buildMatriculaSub(perfil.id, usaSnapshot, fechaCorte),
      agentes: filtrados.reduce((s, e) => s + (e.nAgentes ?? 0), 0),
      comunas: new Set(filtrados.map(e => e.comuna)).size,
    };
  }, [filtrados, perfil.id, effectiveMonth, anioSeleccionado]);

  const selectCls = "w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none";

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando datos del programa…
      </div>
    );
  }

  // Datos para el drilldown (calculados solo cuando hay algo abierto).
  let drilldownExtras = {};
  if (drilldown) {
    const centroActual = todos.find(e => e.id === drilldown.estId);
    const tipo = centroActual?.tipo;
    const pares = todos.filter(e => e.slep === drilldown.slepId && e.tipo === tipo);
    let sum = 0, n = 0;
    const valoresTerritorio = new Map();
    for (const p of pares) {
      const v = valoresPorEst.get(p.id)?.get(drilldown.ind.id)?.valor ?? null;
      if (v !== null && v !== undefined) { sum += v; n += 1; valoresTerritorio.set(p.id, v); }
    }
    // Promedios cross-sostenedor para la tabla del drilldown
    const promedioPorSostenedor = new Map();
    for (const s of SLEPS_DATA) {
      const centrosDelSlep = todos.filter(e => e.slep === s.id && e.tipo === tipo);
      let ss = 0, nn = 0;
      for (const e of centrosDelSlep) {
        const v = valoresPorEst.get(e.id)?.get(drilldown.ind.id)?.valor ?? null;
        if (v !== null && v !== undefined) { ss += v; nn += 1; }
      }
      if (nn) promedioPorSostenedor.set(s.id, ss / nn);
    }
    const entry = valoresPorEst.get(drilldown.estId)?.get(drilldown.ind.id);
    drilldownExtras = {
      valor: entry?.valor ?? null,
      estado: entry?.estado ?? 'validado',
      promedioTerritorio: n ? sum / n : null,
      valoresTerritorio,
      promedioPorSostenedor,
    };
  }

  return (
    <>
      {/* Banner */}
      {isCAP ? (
        <div className="text-white rounded-2xl px-6 py-7 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-magenta)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">FUNDACIÓN CAP · INFORME DE CIERRE</p>
            <h2 className="text-3xl md:text-4xl font-medium text-white leading-tight">Vista de cierre · Fundación CAP</h2>
            <p className="text-white/80 mt-2 text-sm">
              Datos <span className="text-lime-300 font-semibold">validados</span> al {labelMesCerrado(capCierre)} · Próxima actualización el 15 del mes siguiente
            </p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">CENTROS EDUCATIVOS</p>
            <p className="font-medium mt-1 text-lg leading-none">{filtrados.length}</p>
          </div>
        </div>
      ) : (
        <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-purple-1)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">VISTA COMPLETA · CONSULTORÍA</p>
            <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">Programa {programa === 'escolar' ? 'Aprender en Familia · Educación Básica' : 'Aprender en Familia · Educación Parvularia'}</h2>
            <p className="text-white/70 mt-1 text-sm">Datos actualizados al {fechaFormateada(effectiveMonth, anioSeleccionado)} · Vista agregada con acceso a todos los cruces.</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">CENTROS EDUCATIVOS</p>
            <p className="font-medium mt-1 text-lg leading-none">{filtrados.length}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2 font-medium text-sm pt-6">
            <Filter size={16}/> Filtros
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Año</label>
              <select value={anioSeleccionado} onChange={(e) => cambiarAnio(Number(e.target.value))} className={selectCls}>
                {ANIOS_DISPONIBLES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
              <select value={filtroSlep} onChange={(e) => setFiltroSlep(e.target.value)} className={selectCls}>
                <option value="TODOS">Todos</option>
                {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Cohorte</label>
              <select value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)} className={selectCls}>
                <option value="TODAS">Todas</option>
                {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Comuna</label>
              <select value={filtroComuna} onChange={(e) => setFiltroComuna(e.target.value)} className={selectCls}>
                <option value="TODAS">Todas</option>
                {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Totals strip — reacts to active filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <TotalCard label="Centros educativos" value={totales.establecimientos} sub={programa === 'escolar' ? 'escuelas del programa' : 'jardines infantiles'} Icon={Building2}/>
        <TotalCard label="Niñas y niños" value={totales.ninos.toLocaleString('es-CL')} sub={totales.matriculaSub} Icon={GraduationCap}/>
        <TotalCard label="Equipos educativos" value={totales.agentes} sub="en el programa" Icon={Users}/>
        <TotalCard label="Comunas" value={totales.comunas} sub="con cobertura activa" Icon={MapPin}/>
      </div>

      {/* Top-3 / Bottom-3 por indicador (promedio del conjunto filtrado) */}
      <IndicatorRanking items={rankingItems} title="Indicadores del programa"/>

      {/* Promedio de cumplimiento por sostenedor (o por centro al elegir un sostenedor) */}
      <SostenedorAveragePicker
        INDS={INDS}
        establecimientos={filtrados}
        sostenedores={SLEPS_DATA}
        mes={effectiveMonth}
        getValor={getValor}
      />

      {/* Comparador por indicador */}
      <div className="card mb-6">
        <button
          onClick={() => setComparadorOpen(o => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <GitCompareArrows size={16} style={{ color: 'var(--color-cyan)' }}/>
            <span className="text-sm font-medium text-gray-dark">Comparación por indicador</span>
          </div>
          {comparadorOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
        </button>
        {comparadorOpen && (
          <ComparadorIndicador
            INDS={INDS}
            AMBITOS={AMBITOS}
            todos={todos}
            slepsDisponibles={slepsDisponibles}
            cohortesDisponibles={cohortesDisponibles}
            comunasDisponibles={comunasDisponibles}
            defaultMes={effectiveMonth}
            sostenedores={SLEPS_DATA}
            valoresPorEst2026={valoresPorEst}
            valoresPorEst2025={valoresPorEst2025}
          />
        )}
      </div>

      {/* Mapa de calor (superadmin + feature flag) */}
      {heatmapVisible && (
        <div className="card mb-6">
          <button
            onClick={() => setHeatmapOpen(o => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Grid3x3 size={16} style={{ color: 'var(--color-cyan)' }}/>
              <span className="text-sm font-medium text-gray-dark">Mapa de calor · Establecimientos × Indicadores</span>
              <span className="tag tag-navy text-[10px]">experimento</span>
            </div>
            {heatmapOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
          </button>
          {heatmapOpen && (
            <div className="mt-4">
              <HeatmapEstablecimientosIndicadores
                establecimientos={filtrados}
                INDS={INDS}
                valoresPorEst={valoresPorEst}
                mes={effectiveMonth}
                onCellClick={(ind, estId) => setDrilldown({ ind, estId, slepId: filtrados.find(e => e.id === estId)?.slep })}
              />
            </div>
          )}
        </div>
      )}

      {/* Lista de centros educativos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por centro educativo</p>
          <h3 className="text-lg text-gray-dark">Todos los centros educativos filtrados</h3>
          <p className="text-sm text-gray-ui mt-1">Haz clic en un centro educativo para ver sus indicadores.</p>
        </div>
        <EstablecimientoList
          conCumplimiento={conCumplimiento}
          AMBITOS={AMBITOS}
          INDS={INDS}
          effectiveMonth={effectiveMonth}
          onDrilldown={(ind, estId, slepId) => setDrilldown({ ind, estId, slepId })}
          valoresPorEst={valoresPorEst}
          sostenedores={SLEPS_DATA}
          programa={programa}
          anioEnCurso={anioEnCurso}
        />
      </div>

      <PipelineStatusBanner />

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown.ind}
          establecimientoId={drilldown.estId}
          slep={drilldown.slepId}
          mes={effectiveMonth}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
          todosEstablecimientos={todos}
          sostenedores={SLEPS_DATA}
          anio={anioSeleccionado}
          anioEnCurso={anioEnCurso}
          {...drilldownExtras}
        />
      )}
    </>
  );
}

// ─── TotalCard ───────────────────────────────────────────────────────────────

function TotalCard({ label, value, sub, Icon }) {
  return (
    <div className="card py-4 px-4 flex items-start gap-3 mb-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-cyan-50">
        <Icon size={16} style={{ color: 'var(--color-cyan)' }}/>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-ui leading-none mb-1">{label}</p>
        <p className="text-2xl font-medium leading-none" style={{ color: 'var(--color-cyan)' }}>{value}</p>
        {sub && <p className="text-[10px] text-gray-ui mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Comparador por indicador ────────────────────────────────────────────────

const NIVELES_OPTS = [
  { v: 'TODOS', l: 'Todos los niveles' },
  { v: 'sala_cuna_menor', l: 'Sala cuna menor' },
  { v: 'sala_cuna_mayor', l: 'Sala cuna mayor' },
  { v: 'nivel_medio_menor', l: 'Nivel medio menor' },
  { v: 'nivel_medio_mayor', l: 'Nivel medio mayor' },
  { v: 'transicion_1', l: 'Transición 1' },
  { v: 'transicion_2', l: 'Transición 2' },
];
const NIVELES_LABEL = Object.fromEntries(NIVELES_OPTS.map(n => [n.v, n.l]));

function filtrarEstablecimientos(todos, { slep, cohorte, comuna }) {
  return todos.filter(e =>
    (slep === 'TODOS' || e.slep === slep) &&
    (cohorte === 'TODAS' || e.cohorte === cohorte) &&
    (comuna === 'TODAS' || e.comuna === comuna)
  );
}

function buildLabel({ slep, cohorte, comuna, nivel, year }, sostenedores = []) {
  const parts = [];
  if (slep !== 'TODOS') parts.push(sostenedores.find(s => s.id === slep)?.nombre.replace(/^SLEP\s+/, '') ?? slep);
  if (cohorte !== 'TODAS') parts.push(`Cohorte ${cohorte}`);
  if (comuna !== 'TODAS') parts.push(comuna);
  if (nivel && nivel !== 'TODOS') parts.push(NIVELES_LABEL[nivel] ?? nivel);
  parts.push(String(year));
  return parts.join(' · ');
}

// Promedio del valor RAW del indicador sobre los establecimientos que aplican
// para el filtro dado. Devuelve `null` si no hay establecimientos con dato.
function promedioValor(ind, ests, valores, mesRef) {
  const aplican = ests.filter(e => isAplicable2026(ind, e, mesRef));
  if (!aplican.length) return null;
  let suma = 0, n = 0;
  for (const e of aplican) {
    const v = valores.get(e.id)?.get(ind.id);
    if (v === null || v === undefined) continue;
    suma += v;
    n += 1;
  }
  return n ? suma / n : null;
}

// Ratio (0..1) para normalizar unidades heterogéneas en el modo "Todos los indicadores".
function ratioLogro(ind, ests, valores, mesRef) {
  const aplican = ests.filter(e => isAplicable2026(ind, e, mesRef));
  if (!aplican.length) return null;
  let suma = 0;
  for (const e of aplican) {
    const v = valores.get(e.id)?.get(ind.id) ?? null;
    const l = calcularLogro(v, ind);
    suma += l === null ? 0 : Math.min(1, l);
  }
  return suma / aplican.length;
}

// Devuelve filas para el bar chart. Cada fila tiene { key, nombre, valor, meta, unidad, ratio, aplica }.
//  - Modo agrupado + indicadorFocal='TODOS': una fila por indicador (ratio 0..1 normalizado).
//  - Modo agrupado + indicadorFocal fijo: una fila con el promedio del indicador respetando su unidad.
//  - Modo desglose 'establecimiento' + indicadorFocal fijo: una fila por establecimiento con su valor real.
//  - `aplica === false`: pinta la fila como no-desglose (nivel elegido con indicador que no desagrega).
//
// Cuando `filters.nivel !== 'TODOS'`, usa `valoresNivel` (Map<estId, Map<indId, valor>>)
// que contiene los promedios por sala filtrados al nivel específico. Los
// indicadores sin `desagregaNivel:true` devuelven aplica:false.
function computeSideData({ todos, filters, INDS, ambitoScope, indicadorFocal, valoresMapByYear, mesRef, desglose, valoresNivel = null }) {
  const ests = filtrarEstablecimientos(todos, filters);
  const nivelActivo = filters.nivel && filters.nivel !== 'TODOS';
  const valoresAgregados = valoresMapByYear.get(filters.year) ?? new Map();

  const indsElegibles = INDS.filter(ind =>
    ind.unidad !== 'sin_meta' &&
    ind.metaNum !== null &&
    (ambitoScope === 'TODOS' || ind.ambito === ambitoScope) &&
    (indicadorFocal === 'TODOS' || ind.id === indicadorFocal)
  );

  // Selecciona la fuente de valores por indicador: si el nivel está activo y el
  // indicador desagrega por nivel, se usa `valoresNivel`. Si no, el mapa agregado.
  function fuenteValores(ind) {
    if (nivelActivo && ind.desagregaNivel === true && valoresNivel) return valoresNivel;
    return valoresAgregados;
  }

  // Desglose por establecimiento requiere indicador focal fijo y sostenedor específico.
  if (desglose === 'establecimiento' && indicadorFocal !== 'TODOS') {
    const ind = indsElegibles[0];
    if (!ind) return [];
    // Si el nivel está activo pero el indicador no desagrega, todas las filas quedan aplica:false.
    const soportaNivel = ind.desagregaNivel === true;
    if (nivelActivo && !soportaNivel) {
      return ests.map(e => ({
        key: e.id, nombre: e.nombre, valor: null, meta: ind.metaNum,
        unidad: ind.unidad, ratio: null, ind, aplica: false,
      }));
    }
    const fuente = fuenteValores(ind);
    return ests.map(e => {
      const applies = isAplicable2026(ind, e, mesRef);
      const v = applies ? (fuente.get(e.id)?.get(ind.id) ?? null) : null;
      const r = calcularLogro(v, ind);
      return {
        key: e.id,
        nombre: e.nombre,
        valor: v,
        meta: ind.metaNum,
        unidad: ind.unidad,
        ratio: r === null ? null : Math.min(1, r),
        ind,
        aplica: applies,
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
        ratio: null,
        ind,
        aplica: false,
      };
    }
    const fuente = fuenteValores(ind);
    const valor = promedioValor(ind, ests, fuente, mesRef);
    const ratio = ratioLogro(ind, ests, fuente, mesRef);
    return {
      key: ind.id,
      nombre: ind.nombre,
      valor,
      meta: ind.metaNum,
      unidad: ind.unidad,
      ratio,
      ind,
      aplica: true,
    };
  });
}

function SideSelector({ label, color, filters, onChange, slepsDisponibles, cohortesDisponibles, comunasDisponibles, AMBITOS }) {
  const sc = "w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark outline-none";
  return (
    <div className="flex-1 min-w-0 border rounded-xl p-3" style={{ borderColor: color }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Año</label>
          <select value={filters.year} onChange={e => onChange({ ...filters, year: Number(e.target.value) })} className={sc}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Sostenedor</label>
          <select value={filters.slep} onChange={e => onChange({ ...filters, slep: e.target.value })} className={sc}>
            <option value="TODOS">Todos</option>
            {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Cohorte</label>
          <select value={filters.cohorte} onChange={e => onChange({ ...filters, cohorte: e.target.value })} className={sc}>
            <option value="TODAS">Todas</option>
            {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Comuna</label>
          <select value={filters.comuna} onChange={e => onChange({ ...filters, comuna: e.target.value })} className={sc}>
            <option value="TODAS">Todas</option>
            {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Nivel</label>
          <select value={filters.nivel} onChange={e => onChange({ ...filters, nivel: e.target.value })} className={sc}>
            {NIVELES_OPTS.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Ámbito (alcance)</label>
          <select value={filters.ambitoScope} onChange={e => onChange({ ...filters, ambitoScope: e.target.value })} className={sc}>
            <option value="TODOS">Todos los ámbitos</option>
            {AMBITOS.map(a => <option key={a.id} value={a.id}>{ambitoCodigo(a)} · {a.nombre}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// Etiqueta corta del indicador para el eje: "Código — nombre truncado".
function truncNombreInd(ind, max = 60) {
  const full = `${indicadorCodigo(ind.id)} — ${ind.nombre}`;
  return full.length > max ? full.slice(0, max - 1) + '…' : full;
}

function ComparadorIndicador({ INDS, AMBITOS, todos, slepsDisponibles, cohortesDisponibles, comunasDisponibles, defaultMes, sostenedores = [], valoresPorEst2026, valoresPorEst2025 }) {
  const initA = { year: 2026, slep: 'TODOS', cohorte: 'TODAS', comuna: 'TODAS', nivel: 'TODOS', ambitoScope: 'TODOS' };
  const initB = { year: 2025, slep: 'TODOS', cohorte: 'TODAS', comuna: 'TODAS', nivel: 'TODOS', ambitoScope: 'TODOS' };
  const [filtersA, setFiltersA] = useState(initA);
  const [filtersB, setFiltersB] = useState(initB);
  const [indicadorFocal, setIndicadorFocal] = useState('TODOS');
  const [desglose, setDesglose] = useState('agrupado');

  const indicadoresElegibles = INDS.filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null);

  // Los valores por nivel solo se traen si el filtro Nivel está activo.
  // Se hacen dos queries (A y B) — cada una devuelve [] cuando `nivel === 'TODOS'`.
  const nivelValoresAQ = useValoresAnioNivel(filtersA.year, filtersA.nivel);
  const nivelValoresBQ = useValoresAnioNivel(filtersB.year, filtersB.nivel);
  const nivelValoresA = nivelValoresAQ.data ?? [];
  const nivelValoresB = nivelValoresBQ.data ?? [];

  // valoresMapByYear queda como el fallback (agregado por jardín).
  // Cuando un lado tiene nivel activo, se construye un map específico a nivel
  // y se pasa por separado en computeSideData.
  const valoresMapByYear = useMemo(() => {
    const to2026 = new Map();
    for (const [estId, m] of valoresPorEst2026) {
      const inner = new Map();
      for (const [indId, entry] of m) inner.set(indId, entry?.valor ?? entry);
      to2026.set(estId, inner);
    }
    return new Map([[2025, valoresPorEst2025], [2026, to2026]]);
  }, [valoresPorEst2025, valoresPorEst2026]);

  // Convierte docs por nivel en Map<estId, Map<indId, valor promedio sobre salas>>.
  // Si un jardín tiene más de una sala del mismo nivel específico, promediamos.
  function buildNivelMap(docs) {
    const buckets = new Map();
    for (const d of docs) {
      if (d.valor === null || d.valor === undefined) continue;
      const inner = buckets.get(d.establecimientoId) || new Map();
      const prev = inner.get(d.indicadorId);
      if (prev) {
        prev.suma += d.valor;
        prev.n += 1;
      } else {
        inner.set(d.indicadorId, { suma: d.valor, n: 1 });
      }
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

  const dataA = useMemo(
    () => computeSideData({ todos, filters: filtersA, INDS, ambitoScope: filtersA.ambitoScope, indicadorFocal, valoresMapByYear, mesRef: defaultMes, desglose, valoresNivel: nivelMapA }),
    [todos, filtersA, INDS, indicadorFocal, valoresMapByYear, defaultMes, desglose, nivelMapA]
  );
  const dataB = useMemo(
    () => computeSideData({ todos, filters: filtersB, INDS, ambitoScope: filtersB.ambitoScope, indicadorFocal, valoresMapByYear, mesRef: defaultMes, desglose, valoresNivel: nivelMapB }),
    [todos, filtersB, INDS, indicadorFocal, valoresMapByYear, defaultMes, desglose, nivelMapB]
  );

  const focalInd = indicadorFocal !== 'TODOS' ? indicadoresElegibles.find(i => i.id === indicadorFocal) : null;

  // Modo de eje: 'nativo' cuando hay indicador focal (una sola unidad) o cuando
  // todas las filas comparten unidad %/binario/conteo/promedio; 'ratio' para
  // "Todos los indicadores" con unidades mezcladas.
  const chartMode = useMemo(() => {
    if (desglose === 'establecimiento' && focalInd) return 'nativo';
    if (focalInd) return 'nativo';
    return 'ratio';
  }, [desglose, focalInd]);

  const chartData = useMemo(() => {
    if (desglose === 'establecimiento' && focalInd) {
      // Una fila por establecimiento; unir A y B por key (estId).
      const keys = [...new Set([...dataA.map(d => d.key), ...dataB.map(d => d.key)])];
      return keys.map(k => {
        const a = dataA.find(d => d.key === k);
        const b = dataB.find(d => d.key === k);
        const nombre = (a || b)?.nombre ?? k;
        return {
          key: k,
          nombre,
          A: chartMode === 'nativo' ? (a?.valor ?? null) : (a?.ratio ?? null),
          B: chartMode === 'nativo' ? (b?.valor ?? null) : (b?.ratio ?? null),
        };
      });
    }
    // Modo agrupado: una fila por indicador.
    const keys = [...new Set([...dataA.map(d => d.key), ...dataB.map(d => d.key)])];
    return keys.map(k => {
      const a = dataA.find(d => d.key === k);
      const b = dataB.find(d => d.key === k);
      const ind = (a || b)?.ind;
      const nombre = ind ? truncNombreInd(ind) : k;
      const rawA = chartMode === 'nativo' ? (a?.valor ?? null) : (a?.ratio ?? null);
      const rawB = chartMode === 'nativo' ? (b?.valor ?? null) : (b?.ratio ?? null);
      return { key: k, nombre, ind, A: rawA, B: rawB };
    });
  }, [dataA, dataB, desglose, focalInd, chartMode]);

  const labelA = buildLabel(filtersA, sostenedores);
  const labelB = buildLabel(filtersB, sostenedores);

  const estsA = filtrarEstablecimientos(todos, filtersA).length;
  const estsB = filtrarEstablecimientos(todos, filtersB).length;

  const anyData2025 = valoresPorEst2025.size > 0;

  // Dominio del eje X:
  //  - chartMode 'ratio': [0, 1] con formato %
  //  - chartMode 'nativo' + focal unidad %/binario: [0, max(1, metaNum)] con formato %
  //  - chartMode 'nativo' + focal conteo/promedio: [0, max(valores, meta) * 1.1] numérico
  const { xDomain, xTickFormat, valueFormat } = useMemo(() => {
    if (chartMode === 'ratio') {
      return {
        xDomain: [0, 1],
        xTickFormat: (v) => `${Math.round(v * 100)}%`,
        valueFormat: (v) => v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`,
      };
    }
    // nativo
    const ind = focalInd || chartData[0]?.ind;
    if (!ind) {
      return { xDomain: [0, 1], xTickFormat: v => `${v}`, valueFormat: v => v ?? '—' };
    }
    if (ind.unidad === '%' || ind.unidad === 'binario') {
      return {
        xDomain: [0, Math.max(1, ind.metaNum)],
        xTickFormat: (v) => `${Math.round(v * 100)}%`,
        valueFormat: (v) => formatValue(ind, v),
      };
    }
    // conteo/promedio
    const vals = chartData.flatMap(d => [d.A, d.B]).filter(v => v !== null && v !== undefined);
    const maxV = Math.max(ind.metaNum ?? 0, ...vals, 0.1);
    return {
      xDomain: [0, Math.ceil(maxV * 1.1)],
      xTickFormat: (v) => Number.isInteger(v) ? String(v) : v.toFixed(1),
      valueFormat: (v) => formatValue(ind, v),
    };
  }, [chartMode, chartData, focalInd]);

  const enableDesgloseEst = focalInd && (filtersA.slep !== 'TODOS' || filtersB.slep !== 'TODOS');

  return (
    <div className="mt-5">
      {/* Side selectors */}
      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        <SideSelector
          label="Grupo A"
          color="var(--color-cyan)"
          filters={filtersA}
          onChange={setFiltersA}
          slepsDisponibles={slepsDisponibles}
          cohortesDisponibles={cohortesDisponibles}
          comunasDisponibles={comunasDisponibles}
          AMBITOS={AMBITOS}
        />
        <SideSelector
          label="Grupo B"
          color="var(--color-magenta)"
          filters={filtersB}
          onChange={setFiltersB}
          slepsDisponibles={slepsDisponibles}
          cohortesDisponibles={cohortesDisponibles}
          comunasDisponibles={comunasDisponibles}
          AMBITOS={AMBITOS}
        />
      </div>

      {/* Filtro por indicador focal (opcional) + desglose */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Indicador (opcional)</label>
          <select
            value={indicadorFocal}
            onChange={e => setIndicadorFocal(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark outline-none"
          >
            <option value="TODOS">Todos los indicadores</option>
            {indicadoresElegibles.map(i => (
              <option key={i.id} value={i.id}>[{indicadorCodigo(i.id)}] {i.nombre}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-ui mt-1 leading-snug">
            Con un indicador seleccionado se puede desagregar por establecimiento.
          </p>
        </div>
        <div>
          <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Desglose</label>
          <select
            value={desglose}
            onChange={e => setDesglose(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark outline-none disabled:opacity-50"
          >
            <option value="agrupado">Agrupado (promedio)</option>
            <option value="establecimiento" disabled={!enableDesgloseEst}>Por establecimiento</option>
            <option value="nivel" disabled>Por nivel (próximamente)</option>
          </select>
          <p className="text-[10px] text-gray-ui mt-1 leading-snug">
            {enableDesgloseEst ? 'Muestra una barra por centro del sostenedor seleccionado.' : 'Requiere un indicador focal y sostenedor específico.'}
          </p>
        </div>
      </div>

      {/* Aviso si algún lado usa 2025 y no hay datos disponibles */}
      {(filtersA.year === 2025 || filtersB.year === 2025) && !anyData2025 && (
        <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: 'rgb(252,244,231)', color: '#8a5a00' }}>
          Sin datos cargados para el período 2025 en Firestore. Las barras del lado 2025 aparecerán como "—".
        </div>
      )}

      {chartMode === 'ratio' && !focalInd && (
        <div className="mb-3 p-2.5 rounded-xl text-[11px] text-gray-ui" style={{ background: 'var(--color-bg)' }}>
          Comparación normalizada (% de cumplimiento vs meta). Selecciona un indicador para ver el valor en su unidad nativa.
        </div>
      )}

      {/* Legend summary */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-ui mb-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-cyan)' }}/>A: {labelA} <span className="text-gray-dark font-medium">({estsA} centros)</span></span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-magenta)' }}/>B: {labelB} <span className="text-gray-dark font-medium">({estsB} centros)</span></span>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-ui text-center py-8">Sin indicadores en común para los filtros seleccionados.</p>
      ) : (
        <div style={{ height: Math.max(220, chartData.length * 28 + 60) }}>
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
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }}
                formatter={(v, name) => [valueFormat(v), name === 'A' ? labelA : labelB]}
                labelStyle={{ color: '#6B7280', marginBottom: 2, fontWeight: 600 }}
              />
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
      )}
    </div>
  );
}

function EstRowItem({ c, idx, openEst, toggle, INDS, AMBITOS, effectiveMonth, onDrilldown, valoresPorEst, sostenedores, programa, anioEnCurso = true }) {
  return (
    <div key={c.est.id} className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => toggle(c.est.id)}
        className="w-full text-left px-4 py-3 hover:bg-bg transition"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded-full font-medium text-white flex items-center justify-center text-xs shrink-0" style={{ background: "var(--color-cyan)" }}>
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-dark truncate">{c.est.nombre}</p>
            <p className="text-xs text-gray-ui">{sostenedores.find(s => s.id === c.est.slep)?.nombre.replace(/^SLEP\s+/, '')} · Cohorte {c.est.cohorte} · {c.est.comuna}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-medium leading-none" style={{ color: 'var(--color-cyan)' }}>{Math.round(c.cumpl * 100)}%</p>
              <p className="text-[10px] text-gray-ui mt-0.5">cumplimiento</p>
            </div>
            {openEst[c.est.id] ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
          </div>
        </div>
      </button>
      {openEst[c.est.id] && (
        <div className="border-t border-border px-4 py-4 bg-bg">
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-3">Indicadores del programa</p>
          <IndicatorPanel
            INDS={INDS}
            AMBITOS={AMBITOS}
            establecimiento={c.est}
            mes={effectiveMonth}
            valoresReales={valoresPorEst.get(c.est.id) ?? new Map()}
            onDrilldown={(ind) => onDrilldown(ind, c.est.id, c.est.slep)}
            programa={programa}
            anioEnCurso={anioEnCurso}
          />
        </div>
      )}
    </div>
  );
}

function EstablecimientoList({ conCumplimiento, AMBITOS, INDS, effectiveMonth, onDrilldown, valoresPorEst, sostenedores, programa, anioEnCurso = true }) {
  const [openEst, setOpenEst] = useState({});
  const toggle = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const sorted = [...conCumplimiento].sort((a, b) => b.cumpl - a.cumpl);
  return (
    <div className="space-y-2">
      {sorted.map((c, idx) => (
        <EstRowItem key={c.est.id} c={c} idx={idx} openEst={openEst} toggle={toggle}
          INDS={INDS} AMBITOS={AMBITOS} effectiveMonth={effectiveMonth} onDrilldown={onDrilldown}
          valoresPorEst={valoresPorEst} sostenedores={sostenedores} programa={programa}
          anioEnCurso={anioEnCurso}/>
      ))}
    </div>
  );
}
