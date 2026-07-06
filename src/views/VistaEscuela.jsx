import { useState } from 'react';
import { useApp, resolverEntidad } from '../lib/context.jsx';
import { AMBITOS_ESCOLAR, AMBITOS_PARVULARIO, INDICADORES_ESCOLAR, INDICADORES_PARVULARIO } from '../data/indicadores.js';
import { ESCUELAS, JARDINES, SLEPS, logroPorAmbito, generarValorIndicador, calcularLogro, MES_ACTUAL } from '../data/establecimientos.js';
import { KpiCard } from '../components/Shared.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import IndicatorDrilldown from '../components/IndicatorDrilldown.jsx';
import IndicatorRanking from '../components/IndicatorRanking.jsx';
import { Target } from 'lucide-react';
import Glosario from '../components/Glosario.jsx';

export default function VistaEscuela() {
  const { perfil } = useApp();
  const [drilldown, setDrilldown] = useState(null);
  const esJardin = perfil.id === 'jardin';
  const AMBITOS = esJardin ? AMBITOS_PARVULARIO : AMBITOS_ESCOLAR;
  const INDS    = esJardin ? INDICADORES_PARVULARIO : INDICADORES_ESCOLAR;

  const entidad = resolverEntidad(perfil.contexto);
  if (!entidad) return <p>Establecimiento no encontrado.</p>;

  const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const periodoLabel = `${NOMBRES_MES[MES_ACTUAL - 1]} ${new Date().getFullYear()}`;

  const slep = SLEPS.find(s => s.id === entidad.slep);
  const logros = logroPorAmbito(INDS, entidad.id, entidad.slep);
  const logroGlobal = Object.values(logros).reduce((a, b) => a + b, 0) / AMBITOS.length;

  // Ranking items: one per indicator, skip sin_meta
  const rankingItems = INDS
    .filter(ind => ind.unidad !== 'sin_meta' && ind.metaNum !== null)
    .map(ind => {
      const { valor } = generarValorIndicador(ind, entidad.id, entidad.slep, MES_ACTUAL);
      const ratio = calcularLogro(valor, ind) ?? 0;
      return { indicador: ind, valor, ratio };
    });

  return (
    <>
      {/* Banner */}
      <div className="text-white rounded-2xl px-5 py-5 mb-6 flex flex-wrap items-end justify-between gap-3" style={{ background: "var(--color-cyan)" }}>
        <div>
          <p className="text-xs text-white/80 tracking-wider font-medium mb-1">
            {entidad.tipo.toUpperCase()} · COHORTE {entidad.cohorte}
          </p>
          <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">{entidad.nombre}</h2>
          <p className="text-white/80 mt-1 text-sm">{slep?.nombre.replace('SLEP ', '')} · Programa Aprender en Familia</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">PERÍODO</p>
            <p className="font-medium mt-1">{periodoLabel}</p>
          </div>
          <div className="bg-white/15 backdrop-blur px-3 py-2 rounded-xl">
            <p className="text-xs text-white/70 leading-none">LOGRO GLOBAL</p>
            <p className="font-medium mt-1 text-lg leading-none">{Math.round(logroGlobal * 100)}%</p>
          </div>
        </div>
      </div>

      {/* KPI único: logro global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Logro global"
          value={`${Math.round(logroGlobal * 100)}%`}
          sublabel={`sobre ${INDS.length} indicadores del programa`}
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
          establecimientoId={entidad.id}
          slep={entidad.slep}
          mes={MES_ACTUAL}
          onDrilldown={(ind) => setDrilldown(ind)}
        />
      </div>

      <Glosario />

      {drilldown && (
        <IndicatorDrilldown
          indicador={drilldown}
          establecimientoId={entidad.id}
          slep={entidad.slep}
          effectiveMonth={MES_ACTUAL}
          perfil={perfil.id}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  );
}
