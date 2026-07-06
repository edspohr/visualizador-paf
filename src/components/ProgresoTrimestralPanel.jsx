import { CalendarClock, TrendingUp, Info } from 'lucide-react';

const TRIMESTRE_LABELS = {
  1: 'T1 · Mar-May',
  2: 'T2 · Jun-Ago',
  3: 'T3 · Sep-Oct',
  4: 'T4 · Nov-Ene',
};

/**
 * Muestra los % de progreso por (ámbito × trimestre) para un establecimiento en un año.
 * Fuente: colección /progresoTrimestral en Firestore (poblada por sync desde Planillas Centrales).
 *
 * Props:
 *   progresos       — array de docs { ambitoId, ambitoNombre, trimestre, progreso, anio }
 *   ambitos         — catálogo de ámbitos del programa (para nombres canónicos)
 *   anio            — año que se está mostrando
 *   perfilCap       — boolean; si true, solo muestra trimestres cerrados
 *   trimestreActual — 1-4; el trimestre en curso (usado por CAP para filtrar)
 */
export default function ProgresoTrimestralPanel({ progresos = [], ambitos = [], anio, perfilCap = false, trimestreActual = 4 }) {
  if (!progresos.length) {
    return (
      <div className="card">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgb(220,240,240)' }}>
            <CalendarClock size={16} style={{ color: 'var(--color-teal)' }}/>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-dark">Progreso por ámbito · {anio}</h3>
            <p className="text-sm text-gray-ui font-light">Todavía no hay datos de progreso trimestral cargados para este establecimiento.</p>
          </div>
        </div>
        <p className="text-xs text-gray-ui font-light mt-4">
          Los progresos por ámbito se cargan desde las Planillas Centrales de Focus.
        </p>
      </div>
    );
  }

  // Agrupar por ámbitoId (o por nombre si el matching automático falló)
  const grupos = agruparPorAmbito(progresos, ambitos);
  const totalPorGrupo = grupos.map(g => ({
    ...g,
    promedio: promedioProgreso(g.valores, perfilCap ? trimestreActual - 1 : 4),
  }));

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgb(220,240,240)' }}>
            <CalendarClock size={16} style={{ color: 'var(--color-teal)' }}/>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-dark">Progreso por ámbito · {anio}</h3>
            <p className="text-sm text-gray-ui font-light">
              % de cumplimiento por trimestre. Fuente: Planillas Centrales de Focus.
            </p>
          </div>
        </div>
        {perfilCap && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-magenta)' }}>
            <Info size={12}/>
            <span>Solo trimestres cerrados</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
              <th className="py-2.5 pr-3 font-medium">Ámbito</th>
              {[1, 2, 3, 4].map(t => (
                <th key={t} className={`py-2.5 px-2 font-medium text-center ${perfilCap && t > trimestreActual - 1 ? 'text-gray-ui/50' : ''}`}>
                  {TRIMESTRE_LABELS[t]}
                </th>
              ))}
              <th className="py-2.5 pl-3 font-medium text-right">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {totalPorGrupo.map(g => (
              <tr key={g.key} className="border-b border-border last:border-0 hover:bg-bg transition">
                <td className="py-3 pr-3">
                  <p className="text-sm font-medium text-gray-dark">{g.nombre}</p>
                  {g.codigo && <p className="text-[10px] text-gray-ui font-mono mt-0.5">{g.codigo}</p>}
                </td>
                {[1, 2, 3, 4].map(t => {
                  const v = g.valores[t];
                  const oculto = perfilCap && t > trimestreActual - 1;
                  return (
                    <td key={t} className="py-3 px-2 text-center">
                      {oculto ? (
                        <span className="text-xs text-gray-ui/50">—</span>
                      ) : v === undefined ? (
                        <span className="text-xs text-gray-ui/60">·</span>
                      ) : (
                        <ProgresoBadge valor={v}/>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-3 text-right">
                  {g.promedio !== null ? (
                    <span className="text-sm font-medium text-gray-dark">{Math.round(g.promedio * 100)}%</span>
                  ) : (
                    <span className="text-xs text-gray-ui">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgresoBadge({ valor }) {
  const pct = Math.round(valor * 100);
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
      <div className="w-14 h-1.5 bg-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: pct === 0 ? 'var(--color-gray-light)' : 'var(--color-teal)',
          }}
        />
      </div>
      <span className="text-gray-dark w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function agruparPorAmbito(progresos, ambitos) {
  const map = new Map();
  for (const p of progresos) {
    const key = p.ambitoId ?? p.ambitoNombre ?? '__sin_ambito__';
    if (!map.has(key)) {
      const ambitoCatalogo = ambitos.find(a => a.id === p.ambitoId);
      map.set(key, {
        key,
        nombre: ambitoCatalogo?.nombre ?? p.ambitoNombre ?? 'Ámbito sin identificar',
        codigo: ambitoCatalogo?.codigo,
        valores: {},
      });
    }
    map.get(key).valores[p.trimestre] = p.progreso;
  }
  return [...map.values()];
}

function promedioProgreso(valoresPorTrimestre, hastaTrimestre) {
  const vals = [];
  for (let t = 1; t <= hastaTrimestre; t++) {
    if (valoresPorTrimestre[t] !== undefined) vals.push(valoresPorTrimestre[t]);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
