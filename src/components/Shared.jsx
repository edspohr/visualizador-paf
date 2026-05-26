import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { colorSemaforo, labelSemaforo } from '../data/establecimientos.js';
import { expectedToDate, formatValue } from '../data/expectedValue.js';

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
          <p className="text-xs text-gray-ui font-medium tracking-wider uppercase">{ambito.codigo}</p>
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

export function IndicatorProgress({ indicador, valor, mes, large = false }) {
  const { metaNum, unidad } = indicador;

  // For binary: use 0/1 scale; for others: use raw numeric scale
  const isBinary = unidad === 'binario';
  const scale = isBinary ? 1 : metaNum;
  const rawValue = isBinary ? (valor ? 1 : 0) : valor;
  const expected = expectedToDate(indicador, mes);

  // Clamp positions to [0%, 100%] of bar width
  const filledPct  = Math.min(100, scale > 0 ? (rawValue / scale) * 100 : 0);
  const expectedPct = Math.min(100, scale > 0 ? (expected / scale) * 100 : 0);

  const semaforo = colorSemaforo(scale > 0 ? rawValue / scale : 0);
  const barColor = {
    lime:  'var(--color-cyan)',
    amber: 'var(--color-yellow)',
    red:   'var(--color-red)',
  }[semaforo];

  // Shift "Esperado" label left if tick is near the right edge
  const labelAlign = expectedPct > 80 ? 'right' : expectedPct < 20 ? 'left' : 'center';
  const labelTranslate = { right: '-100%', center: '-50%', left: '0%' }[labelAlign];

  return (
    <div
      className="w-full"
      title="Cumplimiento esperado a la fecha según frecuencia del indicador"
    >
      {/* Bar area with tick */}
      <div className="relative mb-1">
        {/* "Esperado" label above tick */}
        <div
          className="absolute -top-4 text-[10px] text-gray-ui whitespace-nowrap"
          style={{ left: `${expectedPct}%`, transform: `translateX(${labelTranslate})` }}
        >
          Esperado
        </div>

        {/* Track */}
        <div className={`relative w-full ${large ? 'h-4' : 'h-3'} bg-bg rounded-full overflow-visible mt-4`}>
          {/* Filled segment */}
          <div
            className={`absolute left-0 top-0 ${large ? 'h-4' : 'h-3'} rounded-full transition-all`}
            style={{ width: `${filledPct}%`, background: barColor }}
          />
          {/* Expected tick mark — overlaid, not clipped */}
          <div
            className={`absolute top-0 ${large ? 'h-4' : 'h-3'} w-0.5 bg-ink rounded-full`}
            style={{ left: `calc(${expectedPct}% - 1px)` }}
          />
        </div>
      </div>

      {/* Bottom labels */}
      <div className="flex items-baseline justify-between gap-1 mt-2 flex-wrap sm:flex-nowrap">
        <span className="text-sm font-semibold text-gray-dark">
          Actual: {formatValue(indicador, rawValue)}
        </span>
        <span className="text-xs text-gray-ui">
          Esperado: {formatValue(indicador, expected)}
        </span>
        <span className="text-xs text-gray-ui flex items-center gap-0.5">
          <Target size={10} className="shrink-0" />
          {formatValue(indicador, metaNum)}
        </span>
      </div>
    </div>
  );
}
