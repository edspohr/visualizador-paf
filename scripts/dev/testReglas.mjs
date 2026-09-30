#!/usr/bin/env node
// Checks the Firestore rules and the adminPlataforma function against the
// local emulators, signing in as each test profile with the web SDK (the same
// path a browser takes). Needs `npm run emuladores` + `npm run emuladores:seed`.
//
//   npm run test:reglas
//
// Exit 1 on the first unexpected result. It writes to the emulators only: the
// demo project id and the emulator hosts are set before anything connects.

import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, collection, query, where,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const adminApp = (await import('firebase-admin/app')).initializeApp({ projectId: 'demo-paf' });
const adb = (await import('firebase-admin/firestore')).getFirestore(adminApp);
const aauth = (await import('firebase-admin/auth')).getAuth(adminApp);

const app = initializeApp({ apiKey: 'demo', projectId: 'demo-paf' });
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);
const admin = httpsCallable(functions, 'adminPlataforma');

const CLAVE = process.env.PAF_EMULADOR_CLAVE || 'emulador-paf';
const entrar = async (perfil) => (await signInWithEmailAndPassword(auth, `${perfil}@prueba.test`, CLAVE)).user;

let ok = 0;
const fallos = [];
async function espera(nombre, permitido, fn) {
  let pudo = true, detalle = '';
  try { await fn(); } catch (e) { pudo = false; detalle = e.code ?? e.message; }
  if (pudo === permitido) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos.push(nombre); console.log(`  ✗ ${nombre} — esperado ${permitido ? 'permitido' : 'denegado'}, fue ${pudo ? 'permitido' : `denegado (${detalle})`}`); }
}
const igual = (nombre, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos.push(nombre); console.log(`  ✗ ${nombre} — ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); }
};

const ests = (await adb.collection('establecimientos_real').get()).docs.map(d => ({ id: d.id, ...d.data() }));

// ─── Rules: a user cannot change their own profile or assignment ─────────
console.log('\nReglas · usuarios');
let u = await entrar('pendiente');
await espera('pendiente no puede hacerse superadmin', false, () => setDoc(doc(db, 'usuarios', u.uid), { perfilDefault: 'superadmin' }, { merge: true }));
await espera('pendiente no puede hacerse consultor', false, () => setDoc(doc(db, 'usuarios', u.uid), { perfilDefault: 'consultor' }, { merge: true }));
await espera('pendiente puede cambiar su nombre', true, () => setDoc(doc(db, 'usuarios', u.uid), { nombre: 'Otro nombre' }, { merge: true }));
await espera('pendiente no lee establecimientos', false, () => getDocs(collection(db, 'establecimientos_real')));

u = await entrar('jardin');
const miJardin = (await getDoc(doc(db, 'usuarios', u.uid))).data();
const otroJardin = ests.find(e => e.programa === 'parvulario' && e.id !== miJardin.establecimientoId);
await espera('jardín no puede reasignarse a otro jardín', false, () => setDoc(doc(db, 'usuarios', u.uid), { establecimientoId: otroJardin.id }, { merge: true }));
await espera('jardín no puede cambiar su slepId', false, () => setDoc(doc(db, 'usuarios', u.uid), { slepId: 'SLEP-XX' }, { merge: true }));
await espera('jardín lee su establecimiento', true, () => getDoc(doc(db, 'establecimientos_real', miJardin.establecimientoId)));
await espera('jardín no lee otro establecimiento', false, () => getDoc(doc(db, 'establecimientos_real', otroJardin.id)));
await espera('jardín lee el catálogo de sostenedores', true, () => getDocs(collection(db, 'sostenedores_real')));
await espera('jardín no escribe el catálogo de sostenedores', false, () => setDoc(doc(db, 'sostenedores_real', 'SLEP-ZZ'), { nombre: 'x' }));

console.log('\nReglas · registro inicial');
const sello = Date.now();
let nuevo = (await createUserWithEmailAndPassword(auth, `nuevo-${sello}@prueba.test`, CLAVE)).user;
await espera('registro como superadmin denegado', false, () => setDoc(doc(db, 'usuarios', nuevo.uid), { email: nuevo.email, perfilDefault: 'superadmin', establecimientoId: null }));
await espera('registro como pendiente con asignación denegado', false, () => setDoc(doc(db, 'usuarios', nuevo.uid), { email: nuevo.email, perfilDefault: 'pendiente', establecimientoId: otroJardin.id }));
await espera('registro como pendiente permitido', true, () => setDoc(doc(db, 'usuarios', nuevo.uid), { email: nuevo.email, perfilDefault: 'pendiente', establecimientoId: null }));

// Whitelisted email: only counts when the provider verified it.
for (const [verificado, permitido] of [[false, false], [true, true]]) {
  const email = `speters@focus.cl`;
  try { await aauth.deleteUser((await aauth.getUserByEmail(email)).uid); } catch { /* not there yet */ }
  await aauth.createUser({ email, password: CLAVE, emailVerified: verificado });
  nuevo = (await signInWithEmailAndPassword(auth, email, CLAVE)).user;
  await espera(`whitelist ${verificado ? 'verificada' : 'sin verificar'} → superadmin ${permitido ? 'permitido' : 'denegado'}`, permitido,
    () => setDoc(doc(db, 'usuarios', nuevo.uid), { email, perfilDefault: 'superadmin', establecimientoId: null }));
  await adb.doc(`usuarios/${nuevo.uid}`).delete();
}

console.log('\nReglas · sostenedor');
u = await entrar('sostenedor');
const miSlep = (await getDoc(doc(db, 'usuarios', u.uid))).data().slepId;
const otroSlep = ests.find(e => e.slep && e.slep !== miSlep).slep;
await espera('sostenedor lee los valores de su red', true, () => getDocs(query(collection(db, 'resultados_real'), where('slep', '==', miSlep), where('anio', '==', 2026))));
await espera('sostenedor no lee los valores de otra red', false, () => getDocs(query(collection(db, 'resultados_real'), where('slep', '==', otroSlep), where('anio', '==', 2026))));
await espera('sostenedor no puede cambiar de red', false, () => setDoc(doc(db, 'usuarios', u.uid), { slepId: otroSlep }, { merge: true }));

console.log('\nReglas · superadmin');
u = await entrar('superadmin');
await espera('superadmin "ver como": cambia su propio contexto', true, () => setDoc(doc(db, 'usuarios', u.uid), { slepId: miSlep, establecimientoId: null }, { merge: true }));
await espera('superadmin no escribe establecimientos desde el navegador', false, () => setDoc(doc(db, 'establecimientos_real', 'esc-x'), { nombre: 'x' }));

// ─── adminPlataforma ──────────────────────────────────────────────────────
console.log('\nFunción adminPlataforma');
await entrar('consultor');
await espera('consultor no puede usar la función', false, () => admin({ accion: 'guardarSostenedor', datos: { nombre: 'SLEP Intruso' } }));

await entrar('superadmin');
const slep = (await admin({ accion: 'guardarSostenedor', datos: { nombre: `SLEP Prueba Norte ${sello}` } })).data;
igual('sostenedor nuevo recibe código', slep.id.startsWith('SLEP-PN'), true);
await espera('sostenedor con nombre repetido denegado', false, () => admin({ accion: 'guardarSostenedor', datos: { nombre: `slep prueba norte ${sello}` } }));

const usr = (await admin({ accion: 'crearUsuario', datos: { email: `sost-${sello}@prueba.test`, password: CLAVE, nombre: 'Sostenedor nuevo', perfilDefault: 'sostenedor', slepId: slep.id } })).data;
igual('usuario sostenedor se crea con su SLEP (sin establecimientos aún)', (await adb.doc(`usuarios/${usr.uid}`).get()).data().slepId, slep.id);
igual('la sesión del superadmin no cambia al crear un usuario', auth.currentUser.email, 'superadmin@prueba.test');
await espera('correo repetido denegado', false, () => admin({ accion: 'crearUsuario', datos: { email: `sost-${sello}@prueba.test`, password: CLAVE, perfilDefault: 'pendiente' } }));

const escuela = ests.find(e => e.programa === 'escolar' && e.slep);
let r = (await admin({ accion: 'actualizarUsuario', datos: { uid: usr.uid, perfilDefault: 'escuela', establecimientoId: escuela.id } })).data;
igual('cambio a perfil escuela deriva el SLEP del establecimiento', [r.establecimientoId, r.slepId], [escuela.id, escuela.slep]);
r = (await admin({ accion: 'actualizarUsuario', datos: { uid: usr.uid, perfilDefault: 'sostenedor' } })).data;
igual('cambio de perfil limpia la asignación anterior', [r.establecimientoId, r.slepId], [null, null]);
r = (await admin({ accion: 'actualizarUsuario', datos: { uid: usr.uid, slepId: otroSlep } })).data;
igual('sostenedor se reasigna a otro SLEP', r.slepId, otroSlep);
await espera('jardín de otro programa no se asigna a perfil escuela', false, () => admin({ accion: 'actualizarUsuario', datos: { uid: usr.uid, perfilDefault: 'escuela', establecimientoId: otroJardin.id } }));

// Establishment created ahead of its source, then edited.
const creado = (await admin({ accion: 'guardarEstablecimiento', datos: { programa: 'escolar', nombre: `Escuela Prueba ${sello}`, slep: slep.id, comuna: 'pac', nNinos: '120', rbd: '9876' } })).data;
let est = (await adb.doc(`establecimientos_real/${creado.id}`).get()).data();
igual('establecimiento nuevo: id por nombre, comuna canónica, origen plataforma', [creado.id, est.comuna, est.origen, est.sostenedor], [`esc-prueba-${sello}`, 'Pedro Aguirre Cerda', 'plataforma', `SLEP Prueba Norte ${sello}`]);
await espera('establecimiento con nombre repetido denegado', false, () => admin({ accion: 'guardarEstablecimiento', datos: { programa: 'escolar', nombre: `Escuela Prueba ${sello}` } }));
await espera('matrícula no numérica denegada', false, () => admin({ accion: 'guardarEstablecimiento', datos: { id: creado.id, nNinos: 'muchos' } }));
await espera('sostenedor con establecimientos no se elimina', false, () => admin({ accion: 'eliminarSostenedor', datos: { id: slep.id } }));

// Changing the sostenedor of a school with data reaches its values and users.
const antes = (await adb.collection('resultados_real').where('establecimientoId', '==', escuela.id).get()).size;
r = (await admin({ accion: 'guardarEstablecimiento', datos: { id: escuela.id, slep: slep.id } })).data;
const despues = await adb.collection('resultados_real').where('establecimientoId', '==', escuela.id).where('slep', '==', slep.id).get();
igual('cambio de sostenedor llega a todos los valores de la escuela', despues.size, antes);
est = (await adb.doc(`establecimientos_real/${escuela.id}`).get()).data();
igual('los campos editados quedan a cargo de la plataforma', [...est.camposPlataforma].sort(), ['slep', 'sostenedor']);
r = (await admin({ accion: 'guardarEstablecimiento', datos: { id: escuela.id, slep: slep.id, comuna: est.comuna, nNinos: est.nNinos ?? '', rbd: est.rbd ?? '' } })).data;
igual('guardar sin cambios no marca campos', r.cambios, []);

// Join the placeholder with the school the load registered under another name.
r = (await admin({ accion: 'unirEstablecimientos', datos: { origenId: creado.id, destinoId: escuela.id } })).data;
est = (await adb.doc(`establecimientos_real/${escuela.id}`).get()).data();
igual('unir: el destino hereda lo completado y el provisorio desaparece',
  [est.comuna, est.nNinos, String(est.rbd), (await adb.doc(`establecimientos_real/${creado.id}`).get()).exists],
  ['Pedro Aguirre Cerda', 120, '9876', false]);
await espera('un establecimiento con datos no se puede unir ni eliminar', false, () => admin({ accion: 'eliminarEstablecimiento', datos: { id: escuela.id } }));

r = (await admin({ accion: 'guardarSostenedor', datos: { id: slep.id, nombre: `SLEP Prueba Sur ${sello}` } })).data;
est = (await adb.doc(`establecimientos_real/${escuela.id}`).get()).data();
igual('renombrar sostenedor actualiza sus establecimientos y guarda el alias',
  [est.sostenedor, (await adb.doc(`sostenedores_real/${slep.id}`).get()).data().alias], [`SLEP Prueba Sur ${sello}`, [`SLEP Prueba Norte ${sello}`]]);

await admin({ accion: 'eliminarUsuario', datos: { uid: usr.uid } });
let existe = true;
try { await aauth.getUser(usr.uid); } catch { existe = false; }
igual('eliminar usuario quita registro y cuenta', [existe, (await adb.doc(`usuarios/${usr.uid}`).get()).exists], [false, false]);
await espera('superadmin no puede eliminarse a sí mismo', false, () => admin({ accion: 'eliminarUsuario', datos: { uid: auth.currentUser.uid } }));

await signOut(auth);
console.log(`\n${ok} correctas, ${fallos.length} fallidas${fallos.length ? `:\n  - ${fallos.join('\n  - ')}` : ''}`);
process.exit(fallos.length ? 1 : 0);
