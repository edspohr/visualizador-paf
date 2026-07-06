import { createContext, useContext, useState, useEffect } from 'react';
import { suscribirAuth, obtenerUsuarioDoc, cerrarSesionAuth, iniciarSesionDemo, actualizarUsuarioDoc, auth } from './firebase.js';

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

  // Restaurar perfil desde localStorage (modo demo)
  useEffect(() => {
    const guardado = localStorage.getItem('paf_perfil');
    if (guardado) {
      try { setPerfil(JSON.parse(guardado)); } catch { /* ignore */ }
    }
  }, []);

  // Suscribirse a cambios de auth de Firebase
  useEffect(() => {
    const unsub = suscribirAuth(async (u) => {
      setUsuario(u);
      if (u) {
        try {
          const doc = await obtenerUsuarioDoc(u.uid);
          setUsuarioDoc(doc);
          // Aplicar perfil desde Firestore SOLO si es un login "real" (no anónimo).
          // Los usuarios anónimos ya tienen su perfil desde seleccionarPerfil() y no
          // queremos sobrescribirlo con cada refresh del listener.
          if (doc?.perfilDefault && !u.isAnonymous) {
            const base = perfilPorId(doc.perfilDefault);
            if (base) {
              const contexto = { ...base.contexto };
              if (doc.establecimientoId) contexto.id = doc.establecimientoId;
              const p = { ...base, contexto };
              setPerfil(p);
              localStorage.setItem('paf_perfil', JSON.stringify(p));
            }
          }
        } catch (err) {
          console.warn('No se pudo cargar registro de usuario:', err);
        }
      } else {
        setUsuarioDoc(null);
      }
      setAuthListo(true);
    });
    return () => unsub();
  }, []);

  const seleccionarPerfil = async (p) => {
    setPerfil(p);
    localStorage.setItem('paf_perfil', JSON.stringify(p));
    // Si no hay sesión Firebase, hacer login anónimo con el perfil demo elegido.
    // Esto permite que las reglas Firestore autoricen las lecturas.
    try {
      if (!auth.currentUser) {
        await iniciarSesionDemo(p);
      } else if (auth.currentUser.isAnonymous) {
        // Ya hay sesión anónima previa (cambio de perfil demo). Actualizar el doc.
        await actualizarUsuarioDoc(auth.currentUser.uid, {
          perfilDefault: p.id,
          establecimientoId: p.contexto?.id ?? null,
          slepId: p.contexto?.tipo === 'slep' ? p.contexto.id : null,
        });
      }
    } catch (err) {
      console.warn('No se pudo iniciar sesión demo:', err);
    }
  };

  const cerrarSesion = async () => {
    setPerfil(null);
    localStorage.removeItem('paf_perfil');
    // Si además hay sesión de Firebase, cerrarla también
    if (usuario) {
      try { await cerrarSesionAuth(); } catch (err) { console.warn(err); }
    }
  };

  const cambiarEntidad = async (id) => {
    if (!perfil) return;
    const nuevo = { ...perfil, contexto: { ...perfil.contexto, id } };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
    // Si es sesión anónima demo, actualizar el doc para que las reglas lo lean
    if (auth.currentUser?.isAnonymous) {
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
    // Si cambia programa, también resetear establecimiento por defecto si aplica
    if (perfil.id === 'escuela' && programa === 'parvulario') nuevoCtx.id = 'JAR-001';
    if (perfil.id === 'jardin' && programa === 'escolar') nuevoCtx.id = 'ESC-001';
    const nuevo = { ...perfil, contexto: nuevoCtx };
    setPerfil(nuevo);
    localStorage.setItem('paf_perfil', JSON.stringify(nuevo));
    // Propagar al doc de Firestore si es demo anónimo
    if (auth.currentUser?.isAnonymous && nuevoCtx.id) {
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
