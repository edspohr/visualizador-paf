import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { colorSemaforo, labelSemaforo } from '../data/establecimientos.js';

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

export function AmbitoCard({ ambito, logro, deltaPromedio = null }) {
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
          <span className="text-gray-ui font-light">vs promedio SLEP</span>
          <span
            className="font-medium flex items-center gap-1"
            style={{ color: deltaPromedio > 0 ? 'var(--color-cyan)' : deltaPromedio < 0 ? 'var(--color-red)' : 'var(--color-gray-light)' }}
          >
            {deltaPromedio > 0 ? <TrendingUp size={14}/> : deltaPromedio < 0 ? <TrendingDown size={14}/> : <Minus size={14}/>}
            {deltaPromedio > 0 ? '+' : ''}{Math.round(deltaPromedio * 100)} pp
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
