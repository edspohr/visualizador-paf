// Display-layer normalizers for indicator/ámbito codes and ámbito name overrides.
// Do NOT re-key stored data — these formatters only affect what the UI renders.
// Firestore joins in `resultados_real` must keep matching the raw catalog ids.

// 'I1' → 'I.1'  ·  'I.1' → 'I.1'  ·  falsy → ''
export function indicadorCodigo(id) {
  if (!id) return '';
  const s = String(id);
  const m = s.match(/^I\.?(\d+)$/);
  return m ? `I.${m[1]}` : s;
}

// Accepts an ámbito object ({ id, codigo }) or a raw id string.
// 'A1' → 'A.1'  ·  'A.1' → 'A.1'
export function ambitoCodigo(a) {
  if (!a) return '';
  if (typeof a === 'object') {
    if (a.codigo) return ambitoCodigo(a.codigo);
    if (a.id) return ambitoCodigo(a.id);
    return '';
  }
  const s = String(a);
  const m = s.match(/^A\.?(\d+)$/);
  return m ? `A.${m[1]}` : s;
}

// Ámbito name overrides keyed as `${programa}:${ambitoId}`.
// Applied at display time so a catalog re-parse doesn't revert them.
const AMBITO_NAME_OVERRIDES = {
  'parvulario:A1': 'Liderazgo para la gestión institucional de la alianza familia-jardín',
};

// a: ámbito object with { id, nombre } (or nombre string + separate id)
// programa: 'escolar' | 'parvulario'
export function ambitoNombre(a, programa) {
  if (!a) return '';
  const id = typeof a === 'object' ? a.id : a;
  const nombre = typeof a === 'object' ? a.nombre : '';
  const key = `${programa}:${id}`;
  return AMBITO_NAME_OVERRIDES[key] ?? nombre;
}
