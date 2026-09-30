// Registry of establishments and sostenedores for the scripts and the admin
// Cloud Function: the pure rules live in src/lib/registro.js (shared with the
// frontend); this adds the Firestore loader. Functions receive `db`.

export * from '../../src/lib/registro.js';

// ─── Firestore loaders ────────────────────────────────────────────────────

/** @returns {{ establecimientos: Map<id, doc>, sostenedores: Array<{id, nombre, alias}> }} */
export async function cargarRegistro(db, programa) {
  const [estSnap, sosSnap] = await Promise.all([
    db.collection('establecimientos_real').where('programa', '==', programa).get(),
    db.collection('sostenedores_real').get(),
  ]);
  return {
    establecimientos: new Map(estSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }])),
    sostenedores: sosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}
