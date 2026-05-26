import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, currentMonth, lastClosedMonth } from '../data/establecimientos.js';
import { AmbitoCard, KpiCard, SemaforoBadge, PageHeader } from '../components/Shared.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import { Filter, Users, Building2, Award, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

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

function logrosNacionales(INDS, AMBITOS, filtrados, mes, anio) {
  return Object.fromEntries(
    AMBITOS.map(a => {
      const vals = filtrados.map(e => {
        const r = logroPorAmbito(INDS, e.id, e.slep, mes, anio);
        return r[a.id] ?? 0;
      });
      return [a.id, vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0];
    })
  );
}

function buildPeriodOptions() {
  const opts = [];
  for (const anio of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      opts.push({ value: `${anio}-${m}`, label: `${NOMBRES_MES[m - 1]} ${anio}`, mes: m, anio });
    }
  }
  return opts;
}
const PERIOD_OPTIONS = buildPeriodOptions();

// Single-bar tooltip — only shows the hovered series
function SingleBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#6B7280', marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 600, color: '#333' }}>{item.name}: {item.value}%</p>
    </div>
  );
}

// Collapsible wrapper
function Collapsible({ title, eyebrow, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-xs font-medium tracking-wider uppercase text-gray-ui">{eyebrow}</p>
          <h3 className="text-lg text-gray-dark">{title}</h3>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-ui shrink-0"/> : <ChevronDown size={18} className="text-gray-ui shrink-0"/>}
      </button>
      {open && <div className="mt-5">{children}</div>}
    </div>
  );
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
  const [drilldown, setDrilldown] = useState(null); // { ind, estId, slepId }

  const defaultLeft  = isCAP ? `2025-${lastClosedMonth()}` : `2025-${currentMonth()}`;
  const defaultRight = isCAP ? `2026-${lastClosedMonth()}` : `2026-${currentMonth()}`;
  const [periodoA, setPeriodoA] = useState(defaultLeft);
  const [periodoB, setPeriodoB] = useState(defaultRight);

  const filtrados = useMemo(() => todos.filter(e =>
    (filtroSlep === 'TODOS' || e.slep === filtroSlep) &&
    (filtroCohorte === 'TODAS' || e.cohorte === filtroCohorte)
  ), [todos, filtroSlep, filtroCohorte]);

  const slepsDisponibles = [...new Set(todos.map(e => e.slep))].map(id => SLEPS.find(s => s.id === id)).filter(Boolean);
  const cohortesDisponibles = [...new Set(todos.map(e => e.cohorte))];

  // 2026 logros
  const conLogros = filtrados.map(e => {
    const logros = logroPorAmbito(INDS, e.id, e.slep, effectiveMonth, 2026);
    const promedio = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;
    return { est: e, logros, promedio };
  });

  const logrosNacional = Object.fromEntries(
    AMBITOS.map(a => {
      const vals = conLogros.map(c => c.logros[a.id]);
      return [a.id, vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0];
    })
  );
  const logroGlobal = Object.values(logrosNacional).reduce((a, b) => a + b, 0) / AMBITOS.length;

  // 2025 logros — always computed for YoY display
  const logrosNacional2025 = useMemo(() =>
    logrosNacionales(INDS, AMBITOS, filtrados, effectiveMonth, 2025),
    [INDS, AMBITOS, filtrados, effectiveMonth]
  );

  // Sostenedor bar chart — always shows both years
  const porSlep = slepsDisponibles.map(s => {
    const ests = conLogros.filter(c => c.est.slep === s.id);
    if (!ests.length) return null;
    const logrosA26 = Object.fromEntries(
      AMBITOS.map(a => [a.id, ests.reduce((sum, e) => sum + e.logros[a.id], 0) / ests.length])
    );
    const ests25 = filtrados.filter(e => e.slep === s.id);
    const logrosA25 = Object.fromEntries(
      AMBITOS.map(a => {
        const vals = ests25.map(e => {
          const r = logroPorAmbito(INDS, e.id, e.slep, effectiveMonth, 2025);
          return r[a.id] ?? 0;
        });
        return [a.id, vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0];
      })
    );
    return { slep: s, logros: logrosA26, logros2025: logrosA25 };
  }).filter(Boolean);

  const distribucion = {
    enMeta: conLogros.filter(c => c.promedio >= 0.85).length,
    enDesarrollo: conLogros.filter(c => c.promedio >= 0.6 && c.promedio < 0.85).length,
    bajo: conLogros.filter(c => c.promedio < 0.6).length,
  };

  // Best and worst ámbito nationally
  const ambitosSorted = AMBITOS.map(a => ({ ambito: a, logro: logrosNacional[a.id] ?? 0 }))
    .sort((a, b) => b.logro - a.logro);
  const mejorAmbito  = ambitosSorted[0];
  const criticoAmbito = ambitosSorted[ambitosSorted.length - 1];

  // Sostenedor with highest average YoY improvement
  const mayorAvanceSlep = porSlep.length ? porSlep.map(p => {
    const delta = AMBITOS.reduce((s, a) => s + ((p.logros[a.id] ?? 0) - (p.logros2025[a.id] ?? 0)), 0) / AMBITOS.length;
    return { nombre: p.slep.nombre.replace(/^SLEP\s+/, ''), delta };
  }).sort((a, b) => b.delta - a.delta)[0] : null;

  // Period comparator
  const parsePeriod = (v) => PERIOD_OPTIONS.find(o => o.value === v) ?? { mes: effectiveMonth, anio: 2026 };
  const pA = parsePeriod(periodoA);
  const pB = parsePeriod(periodoB);
  const logrosPA = useMemo(() => logrosNacionales(INDS, AMBITOS, filtrados, pA.mes, pA.anio), [INDS, AMBITOS, filtrados, pA.mes, pA.anio]);
  const logosPB = useMemo(() => logrosNacionales(INDS, AMBITOS, filtrados, pB.mes, pB.anio), [INDS, AMBITOS, filtrados, pB.mes, pB.anio]);

  const ambitoColors = ['rgb(0,138,201)', 'rgb(228,21,105)', 'rgb(255,220,0)', 'rgb(179,67,120)'];
  const selectCls = "w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none";

  const labelA = PERIOD_OPTIONS.find(o => o.value === periodoA)?.label ?? 'A';
  const labelB = PERIOD_OPTIONS.find(o => o.value === periodoB)?.label ?? 'B';

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
            <p className="text-xs text-white/60 leading-none">LOGRO PROMEDIO</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
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
            <p className="text-xs text-white/60 leading-none">LOGRO PROMEDIO</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Filter size={16}/> Filtros
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
              <select value={filtroSlep} onChange={(e) => setFiltroSlep(e.target.value)} className={selectCls}>
                <option value="TODOS">Todos los sostenedores</option>
                {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Cohorte</label>
              <select value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)} className={selectCls}>
                <option value="TODAS">Todas las cohortes</option>
                {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Establecimientos"
          value={filtrados.length}
          sublabel={`${distribucion.enMeta} en meta · ${distribucion.enDesarrollo} en desarrollo · ${distribucion.bajo} requieren atención`}
          icon={Building2}
        />
        <KpiCard
          label="Mejor ámbito"
          value={mejorAmbito ? `${Math.round(mejorAmbito.logro * 100)}%` : '—'}
          sublabel={mejorAmbito?.ambito.nombre ?? ''}
          icon={Award}
          color="lime"
        />
        <KpiCard
          label="Ámbito crítico"
          value={criticoAmbito ? `${Math.round(criticoAmbito.logro * 100)}%` : '—'}
          sublabel={criticoAmbito?.ambito.nombre ?? ''}
          icon={AlertTriangle}
          color="magenta"
        />
        <KpiCard
          label="Mayor avance YoY"
          value={mayorAvanceSlep ? `${mayorAvanceSlep.delta >= 0 ? '+' : ''}${Math.round(mayorAvanceSlep.delta * 100)} pp` : '—'}
          sublabel={mayorAvanceSlep?.nombre ?? 'Sin datos'}
          icon={TrendingUp}
          color="sky"
        />
      </div>

      {/* Ámbito cards — YoY always shown */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro nacional por ámbito · 2026 vs 2025"
        subtitle={`Promedio agregado de ${filtrados.length} establecimientos. Los valores 2025 muestran la evolución año a año.`}
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${AMBITOS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
        {AMBITOS.map(a => {
          const logro2026 = logrosNacional[a.id];
          const logro2025 = logrosNacional2025[a.id] ?? 0;
          const delta = Math.round((logro2026 - logro2025) * 100);
          return (
            <AmbitoCard key={a.id} ambito={a} logro={logro2026} yoy={{ logro2025, delta }}/>
          );
        })}
      </div>

      {/* Sostenedor comparison bar chart — always 2025+2026 */}
      <div className="card mb-8">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Comparativa entre sostenedores</p>
          <h3 className="text-lg text-gray-dark">Logro por sostenedor y ámbito · 2025 vs 2026</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={porSlep.map(p => {
                const row = { slep: p.slep.nombre.replace(/^SLEP\s+/, '') };
                AMBITOS.forEach(a => {
                  row[`${a.codigo} 2026`] = Math.round(p.logros[a.id] * 100);
                  row[`${a.codigo} 2025`] = Math.round(p.logros2025[a.id] * 100);
                });
                return row;
              })}
              margin={{ top: 10, right: 20, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false}/>
              <XAxis dataKey="slep" stroke="#6B7280" fontSize={12}/>
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%"/>
              <Tooltip content={<SingleBarTooltip />}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              {AMBITOS.map((a, i) => (
                <Bar key={`${a.id}-2026`} dataKey={`${a.codigo} 2026`} fill={ambitoColors[i % ambitoColors.length]} radius={[4,4,0,0]}/>
              ))}
              {AMBITOS.map((a, i) => (
                <Bar key={`${a.id}-2025`} dataKey={`${a.codigo} 2025`} fill={ambitoColors[i % ambitoColors.length]} fillOpacity={0.35} radius={[4,4,0,0]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Period comparator — collapsible */}
      <Collapsible eyebrow="Análisis temporal" title="Comparación entre períodos" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Período A</label>
            <select value={periodoA} onChange={e => setPeriodoA(e.target.value)} className={selectCls}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Período B</label>
            <select value={periodoB} onChange={e => setPeriodoB(e.target.value)} className={selectCls}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-medium text-gray-ui uppercase tracking-wider mb-3">{labelA}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AMBITOS.map(a => <AmbitoCard key={a.id} ambito={a} logro={logrosPA[a.id]}/>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-ui uppercase tracking-wider mb-3">{labelB}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AMBITOS.map(a => <AmbitoCard key={a.id} ambito={a} logro={logosPB[a.id]}/>)}
            </div>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={AMBITOS.map(a => ({
                ambito: a.codigo,
                [labelA]: Math.round(logrosPA[a.id] * 100),
                [labelB]: Math.round(logosPB[a.id] * 100),
              }))}
              margin={{ top: 4, right: 16, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false}/>
              <XAxis dataKey="ambito" stroke="#6B7280" fontSize={12}/>
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%"/>
              <Tooltip content={<SingleBarTooltip />}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey={labelA} fill="rgb(0,138,201)" radius={[4,4,0,0]}/>
              <Bar dataKey={labelB} fill="rgb(228,21,105)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Collapsible>

      {/* Establishment table with collapsible indicator drill-down per row */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por establecimiento</p>
          <h3 className="text-lg text-gray-dark">Todos los establecimientos filtrados</h3>
          <p className="text-sm text-gray-ui mt-1">Haz clic en un establecimiento para ver sus indicadores.</p>
        </div>
        <EstablecimientoList
          conLogros={conLogros}
          AMBITOS={AMBITOS}
          INDS={INDS}
          effectiveMonth={effectiveMonth}
          perfil={perfil.id}
          onDrilldown={(ind, estId, slepId) => setDrilldown({ ind, estId, slepId })}
        />
      </div>

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

// Establishment rows with collapsible indicator panel per row
function EstablecimientoList({ conLogros, AMBITOS, INDS, effectiveMonth, perfil, onDrilldown }) {
  const [openEst, setOpenEst] = useState({});
  const toggle = (id) => setOpenEst(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-2">
      {[...conLogros].sort((a, b) => b.promedio - a.promedio).map((c, idx) => (
        <div key={c.est.id} className="border border-border rounded-xl overflow-hidden">
          {/* Row header — click to expand */}
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
                <p className="text-xs text-gray-ui">{SLEPS.find(s => s.id === c.est.slep)?.nombre.replace(/^SLEP\s+/, '')} · Cohorte {c.est.cohorte}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:grid grid-cols-4 gap-2">
                  {AMBITOS.map(a => {
                    const v = Math.round(c.logros[a.id] * 100);
                    const color = c.logros[a.id] >= 0.85 ? 'text-lime-600' : c.logros[a.id] >= 0.6 ? 'text-amber-700' : 'text-red-700';
                    return (
                      <div key={a.id} className="text-center">
                        <p className={`text-xs font-medium ${color}`}>{v}%</p>
                        <p className="text-[10px] text-gray-ui">{a.codigo}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium text-gray-dark leading-none">{Math.round(c.promedio * 100)}%</p>
                  <p className="text-[10px] text-gray-ui mt-0.5">global</p>
                </div>
                <SemaforoBadge logro={c.promedio}/>
                {openEst[c.est.id] ? <ChevronUp size={16} className="text-gray-ui"/> : <ChevronDown size={16} className="text-gray-ui"/>}
              </div>
            </div>
          </button>
          {/* Indicator panel — collapses per establishment */}
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
      ))}
    </div>
  );
}
