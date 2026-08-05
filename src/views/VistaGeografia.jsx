import 'leaflet/dist/leaflet.css';
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { useEscuelas, useJardines, useSleps, useValoresAnio } from '../lib/queries.js';
import { useAmbitos, useIndicadores } from '../lib/queries.js';
import { colorSemaforo } from '../data/establecimientos.js';
import { cumplimientoIndicadores, isAplicable2026, indicadoresAplicables } from '../data/scope.js';
import { currentMonth } from '../data/establecimientos.js';
import GEO from '../data/geoEstablecimientos.json';

const SANTIAGO_CENTER = [-33.51, -70.68];
const ANIO = 2026;
const MES = currentMonth();

const geoById = new Map(GEO.features.map(f => [f.id, f]));

function semaforoToColor(semaforo) {
  switch (semaforo) {
    case 'verde':    return 'var(--color-lime)';
    case 'amarillo': return 'var(--color-yellow)';
    case 'rojo':     return 'var(--color-red)';
    default:         return 'var(--color-gray-ui)';
  }
}

function cssVarToHex(cssVar) {
  // Map design tokens to hex for Leaflet (which doesn't understand CSS vars)
  switch (cssVar) {
    case 'var(--color-lime)':     return '#65a30d';
    case 'var(--color-yellow)':   return '#ffdc00';
    case 'var(--color-red)':      return '#e53517';
    case 'var(--color-gray-ui)':  return '#a0a5a9';
    default:                      return '#a0a5a9';
  }
}

function markerRadius(nNinos) {
  if (!nNinos) return 8;
  return Math.max(6, Math.min(22, Math.sqrt(nNinos) * 1.4));
}

export default function VistaGeografia() {
  const escuelasQ  = useEscuelas();
  const jardinesQ  = useJardines();
  const slepsQ     = useSleps();
  const valoresQ   = useValoresAnio(ANIO);

  const [programa, setPrograma] = useState('escolar');
  const [filtroSlep, setFiltroSlep] = useState('TODOS');

  const indEscolarQ  = useIndicadores('escolar');
  const indParvQ     = useIndicadores('parvulario');
  const INDS = programa === 'escolar' ? (indEscolarQ.data ?? []) : (indParvQ.data ?? []);

  const escuelas  = escuelasQ.data ?? [];
  const jardines  = jardinesQ.data ?? [];
  const sleps     = slepsQ.data ?? [];
  const todos     = programa === 'escolar' ? escuelas : jardines;

  const slepsDisponibles = useMemo(
    () => [...new Set(todos.map(e => e.slep).filter(Boolean))].map(id => sleps.find(s => s.id === id)).filter(Boolean),
    [todos, sleps]
  );

  const filtrados = useMemo(
    () => todos.filter(e => filtroSlep === 'TODOS' || e.slep === filtroSlep),
    [todos, filtroSlep]
  );

  const valoresPorEst = useMemo(() => {
    const m = new Map();
    for (const v of (valoresQ.data ?? [])) {
      if (v.valor === null || v.valor === undefined) continue;
      if (!m.has(v.establecimientoId)) m.set(v.establecimientoId, new Map());
      m.get(v.establecimientoId).set(v.indicadorId, { valor: v.valor });
    }
    return m;
  }, [valoresQ.data]);

  const markers = useMemo(() =>
    filtrados
      .map(e => {
        const geo = geoById.get(e.id);
        if (!geo) return null;
        const vals = valoresPorEst.get(e.id) ?? new Map();
        const aplic = indicadoresAplicables(INDS, e, MES);
        const cumpl = cumplimientoIndicadores(aplic, vals);
        const colorToken = semaforoToColor(colorSemaforo(cumpl));
        const color = cssVarToHex(colorToken);
        return { e, geo, cumpl, color };
      })
      .filter(Boolean),
    [filtrados, valoresPorEst, INDS]
  );

  const cargando = escuelasQ.isLoading || jardinesQ.isLoading || valoresQ.isLoading;

  return (
    <div className="card p-0 overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: 480 }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-white">
        <p className="text-sm font-medium text-gray-dark mr-2">Mapa de impacto territorial</p>

        {/* Program toggle */}
        <div className="inline-flex rounded-lg border border-border overflow-hidden bg-white">
          {['escolar', 'parvulario'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setPrograma(p); setFiltroSlep('TODOS'); }}
              className={`px-3 py-1.5 text-xs font-medium transition ${programa === p ? 'text-white' : 'text-gray-dark hover:bg-bg'}`}
              style={programa === p ? { background: 'var(--color-cyan)' } : undefined}
            >
              {p === 'escolar' ? 'Escolar' : 'Parvulario'}
            </button>
          ))}
        </div>

        {/* SLEP filter */}
        <select
          value={filtroSlep}
          onChange={e => setFiltroSlep(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark outline-none"
        >
          <option value="TODOS">Todos los sostenedores</option>
          {slepsDisponibles.map(s => (
            <option key={s.id} value={s.id}>{s.nombre.replace(/^SLEP\s+/, '')}</option>
          ))}
        </select>

        <span className="text-xs text-gray-ui ml-auto">{markers.length} centros · {ANIO}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-bg/60 border-b border-border text-xs text-gray-ui">
        <span className="font-medium">Cumplimiento:</span>
        {[
          { label: '≥ 80%', color: '#65a30d' },
          { label: '50–79%', color: '#ffdc00' },
          { label: '< 50%', color: '#e53517' },
          { label: 'Sin datos', color: '#a0a5a9' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border border-white/60" style={{ background: color }}/>
            {label}
          </span>
        ))}
        <span className="ml-4 text-gray-ui/70">Tamaño: matrícula aproximada</span>
      </div>

      {/* Map */}
      {cargando ? (
        <div className="flex items-center justify-center h-full text-gray-ui text-sm">Cargando datos…</div>
      ) : (
        <MapContainer
          center={SANTIAGO_CENTER}
          zoom={11}
          style={{ height: 'calc(100% - 94px)', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {markers.map(({ e, geo, cumpl, color }) => (
            <CircleMarker
              key={e.id}
              center={[geo.lat, geo.lng]}
              radius={markerRadius(e.nNinos)}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.85,
                color: '#ffffff',
                weight: 1.5,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{e.nombre}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                    {sleps.find(s => s.id === e.slep)?.nombre?.replace(/^SLEP\s+/, '') ?? e.slep} · {e.comuna}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                    Cohorte {e.cohorte}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>
                    Cumplimiento: {cumpl !== null ? `${Math.round(cumpl * 100)}%` : 'Sin datos'}
                  </p>
                  {e.nNinos && (
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      Matrícula aprox.: {e.nNinos} niños
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: '#a0a5a9', marginTop: 4 }}>
                    Posición: centroide de {e.comuna}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
