import { useMemo, useState } from 'react';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps, useIndicadores, useAmbitos, useValoresIndicador, useValoresAnio } from '../lib/queries.js';
import { calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { cumplimientoIndicadores, indicadoresAplicables } from '../data/scope.js';
import { KpiCard } from '../components/Shared.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import { Target, Loader2 } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';

// Año actualmente navegable + año inmediato anterior como referencia.
const ANIO_ACTUAL = 2026;
const ANIOS_DISPONIBLES = [2025, 2026];
const LS_KEY_ANIO = 'paf_anio_gestion';

function anioInicial() {
  if (typeof window === 'undefined') return ANIO_ACTUAL;
  const stored = Number(window.localStorage.getItem(LS_KEY_ANIO));
  return ANIOS_DISPONIBLES.includes(stored) ? stored : ANIO_ACTUAL;
}

export default function VistaEscuela() {
  const { perfil } = useApp();
  const [drilldown, setDrilldown] = useState(null);
  const [anioSeleccionado, setAnioSeleccionado] = useState(anioInicial);
  const anioEnCurso = anioSeleccionado === ANIO_ACTUAL;
  const mesEfectivo = anioEnCurso ? MES_ACTUAL : 12;
  const cambiarAnio = (a) => {
    setAnioSeleccionado(a);
    if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY_ANIO, String(a));
  };
  const esJardin = perfil.id === 'jardin';
  const programa = esJardin ? 'parvulario' : 'escolar';

  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();
  const indicadoresQ = useIndicadores(programa);
  const ambitosQ = useAmbitos(programa);

  // Valores del propio centro (uso el hook específico por establecimiento).
  const entidadIdFromCtx = perfil.contexto?.id;
  const valoresQ = useValoresIndicador(entidadIdFromCtx, anioSeleccionado);

  // Valores del año completo para calcular el promedio del territorio (peers)
  // en la vista de detalle e IndicatorDrilldown.
  const valoresAnioQ = useValoresAnio(anioSeleccionado);

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || slepsQ.isLoading ||
                   indicadoresQ.isLoading || ambitosQ.isLoading;

  const AMBITOS = ambitosQ.data ?? [];
  const INDS = indicadoresQ.data ?? [];
  const todosEstablecimientos = [...(escuelasQ.data ?? []), ...(jardinesQ.data ?? [])];
  const sostenedores = slepsQ.data ?? [];

  const entidad = resolverEntidad(perfil.contexto, todosEstablecimientos, sostenedores);

  const valoresReales = useMemo(() => new Map(
    (valoresQ.data ?? [])
      .filter(v => v.valor !== null && v.valor !== undefined)
      .map(v => [v.indicadorId, { valor: v.valor, estado: v.estado ?? 'validado' }])
  ), [valoresQ.data]);

  // Map<estId, Map<indicadorId, valor>> del programa completo (para peers).
  const valoresPorEst = useMemo(() => {
    const m = new Map();
    for (const v of (valoresAnioQ.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, v.valor);
    }
    return m;
  }, [valoresAnioQ.data]);

  // % cumplimiento del centro sobre indicadores aplicables 2026, faltantes=0.
  const cumplimiento = useMemo(() => {
    if (!entidad) return 0;
    const aplicables = indicadoresAplicables(INDS, entidad, mesEfectivo);
    return cumplimientoIndicadores(aplicables, valoresReales);
  }, [entidad, INDS, valoresReales, mesEfectivo]);

  // Ranking: uno por indicador aplicable con dato reportado.
  // Los indicadores sin dato se excluyen para no rankearlos como 0% "menor desarrollo".
  const rankingItems = useMemo(() => {
    if (!entidad) return [];
    return indicadoresAplicables(INDS, entidad, mesEfectivo)
      .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
      .map(ind => {
        const entry = valoresReales.get(ind.id);
        const valor = entry?.valor ?? null;
        if (valor === null || valor === undefined) return null;
        const logro = calcularLogro(valor, ind);
        return {
          indicador: ind,
          valor,
          ratio: logro === null ? 0 : Math.min(1, logro),
          estado: entry?.estado ?? 'validado',
        };
      })
      .filter(Boolean);
  }, [entidad, INDS, valoresReales, mesEfectivo]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-ui text-sm">
        <Loader2 size={16} className="animate-spin mr-2"/> Cargando datos del centro educativo…
      </div>
    );
  }
  if (!entidad) return <p>Centro educativo no encontrado.</p>;

  const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const periodoLabel = anioEnCurso
    ? `${NOMBRES_MES[mesEfectivo - 1]} ${anioSeleccionado}`
    : `Cierre ${anioSeleccionado}`;

  const slep = sostenedores.find(s => s.id === entidad.slep);

  // Promedio del territorio (mismo tipo + mismo SLEP) para el indicador abierto
  // en el drilldown — se calcula desde Firestore, no PRNG.
  let drilldownExtras = {};
  if (drilldown) {
    const pares = todosEstablecimientos.filter(e => e.slep === entidad.slep && e.tipo === entidad.tipo);
    const vals = [];
    const valoresTerritorio = new Map();
    for (const p of pares) {
      const v = valoresPorEst.get(p.id)?.get(drilldown.id);
      if (v !== null && v !== undefined) {
        vals.push(v);
        valoresTerritorio.set(p.id, v);
      }
    }
    const promTerritorio = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    const entry = valoresReales.get(drilldown.id);
    drilldownExtras = {
      valor: entry?.valor ?? null,
      estado: entry?.estado ?? 'validado',
      promedioTerritorio: promTerritorio,
      valoresTerritorio,
    };
  }

  return (
    <>
      {/* Banner */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-cyan)" }}>
        <div>
          <p className="text-xs text-white/80 tracking-wider font-medium mb-1">
            {entidad.tipo.toUpperCase()} · COHORTE {entidad.cohorte}
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">{entidad.nombre}</h2>
          <p className="text-white/80 mt-1 text-sm">{slep?.nombre.replace(/^SLEP\s+/, '')} · Programa Aprender en Familia</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">PERÍODO</p>
            <p className="font-medium mt-1">{periodoLabel}</p>
          </div>
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">% CUMPLIMIENTO</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(cumplimiento * 100)}%</p>
          </div>
        </div>
      </div>

      {/* Selector de año */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-gray-ui font-medium uppercase tracking-wider">Año</label>
        <select
          value={anioSeleccionado}
          onChange={(e) => cambiarAnio(Number(e.target.value))}
          className="px-3 py-1.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 outline-none"
          style={{ '--tw-ring-color': 'var(--color-cyan)' }}
        >
          {ANIOS_DISPONIBLES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* KPI único: % cumplimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label={anioEnCurso ? `% avance ${anioSeleccionado}` : `% cumplimiento ${anioSeleccionado}`}
          value={`${Math.round(cumplimiento * 100)}%`}
          sublabel={`sobre ${indicadoresAplicables(INDS, entidad, mesEfectivo).filter(i => i.unidad !== 'sin_meta' && i.metaNum !== null).length} indicadores aplicables`}
          icon={Target}
        />
      </div>

      {/* Top-3 / Bottom-3 por indicador */}
      <IndicatorRanking items={rankingItems} title="Indicadores destacados"/>

      {/* Detalle por indicador */}
      <div className="card">
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider uppercase">Detalle</p>
          <h3 className="text-lg text-gray-dark">Indicadores del programa</h3>
          <p className="text-sm text-gray-ui mt-1">Haz clic en un ámbito para expandir sus indicadores, y en un indicador para ver el detalle.</p>
        </div>
        <IndicatorPanel
          INDS={INDS}
          AMBITOS={AMBITOS}
          establecimiento={entidad}
          mes={mesEfectivo}
          valoresReales={valoresReales}
          onDrilldown={(ind) => setDrilldown(ind)}
          programa={programa}
          anioEnCurso={anioEnCurso}
        />
      </div>

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown}
          establecimientoId={entidad.id}
          slep={entidad.slep}
          mes={mesEfectivo}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
          todosEstablecimientos={todosEstablecimientos}
          sostenedores={sostenedores}
          anio={anioSeleccionado}
          anioEnCurso={anioEnCurso}
          {...drilldownExtras}
        />
      )}
    </>
  );
}
