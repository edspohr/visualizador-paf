// Regla de matrícula para el perfil CAP (Fundación).
//
// La fundación consume snapshots congelados dos veces al año:
//   - Snapshot de mayo → visible junio, julio y agosto.
//   - Snapshot de agosto → visible septiembre a diciembre.
// En enero–mayo aún no hay snapshot vigente para el año, así que se cae al
// valor vivo (`nNinos`) mientras Focus lo confirma en mayo.
//
// Los perfiles no-CAP (consultor, sostenedor, escuela, jardín, superadmin)
// siempre ven el dato vivo — el snapshot es un requerimiento reportado por
// Fundación CAP para estabilizar el informe de cierre.
//
// El pipeline (`scripts/snapshotMatricula.mjs`) escribe los campos
// `nNinosSnapshotMayo`, `nNinosSnapshotMayoFecha`, `nNinosSnapshotMayoAnio`,
// `nNinosSnapshotAgosto`, `nNinosSnapshotAgostoFecha`, `nNinosSnapshotAgostoAnio`
// en `establecimientos_real`. Este helper solo lee.

export function matriculaVisible(est, perfilId, mesEfectivo, anio) {
  const raw = est?.nNinos ?? 0;
  const noCap = perfilId !== 'cap';
  if (noCap || !est) {
    return { valor: raw, fechaCorte: null, esSnapshot: false };
  }

  const snapMayo = pickSnapshot(est, 'Mayo', anio);
  const snapAgosto = pickSnapshot(est, 'Agosto', anio);

  // Mes 1–5: sin snapshot del año todavía → dato vivo.
  if (mesEfectivo <= 5) {
    return { valor: raw, fechaCorte: null, esSnapshot: false };
  }
  // Mes 6–8: snapshot de mayo si existe, si no fallback a vivo.
  if (mesEfectivo <= 8) {
    if (snapMayo) return snapMayo;
    return { valor: raw, fechaCorte: null, esSnapshot: false };
  }
  // Mes 9–12: snapshot de agosto → mayo → vivo.
  if (snapAgosto) return snapAgosto;
  if (snapMayo) return snapMayo;
  return { valor: raw, fechaCorte: null, esSnapshot: false };
}

function pickSnapshot(est, corte, anio) {
  const anioSnap = est[`nNinosSnapshot${corte}Anio`];
  if (anioSnap !== anio) return null;
  const valor = est[`nNinosSnapshot${corte}`];
  if (valor === null || valor === undefined) return null;
  const fecha = est[`nNinosSnapshot${corte}Fecha`] ?? null;
  return { valor, fechaCorte: fecha, esSnapshot: true };
}

// Formatea la fecha de corte (Timestamp de Firestore, Date, o ISO string) a
// dd-MMM-yyyy en es-CL. Devuelve null si no hay fecha reconocible.
export function formatearFechaCorte(fecha) {
  if (!fecha) return null;
  let d;
  if (typeof fecha?.toDate === 'function') d = fecha.toDate();
  else if (fecha instanceof Date) d = fecha;
  else if (typeof fecha === 'string') d = new Date(fecha);
  else return null;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}
