import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { colorSemaforo, labelSemaforo } from '../data/establecimientos.js';
import { formatValue } from '../data/expectedValue.js';
import { ambitoCodigo } from '../lib/labels.js';

// CAP brand semaforo mapping
// verde → cyan, amber → yellow, red → crimson
const COLOR_STYLE = {
  lime:  {
    bg:   'bg-cyan-50',
    text: 'text-cyan-400',
    ring: 'ring-cyan-200',
    bar:  'bg-cyan',
    dot:  'bg-cyan',
  },
  amber: {
    bg:   'bg-yellow-50',
    text: 'text-yellow-400',
    ring: 'ring-yellow-200',
    bar:  'bg-yellow',
    dot:  'bg-yellow',
  },
  red: {
    bg:   'bg-red-50',
    text: 'text-crimson',
    ring: 'ring-red-200',
    bar:  'bg-crimson',
    dot:  'bg-crimson',
  },
};

export function SemaforoBadge({ logro }) {
  const c = colorSemaforo(logro);
  const s = COLOR_STYLE[c];
  return (
    <span className={`tag ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`}></span>
      {labelSemaforo(logro)}
    </span>
  );
}

export function AmbitoCard({ ambito, logro, deltaPromedio = null, yoy = null }) {
  const c = colorSemaforo(logro);
  const s = COLOR_STYLE[c];
  const pct = Math.round(logro * 100);

  return (
    <div className="card-tight">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-ui font-medium tracking-wider uppercase">{ambitoCodigo(ambito)}</p>
          <h4 className="text-sm leading-tight mt-0.5">{ambito.nombre}</h4>
        </div>
        <div className={`w-9 h-9 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
          <span className={`w-3 h-3 rounded-full ${s.dot} shrink-0`}></span>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-medium ${s.text}`}>{pct}%</span>
        <span className="text-xs text-gray-ui font-light">logro</span>
      </div>

      <SemaforoBadge logro={logro} />

      {deltaPromedio !== null && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-gray-ui font-light">vs promedio sostenedor</span>
          <span
            className="font-medium flex items-center gap-1"
            style={{ color: deltaPromedio > 0 ? 'var(--color-cyan)' : deltaPromedio < 0 ? 'var(--color-red)' : 'var(--color-gray-light)' }}
          >
            {deltaPromedio > 0 ? <TrendingUp size={14}/> : deltaPromedio < 0 ? <TrendingDown size={14}/> : <Minus size={14}/>}
            {deltaPromedio > 0 ? '+' : ''}{Math.round(deltaPromedio * 100)} pp
          </span>
        </div>
      )}

      {yoy !== null && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-gray-ui font-light">2025: {Math.round(yoy.logro2025 * 100)}%</span>
          <span
            className="font-medium flex items-center gap-1"
            style={{ color: yoy.delta >= 0 ? 'var(--color-cyan)' : 'var(--color-red)' }}
          >
            {yoy.delta >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
            {yoy.delta >= 0 ? '+' : ''}{yoy.delta} pp
          </span>
        </div>
      )}
    </div>
  );
}

export function KpiCard({ label, value, sublabel, icon: Icon = Target, color = 'cyan' }) {
  const colorMap = {
    cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-400'   },
    magenta: { bg: 'bg-magenta-50', icon: 'text-magenta'    },
    yellow:  { bg: 'bg-yellow-50',  icon: 'text-yellow-400' },
    // legacy aliases
    navy: { bg: 'bg-cyan-50',    icon: 'text-cyan-400' },
    sky:  { bg: 'bg-cyan-50',    icon: 'text-cyan-400' },
    lime: { bg: 'bg-yellow-50',  icon: 'text-yellow-400' },
  };
  const cm = colorMap[color] ?? colorMap.cyan;
  return (
    <div className="card-tight">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-ui font-medium tracking-wider uppercase">{label}</p>
          <p className="text-2xl font-medium mt-1" style={{ color: 'var(--color-gray-dark)' }}>{value}</p>
          {sublabel && <p className="text-xs text-gray-ui font-light mt-1">{sublabel}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl ${cm.bg} ${cm.icon} flex items-center justify-center shrink-0`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ logro, height = 'h-2' }) {
  const c = colorSemaforo(logro);
  const s = COLOR_STYLE[c];
  const pct = Math.min(100, Math.round(logro * 100));
  return (
    <div className={`w-full bg-bg rounded-full ${height} overflow-hidden`}>
      <div className={`${s.bar} ${height} rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
    </div>
  );
}

export function Sparkline({ data, color = 'rgb(0,138,201)' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.logro), 100);
  const w = 100, h = 30;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.logro / max)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function TipoBadge({ tipo }) {
  if (tipo === 'operativo') return <span className="tag tag-cyan">Operativo</span>;
  return <span className="tag tag-magenta">Táctico</span>;
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium tracking-wider mb-1 uppercase" style={{ color: 'var(--color-cyan)' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="text-gray-ui font-light mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Two-bar comparison: este establecimiento vs promedio del territorio.
// No semáforo colors, no judgment labels, no "Esperado" tick.
// `estado`: 'validado' | 'provisional' — when provisional, own-value is muted
// (rendered in gray-ui) and gets a tooltip. Peer value is territory average
// (mixed estados) so it stays validado-styled.
export function IndicatorProgress({ indicador, valor, promedioTerritorio = null, large = false, estado = 'validado' }) {
  const { metaNum, unidad } = indicador;
  const isProvisional = estado === 'provisional';
  const provisionalTitle = 'Valor provisional, pendiente de confirmación por Focus';
  const ownValueCls = isProvisional ? 'font-medium text-gray-ui' : 'font-medium text-gray-dark';

  // sin_meta: show a plain text notice with the raw value only
  if (unidad === 'sin_meta' || metaNum === null || valor === null) {
    return (
      <div className="w-full text-xs text-gray-ui italic py-1">
        Sin meta definida
        {valor !== null && (
          <span
            className={`not-italic ml-2 ${ownValueCls}`}
            title={isProvisional ? provisionalTitle : undefined}
          >
            {formatValue(indicador, valor)}
          </span>
        )}
      </div>
    );
  }

  const isBinary = unidad === 'binario';
  // Scale: for binary 0→1; for others use metaNum (cap at 120% so overachievement is visible)
  const scale = isBinary ? 1 : metaNum;
  // For binary: single-centro views arrive as 0/1 (Sí/No). Aggregate views (sostenedor,
  // consultor) arrive as a fractional mean, which is the % de "Sí" across the peer set.
  // Preserve fractional binary values instead of rounding, so the bar renders as %.
  const rawValue = isBinary && (valor === 0 || valor === 1)
    ? (valor ? 1 : 0)
    : (isBinary ? valor : valor);
  const peerValue = promedioTerritorio !== null
    ? promedioTerritorio  // for binary, this is the % de Sí (fractional 0..1) — keep as-is
    : null;

  // For binary + fractional values (aggregate), format as % de "Sí"
  const fmtBinary = (v) => `${Math.round(v * 100)}% Sí`;
  const fmtValue = (v) => (isBinary && v !== null && v !== 0 && v !== 1)
    ? fmtBinary(v)
    : formatValue(indicador, v);
  const fmtPeer = (v) => (isBinary && v !== null) ? fmtBinary(v) : formatValue(indicador, v);

  const barH = large ? 'h-3.5' : 'h-2.5';
  const trackCls = `w-full ${barH} rounded-full overflow-hidden`;

  const pct = (v) => `${Math.min(100, scale > 0 ? (v / scale) * 100 : 0)}%`;

  // Territorio label — singular/plural handled by tipo stored on est, but here we use
  // a generic phrase; callers that know tipo can override via a labelTerritorio prop
  const peerLabel = 'Promedio del territorio';

  return (
    <div className="w-full space-y-2">
      {/* Bar 1: este centro educativo */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-ui">Este centro educativo</span>
          <span className={ownValueCls} title={isProvisional ? provisionalTitle : undefined}>
            {fmtValue(rawValue)}
          </span>
        </div>
        <div className={`${trackCls} bg-bg`}>
          <div className={barH + ' rounded-full'} style={{ width: pct(rawValue), background: 'var(--color-cyan)' }}/>
        </div>
      </div>

      {/* Bar 2: promedio del territorio */}
      {peerValue !== null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-ui">{peerLabel}</span>
            <span className="font-medium text-gray-dark">{fmtPeer(peerValue)}</span>
          </div>
          <div className={`${trackCls} bg-bg`}>
            <div className={barH + ' rounded-full'} style={{ width: pct(peerValue), background: 'var(--color-gray-light)' }}/>
          </div>
        </div>
      )}

      {/* Footer: meta + frequency, no judgment */}
      <div className="flex items-center gap-4 text-xs text-gray-ui pt-0.5">
        <span className="flex items-center gap-1">
          <Target size={10} className="shrink-0"/>
          Meta anual: <span className="font-medium text-gray-dark ml-0.5">{formatValue(indicador, metaNum)}</span>
        </span>
        <span>Actualización: <span className="font-medium text-gray-dark">{indicador.frecuencia}</span></span>
      </div>
    </div>
  );
}
