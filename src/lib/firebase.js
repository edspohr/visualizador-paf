// Firebase client SDK bootstrap for visualizador-paf.
// The config below is public by design (client-side keys are safe to commit).
// Auth providers enabled: Email/Password + Google.
// Firestore instance available at `db`. Collection used by the app: `usuarios`.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

// `npm run dev:emuladores` (.env.emuladores) points the app at the local
// Firebase emulators under a demo project id, which can never reach production.
export const EMULADORES = import.meta.env.VITE_USE_EMULATORS === '1';

const firebaseConfig = {
  apiKey: 'AIzaSyAcJ4Aif955eSouLB9Ssit29SYy4PaGayU',
  authDomain: 'visualizador-paf.firebaseapp.com',
  projectId: EMULADORES ? 'demo-paf' : 'visualizador-paf',
  storageBucket: 'visualizador-paf.firebasestorage.app',
  messagingSenderId: '719942512215',
  appId: '1:719942512215:web:791e914a3d29e0d9a93d12',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
const functions = getFunctions(app, 'us-central1');

if (EMULADORES) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// ─── Whitelist de superadmins ─────────────────────────────────────────────
// Emails que reciben automáticamente el perfil 'superadmin' al primer login.
// Case-insensitive. Actualizar con los emails reales de Luis y Sebastián cuando
// estén disponibles.

const SUPERADMIN_WHITELIST = new Set([
  'espohr@gmail.com',
  'lagurto@focus.cl',   // Luis Agurto
  'speters@focus.cl',   // Sebastián
]);

export function esEmailSuperadmin(email) {
  return email ? SUPERADMIN_WHITELIST.has(email.toLowerCase().trim()) : false;
}

// The whitelist only applies when the provider verified the email (Google
// sign-in). The Firestore rules enforce the same condition (firestore.rules →
// esWhitelist), so keep both lists in step.
function esSuperadminVerificado(user) {
  return !!user?.emailVerified && esEmailSuperadmin(user.email);
}

// ─── Auth helpers ──────────────────────────────────────────────────────────

export async function iniciarSesionEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registrarEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Al registrarse, whitelist decide si es superadmin; el resto queda 'pendiente'
  // hasta que un superadmin le asigne perfil.
  const esSuperadmin = esSuperadminVerificado(cred.user);
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    email: cred.user.email,
    nombre: cred.user.displayName ?? '',
    perfilDefault: esSuperadmin ? 'superadmin' : 'pendiente',
    establecimientoId: null,
    createdAt: serverTimestamp(),
    proveedor: 'password',
  });
  return cred.user;
}

export async function iniciarConGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const ref = doc(db, 'usuarios', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Primera vez: asignar perfil según whitelist. Superadmins de la whitelist
    // reciben 'superadmin' automáticamente; el resto queda 'pendiente' hasta que
    // un superadmin les asigne perfil desde el panel de usuarios.
    const esSuperadmin = esSuperadminVerificado(cred.user);
    await setDoc(ref, {
      email: cred.user.email,
      nombre: cred.user.displayName ?? '',
      perfilDefault: esSuperadmin ? 'superadmin' : 'pendiente',
      establecimientoId: null,
      createdAt: serverTimestamp(),
      proveedor: 'google',
    });
  } else {
    // Login recurrente: si el email está en whitelist y el doc no lo tiene como
    // superadmin, actualizarlo (permite promover a alguien sin borrar su doc).
    if (esSuperadminVerificado(cred.user) && snap.data().perfilDefault !== 'superadmin') {
      await setDoc(ref, { perfilDefault: 'superadmin' }, { merge: true });
    }
  }
  return cred.user;
}

// Emulators only: sign in as one of the test users created by
// scripts/dev/seedEmulador.mjs (production offers Google sign-in only).
export async function entrarEmulador(perfil) {
  if (!EMULADORES) throw new Error('Solo disponible con emuladores.');
  const cred = await signInWithEmailAndPassword(auth, `${perfil}@prueba.test`, import.meta.env.VITE_EMULADOR_CLAVE);
  return cred.user;
}

export async function cerrarSesionAuth() {
  await fbSignOut(auth);
}

export function suscribirAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function enviarResetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─── Firestore helpers para colección `usuarios` ─────────────────────────

export async function obtenerUsuarioDoc(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// Asegura que exista el doc del usuario en Firestore. Si no existe (caso frecuente
// cuando el flujo de login termina antes que el setDoc del provider), lo crea con
// la lógica de whitelist. Devuelve el doc (existente o recién creado).
export async function asegurarUsuarioDoc(user) {
  if (!user) return null;
  const ref = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { uid: user.uid, ...snap.data() };
  }
  // Doc no existe: crearlo aplicando whitelist
  const esSuperadmin = esSuperadminVerificado(user);
  const nuevo = {
    email: user.email ?? null,
    nombre: user.displayName ?? '',
    perfilDefault: esSuperadmin ? 'superadmin' : 'pendiente',
    establecimientoId: null,
    createdAt: serverTimestamp(),
    proveedor: user.providerData?.[0]?.providerId ?? 'unknown',
  };
  await setDoc(ref, nuevo);
  return { uid: user.uid, ...nuevo };
}

export async function listarUsuarios() {
  const q = query(collection(db, 'usuarios'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// Devuelve solo los usuarios que actúan como consultores Focus.
// Se usa desde el Dashboard de consultores del superadmin.
export async function listarConsultores() {
  const snap = await getDocs(collection(db, 'usuarios'));
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.perfilDefault === 'consultor');
}

export async function actualizarUsuarioDoc(uid, patch) {
  await setDoc(doc(db, 'usuarios', uid), patch, { merge: true });
}

// ─── Administración (función adminPlataforma, ADR-0004) ──────────────────
// Usuarios, sostenedores y establecimientos se escriben en el servidor: las
// reglas de Firestore no permiten que el navegador toque campos de perfil ni
// el registro de establecimientos.

const llamarAdmin = httpsCallable(functions, 'adminPlataforma');

async function admin(accion, datos) {
  try {
    const r = await llamarAdmin({ accion, datos });
    return r.data;
  } catch (err) {
    // The function already answers in Spanish for the cases a person can fix.
    const propio = ['functions/invalid-argument', 'functions/already-exists', 'functions/failed-precondition',
      'functions/not-found', 'functions/permission-denied', 'functions/unauthenticated'].includes(err?.code);
    throw new Error(propio ? err.message : 'No se pudo completar la operación. Intenta nuevamente.');
  }
}

// Crea la cuenta y su registro sin tocar la sesión del administrador.
export const crearUsuarioComoAdmin = (datos) => admin('crearUsuario', datos);
// Cambia perfil y/o asignación; el SLEP del establecimiento se deriva en el servidor.
export const actualizarUsuarioComoAdmin = (uid, datos) => admin('actualizarUsuario', { uid, ...datos });
// Quita el registro y la cuenta de acceso.
export const eliminarUsuarioDoc = (uid) => admin('eliminarUsuario', { uid });

export const guardarSostenedor = (datos) => admin('guardarSostenedor', datos);
export const eliminarSostenedor = (id) => admin('eliminarSostenedor', { id });
export const guardarEstablecimiento = (datos) => admin('guardarEstablecimiento', datos);
export const unirEstablecimientos = (origenId, destinoId) => admin('unirEstablecimientos', { origenId, destinoId });
export const eliminarEstablecimiento = (id) => admin('eliminarEstablecimiento', { id });
