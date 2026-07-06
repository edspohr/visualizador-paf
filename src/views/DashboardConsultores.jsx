import { useMemo, useState } from 'react';
import { BarChart3, Users, Building2, GraduationCap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ESCUELAS, JARDINES, generarValorIndicador, calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import IndicatorRanking from '../components/IndicatorRanking.jsx';

// Agrupa un array de establecimientos por consultorEmail
function agruparPorConsultor(establecimientos) {
  const grupos = {};
  for (const e of establecimientos) {
    const email = e.consultorEmail ?? 'Sin asignar';
    if (!grupos[email]) grupos[email] = [];
    grupos[email].push(e);
  }
  return grupos;
}

// Promedio de logro global para un conjunto de establecimientos (usa mismo cálculo
// que Vista Consultor: promedio de min(1, valor/meta) sobre todos los indicadores del programa)
function calcularPromedioLogro(establecimientos, indicadores, mes) {
  if (!establecimientos.length) return null;
  const inds = indicadores.filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null);
  let suma = 0, n = 0;
  for (const e of establecimientos) {
    for (const ind of inds) {
      const { valor } = generarValorIndicador(ind, e.id, e.slep, mes);
      const logro = calcularLogro(valor, ind);
      if (logro === null) continue;
      suma += Math.min(1, logro);
      n += 1;
    }
  }
  return n ? suma / n : null;
}

// Ranking-items para IndicatorRanking (mismo formato que otras vistas)
function calcularRankingItems(establecimientos, indicadores, mes) {
  return indicadores
    .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
    .map(ind => {
      const vals = establecimientos.map(e => {
        const { valor } = generarValorIndicador(ind, e.id, e.slep, mes);
        return { valor, logro: calcularLogro(valor, ind) ?? 0 };
      });
      const valor = vals.length ? vals.reduce((s, v) => s + (v.valor ?? 0), 0) / vals.length : 0;
      const ratio = vals.length ? vals.reduce((s, v) => s + v.logro, 0) / vals.length : 0;
      return { indicador: ind, valor, ratio };
    });
}

export default function DashboardConsultores() {
  const [programa, setPrograma] = useState('escolar'); // 'escolar' | 'parvulario'
  const [consultorFoco, setConsultorFoco] = useState(null); // email del consultor con ranking expandido

  const establecimientos = programa === 'escolar' ? ESCUELAS : JARDINES;
  const indicadores = programa === 'escolar' ? INDICADORES_ESCOLAR : INDICADORES_PARVULARIO;

  const grupos = useMemo(() => agruparPorConsultor(establecimientos), [establecimientos]);
  const promedioNacional = useMemo(
    () => calcularPromedioLogro(establecimientos, indicadores, MES_ACTUAL),
    [establecimientos, indicadores]
  );

  // Métricas por consultor
  const consultores = useMemo(() => {
    const arr = Object.entries(grupos).map(([email, ests]) => {
      const promedio = calcularPromedioLogro(ests, indicadores, MES_ACTUAL);
      const nNinos = ests.reduce((s, e) => s + (e.nNinos ?? 0), 0);
      const nAgentes = ests.reduce((s, e) => s + (e.nAgentes ?? 0), 0);
      const comunas = new Set(ests.map(e => e.comuna)).size;
      return { email, ests, promedio, nNinos, nAgentes, comunas, delta: (promedio ?? 0) - (promedioNacional ?? 0) };
    });
    // Orden descendente por promedio
    arr.sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));
    return arr;
  }, [grupos, indicadores, promedioNacional]);

  const focoEsts = consultorFoco ? grupos[consultorFoco] ?? [] : [];
  const rankingItemsFoco = useMemo(
    () => (focoEsts.length ? calcularRankingItems(focoEsts, indicadores, MES_ACTUAL) : []),
    [focoEsts, indicadores]
  );

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgb(220,240,240)' }}>
            <BarChart3 size={20} style={{ color: 'var(--color-teal)' }} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-gray-dark">Rendimiento por consultor</h2>
            <p className="text-sm text-gray-ui font-light">
              Métricas agregadas por consultor Focus. Cobertura, logro promedio y ranking de indicadores.
            </p>
          </div>
        </div>
        {/* Toggle programa */}
        <div className="flex items-center gap-1 border border-border rounded-xl p-1 bg-white">
          <button
            onClick={() => { setPrograma('escolar'); setConsultorFoco(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${programa === 'escolar' ? 'text-white' : 'text-gray-ui hover:bg-bg'}`}
            style={programa === 'escolar' ? { background: 'var(--color-cyan)' } : {}}
          >Escolar</button>
          <button
            onClick={() => { setPrograma('parvulario'); setConsultorFoco(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${programa === 'parvulario' ? 'text-white' : 'text-gray-ui hover:bg-bg'}`}
            style={programa === 'parvulario' ? { background: 'var(--color-cyan)' } : {}}
          >Parvulario</button>
        </div>
      </div>

      {/* Header con promedio nacional */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">Promedio nacional</p>
            <p className="text-2xl font-medium text-gray-dark leading-none mt-1">
              {promedioNacional !== null ? `${Math.round(promedioNacional * 100)}%` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">{consultores.length} consultores</p>
            <p className="text-sm text-gray-dark font-light mt-1">
              {establecimientos.length} establecimientos · {establecimientos.reduce((s, e) => s + (e.nNinos ?? 0), 0).toLocaleString('es-CL')} niños
            </p>
          </div>
        </div>
      </div>

      {/* Grid de tarjetas por consultor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {consultores.map(c => (
          <TarjetaConsultor
            key={c.email}
            c={c}
            enFoco={consultorFoco === c.email}
            onToggleFoco={() => setConsultorFoco(prev => prev === c.email ? null : c.email)}
          />
        ))}
      </div>

      {/* Ranking del consultor en foco */}
      {consultorFoco && (
        <IndicatorRanking items={rankingItemsFoco} title={`Indicadores destacados · ${consultorFoco}`}/>
      )}

      {consultores.length === 0 && (
        <div className="card text-center py-16 text-gray-ui text-sm">
          Sin consultores asignados a los establecimientos de este programa.
        </div>
      )}
    </>
  );
}

// ─── Tarjeta por consultor ────────────────────────────────────────────────

function TarjetaConsultor({ c, enFoco, onToggleFoco }) {
  const deltaPP = Math.round(c.delta * 100);
  const positivo = deltaPP > 0;
  const neutral = deltaPP === 0;
  const DeltaIcon = neutral ? Minus : (positivo ? TrendingUp : TrendingDown);
  const deltaColor = neutral ? 'var(--color-gray-ui)' : (positivo ? 'var(--color-cyan)' : 'var(--color-red)');
  return (
    <div className={`card cursor-pointer transition ${enFoco ? 'ring-2' : ''}`}
         style={enFoco ? { boxShadow: '0 0 0 2px var(--color-teal)' } : {}}
         onClick={onToggleFoco}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">Consultor</p>
          <p className="text-sm font-medium text-gray-dark truncate">{c.email}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-medium text-gray-dark leading-none">
            {c.promedio !== null ? `${Math.round(c.promedio * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-ui uppercase tracking-wider mt-1">logro promedio</p>
        </div>
      </div>

      {/* Delta vs nacional */}
      <div className="flex items-center gap-1.5 mb-4 text-xs" style={{ color: deltaColor }}>
        <DeltaIcon size={12}/>
        <span className="font-medium">{positivo ? '+' : ''}{deltaPP} pp</span>
        <span className="text-gray-ui font-light">vs promedio nacional</span>
      </div>

      {/* Métricas de cobertura */}
      <div className="grid grid-cols-4 gap-2">
        <MiniMetric icon={Building2} value={c.ests.length} label="establ."/>
        <MiniMetric icon={GraduationCap} value={c.nNinos.toLocaleString('es-CL')} label="niños"/>
        <MiniMetric icon={Users} value={c.nAgentes} label="agentes"/>
        <MiniMetric icon={Building2} value={c.comunas} label="comunas"/>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFoco(); }}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--color-teal)' }}
        >
          {enFoco ? '← Cerrar ranking' : 'Ver ranking de indicadores →'}
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, value, label }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon size={12} className="text-gray-ui shrink-0 mt-0.5"/>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-dark leading-none">{value}</p>
        <p className="text-[10px] text-gray-ui font-light mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}
