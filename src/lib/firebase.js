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
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAcJ4Aif955eSouLB9Ssit29SYy4PaGayU',
  authDomain: 'visualizador-paf.firebaseapp.com',
  projectId: 'visualizador-paf',
  storageBucket: 'visualizador-paf.firebasestorage.app',
  messagingSenderId: '719942512215',
  appId: '1:719942512215:web:791e914a3d29e0d9a93d12',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ─── Whitelist de superadmins ─────────────────────────────────────────────
// Emails que reciben automáticamente el perfil 'superadmin' al primer login.
// Case-insensitive. Actualizar con los emails reales de Luis y Sebastián cuando
// estén disponibles.

const SUPERADMIN_WHITELIST = new Set([
  'espohr@gmail.com',
  'lagurto@focus.cl',      // TODO: reemplazar por email real de Luis Agurto
  'seba@focus.cl',         // TODO: reemplazar por email real de Sebastián
]);

export function esEmailSuperadmin(email) {
  return email ? SUPERADMIN_WHITELIST.has(email.toLowerCase().trim()) : false;
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
  const esSuperadmin = esEmailSuperadmin(email);
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
    const esSuperadmin = esEmailSuperadmin(cred.user.email);
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
    if (esEmailSuperadmin(cred.user.email) && snap.data().perfilDefault !== 'superadmin') {
      await setDoc(ref, { perfilDefault: 'superadmin' }, { merge: true });
    }
  }
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

export async function listarUsuarios() {
  const q = query(collection(db, 'usuarios'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function actualizarUsuarioDoc(uid, patch) {
  await setDoc(doc(db, 'usuarios', uid), patch, { merge: true });
}

export async function eliminarUsuarioDoc(uid) {
  await deleteDoc(doc(db, 'usuarios', uid));
}

// Crea un usuario directamente desde el panel superadmin.
// Nota: usa la API pública de createUserWithEmailAndPassword, lo cual desloguea al
// superadmin actual y loguea al usuario nuevo. Para producción esto se resuelve
// con Cloud Functions + Admin SDK; para el demo alcanza con recargar sesión.
export async function crearUsuarioComoAdmin({ email, password, nombre, perfilDefault, establecimientoId }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    email,
    nombre: nombre ?? '',
    perfilDefault,
    establecimientoId: establecimientoId ?? null,
    createdAt: serverTimestamp(),
    proveedor: 'password',
    creadoPor: 'superadmin',
  });
  return cred.user;
}
