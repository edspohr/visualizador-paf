import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Users, Building2, GraduationCap, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from 'lucide-react';
import { calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { cumplimientoIndicadores, indicadoresAplicables, isAplicable2026 } from '../data/scope.js';
import { useEscuelas, useJardines, useIndicadores, useValoresAnio } from '../lib/queries.js';
import { listarConsultores } from '../lib/firebase.js';
import IndicatorRanking from '../components/IndicatorRanking.jsx';

const ANIO_GESTION = 2026;

// Promedio de cumplimiento sobre un conjunto de centros (avg del cumplimiento
// individual sobre indicadores aplicables 2026; faltantes cuentan 0).
function calcularPromedioCumplimiento(establecimientos, indicadores, valoresPorEst, mes) {
  if (!establecimientos.length) return null;
  let suma = 0;
  for (const e of establecimientos) {
    const aplicables = indicadoresAplicables(indicadores, e, mes);
    suma += cumplimientoIndicadores(aplicables, valoresPorEst.get(e.id) ?? new Map());
  }
  return suma / establecimientos.length;
}

function calcularRankingItems(establecimientos, indicadores, valoresPorEst, mes) {
  return indicadores
    .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
    .map(ind => {
      const aplican = establecimientos.filter(e => isAplicable2026(ind, e, mes));
      if (!aplican.length) return null;
      let sumaLogro = 0, sumaVal = 0, nVal = 0;
      for (const e of aplican) {
        const v = valoresPorEst.get(e.id)?.get(ind.id) ?? null;
        const l = calcularLogro(v, ind);
        sumaLogro += l === null ? 0 : Math.min(1, l);
        if (v !== null && v !== undefined) { sumaVal += v; nVal += 1; }
      }
      return {
        indicador: ind,
        valor: nVal ? sumaVal / nVal : 0,
        ratio: sumaLogro / aplican.length,
      };
    })
    .filter(Boolean);
}

export default function DashboardConsultores() {
  const [programa, setPrograma] = useState('escolar');
  const [consultorFoco, setConsultorFoco] = useState(null);
  const [consultores, setConsultores] = useState([]);
  const [cargandoConsultores, setCargandoConsultores] = useState(true);
  const [errorConsultores, setErrorConsultores] = useState('');

  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const indicadoresQ = useIndicadores(programa);
  const valoresQ = useValoresAnio(ANIO_GESTION);
  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || indicadoresQ.isLoading || cargandoConsultores;

  const valoresPorEst = useMemo(() => {
    const m = new Map();
    for (const v of (valoresQ.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, v.valor);
    }
    return m;
  }, [valoresQ.data]);

  useEffect(() => {
    (async () => {
      try {
        const lista = await listarConsultores();
        setConsultores(lista);
      } catch (err) {
        setErrorConsultores(err?.message ?? 'No se pudo cargar la lista de consultores.');
      } finally {
        setCargandoConsultores(false);
      }
    })();
  }, []);

  const establecimientos = (programa === 'escolar' ? escuelasQ.data : jardinesQ.data) ?? [];
  const indicadores = indicadoresQ.data ?? [];

  const promedioNacional = useMemo(
    () => calcularPromedioCumplimiento(establecimientos, indicadores, valoresPorEst, MES_ACTUAL),
    [establecimientos, indicadores, valoresPorEst]
  );

  // Métricas por consultor: agrupa establecimientos por consultorUid según los
  // establecimientoIds que tenga asignados el doc del consultor en Firestore.
  const metricasConsultores = useMemo(() => {
    const idsPorConsultor = new Map(
      consultores.map(u => [
        u.uid,
        new Set(Array.isArray(u.establecimientoIds) ? u.establecimientoIds : []),
      ])
    );
    const arr = consultores.map(u => {
      const ests = establecimientos.filter(e => idsPorConsultor.get(u.uid)?.has(e.id));
      const promedio = calcularPromedioCumplimiento(ests, indicadores, valoresPorEst, MES_ACTUAL);
      const nNinos = ests.reduce((s, e) => s + (e.nNinos ?? 0), 0);
      const nAgentes = ests.reduce((s, e) => s + (e.nAgentes ?? 0), 0);
      const comunas = new Set(ests.map(e => e.comuna)).size;
      return {
        uid: u.uid,
        nombre: u.nombre || u.email,
        email: u.email,
        ests,
        promedio,
        nNinos,
        nAgentes,
        comunas,
        delta: (promedio ?? 0) - (promedioNacional ?? 0),
      };
    });
    arr.sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0));
    return arr;
  }, [consultores, establecimientos, indicadores, valoresPorEst, promedioNacional]);

  const focoConsultor = consultorFoco ? metricasConsultores.find(c => c.uid === consultorFoco) : null;
  const rankingItemsFoco = useMemo(
    () => (focoConsultor?.ests.length ? calcularRankingItems(focoConsultor.ests, indicadores, valoresPorEst, MES_ACTUAL) : []),
    [focoConsultor, indicadores, valoresPorEst]
  );

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando métricas por consultor…
      </div>
    );
  }

  const nEstsAsignados = metricasConsultores.reduce((s, c) => s + c.ests.length, 0);
  const nEstsSinAsignar = establecimientos.length - nEstsAsignados;

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

      {errorConsultores && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0"/>
          <span>{errorConsultores}</span>
        </div>
      )}

      {/* Resumen: promedio nacional + estado de asignación */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">Promedio nacional</p>
            <p className="text-2xl font-medium text-gray-dark leading-none mt-1">
              {promedioNacional !== null ? `${Math.round(promedioNacional * 100)}%` : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">
              {metricasConsultores.length} {metricasConsultores.length === 1 ? 'consultor' : 'consultores'}
            </p>
            <p className="text-sm text-gray-dark font-light mt-1">
              {establecimientos.length} establecimientos · {nEstsAsignados} asignados
              {nEstsSinAsignar > 0 && (
                <span className="text-gray-ui"> · {nEstsSinAsignar} sin asignar</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Estado vacío: sin consultores registrados */}
      {metricasConsultores.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto text-gray-ui mb-3"/>
          <p className="text-sm text-gray-dark font-medium">Todavía no hay usuarios registrados con perfil «Consultor».</p>
          <p className="text-xs text-gray-ui font-light mt-2 max-w-md mx-auto">
            Asigna el perfil «Consultor» a usuarios desde <span className="font-medium">Gestión de usuarios</span> y
            luego asigna sus establecimientos para verlos aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Grid de tarjetas por consultor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {metricasConsultores.map(c => (
              <TarjetaConsultor
                key={c.uid}
                c={c}
                enFoco={consultorFoco === c.uid}
                onToggleFoco={() => setConsultorFoco(prev => prev === c.uid ? null : c.uid)}
              />
            ))}
          </div>

          {focoConsultor && focoConsultor.ests.length > 0 && (
            <IndicatorRanking items={rankingItemsFoco} title={`Indicadores destacados · ${focoConsultor.nombre}`}/>
          )}
          {focoConsultor && focoConsultor.ests.length === 0 && (
            <div className="card text-center py-10 text-sm text-gray-ui">
              {focoConsultor.nombre} todavía no tiene establecimientos asignados en este programa.
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Tarjeta por consultor ────────────────────────────────────────────────

function TarjetaConsultor({ c, enFoco, onToggleFoco }) {
  const deltaPP = Math.round(c.delta * 100);
  const positivo = deltaPP > 0;
  const neutral  = deltaPP === 0 || c.promedio === null;
  const DeltaIcon = neutral ? Minus : (positivo ? TrendingUp : TrendingDown);
  const deltaColor = neutral ? 'var(--color-gray-ui)' : (positivo ? 'var(--color-cyan)' : 'var(--color-red)');
  const sinAsignar = c.ests.length === 0;
  return (
    <div className={`card cursor-pointer transition ${enFoco ? 'ring-2' : ''}`}
         style={enFoco ? { boxShadow: '0 0 0 2px var(--color-teal)' } : {}}
         onClick={onToggleFoco}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-ui font-medium uppercase tracking-wider">Consultor</p>
          <p className="text-sm font-medium text-gray-dark truncate">{c.nombre}</p>
          {c.email && c.email !== c.nombre && (
            <p className="text-xs text-gray-ui font-light truncate">{c.email}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-medium text-gray-dark leading-none">
            {c.promedio !== null ? `${Math.round(c.promedio * 100)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-ui uppercase tracking-wider mt-1">logro promedio</p>
        </div>
      </div>

      {!sinAsignar ? (
        <div className="flex items-center gap-1.5 mb-4 text-xs" style={{ color: deltaColor }}>
          <DeltaIcon size={12}/>
          <span className="font-medium">{positivo ? '+' : ''}{deltaPP} pp</span>
          <span className="text-gray-ui font-light">vs promedio nacional</span>
        </div>
      ) : (
        <div className="mb-4 text-xs text-gray-ui font-light">
          Sin establecimientos asignados a este consultor.
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <MiniMetric icon={Building2} value={c.ests.length} label="establ."/>
        <MiniMetric icon={GraduationCap} value={c.nNinos.toLocaleString('es-CL')} label="niños"/>
        <MiniMetric icon={Users} value={c.nAgentes} label="agentes"/>
        <MiniMetric icon={Building2} value={c.comunas} label="comunas"/>
      </div>

      {!sinAsignar && (
        <div className="mt-4 pt-3 border-t border-border">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFoco(); }}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--color-teal)' }}
          >
            {enFoco ? '← Cerrar ranking' : 'Ver ranking de indicadores →'}
          </button>
        </div>
      )}
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
