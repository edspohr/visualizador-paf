// Cloud Functions v2 para el Visualizador PAF.
//
// pipelineNocturno — carga diaria de datos (L-04 / S-01, decisión D-14):
//   todos los días a las 02:00 hora de Chile corre scripts/runPipeline.mjs,
//   el mismo orquestador que se usa a mano: cargas Parvulario y Escolar,
//   espacios sin dato, promedios del territorio, control de datos personales
//   y, el día 1, el cierre mensual del mes anterior para el perfil CAP.
//   Al terminar envía un correo de estado (🟢 OK / 🟡 ATENCIÓN / 🔴 FALLÓ).
//
// Los scripts se empaquetan en functions/pipeline/ al desplegar
// (scripts/bundlePipeline.mjs, predeploy en firebase.json). Corren con la
// identidad de la cuenta de servicio del proyecto, que ya tiene acceso de
// lectura a las planillas; no se copia ninguna clave.
//
// Reemplaza a syncPlanillasCentrales / syncManual, que escribían en
// colecciones antiguas que el visualizador ya no lee.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER = pathResolve(__dirname, '../pipeline/scripts/runPipeline.mjs');

// Gmail app password of SMTP_USER, for the daily status email
// (scripts/lib/correoPipeline.mjs). Stored in Secret Manager:
//   firebase functions:secrets:set SMTP_PASSWORD --project visualizador-paf
// SMTP_USER, PIPELINE_EMAIL_TO and PIPELINE_CORREO live in functions/.env.
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');

export const pipelineNocturno = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'America/Santiago',
    region: 'us-central1',
    timeoutSeconds: 1800,
    memory: '1GiB',
    maxInstances: 1,
    retryCount: 0,
    serviceAccount: 'firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com',
    secrets: [SMTP_PASSWORD],
  },
  async (event) => {
    logger.info('Pipeline nocturno iniciado', { scheduleTime: event.scheduleTime });
    const code = await new Promise((resolve) => {
      const p = spawn(process.execPath, [RUNNER], {
        env: { ...process.env, PAF_OUTPUT_DIR: '/tmp/paf', SMTP_PASSWORD: SMTP_PASSWORD.value() },
        stdio: 'inherit',
      });
      p.on('close', resolve);
    });
    if (code !== 0) {
      // Cloud Monitoring alert policy matches this message (email to superadmin).
      logger.error(`PIPELINE_FALLIDO: el pipeline terminó con código ${code}`);
      throw new Error(`Pipeline nocturno falló (código ${code})`);
    }
    logger.info('Pipeline nocturno completado');
  },
);
