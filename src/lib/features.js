// Feature flags controlados vía Vite env vars. Reiniciar el dev server para
// que los cambios tomen efecto.
//
// Activar: crear/editar `.env.local` (git-ignored) con:
//   VITE_FEATURE_HEATMAP=true
//
// El default (todo apagado) protege producción hasta que Focus valide cada
// experimento con Luis.

export const FEATURES = {
  heatmap: import.meta.env?.VITE_FEATURE_HEATMAP === 'true',
};
