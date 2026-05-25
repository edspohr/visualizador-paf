import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { useApp } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito } from '../data/establecimientos.js';
import { AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, PageHeader } from '../components/Shared.jsx';
import { Globe2, Filter, Users, Building2, Award, TrendingUp, MapPin } from 'lucide-react';

export default function VistaConsultor() {
  const { perfil } = useApp();
  const programa = perfil.contexto.programa || 'escolar';
  const AMBITOS = programa === 'escolar' ? AMBITOS_ESCOLAR : AMBITOS_PARVULARIO;
  const INDS    = programa === 'escolar' ? INDICADORES_ESCOLAR : INDICADORES_PARVULARIO;
  const todos   = programa === 'escolar' ? ESCUELAS : JARDINES;

  const [filtroSlep, setFiltroSlep] = useState('TODOS');
  const [filtroCohorte, setFiltroCohorte] = useState('TODAS');

  const filtrados = useMemo(() => todos.filter(e =>
    (filtroSlep === 'TODOS' || e.slep === filtroSlep) &&
    (filtroCohorte === 'TODAS' || e.cohorte === filtroCohorte)
  ), [todos, filtroSlep, filtroCohorte]);

  // Cohortes y SLEPs disponibles según programa
  const slepsDisponibles = [...new Set(todos.map(e => e.slep))].map(id => SLEPS.find(s => s.id === id)).filter(Boolean);
  const cohortesDisponibles = [...new Set(todos.map(e => e.cohorte))];

  // Logros globales por establecimiento filtrado
  const conLogros = filtrados.map(e => {
    const logros = logroPorAmbito(INDS, e.id, e.slep);
    const promedio = Object.values(logros).reduce((a,b)=>a+b,0) / AMBITOS.length;
    return { est: e, logros, promedio };
  });

  // Logros promedio por ámbito (nacional / filtrado)
  const logrosNacional = Object.fromEntries(
    AMBITOS.map(a => {
      const vals = conLogros.map(c => c.logros[a.id]);
      return [a.id, vals.length ? vals.reduce((x,y)=>x+y,0) / vals.length : 0];
    })
  );
  const logroGlobal = Object.values(logrosNacional).reduce((a,b)=>a+b,0) / AMBITOS.length;

  // Comparativa por SLEP (cuántos establecimientos por SLEP, logro promedio)
  const porSlep = slepsDisponibles.map(s => {
    const ests = conLogros.filter(c => c.est.slep === s.id);
    if (!ests.length) return null;
    const prom = ests.reduce((sum, e) => sum + e.promedio, 0) / ests.length;
    const logrosA = Object.fromEntries(
      AMBITOS.map(a => [a.id, ests.reduce((sum, e) => sum + e.logros[a.id], 0) / ests.length])
    );
    return { slep: s, count: ests.length, promedio: prom, logros: logrosA };
  }).filter(Boolean);

  // Distribución (cuántos en cada categoría)
  const distribucion = {
    enMeta: conLogros.filter(c => c.promedio >= 0.85).length,
    enDesarrollo: conLogros.filter(c => c.promedio >= 0.6 && c.promedio < 0.85).length,
    bajo: conLogros.filter(c => c.promedio < 0.6).length,
  };

  return (
    <>
      {/* Banner navy con vista completa */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-cyan)" }}>
        <div>
          <p className="text-xs text-white/60 tracking-wider font-medium mb-1">VISTA COMPLETA · CONSULTORÍA / FUNDACIÓN CAP</p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">Programa {programa === 'escolar' ? 'Aprender en Familia · Educación Básica' : 'Aprender en Familia · Educación Parvularia'}</h2>
          <p className="text-white/70 mt-1 text-sm">Vista agregada con acceso a todos los cruces (cohorte, año, sostenedor, comuna).</p>
        </div>
        <div className="bg-white/10 px-3 py-2 rounded-xl text-sm">
          <p className="text-xs text-white/60 leading-none">LOGRO PROMEDIO</p>
          <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Filter size={16}/> Filtros
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Sostenedor</label>
              <select value={filtroSlep} onChange={(e) => setFiltroSlep(e.target.value)} className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none">
                <option value="TODOS">Todos los sostenedores</option>
                {slepsDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Cohorte</label>
              <select value={filtroCohorte} onChange={(e) => setFiltroCohorte(e.target.value)} className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none">
                <option value="TODAS">Todas las cohortes</option>
                {cohortesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1 uppercase tracking-wider">Año implementación</label>
              <select className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-sky focus:border-sky outline-none" defaultValue="2026">
                <option>2026 (Año 1)</option>
                <option disabled>2027 (Año 2)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Establecimientos" value={filtrados.length} sublabel={`${slepsDisponibles.length} ${slepsDisponibles.length === 1 ? 'SLEP activo' : 'SLEPs activos'}`} icon={Building2}/>
        <KpiCard label="En meta" value={distribucion.enMeta} sublabel={`${Math.round((distribucion.enMeta / (filtrados.length || 1)) * 100)}% del total`} icon={Award} color="lime"/>
        <KpiCard label="En desarrollo" value={distribucion.enDesarrollo} sublabel={`${Math.round((distribucion.enDesarrollo / (filtrados.length || 1)) * 100)}% del total`} icon={TrendingUp} color="sky"/>
        <KpiCard label="Bajo lo esperado" value={distribucion.bajo} sublabel={`${Math.round((distribucion.bajo / (filtrados.length || 1)) * 100)}% del total`} icon={Users} color="navy"/>
      </div>

      {/* Semáforos por ámbito */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro nacional por ámbito"
        subtitle={`Promedio agregado de ${filtrados.length} establecimientos según filtros aplicados.`}
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${AMBITOS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
        {AMBITOS.map(a => (
          <AmbitoCard key={a.id} ambito={a} logro={logrosNacional[a.id]}/>
        ))}
      </div>

      {/* Comparación entre SLEP */}
      <div className="card mb-8">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Comparativa entre sostenedores</p>
          <h3 className="text-lg text-gray-dark">Logro por SLEP y ámbito</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={porSlep.map(p => ({
                slep: p.slep.nombre.replace('SLEP ',''),
                ...Object.fromEntries(AMBITOS.map(a => [a.codigo, Math.round(p.logros[a.id] * 100)]))
              }))}
              margin={{ top: 10, right: 20, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false}/>
              <XAxis dataKey="slep" stroke="#6B7280" fontSize={12}/>
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%"/>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} formatter={(v) => `${v}%`}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              {AMBITOS.map((a, i) => {
                const colors = ['rgb(0,138,201)', 'rgb(228,21,105)', 'rgb(255,220,0)', 'rgb(179,67,120)'];
                return <Bar key={a.id} dataKey={a.codigo} fill={colors[i % colors.length]} radius={[4,4,0,0]}/>;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de todos los establecimientos */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle por establecimiento</p>
          <h3 className="text-lg text-gray-dark">Todos los establecimientos filtrados</h3>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Establecimiento</th>
                <th className="py-2 pr-3 font-medium">Sostenedor</th>
                <th className="py-2 pr-3 font-medium">Cohorte</th>
                {AMBITOS.map(a => <th key={a.id} className="py-2 px-2 font-medium text-center">{a.codigo}</th>)}
                <th className="py-2 pl-3 font-medium text-right">Global</th>
              </tr>
            </thead>
            <tbody>
              {conLogros.sort((a, b) => b.promedio - a.promedio).map((c, idx) => (
                <tr key={c.est.id} className="border-b border-border hover:bg-bg transition">
                  <td className="py-3 pr-3 text-gray-ui text-xs">{idx + 1}</td>
                  <td className="py-3 pr-3">
                    <p className="font-medium">{c.est.nombre}</p>
                  </td>
                  <td className="py-3 pr-3 text-gray-dark">{SLEPS.find(s => s.id === c.est.slep)?.nombre.replace('SLEP ','')}</td>
                  <td className="py-3 pr-3 text-gray-ui text-xs">{c.est.cohorte}</td>
                  {AMBITOS.map(a => {
                    const v = Math.round(c.logros[a.id] * 100);
                    const color = c.logros[a.id] >= 0.85 ? 'text-lime-600' : c.logros[a.id] >= 0.6 ? 'text-amber-700' : 'text-red-700';
                    return <td key={a.id} className={`py-3 px-2 text-center font-medium ${color}`}>{v}%</td>;
                  })}
                  <td className="py-3 pl-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium text-gray-dark">{Math.round(c.promedio * 100)}%</span>
                      <SemaforoBadge logro={c.promedio}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
