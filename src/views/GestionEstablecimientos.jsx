import { useMemo, useState } from 'react';
import { Building2, Plus, Search, X, Loader2, AlertCircle, Pencil, Trash2, Landmark, CheckCircle2, Link2 } from 'lucide-react';
import { useRegistro } from '../lib/queries.js';
import { COHORTES, datosFaltantes, esperaFuente } from '../lib/registro.js';
import {
  guardarSostenedor, eliminarSostenedor,
  guardarEstablecimiento, unirEstablecimientos, eliminarEstablecimiento,
} from '../lib/firebase.js';

// Registro de establecimientos y sostenedores (superadmin). Lo que se edita
// aquí prevalece sobre las planillas: la carga nocturna deja de sobrescribir
// los campos modificados y avisa por correo si la planilla dice otra cosa.

const PROGRAMA_LABEL = { escolar: 'Educación Básica', parvulario: 'Educación Parvularia' };
const DIAS_NUEVO = 14;

const fechaDe = (t) => (t?.toDate ? t.toDate() : t ? new Date(t) : null);
const esReciente = (est) => {
  const f = fechaDe(est.detectadoAt);
  return !!f && (Date.now() - f.getTime()) < DIAS_NUEVO * 24 * 3600 * 1000;
};

export default function GestionEstablecimientos() {
  const registro = useRegistro();
  const [programa, setPrograma] = useState('escolar');
  const [q, setQ] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [editando, setEditando] = useState(null);       // establecimiento | { nuevo: true }
  const [sostenedorEdit, setSostenedorEdit] = useState(null); // sostenedor | { nuevo: true }
  const [error, setError] = useState('');

  const establecimientos = registro.data?.establecimientos ?? [];
  const sostenedores = useMemo(
    () => [...(registro.data?.sostenedores ?? [])].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es')),
    [registro.data],
  );
  const nombreSlep = (id) => sostenedores.find(s => s.id === id)?.nombre ?? id;

  const conEstado = useMemo(() => establecimientos.map(e => ({
    ...e,
    faltan: datosFaltantes(e),
    sinFuente: esperaFuente(e),
    reciente: esReciente(e),
  })), [establecimientos]);

  const resumen = useMemo(() => ({
    pendientes: conEstado.filter(e => e.faltan.length && !e.sinFuente).length,
    sinFuente: conEstado.filter(e => e.sinFuente).length,
    recientes: conEstado.filter(e => e.reciente).length,
  }), [conEstado]);

  const filtrados = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return conEstado
      .filter(e => e.programa === programa)
      .filter(e => !needle || (e.nombre ?? '').toLowerCase().includes(needle) || (e.comuna ?? '').toLowerCase().includes(needle))
      .filter(e => !soloPendientes || e.faltan.length || e.sinFuente)
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [conEstado, programa, q, soloPendientes]);

  const comunas = useMemo(
    () => [...new Set(establecimientos.map(e => e.comuna).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [establecimientos],
  );

  const borrarSostenedor = async (s) => {
    if (!confirm(`¿Eliminar el sostenedor "${s.nombre}"?`)) return;
    setError('');
    try { await eliminarSostenedor(s.id); registro.recargar(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgb(220,240,240)' }}>
            <Building2 size={20} style={{ color: 'var(--color-teal)' }} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-gray-dark">Establecimientos y sostenedores</h2>
            <p className="text-sm text-gray-ui font-light">Registro de sostenedores, escuelas y jardines. Lo que edites aquí prevalece sobre las planillas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSostenedorEdit({ nuevo: true })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-gray-dark border border-border hover:bg-bg transition"
          >
            <Plus size={16}/> Nuevo sostenedor
          </button>
          <button
            onClick={() => setEditando({ nuevo: true, programa })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition"
            style={{ background: 'var(--color-teal)' }}
          >
            <Plus size={16}/> Nuevo establecimiento
          </button>
        </div>
      </div>

      {(error || registro.error) && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0"/>
          <span>{error || 'No se pudo cargar el registro.'}</span>
        </div>
      )}

      {registro.isLoading ? (
        <div className="card flex items-center justify-center py-16 text-gray-ui text-sm">
          <Loader2 size={16} className="animate-spin mr-2"/> Cargando registro…
        </div>
      ) : (
        <>
          {/* Resumen de pendientes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Resumen valor={resumen.recientes} texto={`detectados en los últimos ${DIAS_NUEVO} días`} />
            <Resumen valor={resumen.pendientes} texto="con datos por completar" />
            <Resumen valor={resumen.sinFuente} texto="creados aquí, aún sin planilla" />
          </div>

          {/* Sostenedores */}
          <div className="card mb-4">
            <h3 className="text-sm font-medium text-gray-dark mb-3 flex items-center gap-2"><Landmark size={14} className="text-gray-ui"/> Sostenedores</h3>
            {sostenedores.length === 0 ? (
              <p className="text-sm text-gray-ui font-light">Todavía no hay sostenedores registrados.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sostenedores.map(s => {
                  const propios = establecimientos.filter(e => e.slep === s.id);
                  const nEsc = propios.filter(e => e.programa === 'escolar').length;
                  const nJar = propios.filter(e => e.programa === 'parvulario').length;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-dark truncate">{s.nombre}</p>
                        <p className="text-xs text-gray-ui font-light">
                          {propios.length === 0 ? 'Sin establecimientos todavía' : `${nEsc} escuela${nEsc === 1 ? '' : 's'} · ${nJar} jardín${nJar === 1 ? '' : 'es'}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setSostenedorEdit(s)} title="Cambiar nombre" aria-label={`Cambiar nombre de ${s.nombre}`} className="p-1.5 rounded-lg hover:bg-bg transition">
                          <Pencil size={14} className="text-gray-ui"/>
                        </button>
                        {propios.length === 0 && (
                          <button onClick={() => borrarSostenedor(s)} title="Eliminar" aria-label={`Eliminar ${s.nombre}`} className="p-1.5 rounded-lg hover:bg-bg transition">
                            <Trash2 size={14} style={{ color: 'var(--color-red)' }}/>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Establecimientos */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-bg">
                {Object.entries(PROGRAMA_LABEL).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPrograma(id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${programa === id ? 'text-white' : 'text-gray-ui hover:text-gray-dark'}`}
                    style={programa === id ? { background: 'var(--color-cyan)' } : {}}
                  >
                    {label} ({establecimientos.filter(e => e.programa === id).length})
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-ui pointer-events-none"/>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre o comuna…"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none transition"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-dark cursor-pointer">
                <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="accent-cyan"/>
                Solo con pendientes
              </label>
            </div>

            <div className="overflow-x-auto">
              {filtrados.length === 0 ? (
                <p className="text-center text-sm text-gray-ui py-12">No hay establecimientos con esos filtros.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                      <th className="py-3 pr-3 font-medium">Establecimiento</th>
                      <th className="py-3 px-3 font-medium">Sostenedor</th>
                      <th className="py-3 px-3 font-medium">Comuna</th>
                      <th className="py-3 px-3 font-medium">Cohorte</th>
                      <th className="py-3 px-3 font-medium text-right">Matrícula</th>
                      {programa === 'escolar' && <th className="py-3 px-3 font-medium">RBD</th>}
                      <th className="py-3 px-3 font-medium">Estado</th>
                      <th className="py-3 pl-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(e => (
                      <tr key={e.id} className="border-b border-border last:border-0 hover:bg-bg transition">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-gray-dark">{e.nombre}</p>
                          {e.reciente && <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-magenta)' }}>Nuevo</span>}
                        </td>
                        <td className="py-3 px-3 text-gray-dark">{e.slep ? nombreSlep(e.slep).replace(/^SLEP\s+/, '') : <Vacio/>}</td>
                        <td className="py-3 px-3 text-gray-dark">{e.comuna || <Vacio/>}</td>
                        <td className="py-3 px-3 text-gray-dark">{e.cohorte || <Vacio/>}</td>
                        <td className="py-3 px-3 text-right text-gray-dark tabular-nums">{e.nNinos ?? <Vacio/>}</td>
                        {programa === 'escolar' && <td className="py-3 px-3 text-gray-dark">{e.rbd || <Vacio/>}</td>}
                        <td className="py-3 px-3"><Estado est={e}/></td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            onClick={() => setEditando(e)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-white transition text-gray-dark"
                          >
                            <Pencil size={12} className="text-gray-ui"/> Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {editando && (
        <ModalEstablecimiento
          est={editando}
          sostenedores={sostenedores}
          comunas={comunas}
          candidatosUnion={conEstado.filter(e => !e.sinFuente && e.programa === editando.programa)}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); registro.recargar(); }}
        />
      )}

      {sostenedorEdit && (
        <ModalSostenedor
          sostenedor={sostenedorEdit}
          onClose={() => setSostenedorEdit(null)}
          onGuardado={() => { setSostenedorEdit(null); registro.recargar(); }}
        />
      )}
    </>
  );
}

const Vacio = () => <span className="text-gray-ui font-light">—</span>;

function Resumen({ valor, texto }) {
  return (
    <div className="card-tight flex items-baseline gap-2">
      <span className="text-2xl font-medium text-gray-dark tabular-nums">{valor}</span>
      <span className="text-xs text-gray-ui font-light">{texto}</span>
    </div>
  );
}

function Estado({ est }) {
  if (est.sinFuente) {
    return <span className="text-xs text-gray-dark">Aún no aparece en las planillas</span>;
  }
  if (est.faltan.length) {
    return <span className="text-xs" style={{ color: 'var(--color-red)' }}>Falta: {est.faltan.join(', ')}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-dark">
      <CheckCircle2 size={12} style={{ color: 'var(--color-lime)' }}/> Completo
    </span>
  );
}

// ─── Modal establecimiento ────────────────────────────────────────────────

function ModalEstablecimiento({ est, sostenedores, comunas, candidatosUnion, onClose, onGuardado }) {
  const nuevo = !!est.nuevo;
  const [programa, setPrograma] = useState(est.programa ?? 'escolar');
  const [nombre, setNombre] = useState(est.nombre ?? '');
  const [slep, setSlep] = useState(est.slep ?? '');
  const [comuna, setComuna] = useState(est.comuna ?? '');
  const [cohorte, setCohorte] = useState(est.cohorte ?? '');
  const [nNinos, setNNinos] = useState(est.nNinos ?? '');
  const [rbd, setRbd] = useState(est.rbd ?? '');
  const [destino, setDestino] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const ejecutar = async (fn) => {
    setError('');
    setTrabajando(true);
    try { await fn(); onGuardado(); }
    catch (err) { setError(err.message); }
    finally { setTrabajando(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    const datos = { nombre, slep, comuna, cohorte, nNinos, ...(programa === 'escolar' ? { rbd } : {}) };
    ejecutar(() => guardarEstablecimiento(nuevo ? { programa, ...datos } : { id: est.id, ...datos }));
  };

  const unir = () => {
    const d = candidatosUnion.find(c => c.id === destino);
    if (!d || !confirm(`"${est.nombre}" se unirá con "${d.nombre}": los datos que completaste aquí pasan a "${d.nombre}" y este registro se elimina. ¿Continuar?`)) return;
    ejecutar(() => unirEstablecimientos(est.id, destino));
  };

  const eliminar = () => {
    if (!confirm(`¿Eliminar "${est.nombre}"? Todavía no tiene datos cargados.`)) return;
    ejecutar(() => eliminarEstablecimiento(est.id));
  };

  const campo = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-elev my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-dark">{nuevo ? 'Nuevo establecimiento' : est.nombre}</h2>
            <p className="text-xs text-gray-ui font-light mt-1">
              {nuevo
                ? 'Escribe el nombre tal como aparece en la carpeta o en la planilla: así la carga de cada noche lo reconoce y le asocia sus datos.'
                : 'Los datos que cambies aquí prevalecen sobre las planillas.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-xl hover:bg-bg flex items-center justify-center text-gray-ui transition">
            <X size={16}/>
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {nuevo && (
            <Campo label="Programa">
              <select value={programa} onChange={(e) => { setPrograma(e.target.value); setCohorte(''); }} className={campo}>
                {Object.entries(PROGRAMA_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Campo>
          )}
          <Campo label="Nombre">
            <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo}
              placeholder={programa === 'escolar' ? 'Escuela …' : 'Jardín infantil …'}/>
          </Campo>
          <Campo label="Sostenedor">
            <select value={slep} onChange={(e) => setSlep(e.target.value)} className={campo}>
              <option value="">— sin asignar —</option>
              {sostenedores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Comuna">
              <input type="text" value={comuna} onChange={(e) => setComuna(e.target.value)} list="comunas-registro" className={campo}/>
              <datalist id="comunas-registro">{comunas.map(c => <option key={c} value={c}/>)}</datalist>
            </Campo>
            <Campo label="Cohorte">
              <select value={cohorte} onChange={(e) => setCohorte(e.target.value)} className={campo}>
                <option value="">— sin asignar —</option>
                {COHORTES[programa].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Matrícula">
              <input type="number" min="0" step="1" value={nNinos} onChange={(e) => setNNinos(e.target.value)} className={campo}/>
            </Campo>
            {programa === 'escolar' && (
              <Campo label="RBD">
                <input type="text" value={rbd} onChange={(e) => setRbd(e.target.value)} className={campo} placeholder="9876"/>
              </Campo>
            )}
          </div>

          {!nuevo && est.sinFuente && (
            <div className="p-3 rounded-xl bg-bg space-y-2">
              <p className="text-xs text-gray-dark">
                Este establecimiento todavía no aparece en las planillas con este nombre. Si la carga ya lo registró con otro nombre, únelos para no tener dos.
              </p>
              <div className="flex items-center gap-2">
                <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${campo} py-2`}>
                  <option value="">— elegir establecimiento —</option>
                  {candidatosUnion.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button type="button" onClick={unir} disabled={!destino || trabajando}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-border bg-white text-gray-dark disabled:opacity-50">
                  <Link2 size={14}/> Unir
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0"/>
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {!nuevo && est.sinFuente && (
                <button type="button" onClick={eliminar} disabled={trabajando} className="text-sm font-medium disabled:opacity-50" style={{ color: 'var(--color-red)' }}>
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-dark hover:bg-bg transition">Cancelar</button>
              <button type="submit" disabled={trabajando}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                style={{ background: 'var(--color-teal)' }}>
                {trabajando && <Loader2 size={14} className="animate-spin"/>}
                {nuevo ? 'Crear establecimiento' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal sostenedor ─────────────────────────────────────────────────────

function ModalSostenedor({ sostenedor, onClose, onGuardado }) {
  const nuevo = !!sostenedor.nuevo;
  const [nombre, setNombre] = useState(sostenedor.nombre ?? '');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setTrabajando(true);
    try {
      await guardarSostenedor(nuevo ? { nombre } : { id: sostenedor.id, nombre });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setTrabajando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-elev my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-dark">{nuevo ? 'Nuevo sostenedor' : 'Cambiar nombre del sostenedor'}</h2>
            <p className="text-xs text-gray-ui font-light mt-1">
              {nuevo
                ? 'Una vez creado puedes asignarle establecimientos y usuarios.'
                : 'El nombre anterior se sigue reconociendo en las planillas.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-xl hover:bg-bg flex items-center justify-center text-gray-ui transition">
            <X size={16}/>
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <Campo label="Nombre">
            <input type="text" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="SLEP …"
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none"/>
          </Campo>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0"/>
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-dark hover:bg-bg transition">Cancelar</button>
            <button type="submit" disabled={trabajando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: 'var(--color-teal)' }}>
              {trabajando && <Loader2 size={14} className="animate-spin"/>}
              {nuevo ? 'Crear sostenedor' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-ui font-medium mb-1.5 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
