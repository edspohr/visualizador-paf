// Administrative actions of the platform (ADR-0002, ADR-0004): users,
// sostenedores and establishments. Called only through the `adminPlataforma`
// callable (functions/src/admin.mjs), which has already verified that the
// caller is a superadmin.
//
// Kept free of firebase-functions so the actions can be exercised against
// any Firestore/Auth instance: each one receives (datos, { db, auth, uid }).
//
// The registry helpers come from the pipeline bundle so ids, platform-owned
// fields and SLEP resolution are the same code the nightly ingests run.

import { FieldValue } from 'firebase-admin/firestore';
import {
  PROGRAMAS, COHORTES, CAMPOS_EDITABLES, establecimientoId, nuevoSlepId, esperaFuente,
} from '../pipeline/scripts/lib/establecimientosRegistro.mjs';
import { comunaCanonica } from '../pipeline/src/lib/comunas.js';

export class ErrorAdmin extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const invalido = (m) => new ErrorAdmin('invalid-argument', m);

const PERFILES_ASIGNABLES = ['escuela', 'jardin', 'sostenedor', 'consultor', 'cap', 'superadmin', 'pendiente'];
const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const clave = (s) => texto(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function enLotes(db, refs, patch) {
  let batch = db.batch(); let n = 0;
  for (const ref of refs) {
    batch.set(ref, patch, { merge: true });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400) await batch.commit();
  return n;
}

// ─── Users ────────────────────────────────────────────────────────────────

// Assignment fields for a profile. jardin/escuela carry the SLEP of their
// establishment (rules and peer averages need it); a sostenedor has exactly
// one SLEP, which must exist in the catalog.
async function asignacion(db, perfil, { establecimientoId: estId, slepId }) {
  if (perfil === 'escuela' || perfil === 'jardin') {
    if (!estId) return { establecimientoId: null, slepId: null };
    const est = await db.doc(`establecimientos_real/${estId}`).get();
    if (!est.exists) throw invalido('El establecimiento seleccionado no existe.');
    const programa = perfil === 'escuela' ? 'escolar' : 'parvulario';
    if (est.data().programa !== programa) throw invalido('El establecimiento no corresponde al perfil elegido.');
    return { establecimientoId: estId, slepId: est.data().slep ?? null };
  }
  if (perfil === 'sostenedor') {
    if (!slepId) return { establecimientoId: null, slepId: null };
    const sos = await db.doc(`sostenedores_real/${slepId}`).get();
    if (!sos.exists) throw invalido('El sostenedor seleccionado no existe.');
    return { establecimientoId: null, slepId };
  }
  return { establecimientoId: null, slepId: null };
}

async function crearUsuario(datos, { db, auth }) {
  const email = texto(datos.email).toLowerCase();
  const nombre = texto(datos.nombre);
  const perfil = datos.perfilDefault;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw invalido('El correo no es válido.');
  if (String(datos.password ?? '').length < 6) throw invalido('La contraseña debe tener al menos 6 caracteres.');
  if (!PERFILES_ASIGNABLES.includes(perfil)) throw invalido('Perfil desconocido.');
  const asignado = await asignacion(db, perfil, datos);

  let user;
  try {
    user = await auth.createUser({ email, password: String(datos.password), displayName: nombre || undefined });
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') throw new ErrorAdmin('already-exists', 'Ya existe una cuenta con ese correo.');
    if (err?.code === 'auth/invalid-email') throw invalido('El correo no es válido.');
    throw err;
  }
  await db.doc(`usuarios/${user.uid}`).set({
    email, nombre, perfilDefault: perfil, ...asignado,
    createdAt: FieldValue.serverTimestamp(), proveedor: 'password', creadoPor: 'superadmin',
  });
  return { uid: user.uid };
}

// Changing a user's profile or assignment goes through here too, so the SLEP
// of the establishment is always derived on the server.
async function actualizarUsuario(datos, { db }) {
  const ref = db.doc(`usuarios/${texto(datos.uid)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ErrorAdmin('not-found', 'El usuario no existe.');
  const perfil = datos.perfilDefault ?? snap.data().perfilDefault;
  if (!PERFILES_ASIGNABLES.includes(perfil)) throw invalido('Perfil desconocido.');
  const patch = { perfilDefault: perfil };
  if ('establecimientoId' in datos || 'slepId' in datos || perfil !== snap.data().perfilDefault) {
    Object.assign(patch, await asignacion(db, perfil, {
      establecimientoId: 'establecimientoId' in datos ? datos.establecimientoId : null,
      slepId: 'slepId' in datos ? datos.slepId : null,
    }));
  }
  if (Array.isArray(datos.establecimientoIds)) patch.establecimientoIds = datos.establecimientoIds.map(String);
  await ref.set(patch, { merge: true });
  return { uid: ref.id, ...patch };
}

async function eliminarUsuario(datos, { db, auth, uid }) {
  const objetivo = texto(datos.uid);
  if (!objetivo) throw invalido('Falta el usuario.');
  if (objetivo === uid) throw new ErrorAdmin('failed-precondition', 'No puedes eliminar tu propia cuenta.');
  await db.doc(`usuarios/${objetivo}`).delete();
  try { await auth.deleteUser(objetivo); } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  return { uid: objetivo };
}

// ─── Sostenedores ─────────────────────────────────────────────────────────

async function guardarSostenedor(datos, { db, uid }) {
  const nombre = texto(datos.nombre);
  if (nombre.length < 3) throw invalido('Escribe el nombre del sostenedor.');
  const [sosSnap, estSnap] = await Promise.all([
    db.collection('sostenedores_real').get(),
    db.collection('establecimientos_real').select('slep').get(),
  ]);
  const repetido = sosSnap.docs.find(d => d.id !== datos.id && clave(d.data().nombre) === clave(nombre));
  if (repetido) throw new ErrorAdmin('already-exists', 'Ya existe un sostenedor con ese nombre.');

  if (!datos.id) {
    const usados = [...sosSnap.docs.map(d => d.id), ...estSnap.docs.map(d => d.data().slep).filter(Boolean)];
    const id = nuevoSlepId(nombre, usados);
    await db.doc(`sostenedores_real/${id}`).set({
      nombre, alias: [], origen: 'plataforma', createdAt: FieldValue.serverTimestamp(), creadoPor: uid,
    });
    return { id, nombre };
  }

  const actual = sosSnap.docs.find(d => d.id === datos.id);
  if (!actual) throw new ErrorAdmin('not-found', 'El sostenedor no existe.');
  const anterior = actual.data().nombre;
  if (anterior === nombre) return { id: datos.id, nombre };
  // The previous name stays as an alias: planillas that still use it keep resolving to this SLEP.
  await actual.ref.set({ nombre, alias: FieldValue.arrayUnion(anterior), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const ests = await db.collection('establecimientos_real').where('slep', '==', datos.id).get();
  await enLotes(db, ests.docs.map(d => d.ref), { sostenedor: nombre });
  return { id: datos.id, nombre, establecimientos: ests.size };
}

async function eliminarSostenedor(datos, { db }) {
  const id = texto(datos.id);
  const [ests, usuarios] = await Promise.all([
    db.collection('establecimientos_real').where('slep', '==', id).limit(1).get(),
    db.collection('usuarios').where('slepId', '==', id).limit(1).get(),
  ]);
  if (!ests.empty) throw new ErrorAdmin('failed-precondition', 'El sostenedor tiene establecimientos asignados.');
  if (!usuarios.empty) throw new ErrorAdmin('failed-precondition', 'El sostenedor tiene usuarios asignados.');
  await db.doc(`sostenedores_real/${id}`).delete();
  return { id };
}

// ─── Establishments ───────────────────────────────────────────────────────

// Normalizes the editable fields present in `datos`. Returns only those keys.
async function camposEstablecimiento(db, programa, datos) {
  const c = {};
  if ('nombre' in datos) {
    c.nombre = texto(datos.nombre);
    if (c.nombre.length < 3) throw invalido('Escribe el nombre del establecimiento.');
  }
  if ('cohorte' in datos) {
    c.cohorte = texto(datos.cohorte) || null;
    if (c.cohorte && !COHORTES[programa].includes(c.cohorte)) throw invalido('La cohorte no corresponde al programa.');
  }
  if ('slep' in datos) {
    c.slep = texto(datos.slep) || null;
    c.sostenedor = null;
    if (c.slep) {
      const sos = await db.doc(`sostenedores_real/${c.slep}`).get();
      if (!sos.exists) throw invalido('El sostenedor seleccionado no existe.');
      c.sostenedor = sos.data().nombre;
    }
  }
  if ('comuna' in datos) c.comuna = comunaCanonica(datos.comuna);
  if ('rbd' in datos) {
    c.rbd = texto(datos.rbd) || null;
    if (c.rbd && !/^\d{1,8}(-[0-9kK])?$/.test(c.rbd)) throw invalido('El RBD debe ser un número (por ejemplo 9876 o 9876-5).');
  }
  if ('nNinos' in datos) {
    const vacio = datos.nNinos === '' || datos.nNinos == null;
    c.nNinos = vacio ? null : Number(datos.nNinos);
    if (!vacio && (!Number.isInteger(c.nNinos) || c.nNinos < 0)) throw invalido('La matrícula debe ser un número entero.');
  }
  return c;
}

// Values, quarterly progress and the users of the establishment carry its
// SLEP (ADR-0001); they follow it immediately when it changes.
async function propagarSlep(db, estId, slep) {
  const [res, prog, usr] = await Promise.all([
    db.collection('resultados_real').where('establecimientoId', '==', estId).select().get(),
    db.collection('progresoTrimestral_real').where('establecimientoId', '==', estId).select().get(),
    db.collection('usuarios').where('establecimientoId', '==', estId).get(),
  ]);
  const valores = await enLotes(db, [...res.docs, ...prog.docs].map(d => d.ref), { slep });
  const perfiles = usr.docs.filter(d => ['jardin', 'escuela'].includes(d.data().perfilDefault));
  await enLotes(db, perfiles.map(d => d.ref), { slepId: slep });
  return { valores, usuarios: perfiles.length };
}

async function guardarEstablecimiento(datos, { db, uid }) {
  if (!datos.id) {
    const programa = datos.programa;
    if (!PROGRAMAS.includes(programa)) throw invalido('Elige el programa.');
    const campos = await camposEstablecimiento(db, programa, { nombre: '', ...datos });
    const id = establecimientoId(programa, campos.nombre);
    const ref = db.doc(`establecimientos_real/${id}`);
    if ((await ref.get()).exists) throw new ErrorAdmin('already-exists', 'Ya existe un establecimiento con ese nombre.');
    const conValor = Object.fromEntries(Object.entries(campos).filter(([, v]) => v != null && v !== ''));
    await ref.set({
      id, programa, tipo: programa === 'escolar' ? 'Escuela' : 'Jardín',
      ...conValor,
      camposPlataforma: Object.keys(conValor).filter(k => CAMPOS_EDITABLES.includes(k)),
      origen: 'plataforma', createdAt: FieldValue.serverTimestamp(), creadoPor: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id, creado: true };
  }

  const ref = db.doc(`establecimientos_real/${texto(datos.id)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ErrorAdmin('not-found', 'El establecimiento no existe.');
  const actual = snap.data();
  const campos = await camposEstablecimiento(db, actual.programa, datos);
  // Compared as text: the ingests store some of these as numbers (rbd, nNinos).
  const cambios = Object.fromEntries(Object.entries(campos).filter(([k, v]) => String(actual[k] ?? '') !== String(v ?? '')));
  if (!Object.keys(cambios).length) return { id: ref.id, cambios: [] };
  await ref.set({
    ...cambios,
    camposPlataforma: FieldValue.arrayUnion(...Object.keys(cambios)),
    updatedAt: FieldValue.serverTimestamp(), editadoPor: uid,
  }, { merge: true });
  const propagado = 'slep' in cambios ? await propagarSlep(db, ref.id, cambios.slep) : null;
  return { id: ref.id, cambios: Object.keys(cambios), propagado };
}

// An establishment created in the platform ahead of time anchors to its
// source by name. When the names differ the load registers the source as a
// new establishment; this joins both: the one with data stays and receives
// what was filled in the platform, the placeholder goes away.
async function unirEstablecimientos(datos, { db, uid }) {
  const [origen, destino] = await Promise.all([
    db.doc(`establecimientos_real/${texto(datos.origenId)}`).get(),
    db.doc(`establecimientos_real/${texto(datos.destinoId)}`).get(),
  ]);
  if (!origen.exists || !destino.exists) throw new ErrorAdmin('not-found', 'El establecimiento no existe.');
  if (origen.id === destino.id) throw invalido('Elige dos establecimientos distintos.');
  const o = origen.data(), d = destino.data();
  if (!esperaFuente(o)) throw new ErrorAdmin('failed-precondition', 'Solo se puede unir un establecimiento creado en la plataforma que aún no tiene datos.');
  if (o.programa !== d.programa) throw invalido('Los establecimientos son de programas distintos.');

  const heredados = (o.camposPlataforma ?? []).filter(k => k !== 'nombre' && o[k] != null);
  const patch = Object.fromEntries(heredados.map(k => [k, o[k]]));
  if (heredados.length) {
    await destino.ref.set({
      ...patch, camposPlataforma: FieldValue.arrayUnion(...heredados),
      updatedAt: FieldValue.serverTimestamp(), editadoPor: uid,
    }, { merge: true });
  }
  const slepFinal = 'slep' in patch ? patch.slep : (d.slep ?? null);
  if ('slep' in patch && patch.slep !== (d.slep ?? null)) await propagarSlep(db, destino.id, patch.slep);

  const [directos, consultores] = await Promise.all([
    db.collection('usuarios').where('establecimientoId', '==', origen.id).get(),
    db.collection('usuarios').where('establecimientoIds', 'array-contains', origen.id).get(),
  ]);
  await enLotes(db, directos.docs.map(x => x.ref), { establecimientoId: destino.id, slepId: slepFinal });
  for (const c of consultores.docs) {
    const ids = [...new Set(c.data().establecimientoIds.map(id => (id === origen.id ? destino.id : id)))];
    await c.ref.set({ establecimientoIds: ids }, { merge: true });
  }
  await origen.ref.delete();
  return { id: destino.id, heredados, usuarios: directos.size + consultores.size };
}

async function eliminarEstablecimiento(datos, { db }) {
  const ref = db.doc(`establecimientos_real/${texto(datos.id)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ErrorAdmin('not-found', 'El establecimiento no existe.');
  if (!esperaFuente(snap.data())) throw new ErrorAdmin('failed-precondition', 'Solo se puede eliminar un establecimiento creado en la plataforma que aún no tiene datos.');
  const usuarios = await db.collection('usuarios').where('establecimientoId', '==', ref.id).limit(1).get();
  if (!usuarios.empty) throw new ErrorAdmin('failed-precondition', 'El establecimiento tiene usuarios asignados.');
  await ref.delete();
  return { id: ref.id };
}

export const ACCIONES = {
  crearUsuario, actualizarUsuario, eliminarUsuario,
  guardarSostenedor, eliminarSostenedor,
  guardarEstablecimiento, unirEstablecimientos, eliminarEstablecimiento,
};
