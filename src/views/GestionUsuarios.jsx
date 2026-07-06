import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Trash2, Search, X, Loader2, AlertCircle, Mail, User, UserCircle, Building2 } from 'lucide-react';
import { PERFILES } from '../lib/context.jsx';
import { useEscuelas, useJardines, useSleps } from '../lib/queries.js';
import {
  listarUsuarios,
  crearUsuarioComoAdmin,
  actualizarUsuarioDoc,
  eliminarUsuarioDoc,
} from '../lib/firebase.js';

const PERFIL_LABELS = Object.fromEntries(PERFILES.map(p => [p.id, p.nombre]));

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [modalCrear, setModalCrear] = useState(false);

  // Datos del catálogo — usados para dropdowns de asignación
  const escuelasQ = useEscuelas();
  const jardinesQ = useJardines();
  const slepsQ = useSleps();
  const catalogo = { escuelas: escuelasQ.data ?? [], jardines: jardinesQ.data ?? [], sleps: slepsQ.data ?? [] };

  const recargar = async () => {
    setLoading(true);
    setError('');
    try {
      const lista = await listarUsuarios();
      setUsuarios(lista);
    } catch (err) {
      setError(err?.message ?? 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { recargar(); }, []);

  const filtrados = useMemo(() => {
    if (!q.trim()) return usuarios;
    const needle = q.toLowerCase().trim();
    return usuarios.filter(u =>
      (u.email ?? '').toLowerCase().includes(needle) ||
      (u.nombre ?? '').toLowerCase().includes(needle) ||
      PERFIL_LABELS[u.perfilDefault]?.toLowerCase().includes(needle)
    );
  }, [usuarios, q]);

  const cambiarPerfil = async (uid, perfilDefault) => {
    try {
      await actualizarUsuarioDoc(uid, { perfilDefault });
      setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, perfilDefault } : u));
    } catch (err) {
      setError(err?.message ?? 'No se pudo actualizar.');
    }
  };

  const cambiarEstablecimiento = async (uid, establecimientoId) => {
    try {
      await actualizarUsuarioDoc(uid, { establecimientoId: establecimientoId || null });
      setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, establecimientoId: establecimientoId || null } : u));
    } catch (err) {
      setError(err?.message ?? 'No se pudo actualizar.');
    }
  };

  const eliminar = async (uid) => {
    if (!confirm('¿Eliminar este usuario? Se quita del registro de la plataforma; la cuenta de Firebase Auth queda huérfana y solo puede ser eliminada desde la consola de Firebase.')) return;
    try {
      await eliminarUsuarioDoc(uid);
      setUsuarios(prev => prev.filter(u => u.uid !== uid));
    } catch (err) {
      setError(err?.message ?? 'No se pudo eliminar.');
    }
  };

  return (
    <>
      {/* Header + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgb(220,240,240)' }}>
            <Users size={20} style={{ color: 'var(--color-teal)' }} />
          </div>
          <div>
            <h2 className="text-xl font-medium text-gray-dark">Gestión de usuarios</h2>
            <p className="text-sm text-gray-ui font-light">Alta, edición y baja de usuarios registrados en la plataforma.</p>
          </div>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition"
          style={{ background: 'var(--color-teal)' }}
        >
          <Plus size={16}/> Crear usuario
        </button>
      </div>

      {/* Buscador */}
      <div className="card mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-ui pointer-events-none"/>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo, nombre o perfil…"
            className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none transition"
          />
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0"/>
          <span>{error}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-ui text-sm">
            <Loader2 size={16} className="animate-spin mr-2"/> Cargando usuarios…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <UserCircle size={40} className="mx-auto text-gray-ui mb-3"/>
            <p className="text-sm text-gray-dark font-medium">
              {q ? 'No hay usuarios que coincidan con la búsqueda.' : 'Todavía no hay usuarios registrados.'}
            </p>
            <p className="text-xs text-gray-ui font-light mt-1">
              {!q && 'Crea el primero desde "Crear usuario".'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs text-gray-ui uppercase tracking-wider">
                <th className="py-3 pr-3 font-medium">Usuario</th>
                <th className="py-3 px-3 font-medium">Perfil asignado</th>
                <th className="py-3 px-3 font-medium">Establecimiento</th>
                <th className="py-3 px-3 font-medium">Proveedor</th>
                <th className="py-3 pl-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(u => (
                <FilaUsuario
                  key={u.uid}
                  u={u}
                  onCambiarPerfil={(id) => cambiarPerfil(u.uid, id)}
                  onCambiarEstablecimiento={(id) => cambiarEstablecimiento(u.uid, id)}
                  onEliminar={() => eliminar(u.uid)}
                  catalogo={catalogo}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalCrear && (
        <ModalCrearUsuario
          onClose={() => setModalCrear(false)}
          onCreado={() => { setModalCrear(false); recargar(); }}
          catalogo={catalogo}
        />
      )}
    </>
  );
}

// ─── Fila de usuario ──────────────────────────────────────────────────────

function FilaUsuario({ u, onCambiarPerfil, onCambiarEstablecimiento, onEliminar, catalogo }) {
  const perfilObj = PERFILES.find(p => p.id === u.perfilDefault);
  const opcionesEstablecimiento = opcionesPorPerfil(u.perfilDefault, catalogo);
  return (
    <tr className="border-b border-border last:border-0 hover:bg-bg transition">
      <td className="py-3 pr-3">
        <p className="font-medium text-gray-dark">{u.nombre || u.email}</p>
        {u.nombre && <p className="text-xs text-gray-ui font-light">{u.email}</p>}
      </td>
      <td className="py-3 px-3">
        <select
          value={u.perfilDefault ?? ''}
          onChange={(e) => onCambiarPerfil(e.target.value)}
          className="px-2 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 outline-none"
        >
          {PERFILES.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </td>
      <td className="py-3 px-3">
        {opcionesEstablecimiento.length > 0 ? (
          <select
            value={u.establecimientoId ?? ''}
            onChange={(e) => onCambiarEstablecimiento(e.target.value)}
            className="px-2 py-1.5 border border-border rounded-lg text-xs bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 outline-none max-w-[240px]"
          >
            <option value="">— sin asignar —</option>
            {opcionesEstablecimiento.map(op => (
              <option key={op.id} value={op.id}>{op.nombre}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-gray-ui font-light">— no aplica —</span>
        )}
      </td>
      <td className="py-3 px-3">
        <span className="text-xs text-gray-ui font-light capitalize">{u.proveedor ?? '—'}</span>
      </td>
      <td className="py-3 pl-3 text-right">
        <button
          onClick={onEliminar}
          className="text-gray-ui hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"
          style={{ '--color-red': 'var(--color-red)' }}
          title="Eliminar usuario"
        >
          <Trash2 size={14} style={{ color: 'var(--color-red)' }}/>
        </button>
      </td>
    </tr>
  );
}

// Devuelve la lista de establecimientos/SLEPs disponibles para un perfil dado.
// catalogo = { escuelas, jardines, sleps } viene de Firestore.
function opcionesPorPerfil(perfilId, catalogo = { escuelas: [], jardines: [], sleps: [] }) {
  if (perfilId === 'escuela') return catalogo.escuelas.map(e => ({ id: e.id, nombre: e.nombre }));
  if (perfilId === 'jardin')  return catalogo.jardines.map(j => ({ id: j.id, nombre: j.nombre }));
  if (perfilId === 'sostenedor') return catalogo.sleps.map(s => ({ id: s.id, nombre: s.nombre }));
  return []; // consultor, cap, superadmin: sin asignación específica
}

// ─── Modal crear usuario ──────────────────────────────────────────────────

function ModalCrearUsuario({ onClose, onCreado, catalogo }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState('escuela');
  const [establecimientoId, setEstablecimientoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const opciones = opcionesPorPerfil(perfil, catalogo);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await crearUsuarioComoAdmin({
        email: email.trim(),
        password,
        nombre: nombre.trim(),
        perfilDefault: perfil,
        establecimientoId: establecimientoId || null,
      });
      onCreado();
    } catch (err) {
      const code = err?.code ?? '';
      if (code === 'auth/email-already-in-use') setError('Ya existe una cuenta con ese correo.');
      else if (code === 'auth/invalid-email') setError('El correo no es válido.');
      else setError(err?.message ?? 'No se pudo crear.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-elev my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-dark">Crear usuario</h2>
            <p className="text-xs text-gray-ui font-light mt-1">
              Al crear, el usuario recibirá acceso con la contraseña que definas. Puedes cambiar el perfil después.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-bg flex items-center justify-center text-gray-ui transition">
            <X size={16}/>
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <ModalField label="Correo" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="usuario@focus.cl"/>
          <ModalField label="Nombre completo" icon={User} type="text" value={nombre} onChange={setNombre} placeholder="Nombre y apellido"/>
          <ModalField label="Contraseña inicial" icon={UserCircle} type="password" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres"/>

          <div>
            <label className="block text-xs text-gray-ui font-medium mb-1.5 uppercase tracking-wider">Perfil</label>
            <select
              value={perfil}
              onChange={(e) => { setPerfil(e.target.value); setEstablecimientoId(''); }}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none"
            >
              {PERFILES.map(p => <option key={p.id} value={p.id}>{p.nombre} — {p.descripcion}</option>)}
            </select>
          </div>

          {opciones.length > 0 && (
            <div>
              <label className="block text-xs text-gray-ui font-medium mb-1.5 uppercase tracking-wider">Establecimiento / Sostenedor</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-ui pointer-events-none"/>
                <select
                  value={establecimientoId}
                  onChange={(e) => setEstablecimientoId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none"
                >
                  <option value="">— sin asignar (elegirá al ingresar) —</option>
                  {opciones.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgb(252,235,231)', color: 'var(--color-red)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0"/>
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-dark hover:bg-bg transition">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: 'var(--color-teal)' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
              Crear usuario
            </button>
          </div>

          <p className="text-[10px] text-gray-ui font-light mt-2 pt-2 border-t border-border">
            Nota: al crear el usuario se cierra tu sesión actual y se inicia la del recién creado.
            Esta es una limitación de la API cliente de Firebase Auth. Cierra sesión y vuelve a entrar como superadmin.
          </p>
        </form>
      </div>
    </div>
  );
}

function ModalField({ label, icon: Icon, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-ui font-medium mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-ui pointer-events-none"/>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={type !== 'text'}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-sm bg-white text-gray-dark focus:ring-2 focus:ring-cyan-100 focus:border-cyan outline-none transition"
        />
      </div>
    </div>
  );
}
