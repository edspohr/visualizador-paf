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
  signInAnonymously,
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

// ─── Auth helpers ──────────────────────────────────────────────────────────

export async function iniciarSesionEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registrarEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Guardar registro básico en Firestore (perfil default = escuela; superadmin puede cambiar)
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    email: cred.user.email,
    nombre: cred.user.displayName ?? '',
    perfilDefault: 'escuela',
    establecimientoId: null,
    createdAt: serverTimestamp(),
    proveedor: 'password',
  });
  return cred.user;
}

// Inicia una sesión anónima de Firebase Auth y crea (o actualiza) el doc
// /usuarios/{uid} con el perfil demo seleccionado. Esto permite que las reglas
// Firestore (que exigen auth + doc de usuario) autoricen las lecturas del catálogo.
export async function iniciarSesionDemo(perfil) {
  const cred = await signInAnonymously(auth);
  // Guardar el perfil demo elegido para que las reglas puedan leer perfilDefault
  const ref = doc(db, 'usuarios', cred.user.uid);
  await setDoc(ref, {
    email: null,
    nombre: `Demo · ${perfil.nombre}`,
    perfilDefault: perfil.id,
    establecimientoId: perfil.contexto?.id ?? null,
    slepId: perfil.contexto?.tipo === 'slep' ? perfil.contexto.id : null,
    createdAt: serverTimestamp(),
    proveedor: 'anonymous',
    demo: true,
  }, { merge: true });
  return cred.user;
}

export async function iniciarConGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  // Upsert Firestore doc — mantiene la asignación previa si ya existe
  const ref = doc(db, 'usuarios', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: cred.user.email,
      nombre: cred.user.displayName ?? '',
      perfilDefault: 'escuela',
      establecimientoId: null,
      createdAt: serverTimestamp(),
      proveedor: 'google',
    });
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
