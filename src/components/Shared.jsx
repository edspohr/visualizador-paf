import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { colorSemaforo, labelSemaforo } from '../data/establecimientos.js';

// Color por estado
const COLOR_STYLE = {
  lime:  { bg: 'bg-lime-50',  text: 'text-lime-600',  ring: 'ring-lime-200',  bar: 'bg-lime' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', bar: 'bg-amber-400' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200',   bar: 'bg-red-400' },
};

export function SemaforoBadge({ logro }) {
  const c = colorSemaforo(logro);
  const s = COLOR_STYLE[c];
  return (
    <span className={`tag ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.bar}`}></span>
      {labelSemaforo(logro)}
    </span>
  );
}

// Card grande con semáforo de ámbito
export function AmbitoCard({ ambito, logro, deltaPromedio = null, evolucion = null }) {
  const c = colorSemaforo(logro);
  const s = COLOR_STYLE[c];
  const pct = Math.round(logro * 100);

  return (
    <div className="card-tight">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted font-semibold tracking-wider">{ambito.codigo}</p>
          <h4 className="text-sm leading-tight mt-0.5 text-navy">{ambito.nombre}</h4>
        </div>
        <div className={`w-9 h-9 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
          <span className={`w-3 h-3 rounded-full ${s.bar} shrink-0`}></span>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${s.text}`}>{pct}%</span>
        <span className="text-xs text-muted">logro</span>
      </div>

      <SemaforoBadge logro={logro} />

      {deltaPromedio !== null && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted">vs promedio SLEP</span>
          <span className={`font-semibold flex items-center gap-1 ${deltaPromedio > 0 ? 'text-lime-600' : deltaPromedio < 0 ? 'text-red-600' : 'text-muted'}`}>
            {deltaPromedio > 0 ? <TrendingUp size={14}/> : deltaPromedio < 0 ? <TrendingDown size={14}/> : <Minus size={14}/>}
            {deltaPromedio > 0 ? '+' : ''}{Math.round(deltaPromedio * 100)} pp
          </span>
        </div>
      )}
    </div>
  );
}

// KPI numérico simple
export function KpiCard({ label, value, sublabel, icon: Icon = Target, color = 'navy' }) {
  const colorMap = {
    navy: 'bg-navy-50 text-navy',
    sky:  'bg-sky-50 text-sky-600',
    lime: 'bg-lime-50 text-lime-600',
  };
  return (
    <div className="card-tight">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted font-semibold tracking-wider uppercase">{label}</p>
          <p className="text-2xl font-bold text-navy mt-1">{value}</p>
          {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg ${colorMap[color]} flex items-center justify-center shrink-0`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

// Barra de progreso para un indicador
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

// Mini sparkline para evolución mensual (sin recharts, simple SVG)
export function Sparkline({ data, color = '#5B9BD5' }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.logro), 100);
  const min = 0;
  const w = 100, h = 30;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.logro - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Tag tipo de indicador (operativo/táctico)
export function TipoBadge({ tipo }) {
  if (tipo === 'operativo') {
    return <span className="tag tag-sky">Operativo</span>;
  }
  return <span className="tag tag-navy">Táctico</span>;
}

// PageHeader reutilizable
export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && <p className="text-xs text-sky-600 font-semibold tracking-wider mb-1 uppercase">{eyebrow}</p>}
        <h1 className="text-2xl md:text-3xl text-navy">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
