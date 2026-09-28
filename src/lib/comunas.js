// Canonical comuna names. Shared by the ingest scripts (scripts/ingest*.mjs)
// and the views, so a source that writes "PAC" or "SAN BERNARDO" does not
// show up as an extra comuna (S-08: Santa Rosa counted 6 comunas instead of 5).
//
// Pure module: no imports, safe to load from Node scripts and from Vite.

const CANONICAS = [
  'Cerrillos', 'El Bosque', 'Estación Central', 'La Cisterna', 'La Granja',
  'La Pintana', 'Lo Espejo', 'Maipú', 'Pedro Aguirre Cerda', 'Quinta Normal', 'San Bernardo',
  'San Joaquín', 'San Miguel', 'San Ramón', 'Santiago',
];

const ALIAS = {
  pac: 'Pedro Aguirre Cerda',
  'p. a. cerda': 'Pedro Aguirre Cerda',
  'p.a.c.': 'Pedro Aguirre Cerda',
};

const clave = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const POR_CLAVE = new Map(CANONICAS.map(c => [clave(c), c]));

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
function titulo(s) {
  return s.toLowerCase().split(' ')
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Canonical display name for a comuna, or null for empty input. */
export function comunaCanonica(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const k = clave(s);
  return ALIAS[k] ?? POR_CLAVE.get(k) ?? titulo(s);
}
