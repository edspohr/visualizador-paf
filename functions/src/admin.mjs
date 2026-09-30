// adminPlataforma — callable for the superadmin screens (ADR-0004).
//
// Users, sostenedores and establishments are written here with the Admin SDK
// instead of from the browser: the Firestore rules no longer let a client
// write privileged fields, creating a user does not replace the
// administrator's session, and a change of sostenedor reaches every
// denormalized copy in the same operation.
//
// Request: { accion: <name in ACCIONES>, datos: {...} }. Only superadmins.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ACCIONES, ErrorAdmin } from './adminAcciones.mjs';

if (!getApps().length) initializeApp();

export const adminPlataforma = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    serviceAccount: 'firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
    const db = getFirestore();
    const yo = await db.doc(`usuarios/${uid}`).get();
    if (yo.data()?.perfilDefault !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Solo un superadministrador puede hacer este cambio.');
    }
    const { accion, datos = {} } = request.data ?? {};
    const fn = Object.hasOwn(ACCIONES, accion) ? ACCIONES[accion] : null;
    if (!fn) throw new HttpsError('invalid-argument', 'Acción desconocida.');
    try {
      const resultado = await fn(datos, { db, auth: getAuth(), uid });
      // Never log `datos`: crearUsuario carries a password.
      logger.info('adminPlataforma', { accion, uid, id: resultado?.id ?? resultado?.uid ?? null });
      return resultado;
    } catch (err) {
      if (err instanceof ErrorAdmin) throw new HttpsError(err.code, err.message);
      logger.error('adminPlataforma falló', { accion, uid, error: String(err?.stack ?? err) });
      throw new HttpsError('internal', 'No se pudo completar la operación.');
    }
  },
);
