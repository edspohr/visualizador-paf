// Parser de las hojas de detalle por indicador dentro de las Planillas Centrales.
//
// Hojas conocidas (Cohorte 25-26 Año 1):
//   - INDICAD0RES CONSULTOR      → 1 fila/jardín, columnas por indicador de fuente Consultor
//   - IND PRODUCTOS              → 1 fila/jardín, columnas por indicador P1-P4
//   - INDICADORES COORDINADOR    → 1 fila/jardín, incluye matrícula/salas/agentes reales
//   - INDICADORES EXTRAS JARDÍN  → 1 fila/(jardín × sala), granularidad por sala (fuera de scope inicial)
//
// Estrategia:
//   - Fila 1: encabezados con nombres de columnas (incluyen texto del indicador).
//   - Fila 2+: datos, columnas A y B identifican comuna + establecimiento; el resto son valores.
//   - Se mapea cada columna a un indicadorId del catálogo por match de texto.

import { normalizar } from './parserUtil.mjs';

// ─── Columnas de metadata (no son indicadores) ────────────────────────────
const COLS_METADATA = new Set([
  'comuna',
  'identificar sala cuna y o jardin infantil',
  'sala cuna jardin infantil',
  'identificar establecimiento',
  'consultor a',
  'consultora',
  'consultor',
  'nivel',
  'nivel especifico',
]);

// Columnas de INDICADORES COORDINADOR que actualizan el doc del establecimiento
// (no son valores de indicador, sino atributos del establecimiento).
export const COLS_ESTABLECIMIENTO = new Map([
  ['n salas', 'nSalas'],
  ['matricula', 'nNinos'],
  ['n agentes educativas', 'nAgentes'],
]);

// ─── Mapeo columna → indicadorId (por match aproximado con nombres de catálogo) ─

function encontrarIndicador(columnaTexto, indicadores, programa) {
  const target = normalizar(columnaTexto);
  if (!target || target.length < 4) return null;

  // Excluir metadata
  if (COLS_METADATA.has(target)) return null;
  if (COLS_ESTABLECIMIENTO.has(target)) return null;

  const candidatos = indicadores.filter(i => i.programa === programa);

  // Nivel 1: match exacto normalizado
  let match = candidatos.find(ind => normalizar(ind.nombre) === target);
  if (match) return match;

  // Nivel 2: inclusión bidireccional (columna incluye nombre o viceversa)
  // Solo para strings >20 caracteres para evitar false positives
  if (target.length > 20) {
    match = candidatos.find(ind => {
      const nom = normalizar(ind.nombre);
      return (nom.length > 20 && nom.includes(target)) ||
             (target.length > 20 && target.includes(nom));
    });
    if (match) return match;
  }

  // Nivel 3: overlap de tokens significativos (>3 caracteres cada uno).
  // Requiere que al menos 80% de los tokens del nombre del catálogo estén en la columna.
  const targetTokens = new Set(target.split(/\s+/).filter(w => w.length > 3));
  if (targetTokens.size < 3) return null;

  let mejor = null;
  let mejorScore = 0;
  for (const ind of candidatos) {
    const nomTokens = new Set(normalizar(ind.nombre).split(/\s+/).filter(w => w.length > 3));
    if (nomTokens.size < 3) continue;
    const overlap = [...nomTokens].filter(t => targetTokens.has(t)).length;
    const score = overlap / nomTokens.size;
    if (score > mejorScore && score >= 0.65) {
      mejorScore = score;
      mejor = ind;
    }
  }
  return mejor;
}

// ─── Parseo de un valor cell ──────────────────────────────────────────────

function parseValor(raw, unidad) {
  if (raw === null || raw === undefined || raw === '' || raw === '#N/A') return null;
  const s = String(raw).trim();
  if (s === '') return null;

  // Binario: TRUE/FALSE, Sí/No, SI/NO
  if (unidad === 'binario') {
    const up = s.toUpperCase();
    if (up === 'TRUE' || up === 'SI' || up === 'SÍ' || up === '1') return 1;
    if (up === 'FALSE' || up === 'NO' || up === '0') return 0;
    return null;
  }

  // Con símbolo %: proporción 0-1
  if (s.includes('%')) {
    const s2 = s.replace('%', '').replace(',', '.').trim();
    const n = parseFloat(s2);
    if (isNaN(n)) return null;
    return n > 1 ? n / 100 : n;
  }

  // Numérico
  const n = parseFloat(s.replace(',', '.'));
  if (isNaN(n)) return null;

  // Si es indicador de tipo % pero sin símbolo (ej: 0.85), asumimos proporción
  if (unidad === '%') return n <= 1 ? n : n / 100;

  return n;
}

// ─── Parseo principal: una hoja de indicadores ────────────────────────────
// Retorna { valores: [...], updatesEstablecimientos: [...], warnings: [...] }

export async function parsearHojaIndicadores(sheets, sheetId, hojaTitulo, planilla, establecimientos, indicadores, encontrarEstablecimientoFn) {
  const warnings = [];
  const valores = [];
  const updatesEstablecimientos = new Map(); // establecimientoId → { campos }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${hojaTitulo}!A1:AZ100`,  // ancho amplio
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) {
    warnings.push(`Hoja ${hojaTitulo}: sin datos`);
    return { valores, updatesEstablecimientos, warnings };
  }

  const headers = rows[0].map(h => String(h ?? '').trim());
  if (headers.length < 3) {
    warnings.push(`Hoja ${hojaTitulo}: headers insuficientes`);
    return { valores, updatesEstablecimientos, warnings };
  }

  // Detectar cuál columna trae el nombre del establecimiento (columna B típica)
  // Fallback: primera columna después de Comuna que no sea metadata.
  const idxEstablecimiento = headers.findIndex(h => {
    const n = normalizar(h);
    return n.includes('sala cuna') || n.includes('jardin infantil') ||
           n.includes('scji') || n.includes('establecimiento');
  });
  if (idxEstablecimiento < 0) {
    warnings.push(`Hoja ${hojaTitulo}: no se encontró columna de establecimiento`);
    return { valores, updatesEstablecimientos, warnings };
  }

  // Para cada columna, decidir si es indicador, metadata, o establecimiento-attr
  const mapping = headers.map((header, colIdx) => {
    if (colIdx === idxEstablecimiento) return { tipo: 'establecimiento-nombre' };
    const norm = normalizar(header);
    if (!norm) return { tipo: 'ignorar' };
    if (COLS_METADATA.has(norm)) return { tipo: 'metadata' };
    if (COLS_ESTABLECIMIENTO.has(norm)) {
      return { tipo: 'atributo-establecimiento', campo: COLS_ESTABLECIMIENTO.get(norm) };
    }
    const ind = encontrarIndicador(header, indicadores, planilla.programa);
    if (ind) return { tipo: 'indicador', indicador: ind, columnaOriginal: header };
    return { tipo: 'sin-match', header };
  });

  // Log de columnas sin match
  const sinMatch = mapping.filter(m => m.tipo === 'sin-match').map(m => m.header);
  if (sinMatch.length) {
    warnings.push(`Hoja ${hojaTitulo}: ${sinMatch.length} columnas sin match a indicador (${sinMatch.slice(0, 3).join(', ')}${sinMatch.length > 3 ? '…' : ''})`);
  }

  // Procesar cada fila de datos
  for (let filaIdx = 1; filaIdx < rows.length; filaIdx++) {
    const row = rows[filaIdx];
    if (!row.length) continue;

    const nombreEstablecimiento = row[idxEstablecimiento];
    if (!nombreEstablecimiento) continue;
    const est = encontrarEstablecimientoFn(nombreEstablecimiento, establecimientos, planilla.tipoEst);
    if (!est) {
      warnings.push(`Hoja ${hojaTitulo} fila ${filaIdx + 1}: sin match para "${nombreEstablecimiento}"`);
      continue;
    }

    // Iterar columnas
    for (let colIdx = 0; colIdx < mapping.length; colIdx++) {
      const m = mapping[colIdx];
      if (!m || m.tipo !== 'indicador' && m.tipo !== 'atributo-establecimiento') continue;
      const rawValue = row[colIdx];

      if (m.tipo === 'atributo-establecimiento') {
        const n = parseFloat(String(rawValue ?? '').replace(',', '.'));
        if (!isNaN(n)) {
          if (!updatesEstablecimientos.has(est.id)) updatesEstablecimientos.set(est.id, {});
          updatesEstablecimientos.get(est.id)[m.campo] = Math.round(n);
        }
        continue;
      }

      // Es un indicador
      const valor = parseValor(rawValue, m.indicador.unidad);
      if (valor === null) continue;

      const docId = `${est.id}_${m.indicador.id}_${planilla.anio}`;
      valores.push({
        docId,
        data: {
          establecimientoId: est.id,
          indicadorId: m.indicador.id,
          indicadorNombre: m.indicador.nombre,
          ambitoId: m.indicador.ambito,
          anio: planilla.anio,
          valor,
          unidad: m.indicador.unidad,
          programa: planilla.programa,
          fuenteSync: 'planilla-central',
          sheetId,
          hojaTitulo,
          columnaOriginal: m.columnaOriginal,
        },
      });
    }
  }

  return { valores, updatesEstablecimientos, warnings };
}
