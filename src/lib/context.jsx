import { createContext, useContext, useState, useEffect } from 'react';
import { suscribirAuth, asegurarUsuarioDoc, cerrarSesionAuth, actualizarUsuarioDoc, auth } from './firebase.js';

const AppCtx = createContext(null);

// Perfiles disponibles con su contexto por defecto
export const PERFILES = [
  {
    id: 'escuela',
    nombre: 'Escuela',
    descripcion: 'Directora, equipo directivo',
    icono: 'school',
    color: 'cyan',
    rol: 'Acceso a tu establecimiento',
    contexto: { tipo: 'establecimiento', id: 'ESC-001', programa: 'escolar' }
  },
  {
    id: 'jardin',
    nombre: 'Jardín Infantil',
    descripcion: 'Directora, equipo educativo',
    icono: 'baby',
    color: 'yellow',
    rol: 'Acceso a tu jardín',
    contexto: { tipo: 'establecimiento', id: 'JAR-001', programa: 'parvulario' }
  },
  {
    id: 'sostenedor',
    nombre: 'Sostenedor',
    descripcion: 'Sostenedor',
    icono: 'building',
    color: 'magenta',
    rol: 'Acceso a tu red de establecimientos',
    contexto: { tipo: 'slep', id: 'SLEP-LP', programa: 'escolar' }
  },
  {
    id: 'consultor',
    nombre: 'Consultor',
    descripcion: 'Coordinación Focus',
    icono: 'shield',
    color: 'purple',
    rol: 'Acceso completo a todos los programas',
    contexto: { tipo: 'total', programa: 'escolar' }
  },
  {
    id: 'cap',
    nombre: 'Fundación CAP',
    descripcion: 'Financiador del programa',
    icono: 'award',
    color: 'crimson',
    rol: 'Acceso a datos cerrados del mes anterior',
    contexto: { tipo: 'total', programa: 'escolar' }
  },
  {
    id: 'superadmin',
    nombre: 'Superadministrador',
    descripcion: 'Coordinación Focus + gestión de plataforma',
    icono: 'shield-check',
    color: 'teal',
    rol: 'Acceso completo + gestión de usuarios',
    contexto: { tipo: 'total', programa: 'escolar' }
  },
  {
    id: 'pendiente',
    nombre: 'Pendiente de asignación',
    descripcion: 'Cuenta registrada; esperando asignación de perfil por un administrador',
    icono: 'shield',
    color: 'gray',
    rol: 'Acceso restringido',
    contexto: { tipo: 'pendiente', programa: 'escolar' }
  },
];

// Busca en PERFILES por id (case-insensitive) y devuelve una copia lista para usar.
function perfilPorId(id) {
  return PERFILES.find(p => p.id === id);
}

export function AppProvider({ children }) {
  const [perfil, setPerfil] = useState(null);
  // usuario autenticado con Firebase (null = anónimo/demo)
  const [usuario, setUsuario] = useState(null);
  // usuarioDoc: registro en Firestore de ese usuario (perfil asignado, establecimiento, etc.)
  const [usuarioDoc, setUsuarioDoc] = useState(null);
  const [authListo, setAuthListo] = useState(false);

  // Nota: ya no restauramos perfil desde localStorage al mount inicial.
  // El perfil se aplica exclusivamente desde el doc de usuario en Firestore
  // cuando el listener de auth detecta una sesión (línea siguiente).

  // Suscribirse a cambios de auth de Firebase.
  // Al login (o restauración de sesión), leemos el doc del usuario y aplicamos su
  // perfil asignado automáticamente. Los superadmins pueden cambiar de perfil después
  // desde el dropdown del header.
  useEffect(() => {
    const unsub = suscribirAuth(async (u) => {
      setUsuario(u);
      if (u) {
        try {
          // asegurarUsuarioDoc crea el doc si no existe (evita race condition entre
          // el listener y el setDoc del provider). Aplica whitelist automáticamente.
          const doc = await asegurarUsuarioDoc(u);
          setUsuarioDoc(doc);
          if (doc?.perfilDefault) {
            const base = perfilPorId(doc.perfilDefault);
            if (base) {
              const contexto = { ...base.contexto };
              if (doc.establecimientoId) contexto.id = doc.establecimientoId;
              if (doc.slepId && contexto.tipo === 'slep') contexto.id = doc.slepId;
              const p = { ...base, contexto };
              setPerfil(p);
              localStorage.setItem('paf_perfil', JSON.stringify(p));
            }
          }
        } catch (err) {
          console.error('No se pudo cargar registro de usuario:', err);
          // No dejar la app en estado de espera indefinido: forzar cierre de sesión
          // para que el usuario vuelva al login limpio.
          try { await cerrarSesionAuth(); } catch { /* ignore */ }
        }
      } else {
        setUsuarioDoc(null);
        setPerfil(null);
        localStorage.removeItem('paf_perfil');
      }
      setAuthListo(true);
    });
    return () => unsub();
  }, []);

  // seleccionarPerfil ahora solo lo usan los superadmins desde el dropdown del header
  // para "cambiar de vista" a otro perfil (jardín, sostenedor, etc.).
  // Los usuarios normales reciben su perfil directamente al hacer login (auth listener).
  const seleccionarPerfil = async (p) => {
    setPerfil(p);
    localStorage.setItem('paf_perfil', JSON.stringify(p));
    // Si hay usuario logueado, actualizar su doc para que las reglas de Firestore
    // autoricen la lectura del nuevo establecimiento/slep. Esto solo tiene sentido
    // para superadmins (los únicos que pueden cambiar de perfil libremente).
    if (auth.currentUser && usuarioDoc?.perfilDefault === 'superadmin') {
      try {
        await actualizarUsuarioDoc(auth.currentUser.uid, {
          establecimientoId: p.contexto?.tipo === 'establecimiento' ? p.contexto.id : null,
          slepId: p.contexto?.tipo === 'slep' ? p.contexto.id : null,
          // Nota: perfilDefault se mantiene como 'superadmin' aunque esté "viendo como" otro perfil
        });
      } catch (err) {
        console.warn('No se pudo actualizar contexto del usuario:', err);
      }
    }
  };

  const cerrarSesion = async () => {
    setPerfil(null);
    localStorage.removeItem('paf_perfil');
    if (usuario) {
      try { await cerrarSesionAuth(); } catch (err) { console.warn(err); }
    }
  };

  const cambiarEntidad = async (id) => {
    if (!perfil) return;
    const nuevo = { ...perfil, contexto: { ...perfil.contexto, id } };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
    // Propagar al doc de Firestore para que las reglas autoricen la lectura del
    // nuevo establecimiento. Solo aplica a superadmins (los demás no pueden cambiar).
    if (auth.currentUser && usuarioDoc?.perfilDefault === 'superadmin') {
      try {
        await actualizarUsuarioDoc(auth.currentUser.uid, {
          establecimientoId: nuevo.contexto?.tipo === 'establecimiento' ? id : null,
          slepId: nuevo.contexto?.tipo === 'slep' ? id : null,
        });
      } catch (err) { console.warn(err); }
    }
  };

  const cambiarPrograma = async (programa) => {
    if (!perfil) return;
    const nuevoCtx = { ...perfil.contexto, programa };
    if (perfil.id === 'escuela' && programa === 'parvulario') nuevoCtx.id = 'JAR-001';
    if (perfil.id === 'jardin' && programa === 'escolar') nuevoCtx.id = 'ESC-001';
    const nuevo = { ...perfil, contexto: nuevoCtx };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
    if (auth.currentUser && usuarioDoc?.perfilDefault === 'superadmin' && nuevoCtx.id) {
      try {
        await actualizarUsuarioDoc(auth.currentUser.uid, {
          establecimientoId: nuevoCtx.tipo === 'establecimiento' ? nuevoCtx.id : null,
        });
      } catch (err) { console.warn(err); }
    }
  };

  return (
    <AppCtx.Provider value={{
      perfil, seleccionarPerfil, cerrarSesion, cambiarEntidad, cambiarPrograma,
      usuario, usuarioDoc, authListo,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}

// Resolvedor de entidades — recibe los datos por parámetro (post Fase A vienen de Firestore)
export function resolverEntidad(contexto, todosEstablecimientos = [], sostenedores = []) {
  if (contexto.tipo === 'establecimiento') {
    return todosEstablecimientos.find(e => e.id === contexto.id);
  }
  if (contexto.tipo === 'slep') {
    return sostenedores.find(s => s.id === contexto.id);
  }
  return null;
}
