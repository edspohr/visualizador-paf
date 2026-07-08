import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatValue } from '../data/expectedValue.js';
import { ambitoCodigo } from '../lib/labels.js';

/**
 * Shows the top-3 and bottom-3 indicators by logro ratio.
 *
 * Props:
 *   items  — [{ indicador, valor, ratio }], pre-computed by caller, sin_meta excluded.
 *   title  — optional section eyebrow label
 */
export default function IndicatorRanking({ items, title = 'Vista ejecutiva' }) {
  if (!items.length) return null;

  const sorted = [...items].sort((a, b) => b.ratio - a.ratio);
  const top    = sorted.slice(0, 3);
  const bottom = sorted.slice(-3).reverse(); // lowest first → reverse to show worst at top

  return (
    <div className="card mb-6">
      <p className="text-xs font-medium tracking-wider uppercase text-gray-ui mb-4">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Mayor desarrollo */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: 'var(--color-cyan)' }} className="shrink-0"/>
            <p className="text-xs font-semibold text-gray-dark uppercase tracking-wide">Mayor desarrollo</p>
          </div>
          <ol className="space-y-2">
            {top.map(({ indicador, valor, estado }) => (
              <IndicadorItem key={indicador.id} indicador={indicador} valor={valor} estado={estado} accent="cyan"/>
            ))}
          </ol>
        </div>

        {/* Menor desarrollo */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} style={{ color: 'var(--color-gray-light)' }} className="shrink-0"/>
            <p className="text-xs font-semibold text-gray-dark uppercase tracking-wide">Menor desarrollo</p>
          </div>
          <ol className="space-y-2">
            {bottom.map(({ indicador, valor, estado }) => (
              <IndicadorItem key={indicador.id} indicador={indicador} valor={valor} estado={estado} accent="gray"/>
            ))}
          </ol>
        </div>

      </div>
    </div>
  );
}

function IndicadorItem({ indicador, valor, estado = 'validado', accent }) {
  const dotColor = accent === 'cyan' ? 'var(--color-cyan)' : 'var(--color-gray-light)';
  const isProvisional = estado === 'provisional';
  const provisionalTitle = 'Valor provisional, pendiente de confirmación por Focus';
  const valueCls = isProvisional ? 'font-medium text-gray-ui' : 'font-medium text-gray-dark';
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
        style={{ background: dotColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-gray-dark leading-snug">{indicador.nombre}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-gray-ui mt-0.5">
          <span className="font-mono">{ambitoCodigo(indicador.ambito)}</span>
          <span>
            Valor: <span className={valueCls} title={isProvisional ? provisionalTitle : undefined}>{formatValue(indicador, valor)}</span>
            {indicador.metaNum !== null && (
              <> / meta <span className="font-medium text-gray-dark">{formatValue(indicador, indicador.metaNum)}</span></>
            )}
          </span>
          <span>Actualización: {indicador.frecuencia}</span>
        </div>
      </div>
    </li>
  );
}
