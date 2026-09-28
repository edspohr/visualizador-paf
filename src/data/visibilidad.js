// Which indicators are shown or counted at the level of a single
// establishment, by program and profile. Decisions of 2026-09-27.

// D-01 (Luis, L-07): Parvulario territorial indicators (meetings of the SLEP
// with directoras and coordinadoras). They are not the jardín's own work, so
// they are left out of each jardín's % and its indicator grid in every
// profile, and stay in the sostenedor and program-level views.
const TERRITORIALES = {
  parvulario: new Set(['I.5', 'I.6', 'I.7', 'I.8']),
};

// D-02 (Sebastián, S-06): participation of the school's director and
// coordinator. Hidden from the escuela profile only; they still count in the
// school's % so it matches what sostenedor and consultores see.
const OCULTOS_POR_PERFIL = {
  escuela: new Set(['I.3', 'I.4', 'I.6', 'I.7', 'I.8', 'I.13', 'I.14', 'I.17', 'I.18']),
};

export function esTerritorial(ind) {
  return TERRITORIALES[ind?.programa]?.has(ind.id) ?? false;
}

/** Set of indicator ids hidden (not removed from the %) for a profile. */
export function ocultosParaPerfil(perfilId, programa) {
  if (programa !== 'escolar') return new Set();
  return OCULTOS_POR_PERFIL[perfilId] ?? new Set();
}
