import { useState, useMemo } from 'react';
import { useApp } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, generarValorIndicador, calcularLogro, currentMonth, lastClosedMonth, anioImplementacion } from '../data/establecimientos.js';
import { KpiCard } from '../components/Shared.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import IndicatorAveragePicker from '../components/IndicatorAveragePicker.jsx';
import { Filter, Building2, Users, GraduationCap, MapPin, ChevronDown, ChevronUp, GitCompareArrows, ToggleLeft, ToggleRight } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fechaFormateada(mes) {
  const hoy = new Date();
  if (mes === currentMonth()) {
    return `${hoy.getDate()} de ${NOMBRES_MES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  }
  const year = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
  const lastDay = new Date(year, mes, 0).getDate();
  return `${lastDay} de ${NOMBRES_MES[mes - 1]} de ${year}`;
}

export default function VistaConsultor() {
  const { perfil } = useApp();
  const isCAP = perfil.id === 'cap';
  const effectiveMonth = isCAP ? lastClosedMonth() : currentMonth();

  const programa = perfil.contexto.programa || 'escolar';
  const AMBITOS = programa === 'escolar' ? AMBITOS_ESCOLAR : AMBITOS_PARVULARIO;
  const INDS    = programa === 'escolar' ? INDICADORES_ESCOLAR : INDICADORES_PARVULARIO;
  const todos   = programa === 'escolar' ? ESCUELAS : JARDINES;

  const [filtroSlep, setFiltroSlep] = useState('TODOS');
  const [filtroCohorte, setFiltroCohorte] = useState('TODAS');
  const [filtroAnio, setFiltroAnio] = useState('TODOS');
  const [filtroComuna, setFiltroComuna] = useState('TODAS');
  const [drilldown, setDrilldown] = useState(null);
  const [comparadorOpen, setComparadorOpen] = useState(false);
  const [agruparConsultor, setAgruparConsultor] = useState(false);

  const filtrados = useMemo(() => todos.filter(e =>
    (filtroSlep === 'TODOS' || e.slep === filtroSlep) &&
    (filtroCohorte === 'TODAS' || e.cohorte === filtroCohorte) &&
    (filtroAnio === 'TODOS' || anioImplementacion(e, effectiveMonth <= 4 ? 2025 : 2026) === Number(filtroAnio)) &&
    (filtroComuna === 'TODAS' || e.comuna === filtroComuna)
  ), [todos, filtroSlep, filtroCohorte, filtroAnio, filtroComuna, effectiveMonth]);

  const slepsDisponibles = [...new Set(todos.map(e => e.slep))].map(id => SLEPS.find(s => s.id === id)).filter(Boolean);
  const cohortesDisponibles = [...new Set(todos.map(e => e.cohorte))];
  const aniosDisponibles = [...new Set(todos.map(e => anioImplementacion(e, effectiveMonth <= 4 ? 2025 : 2026)))].sort();
  const comunasDisponibles = [...new Set(todos.map(e => e.comuna))].sort();

  const conLogros = useMemo(() => filtrados.map(e => {
    const logros = logroPorAmbito(INDS, e.id, e.slep, effectiveMonth, 2026);
    const promedio = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;
    return { est: e, logros, promedio };
  }), [filtrados, INDS, AMBITOS, effectiveMonth]);

  const distribucion = {
    enMeta: conLogros.filter(c => c.promedio >= 0.85).length,
    enDesarrollo: conLogros.filter(c => c.promedio >= 0.6 && c.promedio < 0.85).length,
    bajo: conLogros.filter(c => c.promedio < 0.6).length,
  };

  // Ranking items: average each indicator across all filtered establishments
  const rankingItems = useMemo(() => INDS
    .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
    .map(ind => {
      const vals = filtrados.map(e => {
        const { valor } = generarValorIndicador(ind, e.id, e.slep, effectiveMonth);
        return { valor, logro: calcularLogro(valor, ind) ?? 0 };
      });
      const valor = vals.length ? vals.reduce((s, v) => s + (v.valor ?? 0), 0) / vals.length : 0;
      const ratio = vals.length ? vals.reduce((s, v) => s + v.logro, 0) / vals.length : 0;
      return { indicador: ind, valor, ratio };
    }), [INDS, filtrados, effectiveMonth]);

  // Totals strip (reacts to filters)
  const totales = useMemo(() => ({
    establecimientos: filtrados.length,
    ninos: filtrados.reduce((s, e) => s + (e.nNinos ?? 0), 0),
    agentes: filtrados.reduce((s, e) => s + (e.nAgentes ?? 0), 0),
    comunas: new Set(filtrados.map(e => e.comuna)).size,
  }), [filtrados]);

  // breakdownBy: use sostenedor when viewing all, establecimiento when filtered to one
  const breakdownBy = filtroSlep === 'TODOS' ? 'sostenedor' : 'establecimiento';

  const selectCls = "w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none";

  return (
    <>
      {/* Banner */}
      {isCAP ? (
        <div className="text-white rounded-2xl px-6 py-7 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-magenta)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">FUNDACIÓN CAP · INFORME DE CIERRE</p>
            <h2 className="text-3xl md:text-4xl font-medium text-white leading-tight">Vista de cierre · Fundación CAP</h2>
            <p className="text-white/80 mt-2 text-sm">
              Datos <span className="text-lime-300 font-semibold">validados</span> al 30 de Abril de 2026 · Próxima actualización: primera semana de Junio
            </p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">ESTABLECIMIENTOS</p>
            <p className="font-medium mt-1 text-lg leading-none">{filtrados.length}</p>
          </div>
        </div>
      ) : (
        <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-purple-1)" }}>
          <div>
            <p className="text-xs text-white/60 tracking-wider font-medium mb-1">VISTA COMPLETA · CONSULTORÍA</p>
            <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">Programa {programa === 'escolar' ? 'Aprender en Familia · Educación Básica' : 'Aprender en Familia · Educación Parvularia'}</h2>
            <p className="text-white/70 mt-1 text-sm">Datos actualizados al {fechaFormateada(effectiveMonth)} · Vista agregada con acceso a todos los cruces.</p>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
            <p className="text-xs text-white/60 leading-none">ESTABLECIMIENTOS</p>
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
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Año de implementación</label>
              <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className={selectCls}>
                <option value="TODOS">Todos</option>
                {aniosDisponibles.map(a => <option key={a} value={a}>Año {a}</option>)}
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
        <TotalCard label="Establecimientos" value={totales.establecimientos} sub={`${distribucion.enMeta} en meta · ${distribucion.enDesarrollo} en desarrollo · ${distribucion.bajo} en camino`} Icon={Building2}/>
        <TotalCard label="Niños y niñas" value={totales.ninos.toLocaleString('es-CL')} sub="matrícula estimada" Icon={GraduationCap}/>
        <TotalCard label="Agentes educativos" value={totales.agentes} sub="en el programa" Icon={Users}/>
        <TotalCard label="Comunas" value={totales.comunas} sub="con cobertura activa" Icon={MapPin}/>
      </div>

      {/* Top-3 / Bottom-3 por indicador (promedio del conjunto filtrado) */}
      <IndicatorRanking items={rankingItems} title="Indicadores del programa"/>

      {/* Selector de indicador + gráfico comparativo */}
      <IndicatorAveragePicker
        INDS={INDS}
        establecimientos={filtrados}
        mes={effectiveMonth}
        breakdownBy={breakdownBy}
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
            aniosDisponibles={aniosDisponibles}
            comunasDisponibles={comunasDisponibles}
            defaultMes={effectiveMonth}
          />
        )}
      </div>

      {/* Lista de establecimientos */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-medium tracking-wider uppercase">Detalle por establecimiento</p>
            <h3 className="text-lg text-gray-dark">Todos los establecimientos filtrados</h3>
            <p className="text-sm text-gray-ui mt-1">Haz clic en un establecimiento para ver sus indicadores.</p>
          </div>
          <button
            onClick={() => setAgruparConsultor(v => !v)}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-bg transition shrink-0"
            style={agruparConsultor ? { borderColor: 'var(--color-cyan)', color: 'var(--color-cyan)' } : {}}
          >
            {agruparConsultor
              ? <ToggleRight size={16} style={{ color: 'var(--color-cyan)' }}/>
              : <ToggleLeft size={16} className="text-gray-ui"/>}
            Agrupar por consultor
          </button>
        </div>
        <EstablecimientoList
          conLogros={conLogros}
          AMBITOS={AMBITOS}
          INDS={INDS}
          effectiveMonth={effectiveMonth}
          perfil={perfil.id}
          agruparConsultor={agruparConsultor}
          onDrilldown={(ind, estId, slepId) => setDrilldown({ ind, estId, slepId })}
        />
      </div>

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown.ind}
          establecimientoId={drilldown.estId}
          slep={drilldown.slepId}
          effectiveMonth={effectiveMonth}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
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
        <p className="text-2xl font-medium text-gray-dark leading-none">{value}</p>
        {sub && <p className="text-[10px] text-gray-ui mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Comparador por indicador ────────────────────────────────────────────────

const MESES_OPTS = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
];

function filtrarEstablecimientos(todos, { slep, cohorte, anio, comuna, mes, year }) {
  return todos.filter(e =>
    (slep === 'TODOS' || e.slep === slep) &&
    (cohorte === 'TODAS' || e.cohorte === cohorte) &&
    (anio === 'TODOS' || anioImplementacion(e, year) === Number(anio)) &&
    (comuna === 'TODAS' || e.comuna === comuna)
  );
}

function buildLabel({ slep, cohorte, anio, comuna, mes, year }) {
  const parts = [];
  if (slep !== 'TODOS') parts.push(SLEPS.find(s => s.id === slep)?.nombre.replace(/^SLEP\s+/, '') ?? slep);
  if (cohorte !== 'TODAS') parts.push(`Cohorte ${cohorte}`);
  if (anio !== 'TODOS') parts.push(`Año ${anio}`);
  if (comuna !== 'TODAS') parts.push(comuna);
  parts.push(`${NOMBRES_MES[mes - 1]} ${year}`);
  return parts.join(' · ');
}

function computeSideData(todos, filters, INDS, ambitoScope) {
  const ests = filtrarEstablecimientos(todos, filters);
  const inds = INDS.filter(ind =>
    ind.unidad !== 'sin_meta' &&
    ind.metaNum !== null &&
    (ambitoScope === 'TODOS' || ind.ambito === ambitoScope)
  );
  return inds.map(ind => {
    const logros = ests.map(e => {
      const { valor } = generarValorIndicador(ind, e.id, e.slep, filters.mes, filters.year);
      return calcularLogro(valor, ind) ?? 0;
    });
    const ratio = logros.length ? logros.reduce((s, v) => s + v, 0) / logros.length : 0;
    return { id: ind.id, nombre: ind.id, ratio: Math.round(ratio * 100) };
  });
}

function SideSelector({ label, color, filters, onChange, slepsDisponibles, cohortesDisponibles, aniosDisponibles, comunasDisponibles, AMBITOS }) {
  const sc = "w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark outline-none";
  return (
    <div className="flex-1 min-w-0 border rounded-xl p-3" style={{ borderColor: color }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Mes</label>
          <select value={filters.mes} onChange={e => onChange({ ...filters, mes: Number(e.target.value) })} className={sc}>
            {MESES_OPTS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
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
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Año impl.</label>
          <select value={filters.anio} onChange={e => onChange({ ...filters, anio: e.target.value })} className={sc}>
            <option value="TODOS">Todos</option>
            {aniosDisponibles.map(a => <option key={a} value={a}>Año {a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Comuna</label>
          <select value={filters.comuna} onChange={e => onChange({ ...filters, comuna: e.target.value })} className={sc}>
            <option value="TODAS">Todas</option>
            {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-gray-ui font-medium mb-0.5 uppercase tracking-wider">Ámbito (alcance)</label>
          <select value={filters.ambitoScope} onChange={e => onChange({ ...filters, ambitoScope: e.target.value })} className={sc}>
            <option value="TODOS">Todos los ámbitos</option>
            {AMBITOS.map(a => <option key={a.id} value={a.id}>{a.id} · {a.nombre}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function ComparadorIndicador({ INDS, AMBITOS, todos, slepsDisponibles, cohortesDisponibles, aniosDisponibles, comunasDisponibles, defaultMes }) {
  const defaultYear = new Date().getFullYear();
  const initA = { mes: defaultMes, year: defaultYear, slep: 'TODOS', cohorte: 'TODAS', anio: 'TODOS', comuna: 'TODAS', ambitoScope: 'TODOS' };
  const initB = { mes: defaultMes, year: defaultYear - 1, slep: 'TODOS', cohorte: 'TODAS', anio: 'TODOS', comuna: 'TODAS', ambitoScope: 'TODOS' };
  const [filtersA, setFiltersA] = useState(initA);
  const [filtersB, setFiltersB] = useState(initB);

  const dataA = useMemo(() => computeSideData(todos, filtersA, INDS, filtersA.ambitoScope), [todos, filtersA, INDS]);
  const dataB = useMemo(() => computeSideData(todos, filtersB, INDS, filtersB.ambitoScope), [todos, filtersB, INDS]);

  const chartData = useMemo(() => {
    const idsA = new Set(dataA.map(d => d.id));
    const idsB = new Set(dataB.map(d => d.id));
    const ids = [...new Set([...idsA, ...idsB])];
    return ids.map(id => ({
      nombre: id,
      A: dataA.find(d => d.id === id)?.ratio ?? null,
      B: dataB.find(d => d.id === id)?.ratio ?? null,
    }));
  }, [dataA, dataB]);

  const labelA = buildLabel(filtersA);
  const labelB = buildLabel(filtersB);

  const estsA = filtrarEstablecimientos(todos, filtersA).length;
  const estsB = filtrarEstablecimientos(todos, filtersB).length;

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
          aniosDisponibles={aniosDisponibles}
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
          aniosDisponibles={aniosDisponibles}
          comunasDisponibles={comunasDisponibles}
          AMBITOS={AMBITOS}
        />
      </div>

      {/* Legend summary */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-ui mb-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-cyan)' }}/>A: {labelA} <span className="text-gray-dark font-medium">({estsA} establ.)</span></span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: 'var(--color-magenta)' }}/>B: {labelB} <span className="text-gray-dark font-medium">({estsB} establ.)</span></span>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-ui text-center py-8">Sin indicadores en común para los filtros seleccionados.</p>
      ) : (
        <div style={{ height: Math.max(220, chartData.length * 28 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 48, bottom: 4, left: 52 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false}/>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                stroke="#6B7280"
                fontSize={10}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                stroke="#6B7280"
                fontSize={10}
                width={50}
                tick={{ fill: '#333333' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }}
                formatter={(v, name) => [`${v ?? '—'}%`, name === 'A' ? labelA : labelB]}
                labelStyle={{ color: '#6B7280', marginBottom: 2, fontWeight: 600 }}
              />
              <Legend
                formatter={(value) => value === 'A' ? labelA : labelB}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Bar dataKey="A" fill="var(--color-cyan)" radius={[0, 3, 3, 0]} maxBarSize={16}
                label={{ position: 'right', formatter: v => v !== null ? `${v}%` : '', fontSize: 10, fill: '#6B7280' }}/>
              <Bar dataKey="B" fill="var(--color-magenta)" radius={[0, 3, 3, 0]} maxBarSize={16}
                label={{ position: 'right', formatter: v => v !== null ? `${v}%` : '', fontSize: 10, fill: '#6B7280' }}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EstRowItem({ c, idx, openEst, toggle, INDS, AMBITOS, effectiveMonth, onDrilldown }) {
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
            <p className="text-xs text-gray-ui">{SLEPS.find(s => s.id === c.est.slep)?.nombre.replace(/^SLEP\s+/, '')} · Cohorte {c.est.cohorte} · {c.est.comuna}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-medium text-gray-dark leading-none">{Math.round(c.promedio * 100)}%</p>
              <p className="text-[10px] text-gray-ui mt-0.5">global</p>
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
            establecimientoId={c.est.id}
            slep={c.est.slep}
            mes={effectiveMonth}
            onDrilldown={(ind) => onDrilldown(ind, c.est.id, c.est.slep)}
          />
        </div>
      )}
    </div>
  );
}

function EstablecimientoList({ conLogros, AMBITOS, INDS, effectiveMonth, perfil, agruparConsultor, onDrilldown }) {
  const [openEst, setOpenEst] = useState({});
  const [openGrupo, setOpenGrupo] = useState({});
  const toggle = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleGrupo = (email) => setOpenGrupo(prev => ({ ...prev, [email]: !prev[email] }));

  const sorted = [...conLogros].sort((a, b) => b.promedio - a.promedio);

  if (!agruparConsultor) {
    return (
      <div className="space-y-2">
        {sorted.map((c, idx) => (
          <EstRowItem key={c.est.id} c={c} idx={idx} openEst={openEst} toggle={toggle}
            INDS={INDS} AMBITOS={AMBITOS} effectiveMonth={effectiveMonth} onDrilldown={onDrilldown}/>
        ))}
      </div>
    );
  }

  // Grouped by consultorEmail
  const grupos = {};
  for (const c of sorted) {
    const email = c.est.consultorEmail ?? 'Sin asignar';
    if (!grupos[email]) grupos[email] = [];
    grupos[email].push(c);
  }
  const gruposOrdenados = Object.entries(grupos).sort((a, b) => {
    const avgA = a[1].reduce((s, c) => s + c.promedio, 0) / a[1].length;
    const avgB = b[1].reduce((s, c) => s + c.promedio, 0) / b[1].length;
    return avgB - avgA;
  });

  return (
    <div className="space-y-3">
      {gruposOrdenados.map(([email, items]) => {
        const avg = items.reduce((s, c) => s + c.promedio, 0) / items.length;
        const isOpen = openGrupo[email] ?? false;
        return (
          <div key={email} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGrupo(email)}
              className="w-full text-left px-4 py-3 hover:bg-bg transition"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-cyan)' }}>
                  <Users size={13} className="text-white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-dark truncate">{email}</p>
                  <p className="text-xs text-gray-ui">{items.length} establecimiento{items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-medium text-gray-dark leading-none">{Math.round(avg * 100)}%</p>
                    <p className="text-[10px] text-gray-ui mt-0.5">promedio</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-3 bg-bg space-y-2">
                {items.map((c, idx) => (
                  <EstRowItem key={c.est.id} c={c} idx={idx} openEst={openEst} toggle={toggle}
                    INDS={INDS} AMBITOS={AMBITOS} effectiveMonth={effectiveMonth} onDrilldown={onDrilldown}/>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
