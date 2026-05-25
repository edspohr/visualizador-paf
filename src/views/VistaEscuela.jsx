import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, generarValorIndicador, calcularLogro, logroPorAmbito, evolucionAmbito, promedioSlepAmbito, MES_ACTUAL } from '../data/establecimientos.js';
import { AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, TipoBadge, PageHeader } from '../components/Shared.jsx';
import { Target, Calendar, Building2, Users } from 'lucide-react';

export default function VistaEscuela() {
  const { perfil } = useApp();
  const esJardin = perfil.id === 'jardin';
  const programa = esJardin ? 'parvulario' : 'escolar';
  const AMBITOS = esJardin ? AMBITOS_PARVULARIO : AMBITOS_ESCOLAR;
  const INDS    = esJardin ? INDICADORES_PARVULARIO : INDICADORES_ESCOLAR;
  const todos   = esJardin ? JARDINES : ESCUELAS;

  const entidad = resolverEntidad(perfil.contexto);
  if (!entidad) return <p>Establecimiento no encontrado.</p>;

  const slep = SLEPS.find(s => s.id === entidad.slep);
  const logros = logroPorAmbito(INDS, entidad.id, entidad.slep);
  const promedios = Object.fromEntries(
    AMBITOS.map(a => [a.id, promedioSlepAmbito(INDS, todos, entidad.slep, a.id)])
  );

  // Logro global
  const logroGlobal = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;

  // Data para evolución (apilada por ámbito)
  const evol = (() => {
    const meses = ['Ene','Feb','Mar','Abr','May'];
    return meses.map((m, idx) => {
      const row = { mes: m };
      AMBITOS.forEach(a => {
        const indsA = INDS.filter(i => i.ambito === a.id);
        let s = 0, n = 0;
        for (const ind of indsA) {
          const { valor } = generarValorIndicador(ind, entidad.id, entidad.slep, idx + 1);
          s += Math.min(1, calcularLogro(valor, ind));
          n += 1;
        }
        row[a.codigo] = Math.round((n ? s/n : 0) * 100);
      });
      return row;
    });
  })();

  // Tabla de indicadores
  const filasIndicadores = INDS.map(ind => {
    const { valor } = generarValorIndicador(ind, entidad.id, entidad.slep, MES_ACTUAL);
    const logro = calcularLogro(valor, ind);
    return { ind, valor, logro };
  });

  return (
    <>
      {/* Banner celeste con contexto */}
      <div className="bg-sky text-white rounded-xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-sky-50 tracking-wider font-semibold mb-1">
            {entidad.tipo.toUpperCase()} · COHORTE {entidad.cohorte}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{entidad.nombre}</h2>
          <p className="text-sky-50 mt-1 text-sm">{slep?.nombre} · Programa Aprender en Familia</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-lg">
            <p className="text-xs text-sky-100 leading-none">PERÍODO</p>
            <p className="font-semibold mt-1">Mayo 2026</p>
          </div>
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-lg">
            <p className="text-xs text-sky-100 leading-none">LOGRO GLOBAL</p>
            <p className="font-semibold mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Semáforos por ámbito */}
      <PageHeader
        eyebrow="VISTA EJECUTIVA"
        title="Logro por ámbito"
        subtitle="% de cumplimiento agregado de los indicadores de cada ámbito comparado con el promedio del SLEP."
      />
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${AMBITOS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-8`}>
        {AMBITOS.map(a => (
          <AmbitoCard
            key={a.id}
            ambito={a}
            logro={logros[a.id]}
            deltaPromedio={logros[a.id] - promedios[a.id]}
          />
        ))}
      </div>

      {/* Evolución mensual */}
      <div className="card mb-8">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-xs text-sky-600 font-semibold tracking-wider uppercase">Evolución del año</p>
            <h3 className="text-lg text-navy">Logro mensual por ámbito</h3>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evol} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="mes" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              {AMBITOS.map((a, i) => {
                const colors = ['#1A365D', '#5B9BD5', '#8CC63F', '#2D5489'];
                return (
                  <Line
                    key={a.id}
                    type="monotone"
                    dataKey={a.codigo}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparativa con SLEP */}
      <div className="card mb-8">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-xs text-sky-600 font-semibold tracking-wider uppercase">Comparativa territorial</p>
            <h3 className="text-lg text-navy">Tu establecimiento vs promedio {slep?.nombre}</h3>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={AMBITOS.map(a => ({
              ambito: a.codigo,
              'Tu establecimiento': Math.round(logros[a.id] * 100),
              'Promedio SLEP': Math.round(promedios[a.id] * 100),
            }))} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="ambito" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="Tu establecimiento" fill="#1A365D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Promedio SLEP" fill="#8CC63F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle por indicador */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-xs text-sky-600 font-semibold tracking-wider uppercase">Detalle</p>
            <h3 className="text-lg text-navy">Indicadores del programa</h3>
            <p className="text-sm text-muted mt-1">{filasIndicadores.length} indicadores · {filasIndicadores.filter(f => f.ind.tipo === 'operativo').length} operativos · {filasIndicadores.filter(f => f.ind.tipo === 'táctico').length} tácticos</p>
          </div>
        </div>

        {/* Agrupar por ámbito */}
        {AMBITOS.map(a => {
          const filas = filasIndicadores.filter(f => f.ind.ambito === a.id);
          if (!filas.length) return null;
          return (
            <div key={a.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <span className="tag tag-navy">{a.codigo}</span>
                <h4 className="text-base text-navy">{a.nombre}</h4>
              </div>
              <div className="space-y-2">
                {filas.map(({ ind, valor, logro }) => (
                  <div key={ind.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2.5 px-3 rounded-lg hover:bg-bg transition">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 text-xs text-muted font-mono shrink-0 pt-0.5 sm:pt-0">{ind.id}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm text-ink">{ind.nombre}</span>
                          <TipoBadge tipo={ind.tipo}/>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                          <span>Actividad: {ind.actividad}</span>
                          <span>Frec: {ind.frecuencia}</span>
                          <span>Fuente: {ind.fuente}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 pl-[60px] sm:pl-0">
                      <div className="w-28 hidden md:block">
                        <ProgressBar logro={logro}/>
                      </div>
                      <div className="text-right shrink-0 w-24 sm:w-32">
                        <p className="text-sm font-bold text-navy">
                          {ind.unidad === '%' ? `${Math.round(valor * 100)}%`
                            : ind.unidad === 'binario' ? (valor ? 'Sí' : 'No')
                            : valor}
                        </p>
                        <p className="text-xs text-muted">meta: {ind.meta}</p>
                      </div>
                      <div className="shrink-0 hidden lg:block">
                        <SemaforoBadge logro={logro}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
