// Daily status email of the nightly pipeline (requested by Edmundo,
// 2026-09-28, for the first weeks of operation).
//
// Three states, visible in the subject and in a colored banner:
//   🟢 OK         — all steps ran, numbers in line with the previous run.
//   🟡 ATENCIÓN   — all steps ran, but something looks off (fewer
//                   establishments/indicators/docs than the previous run,
//                   planillas that could not be read, >100% values, a new or
//                   missing establishment — ADR-0003).
//   🔴 FALLÓ      — a step failed; the site keeps the previous data.
//
// Sending: Gmail SMTP with an app password (SMTP_USER / SMTP_PASSWORD, the
// latter a Firebase secret). Without credentials the email is only logged.
// PIPELINE_CORREO = 'diario' (default: every run) | 'solo-problemas'.

const SITIO = 'https://visualizador-paf.web.app';
const ADMIN = `${SITIO}/establecimientos`;
const LOGS = 'https://console.cloud.google.com/run/detail/us-central1/pipelinenocturno/logs?project=visualizador-paf';
const FIRESTORE = 'https://console.firebase.google.com/project/visualizador-paf/firestore/databases/-default-/data/~2Fconfig~2FpipelineMetadata';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fechaChile = (d) => new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(d);
const dur = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

/**
 * Compares today's summary with the previous run and returns the list of
 * things to look at (empty = all normal).
 */
export function detectarAdvertencias(resumen, anterior) {
  const a = [];
  const p = resumen.parvulario, e = resumen.escolar;
  if (p) {
    if (anterior?.parvulario && p.jardines < anterior.parvulario.jardines) a.push(`Parvularia: se cargaron ${p.jardines} jardines (en la carga anterior fueron ${anterior.parvulario.jardines}).`);
    if (anterior?.parvulario && p.docsJardin < anterior.parvulario.docsJardin * 0.9) a.push(`Parvularia: ${p.docsJardin} valores por jardín, bajó más de 10 % respecto de la carga anterior (${anterior.parvulario.docsJardin}).`);
    if (anterior?.parvulario && p.indicadores < anterior.parvulario.indicadores) a.push(`Parvularia: ${p.indicadores} indicadores con datos (antes ${anterior.parvulario.indicadores}).`);
    if (p.marcadosSinDato > 20) a.push(`Parvularia: ${p.marcadosSinDato} valores quedaron sin dato porque ya no vienen en las planillas.`);
    // Known, recurring issues (e.g. the 2025 Central's I.12 counts) only warn when they grow.
    if (p.fueraDeRango > (anterior?.parvulario?.fueraDeRango ?? 0)) a.push(`Parvularia: ${p.fueraDeRango} celdas con porcentajes sobre 100 % en las planillas centrales (antes ${anterior?.parvulario?.fueraDeRango ?? 0}; ver detalle).`);
  }
  if (e) {
    if (anterior?.escolar && e.escuelas < anterior.escolar.escuelas) a.push(`Educación Básica: se cargaron ${e.escuelas} escuelas (en la carga anterior fueron ${anterior.escolar.escuelas}).`);
    if (anterior?.escolar && e.docs < anterior.escolar.docs * 0.9) a.push(`Educación Básica: ${e.docs} valores, bajó más de 10 % respecto de la carga anterior (${anterior.escolar.docs}).`);
    if (anterior?.escolar && e.indicadores < anterior.escolar.indicadores) a.push(`Educación Básica: ${e.indicadores} indicadores con datos (antes ${anterior.escolar.indicadores}).`);
    if (e.marcadosSinDato > 20) a.push(`Educación Básica: ${e.marcadosSinDato} valores quedaron sin dato porque ya no vienen en las planillas.`);
    if (e.erroresLectura > (anterior?.escolar?.erroresLectura ?? 0)) a.push(`Educación Básica: ${e.erroresLectura} planillas o pestañas no se pudieron leer (antes ${anterior?.escolar?.erroresLectura ?? 0}): permisos, enlace roto o pestaña renombrada. Ver detalle.`);
  }
  // Registry of establishments (ADR-0003). A new establishment always warns;
  // the rest only on the night the situation first shows up, so an open item
  // does not turn every email yellow (it stays listed in its own section).
  for (const [prog, et] of Object.entries(PROGRAMA_ETIQUETA)) {
    const r = resumen.establecimientos?.[prog];
    if (!r) continue;
    const ant = anterior?.establecimientos?.[prog];
    const recientes = (lista, previa, clave = x => x.id) => (lista ?? []).filter(x => !(previa ?? []).some(y => clave(y) === clave(x)));
    for (const n of r.nuevos ?? []) {
      a.push(`${et}: establecimiento nuevo «${n.nombre}»${n.cohorte ? ` (cohorte ${n.cohorte})` : ''}. Ya está publicado.${n.faltan?.length ? ` Falta completar en la plataforma: ${n.faltan.join(', ')}.` : ''}`);
    }
    for (const d of recientes(r.desaparecidos, ant?.desaparecidos)) {
      a.push(`${et}: «${d.nombre}» dejó de aparecer en la fuente (carpeta o fila eliminada o renombrada). Sus datos anteriores se mantienen.`);
    }
    for (const d of recientes(r.sinFuente, ant?.sinFuente)) {
      a.push(`${et}: «${d.nombre}» fue creado en la plataforma y todavía no se encuentra en las planillas. Se mostrará cuando aparezca con ese nombre.`);
    }
    for (const n of recientes(r.sostenedoresDesconocidos, ant?.sostenedoresDesconocidos, x => x)) {
      a.push(`${et}: el sostenedor «${n}» viene en las planillas pero no existe en la plataforma. Crearlo en "Establecimientos y sostenedores".`);
    }
    // `slep` always comes with `sostenedor`, which is the readable one.
    const distintos = (l) => (l ?? []).filter(x => x.campo !== 'slep');
    for (const d of recientes(distintos(r.discrepancias), distintos(ant?.discrepancias), x => `${x.id}|${x.campo}|${x.fuente}`)) {
      a.push(`${et}: «${d.nombre}» tiene ${CAMPO_ETIQUETA[d.campo] ?? d.campo} = ${d.plataforma ?? 'vacío'} en la plataforma y ${d.fuente} en la planilla. Se mantiene el dato de la plataforma.`);
    }
  }
  if (anterior?.slep && resumen.slep?.corregidos > 0) a.push(`Se corrigió el sostenedor en ${resumen.slep.corregidos} valores que no lo traían o lo traían desactualizado.`);
  if (resumen.slep?.huerfanos > (anterior?.slep?.huerfanos ?? 0)) a.push(`Hay valores de ${resumen.slep.huerfanos} establecimientos que no están registrados (ver detalle en los logs).`);
  return a;
}

const PROGRAMA_ETIQUETA = { parvulario: 'Parvularia', escolar: 'Educación Básica' };
const CAMPO_ETIQUETA = { nNinos: 'matrícula', rbd: 'RBD' };

// Open items of the registry, listed every day until someone closes them.
function bloqueRegistro(establecimientos) {
  const filas = [];
  for (const [prog, et] of Object.entries(PROGRAMA_ETIQUETA)) {
    const r = establecimientos?.[prog];
    if (!r) continue;
    for (const x of r.pendientes ?? []) filas.push(`<li style="margin:3px 0">${esc(et)} · <b>${esc(x.nombre)}</b>: falta ${esc(x.faltan.join(', '))}</li>`);
    for (const x of r.sinFuente ?? []) filas.push(`<li style="margin:3px 0">${esc(et)} · <b>${esc(x.nombre)}</b>: creado en la plataforma, aún no aparece en las planillas</li>`);
    for (const x of r.desaparecidos ?? []) filas.push(`<li style="margin:3px 0">${esc(et)} · <b>${esc(x.nombre)}</b>: ya no aparece en las planillas</li>`);
  }
  if (!filas.length) return '';
  return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin:12px 0">
      <p style="margin:0 0 6px;font-weight:700;font-size:14px">Establecimientos con pendientes (${filas.length})</p>
      <ul style="margin:0;padding-left:18px;font-size:13px">${filas.join('')}</ul>
      <p style="margin:8px 0 0;font-size:13px">Se completan en <a href="${ADMIN}">Establecimientos y sostenedores</a>.</p>
    </div>`;
}

export function construirCorreo({ exitoso, fallo, pasos, inicio, fin, resumen, advertencias, detalles = [] }) {
  const estado = !exitoso ? 'falla' : advertencias.length ? 'atencion' : 'ok';
  const cfg = {
    ok: { icono: '🟢', titulo: 'Actualización diaria OK', color: '#15803d', fondo: '#dcfce7', texto: 'Los datos del visualizador se actualizaron correctamente.' },
    atencion: { icono: '🟡', titulo: 'Actualización completada con advertencias', color: '#a16207', fondo: '#fef9c3', texto: 'Los datos se actualizaron, pero hay cosas que revisar.' },
    falla: { icono: '🔴', titulo: 'FALLÓ la actualización diaria', color: '#b91c1c', fondo: '#fee2e2', texto: 'Los datos NO se actualizaron completamente. El visualizador sigue mostrando la última carga exitosa.' },
  }[estado];
  const dia = fechaChile(inicio).split(',')[0];
  const subject = estado === 'falla'
    ? `🔴 FALLÓ · Visualizador PAF · carga ${dia} · paso: ${fallo?.paso ?? 'desconocido'}`
    : estado === 'atencion'
      ? `🟡 ATENCIÓN · Visualizador PAF · carga ${dia} · ${advertencias.length} advertencia${advertencias.length > 1 ? 's' : ''}`
      : `🟢 OK · Visualizador PAF · carga ${dia}`;

  const filasPasos = pasos.map(p => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${p.codigo === 0 ? '✅' : '❌'} ${esc(p.nombre)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">${dur(p.segundos)}</td>
    </tr>`).join('');

  const p = resumen.parvulario, e = resumen.escolar;
  const cifras = [
    p && `Educación Parvularia: <b>${p.jardines}</b> jardines · <b>${p.docsJardin}</b> valores por jardín y <b>${p.docsSala}</b> por sala · <b>${p.indicadores}</b> indicadores con datos`,
    e && `Educación Básica: <b>${e.escuelas}</b> escuelas · <b>${e.docs}</b> valores · <b>${e.indicadores}</b> de 51 indicadores con datos`,
    resumen.promedios && `Promedios del territorio: <b>${resumen.promedios.total}</b> calculados (${resumen.promedios.publicables} visibles)`,
    resumen.cierre && `Cierre mensual <b>${esc(resumen.cierre.periodo)}</b> guardado (${resumen.cierre.docs} valores) · visible para Fundación CAP desde el día 16`,
  ].filter(Boolean).map(t => `<li style="margin:4px 0">${t}</li>`).join('');

  const bloqueFalla = estado === 'falla' ? `
    <div style="border:2px solid #b91c1c;border-radius:10px;padding:14px 16px;margin:16px 0;background:#fff">
      <p style="margin:0 0 6px;font-weight:700;color:#b91c1c;font-size:16px">Qué falló</p>
      <p style="margin:0 0 4px">Paso: <b>${esc(fallo?.paso)}</b> (código ${esc(fallo?.codigo)})</p>
      <pre style="white-space:pre-wrap;background:#f9fafb;border-radius:6px;padding:10px;font-size:12px;margin:8px 0">${esc(fallo?.detalle)}</pre>
      <p style="margin:10px 0 4px;font-weight:700">Qué hacer</p>
      <ol style="margin:0;padding-left:18px">
        <li>Revisar el log completo: <a href="${LOGS}">logs de pipelineNocturno</a>.</li>
        <li>Si es un permiso o enlace de planilla, corregirlo en Drive y volver a correr: <code>gcloud scheduler jobs run firebase-schedule-pipelineNocturno-us-central1 --location us-central1 --project visualizador-paf</code></li>
        <li>Si es un error del código, correr en local <code>node scripts/runPipeline.mjs --sin-cierre</code> para reproducirlo.</li>
      </ol>
      <p style="margin:10px 0 0;color:#6b7280;font-size:13px">Mientras tanto, los usuarios ven los datos de la última carga exitosa y la fecha "Datos actualizados al …" no cambia.</p>
    </div>` : '';

  const bloqueAdv = advertencias.length ? `
    <div style="border:2px solid #a16207;border-radius:10px;padding:14px 16px;margin:16px 0;background:#fff">
      <p style="margin:0 0 6px;font-weight:700;color:#a16207;font-size:16px">Para revisar</p>
      <ul style="margin:0;padding-left:18px">${advertencias.map(t => `<li style="margin:4px 0">${esc(t)}</li>`).join('')}</ul>
    </div>` : '';

  const bloqueDetalle = detalles.length ? `
    <details style="margin-top:12px"><summary style="cursor:pointer;color:#6b7280">Detalle técnico (${detalles.length})</summary>
      <ul style="font-size:12px;color:#374151">${detalles.slice(0, 40).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </details>` : '';

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:640px;margin:0 auto;padding:20px 16px">
    <div style="background:${cfg.color};color:#fff;border-radius:12px;padding:20px 22px">
      <p style="margin:0;font-size:13px;opacity:.85;letter-spacing:.04em">VISUALIZADOR PAF · CARGA DIARIA</p>
      <p style="margin:6px 0 0;font-size:24px;font-weight:700">${cfg.icono} ${cfg.titulo}</p>
      <p style="margin:6px 0 0;font-size:15px">${cfg.texto}</p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px 22px;margin-top:12px">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px">Inicio ${esc(fechaChile(inicio))} · término ${esc(fechaChile(fin))} · duración ${dur(Math.round((fin - inicio) / 1000))}</p>
      ${bloqueFalla}${bloqueAdv}
      ${cifras ? `<ul style="padding-left:18px;margin:12px 0">${cifras}</ul>` : ''}
      ${bloqueRegistro(resumen.establecimientos)}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">${filasPasos}</table>
      ${bloqueDetalle}
      <p style="margin:16px 0 0;font-size:13px"><a href="${SITIO}">Abrir el visualizador</a> · <a href="${LOGS}">Logs</a> · <a href="${FIRESTORE}">Estado en Firestore</a></p>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin:10px 4px">Correo automático de la función pipelineNocturno. Para recibir solo avisos de problemas, cambiar PIPELINE_CORREO a "solo-problemas" en functions/.env.</p>
  </div></body></html>`;

  const text = [
    `${cfg.icono} ${cfg.titulo}`, cfg.texto,
    fallo ? `Paso que falló: ${fallo.paso} (código ${fallo.codigo})\n${fallo.detalle}` : '',
    ...advertencias.map(t => `- ${t}`),
    ...pasos.map(p => `${p.codigo === 0 ? 'OK ' : 'ERR'} ${p.nombre} (${dur(p.segundos)})`),
    `Logs: ${LOGS}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text, estado };
}

export async function enviarCorreo(correo) {
  const modo = process.env.PIPELINE_CORREO || 'diario';
  if (modo === 'solo-problemas' && correo.estado === 'ok') return { enviado: false, motivo: 'solo-problemas' };
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASSWORD;
  // One or more recipients, comma-separated.
  const to = (process.env.PIPELINE_EMAIL_TO || user || '').split(',').map(x => x.trim()).filter(Boolean).join(', ');
  if (!user || !pass || !to) {
    console.log(`[correo] Sin credenciales SMTP: no se envía. Asunto: ${correo.subject}`);
    return { enviado: false, motivo: 'sin credenciales' };
  }
  const { default: nodemailer } = await import('nodemailer');
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
  await t.sendMail({
    from: `"Visualizador PAF" <${user}>`,
    to,
    subject: correo.subject,
    text: correo.text,
    html: correo.html,
    priority: correo.estado === 'falla' ? 'high' : 'normal',
  });
  console.log(`[correo] Enviado a ${to}: ${correo.subject}`);
  return { enviado: true };
}
